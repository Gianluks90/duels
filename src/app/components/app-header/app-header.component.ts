import { Component, ChangeDetectionStrategy, inject, computed, output } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { AuthService } from '../../services/auth.service';
import { BoardLayoutService } from '../../services/board-layout.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { RulebookDialogComponent } from '../../dialogs/rulebook/rulebook-dialog.component';
import { OptionsDialogComponent } from '../../dialogs/options/options-dialog.component';
import { GrimoireDialogComponent } from '../../dialogs/grimoire/grimoire-dialog.component';
import { ProfileDialogComponent } from '../../dialogs/profile/profile-dialog.component';
import { RedeemDialogComponent } from '../../dialogs/redeem/redeem-dialog.component';
import { FriendsDialogComponent } from '../../dialogs/friends/friends-dialog.component';
import { IconButtonComponent } from '../ui/icon-button/icon-button.component';
import { TooltipDirective } from '../ui/tooltip/tooltip.directive';
import { ActionMenuComponent, type ActionMenuItem } from '../ui/action-menu/action-menu.component';

/**
 * Header condiviso da Home/Collezione/Obiettivi (e in futuro altre pagine fuori da una partita) —
 * prima viveva solo dentro HomeComponent, estratto qui perché Collezione/Obiettivi ora lo mostrano
 * identico (navigazione continua, mai un "torna alla home" come unico modo per uscire da quelle
 * pagine). Grimorio/Regolamento/Opzioni non sono più bottoni nella barra in alto (troppe voci
 * cliccabili) — sono una colonna di icon-button fissa in basso a destra, stesso schema del
 * `board__toolbar` nella Fonte Arcana durante il duello (icona sola + tooltip, sempre visibile).
 * "Debug" resta fuori apposta: crea una partita nuova, è un'azione della Home (vicino a "Crea
 * partita"), non navigazione generica.
 */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ActionMenuComponent, IconButtonComponent, TooltipDirective],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly boardLayout = inject(BoardLayoutService);
  protected readonly i18n = inject(TranslationService);

  protected readonly profile = this.auth.profile;

  /** Riusa BoardLayoutService come HomeComponent già faceva — stessa soglia mobile/tablet vs
   * desktop in tutta l'app, non solo sulla Home. */
  protected readonly isCompact = computed(() => this.boardLayout.tier() !== 'desktop');

  protected readonly menuIcon = '/icons/menu_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly grimoireIcon = '/icons/book_2_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly rulebookIcon =
    '/icons/question_mark_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly gearIcon = '/icons/settings_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  /** Emesso quando la dialog Amici si chiude — HomeComponent la usa per ricaricare l'elenco duelli
   * pubblici (l'ordinamento "amici in cima" potrebbe essere cambiato). Le altre pagine che montano
   * questo header semplicemente non ci si iscrivono. */
  readonly friendsChanged = output<void>();

  protected readonly navMenuItems = computed<ActionMenuItem[]>(() => [
    { label: this.i18n.t('home.homeNav'), action: () => this.goHome() },
    { label: this.i18n.t('home.collection'), action: () => this.openCollection() },
    { label: this.i18n.t('home.objectives'), action: () => this.openObjectives() },
    { label: this.i18n.t('home.friends'), action: () => this.openFriends() },
  ]);

  protected readonly avatarMenuItems = computed<ActionMenuItem[]>(() => [
    { label: this.i18n.t('home.menu.myProfile'), action: () => this.openMyProfile() },
    { label: this.i18n.t('home.menu.profile'), action: () => this.openProfile() },
    { label: this.i18n.t('home.menu.redeemCode'), action: () => this.openRedeemDialog() },
    { label: this.i18n.t('home.menu.signOut'), action: () => this.signOut() },
  ]);

  protected goHome(): void {
    this.router.navigate(['/home']);
  }

  protected openCollection(): void {
    this.router.navigate(['/collection']);
  }

  protected openObjectives(): void {
    this.router.navigate(['/objectives']);
  }

  /** Il proprio profilo pubblico (Achievements) — distinto da openProfile() sotto, che apre invece
   * la dialog di MODIFICA (nome/foto/dorso/...). Questa è la stessa pagina che vedrebbe un amico. */
  protected openMyProfile(): void {
    const uid = this.auth.user()?.uid;
    if (uid) this.router.navigate(['/profile', uid]);
  }

  protected openGrimoire(): void {
    this.dialog.open(GrimoireDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openRulebook(): void {
    this.dialog.open(RulebookDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openOptions(): void {
    this.dialog.open(OptionsDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openProfile(): void {
    this.dialog.open(ProfileDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openRedeemDialog(): void {
    this.dialog.open(RedeemDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
  }

  protected openFriends(): void {
    const ref = this.dialog.open(FriendsDialogComponent, {
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      panelClass: 'dialog-panel',
    });
    ref.closed.subscribe(() => this.friendsChanged.emit());
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}
