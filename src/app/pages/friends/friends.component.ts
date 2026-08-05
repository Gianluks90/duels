import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FriendsService, type FriendRequest } from '../../services/friends.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import type { UserProfile } from '../../models/user.model';

interface FriendRow {
  request: FriendRequest;
  uid: string;
  profile: UserProfile | null;
}

/**
 * Pagina Amici (Achievements): stessa struttura a due colonne di CollectionComponent/
 * ObjectivesComponent (header con bordo sotto + corpo diviso da un bordo verticale) invece della
 * vecchia FriendsDialogComponent (CDK Dialog) — sostituita interamente da questa route, non più
 * raggiungibile: AppHeaderComponent.openFriends() ora naviga qui. Colonna sinistra: identico
 * contenuto della vecchia dialog TRANNE l'elenco amici (link/codice, aggiungi amico, richieste
 * ricevute/inviate) — v. FriendsService per tutta la logica di dominio, invariata. Colonna destra:
 * l'elenco amici, ora una griglia di card (non più righe espandibili con le magie preferite —
 * quel dettaglio resta comunque visibile aprendo il profilo pubblico dell'amico, un click via).
 */
@Component({
  selector: 'app-friends',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe, AppHeaderComponent, IconButtonComponent],
  templateUrl: './friends.component.html',
  styleUrl: './friends.component.scss',
})
export class FriendsComponent {
  private readonly auth = inject(AuthService);
  private readonly friendsService = inject(FriendsService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(TranslationService);

  protected readonly removeIcon = '/icons/person_remove_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

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
   * bottone di QUELLA riga/card invece di bloccare l'intera pagina per un'azione singola. */
  protected readonly busyRequestId = signal<string | null>(null);

  constructor() {
    void this.refresh();
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
          return { request, uid: friendUid, profile };
        }),
      );
      this.friends.set(rows);
      // Achievements "Duellante socievole"/"Duellante amichevole" — il conteggio è comunque già
      // qui per disegnare la griglia, nessun giro di rete in più (v. AuthService.syncFriendsCount).
      void this.auth.syncFriendsCount(rows.length);
    } finally {
      this.loading.set(false);
    }
  }

  /** Titolo equipaggiato dall'amico (v. ProfileComponent.displayTitle, stessa risoluzione variant-id
   * → testo) — `null` se non ne ha ancora sbloccato/equipaggiato uno, la card mostra solo il nome. */
  protected friendTitle(row: FriendRow): string | null {
    const titleId = row.profile?.title;
    return titleId ? this.i18n.titleLabel(titleId) : null;
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

  /** Profilo pubblico (Achievements) di un amico. */
  protected viewProfile(uid: string): void {
    this.router.navigate(['/profile', uid]);
  }
}
