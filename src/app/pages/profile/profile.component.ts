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
import { ObjectiveCardComponent } from '../../components/objective-card/objective-card.component';
import { OBJECTIVE_CATALOG } from '../../data/objectives';
import { SPELL_CATALOG } from '../../data/spells';
import { buildObjectiveProgress, buildProgressSource } from '../../game/achievements';
import {
  COLLECTION_CATEGORY_ORDER,
  collectionCompletionPercent,
  collectionProgress,
} from '../../game/collection-progress';
import { EMPTY_USER_STATS, type UserProfile, type UserStats } from '../../models/user.model';

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
  imports: [
    TranslatePipe,
    AppHeaderComponent,
    IconButtonComponent,
    TooltipDirective,
    ObjectiveCardComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  /** Ogni metrica scalare di UserStats attualmente tracciata per gli Achievements (esclude le mappe
   * libere spellCastCounts/elementsObtained/cardPatternMatches, non un singolo valore) — stesso
   * elenco di campi coperti da ObjectiveMetric (v. objective.model.ts), riusa le etichette già
   * tradotte in `objectives.metricLabels.*` (ObjectiveCardComponent non le legge più, ma restano nei
   * dizionari apposta per questo). */
  private static readonly STAT_FIELDS: readonly (keyof UserStats)[] = [
    'gamesPlayed',
    'wins',
    'losses',
    'cardsCollected',
    'combinationsMade',
    'spellsCast',
    'damageDealt',
    'healingDone',
    'currentWinStreak',
    'friendDuelsPlayed',
    'friendDuelWins',
    'shieldsGained',
    'shieldsRemoved',
    'freezeApplied',
    'poisonApplied',
    'manaConsumed',
  ];

  private readonly auth = inject(AuthService);
  private readonly friendsService = inject(FriendsService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  protected readonly i18n = inject(TranslationService);

  protected readonly gearIcon = '/icons/settings_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  protected readonly addFriendIcon = '/icons/person_add_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  /** Mascherata e tinta oro in CSS (stesso schema di IconButtonComponent.icon-btn__icon, v.
   * profile.component.scss) invece che un `<img>` — l'SVG sorgente è grigio chiaro fisso
   * (E3E3E3), qui deve invece comparire dello stesso colore del testo accanto. */
  protected readonly friendsIcon = '/icons/group_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.svg';

  private readonly viewedUid = signal('');
  private readonly fetchedProfile = signal<UserProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  /** Feedback temporaneo sul bottone "Aggiungi amico" — stesso schema di FriendsDialogComponent.linkCopied
   * (si azzera da solo dopo 2s), niente stato di errore dedicato: chi arriva su questa pagina è già
   * amico nella stragrande maggioranza dei casi (v. isFriend() in firestore.rules, unica via oggi per
   * raggiungere il profilo di qualcun altro), quindi un eventuale errore Firestore è la stessa
   * eccezione rara silenziosamente ignorata di un doppio click. */
  protected readonly friendRequestSent = signal(false);

  protected readonly isSelf = computed(() => this.viewedUid() === this.auth.user()?.uid);
  protected readonly profile = computed(() =>
    this.isSelf() ? this.auth.profile() : this.fetchedProfile(),
  );
  protected readonly stats = computed(() => this.profile()?.stats ?? EMPTY_USER_STATS);
  protected readonly statFields = ProfileComponent.STAT_FIELDS;
  protected readonly favoriteSpellIds = computed(() => this.profile()?.favoriteSpellIds ?? []);
  /** Sincronizzato da FriendsDialogComponent ogni volta che carica la lista amici per intero (v.
   * AuthService.syncFriendsCount) — nessuna chiamata di rete in più qui, solo il valore già
   * denormalizzato sul profilo (proprio o di un amico, entrambi leggibili da questa pagina). */
  protected readonly friendsCount = computed(() => this.profile()?.friendsCount ?? 0);

  /** Stesso calcolo di ObjectivesComponent.objectivesProgress, sul profilo VISUALIZZATO (non
   * necessariamente auth.profile()) — buildProgressSource/buildObjectiveProgress accettano già
   * qualunque UserProfile/UserStats, non solo quello dell'utente loggato. */
  private readonly objectivesProgress = computed(() => {
    const p = this.profile();
    return buildObjectiveProgress(
      OBJECTIVE_CATALOG,
      buildProgressSource(p?.stats, p ?? undefined),
      p?.claimedObjectiveIds,
    );
  });
  /** Stessa formula di ObjectivesComponent.completionPercent — "completato" (progress >= soglia),
   * non "riscattato". */
  protected readonly objectivesCompletionPercent = computed(() => {
    const all = this.objectivesProgress();
    if (all.length === 0) return 0;
    const completed = all.filter((item) => item.progress >= item.objective.threshold).length;
    return Math.round((completed / all.length) * 100);
  });
  /** Ultimi 4 obiettivi COMPLETATI, più recente prima — `completedObjectiveIds` cresce per
   * append (v. AuthService.applyGameStats/claimObjective/..., sempre `[...precedenti, ...nuovi]`),
   * quindi l'ordine dell'array è già cronologico: bastano gli ultimi 4 elementi, invertiti. */
  protected readonly recentObjectives = computed(() => {
    const recentIds = (this.profile()?.completedObjectiveIds ?? []).slice(-4).reverse();
    const progress = this.objectivesProgress();
    return recentIds
      .map((id) => progress.find((item) => item.objective.id === id))
      .filter((item) => item !== undefined);
  });

  /** % di completamento Collezione (dorsi/sfondi/titoli/arte v1) del profilo VISUALIZZATO — stessa
   * idea di objectivesCompletionPercent sopra, calcolo estratto in game/collection-progress.ts
   * perché CollectionComponent.completionPercent dipende da i18n/BackgroundService (serve solo per
   * disegnare i tile) che qui non servono. */
  protected readonly collectionCompletionPercent = computed(() =>
    collectionCompletionPercent(this.profile()),
  );

  /** Owned/totale per ciascuna categoria di Collezione, nello stesso ordine delle tab di
   * CollectionComponent — mostrato come la sezione "Statistiche" sotto (stesso `dl`/`dt`/`dd`), con
   * "owned/totale" al posto di un singolo numero (v. template, `collection.<key>` per l'etichetta,
   * le stesse stringhe già usate per le tab di CollectionComponent). */
  protected readonly collectionBreakdown = computed(() => {
    const progress = collectionProgress(this.profile());
    return COLLECTION_CATEGORY_ORDER.map((key) => ({ key, ...progress[key] }));
  });
  /** Il titolo da mostrare — risolto in testo (v. TranslationService.titleLabel, `p.title` è una
   * variant-id, non testo già pronto). Chi può EQUIPAGGIARE un titolo esclusivo (v. TITLE_CATALOG,
   * es. "Primo duellante") è ristretto altrove (firestore.rules, CollectionComponent) — una volta
   * equipaggiato resta visibile normalmente a chiunque possa vedere questo profilo, nessuna
   * restrizione qui. */
  protected readonly displayTitle = computed(() => {
    const titleId = this.profile()?.title;
    return titleId ? this.i18n.titleLabel(titleId) : null;
  });
  /** Dorso equipaggiato — stesso schema di CardComponent.backSrc (`/cards-back/${skin}.webp`). */
  protected readonly cardBackSrc = computed(
    () => `/cards-back/${this.profile()?.cardBack ?? 'dark'}.webp`,
  );

  /** Arte carta di un incantesimo preferito — stesso path di GrimoireDialogComponent.illustrationSrc. */
  protected spellImageSrc(spellId: string): string {
    return `/cards-spell/${spellId}.webp`;
  }

  protected spellName(spellId: string): string {
    return this.i18n.t(`spells.${spellId}.name`);
  }

  /** null se il dizionario non ha una voce flavorText per questo incantesimo — stesso schema di
   * BoardComponent.spellFlavor. */
  protected spellFlavor(spellId: string): string | null {
    const key = `spells.${spellId}.flavorText`;
    const text = this.i18n.t(key);
    return text === key ? null : text;
  }

  /** Stessa formattazione "ridotta" (non quella completa del Grimorio) di BoardComponent.
   * spellEffectSummary, adattata a un id invece che a una Card intera — le carte preferite qui non
   * sono mai carte di gioco vere, solo un id. Riusa le stesse chiavi `grimoire.effects.*`. */
  protected spellEffectSummary(spellId: string): string {
    const spell = SPELL_CATALOG.find((s) => s.id === spellId);
    if (!spell) return '';
    return spell.effects
      .map((e) => {
        const amount = e.amount ?? 1;
        switch (e.type) {
          case 'damage':
            return spell.element
              ? this.i18n.t('grimoire.effects.damageElement', {
                  amount,
                  element: this.i18n.elementLabel(spell.element),
                })
              : this.i18n.t('grimoire.effects.damage', { amount });
          case 'damage_ignore_shields':
            return this.i18n.t('grimoire.effects.damageIgnoreShields', { amount });
          case 'damage_self':
            return spell.element
              ? this.i18n.t('grimoire.effects.damageSelfElement', {
                  amount,
                  element: this.i18n.elementLabel(spell.element),
                })
              : this.i18n.t('grimoire.effects.damageSelf', { amount });
          case 'damage_halve_opponent':
            return this.i18n.t('grimoire.effects.damageHalveOpponent');
          case 'damage_from_fonte':
            return this.i18n.t('grimoire.effects.damageFromFonte');
          case 'heal':
            return this.i18n.t('grimoire.effects.heal', { amount });
          case 'shield_add':
            return this.i18n.t('grimoire.effects.shieldAdd', { amount });
          case 'shield_remove_opponent':
            return e.amount !== undefined
              ? this.i18n.t('grimoire.effects.shieldRemoveOpponent', { amount: e.amount })
              : this.i18n.t('grimoire.effects.shieldRemoveOpponentAll');
          case 'poison_add':
            return this.i18n.t('grimoire.effects.poisonAdd', { amount });
          case 'ice_add':
            return this.i18n.t('grimoire.effects.iceAdd', { amount });
          case 'poison_clear_self':
            return this.i18n.t('grimoire.effects.poisonClearSelf');
          case 'ice_clear_self':
            return this.i18n.t('grimoire.effects.iceClearSelf');
          case 'opponent_discard_random':
            return this.i18n.t('grimoire.effects.opponentDiscardRandom', { amount });
          case 'opponent_discard_hand':
            return this.i18n.t('grimoire.effects.opponentDiscardHand');
          case 'reveal_opponent_hand':
            if (e.cardTierFilter === 'spell') {
              return e.amount !== undefined
                ? this.i18n.t('grimoire.effects.revealOpponentHandRandomSpell', {
                    amount: e.amount,
                  })
                : this.i18n.t('grimoire.effects.revealOpponentHandSpell');
            }
            return e.amount !== undefined
              ? this.i18n.t('grimoire.effects.revealOpponentHandRandom', { amount: e.amount })
              : this.i18n.t('grimoire.effects.revealOpponentHand');
          case 'fonte_reset':
            return this.i18n.t('grimoire.effects.fonteReset');
          case 'boost_card_mana':
            return this.i18n.t('grimoire.effects.boostCardMana', { amount });
          case 'consume_discards':
            return e.consumableCardTiers?.includes('spell')
              ? this.i18n.t('grimoire.effects.consumeDiscardsExtended', { amount })
              : this.i18n.t('grimoire.effects.consumeDiscards', { amount });
          default:
            return e.type;
        }
      })
      .join(' ');
  }

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

  /** Solo per un profilo altrui (v. isSelf sopra) — manda una richiesta di amicizia diretta, stesso
   * FriendsService.sendRequest() di FriendsDialogComponent. */
  protected async addFriend(): Promise<void> {
    const myProfile = this.auth.profile();
    const uid = this.viewedUid();
    if (!myProfile || !uid) return;

    try {
      await this.friendsService.sendRequest(myProfile, uid);
      this.friendRequestSent.set(true);
      setTimeout(() => this.friendRequestSent.set(false), 2000);
    } catch {
      // v. commento su friendRequestSent sopra — nessuno stato di errore dedicato.
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
