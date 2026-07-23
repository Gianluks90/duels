import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../services/auth.service';
import { FriendsService, type FriendRequest } from '../../services/friends.service';
import { TranslationService } from '../../services/translation.service';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { SPELL_CATALOG } from '../../data/spells';
import type { UserProfile } from '../../models/user.model';

interface FriendRow {
  request: FriendRequest;
  uid: string;
  profile: UserProfile | null;
  expanded: boolean;
}

@Component({
  selector: 'app-friends-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './friends-dialog.component.html',
  styleUrl: './friends-dialog.component.scss',
})
export class FriendsDialogComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly auth = inject(AuthService);
  private readonly friendsService = inject(FriendsService);
  protected readonly i18n = inject(TranslationService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  protected readonly myUid = computed(() => this.auth.user()?.uid ?? '');
  /** Stesso dominio della room code (home.component.ts, copyCode) — un link che, aperto già loggati,
   * home.component.ts intercetta via query param 'friend' e usa per innescare sendRequest(). */
  protected readonly myLink = computed(() =>
    this.myUid() ? `${location.origin}/home?friend=${this.myUid()}` : '',
  );

  protected readonly linkCopied = signal(false);

  protected readonly addValue = signal('');
  protected readonly addSending = signal(false);
  protected readonly addError = signal<string | null>(null);
  protected readonly addSuccess = signal(false);

  protected readonly loading = signal(true);
  protected readonly incoming = signal<readonly FriendRequest[]>([]);
  protected readonly outgoing = signal<readonly FriendRequest[]>([]);
  protected readonly friends = signal<readonly FriendRow[]>([]);

  /** gameId... ehm, requestId per cui è in corso un accept/decline/resend/remove — disabilita solo il
   * bottone di QUELLA riga invece di bloccare l'intera dialog per un'azione singola. */
  protected readonly busyRequestId = signal<string | null>(null);

  constructor() {
    void this.refresh();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private async refresh(): Promise<void> {
    const uid = this.myUid();
    if (!uid) return;

    this.loading.set(true);
    try {
      const [incoming, outgoing, friendRequests] = await Promise.all([
        this.friendsService.listIncoming(uid),
        this.friendsService.listOutgoing(uid),
        this.friendsService.listFriends(uid),
      ]);
      this.incoming.set(incoming);
      this.outgoing.set(outgoing);

      // A questa scala (amici nell'ordine delle decine) N getDoc singoli senza batching sono
      // accettabili — niente indice/collection group dedicato solo per questo.
      const rows = await Promise.all(
        friendRequests.map(async (request): Promise<FriendRow> => {
          const friendUid = this.friendsService.otherUid(request, uid);
          const profile = await this.friendsService.getFriendProfile(friendUid);
          return { request, uid: friendUid, profile, expanded: false };
        }),
      );
      this.friends.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  protected async copyLink(): Promise<void> {
    await navigator.clipboard.writeText(this.myLink());
    this.linkCopied.set(true);
    setTimeout(() => this.linkCopied.set(false), 2000);
  }

  protected setAddValue(value: string): void {
    this.addValue.set(value);
    this.addError.set(null);
    this.addSuccess.set(false);
  }

  protected async sendRequest(): Promise<void> {
    const profile = this.auth.profile();
    const target = this.extractUid(this.addValue());
    if (!profile || !target) return;

    this.addSending.set(true);
    this.addError.set(null);
    this.addSuccess.set(false);
    try {
      await this.friendsService.sendRequest(profile, target);
      this.addValue.set('');
      this.addSuccess.set(true);
      await this.refresh();
    } catch (err) {
      this.addError.set(this.addErrorMessage(err));
    } finally {
      this.addSending.set(false);
    }
  }

  /** Accetta sia un uid incollato grezzo sia un link "...?friend=<uid>" incollato per intero. */
  private extractUid(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      const url = new URL(trimmed);
      return url.searchParams.get('friend')?.trim() || null;
    } catch {
      return trimmed;
    }
  }

  /** FriendsService/le regole Firestore lanciano error code stabili — tradotti qui, come
   * home.component.ts joinErrorMessage() fa per gli errori di join partita. */
  private addErrorMessage(err: unknown): string {
    const code = err instanceof Error ? err.message : '';
    const key = `friends.add.errors.${code}`;
    const translated = this.i18n.t(key);
    return translated === key ? this.i18n.t('friends.add.unknownError') : translated;
  }

  protected async respond(request: FriendRequest, accept: boolean): Promise<void> {
    this.busyRequestId.set(request.id);
    try {
      await this.friendsService.respondToRequest(request.id, accept);
      await this.refresh();
    } finally {
      this.busyRequestId.set(null);
    }
  }

  protected async resend(request: FriendRequest): Promise<void> {
    this.busyRequestId.set(request.id);
    try {
      await this.friendsService.resendRequest(request.id);
      await this.refresh();
    } finally {
      this.busyRequestId.set(null);
    }
  }

  protected async removeRequest(requestId: string): Promise<void> {
    this.busyRequestId.set(requestId);
    try {
      await this.friendsService.unfriend(requestId);
      await this.refresh();
    } finally {
      this.busyRequestId.set(null);
    }
  }

  protected toggleExpanded(row: FriendRow): void {
    this.friends.update((rows) =>
      rows.map((r) => (r === row ? { ...r, expanded: !r.expanded } : r)),
    );
  }

  protected friendSpellNames(row: FriendRow): string[] {
    const ids = row.profile?.favoriteSpellIds ?? [];
    return ids
      .map((id) => SPELL_CATALOG.find((s) => s.id === id))
      .filter((s): s is (typeof SPELL_CATALOG)[number] => !!s)
      .map((s) => this.i18n.t(`spells.${s.id}.name`));
  }
}
