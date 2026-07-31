import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { AuthService } from '../../services/auth.service';
import { FriendsService } from '../../services/friends.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TooltipDirective } from '../../components/ui/tooltip/tooltip.directive';
import { ProfileDialogComponent } from '../../dialogs/profile/profile-dialog.component';
import { EMPTY_USER_STATS, type UserProfile } from '../../models/user.model';

/**
 * Profilo pubblico (Achievements) — raggiungibile dalla lista amici o dal proprio menu, mostra
 * titolo/stats riassuntivi. Legge `users/{uid}` direttamente: la regola Firestore (isFriend/self)
 * decide chi può vederlo, non questo componente — un fallimento di lettura (non amico, uid
 * inesistente) diventa lo stato `notFound`, senza distinguere i due casi (evita di far scoprire
 * "questo uid esiste ma non siete amici" a chi indovina un uid a caso).
 */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe, AppHeaderComponent, IconButtonComponent, TooltipDirective],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly friendsService = inject(FriendsService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  protected readonly i18n = inject(TranslationService);

  protected readonly gearIcon = '/icons/settings_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  private readonly viewedUid = signal('');
  private readonly fetchedProfile = signal<UserProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);

  protected readonly isSelf = computed(() => this.viewedUid() === this.auth.user()?.uid);
  protected readonly profile = computed(() =>
    this.isSelf() ? this.auth.profile() : this.fetchedProfile(),
  );
  protected readonly stats = computed(() => this.profile()?.stats ?? EMPTY_USER_STATS);
  /** Il titolo da mostrare — risolto in testo (v. TranslationService.titleLabel, `p.title` è una
   * variant-id, non testo già pronto). Chi può EQUIPAGGIARE un titolo esclusivo (v. TITLE_CATALOG,
   * es. "Primo duellante") è ristretto altrove (firestore.rules, CollectionComponent) — una volta
   * equipaggiato resta visibile normalmente a chiunque possa vedere questo profilo, nessuna
   * restrizione qui. */
  protected readonly displayTitle = computed(() => {
    const titleId = this.profile()?.title;
    return titleId ? this.i18n.titleLabel(titleId) : null;
  });

  async ngOnInit(): Promise<void> {
    const uid = this.route.snapshot.paramMap.get('uid') ?? '';
    this.viewedUid.set(uid);

    if (uid === this.auth.user()?.uid) {
      this.loading.set(false);
      return;
    }

    try {
      const fetched = await this.friendsService.getFriendProfile(uid);
      if (!fetched) {
        this.notFound.set(true);
      } else {
        this.fetchedProfile.set(fetched);
      }
    } catch {
      // Regola Firestore che nega (non amico) — stesso stato di "non trovato", v. commento sopra.
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Solo per il proprietario (v. isSelf sopra) — la dialog di MODIFICA (nome/foto/dorso/...), non
   * più raggiungibile dal menu dell'header (spostata qui: ha senso solo guardando il proprio
   * profilo, non quello di un amico). */
  protected openSettings(): void {
    this.dialog.open(ProfileDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }
}
