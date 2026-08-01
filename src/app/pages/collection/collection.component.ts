import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { BackgroundService } from '../../services/background.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import {
  CollectionTileComponent,
  type CollectionItem,
} from '../../components/collection-tile/collection-tile.component';
import { OBJECTIVE_CATALOG } from '../../data/objectives';
import { CARD_BACK_CATALOG } from '../../data/card-backs';
import { BACKGROUND_CATALOG } from '../../data/backgrounds';
import {
  TITLE_CATALOG,
  titleBaseId,
  titleRewardVariantIds,
  type TitleDefinition,
} from '../../data/titles';
import { COLLECTIBLE_ELEMENT_IDS } from '../../data/elements';
import { SPELL_CATALOG } from '../../data/spells';
import { DEFAULT_BACKGROUND_ID } from '../../models/user.model';
import { elementImagePath } from '../../models/element.model';
import type { RewardUnlock } from '../../models/reward-unlock.model';
import type { Objective } from '../../models/objective.model';

type CollectionCategory = 'cardBacks' | 'backgrounds' | 'titles' | 'elements' | 'mana' | 'spells';

/**
 * Collezione (Achievements): dorsi/sfondi/titoli in un'unica griglia per categoria, in ordine
 * alfabetico per id — posseduti (arte reale) e ancora da sbloccare (lucchetto dorato, stessa
 * dimensione che avrebbero da posseduti) mescolati insieme, non due sezioni separate: il giocatore
 * deve vedere subito quanti slot esistono in totale. Le scelte vere e proprie (equip) sono qui
 * stesso, in "modalità personalizzazione" (v. editMode sotto) — non più nella dialog profilo, che
 * resta solo identità + zona pericolosa (ProfileDialogComponent). Stesso AppHeaderComponent di
 * Home/Obiettivi per la navigazione continua.
 */
@Component({
  selector: 'app-collection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe, AppHeaderComponent, CollectionTileComponent],
  templateUrl: './collection.component.html',
  styleUrl: './collection.component.scss',
})
export class CollectionComponent {
  private readonly auth = inject(AuthService);
  private readonly backgroundService = inject(BackgroundService);
  private readonly i18n = inject(TranslationService);

  /** Incantesimi lanciati per sbloccare l'arte v1 di un incantesimo (v. spellItems sotto) — soglia
   * fissa uguale per tutti, non (ancora) per-incantesimo come i reward di OBJECTIVE_CATALOG. */
  private static readonly SPELL_LEGACY_UNLOCK_COUNT = 10;

  protected readonly categories: readonly { id: CollectionCategory; labelKey: string }[] = [
    { id: 'cardBacks', labelKey: 'collection.cardBacks' },
    { id: 'backgrounds', labelKey: 'collection.backgrounds' },
    { id: 'titles', labelKey: 'collection.titles' },
    { id: 'elements', labelKey: 'collection.elements' },
    { id: 'mana', labelKey: 'collection.mana' },
    { id: 'spells', labelKey: 'collection.spells' },
  ];

  protected readonly selectedCategory = signal<CollectionCategory>('cardBacks');

  protected selectCategory(category: CollectionCategory): void {
    this.selectedCategory.set(category);
  }

  /**
   * Modalità personalizzazione (dorso/sfondo, un radio per categoria mostrato sui tile — v.
   * CollectionTileComponent.selectable/selected) — sostituisce i vecchi
   * CardBackPickerComponent/BackgroundPickerComponent nella dialog profilo: qui i tile ESISTONO
   * già in griglia, niente select separate da costruire (e in futuro elementi/incantesimi, quando
   * avranno un vero meccanismo di equip — troppi per un select). Il titolo NON è qui: resta un
   * select in ProfileDialogComponent, insieme a nome/foto (identità dell'account, non un
   * "collezionabile" da sfogliare come dorsi/sfondi) — il tab "Titoli" si disabilita mentre si è in
   * modalità personalizzazione (v. template) proprio perché qui non c'è nulla da impostare per quella
   * categoria. Le due selezioni pendenti si applicano insieme con un solo `updateProfile()` ad
   * "Applica" — "Annulla" (o un refresh, stesso identico effetto) le scarta senza chiedere conferma,
   * nessuna guardia su modifiche non salvate: stesso comportamento già accettato dei picker che
   * sostituisce.
   */
  protected readonly editMode = signal(false);
  protected readonly pendingCardBack = signal('dark');
  protected readonly pendingBackground = signal(DEFAULT_BACKGROUND_ID);

  /** Dorso/sfondo REALMENTE equipaggiati in questo momento (non la selezione pendente) — usati per
   * il badge "Attivo" (v. CollectionTileComponent.selected) quando NON si è in modalità
   * personalizzazione, così si vede sempre cosa si sta usando senza dover aprire la modifica. */
  protected readonly equippedCardBack = computed(() => this.auth.profile()?.cardBack ?? 'dark');
  protected readonly equippedBackground = computed(
    () => this.auth.profile()?.background ?? DEFAULT_BACKGROUND_ID,
  );

  /** Id BASE del titolo equipaggiato in questo momento (v. titleBaseId, risale da una delle
   * variant-id di genere a `TitleDefinition.id`) — usato per il badge "Attivo" sul tile, stesso
   * ruolo di equippedCardBack/equippedBackground sopra ma senza modalità personalizzazione (i
   * titoli restano un select in ProfileDialogComponent, v. titleItem sotto). */
  protected readonly equippedTitleBaseId = computed(() => {
    const title = this.auth.profile()?.title;
    return title ? titleBaseId(title) : null;
  });

  protected startPersonalizing(): void {
    const profile = this.auth.profile();
    this.pendingCardBack.set(profile?.cardBack ?? 'dark');
    this.pendingBackground.set(profile?.background ?? DEFAULT_BACKGROUND_ID);
    // Il tab Titoli si disabilita in modalità personalizzazione (v. template) — se ci si era sopra,
    // se ne esce, altrimenti resterebbe un tab attivo ma non raggiungibile via click.
    if (this.selectedCategory() === 'titles') this.selectedCategory.set(this.categories[0].id);
    this.editMode.set(true);
  }

  protected cancelPersonalizing(): void {
    this.editMode.set(false);
  }

  protected async applyPersonalizing(): Promise<void> {
    await this.auth.updateProfile({
      cardBack: this.pendingCardBack(),
      background: this.pendingBackground(),
    });
    this.editMode.set(false);
  }

  protected selectCardBack(id: string): void {
    this.pendingCardBack.set(id);
  }

  protected selectBackground(id: string): void {
    this.pendingBackground.set(id);
  }

  /** Dorsi carta: guidati da CARD_BACK_CATALOG (arte reale per tutti, v. data/card-backs.ts) —
   * a differenza dei titoli sotto, dorsi e sfondi hanno già contenuto vero, non più placeholder. */
  protected readonly cardBackItems = computed<CollectionItem[]>(() => {
    const ownedIds = new Set(this.auth.profile()?.unlockedCardBacks ?? []);
    const catalogIds = new Set(CARD_BACK_CATALOG.map((def) => def.id));

    const catalogItems = CARD_BACK_CATALOG.map((def) =>
      this.catalogItem(
        def.id,
        `/cards-back/${def.id}.webp`,
        'cardBackCatalog',
        def.unlock,
        ownedIds,
      ),
    );

    // Fallback difensivo: un dorso posseduto ma non ancora documentato in CARD_BACK_CATALOG (skin
    // futura non ancora aggiunta lì) — non dovrebbe succedere in pratica, ma non lo si nasconde.
    const extraItems = [...ownedIds]
      .filter((id) => !catalogIds.has(id))
      .map((id) =>
        this.realItem(
          id,
          `/cards-back/${id}.webp`,
          `profile.cardBack.options.${id}`,
          'unlockedViaCode',
        ),
      );

    return this.sortById([...catalogItems, ...extraItems]);
  });

  /** Sfondi: guidati da BACKGROUND_CATALOG — stesso schema dei dorsi sopra (arte reale in
   * public/images/backgrounds/<id>.webp, v. data/backgrounds.ts). */
  protected readonly backgroundItems = computed<CollectionItem[]>(() => {
    const ownedIds = new Set(this.auth.profile()?.unlockedBackgrounds ?? []);
    return this.sortById(
      BACKGROUND_CATALOG.map((def) => {
        const option = this.backgroundService.options().find((o) => o.id === def.id);
        return this.catalogItem(
          def.id,
          option?.file ?? null,
          'backgroundCatalog',
          def.unlock,
          ownedIds,
        );
      }),
    );
  });

  /** Titoli: guidati da TITLE_CATALOG (mirror di CARD_BACK_CATALOG/BACKGROUND_CATALOG) — alcuni
   * ormai gratuiti fin da subito (`unlock.kind === 'free'`), gli altri legati a un obiettivo. I
   * titoli `exclusive` (v. modello) a un uid diverso dal proprio sono esclusi del tutto dalla
   * griglia, non solo mostrati bloccati — a differenza di ogni altro titolo, nessuno slot "da
   * sbloccare" da vedere per chi non potrà mai ottenerlo. */
  protected readonly titleItems = computed<CollectionItem[]>(() => {
    const myUid = this.auth.user()?.uid;
    const ownedIds = new Set(this.auth.profile()?.unlockedTitles ?? []);
    const visibleCatalog = TITLE_CATALOG.filter(
      (def) => def.unlock.kind !== 'exclusive' || def.unlock.uid === myUid,
    );
    return this.sortById(visibleCatalog.map((def) => this.titleItem(def, ownedIds)));
  });

  /** Elementi: a differenza di dorsi/sfondi/titoli, l'arte NUOVA è sempre posseduta (è quella già in
   * uso in ogni partita, v. COLLECTIBLE_ELEMENT_IDS) — accanto, in griglia, la sua arte v1
   * originale, sbloccata da `unlockedElementVariants` (Achievements "Variante 'Elemento X'", un
   * obiettivo `variant_<id>` per elemento in OBJECTIVE_CATALOG — stesso schema di
   * catalogItem/unlockInfoFor sotto, già usato per dorsi/sfondi). Nessuna coppia esplicita: id
   * (`fire`) e id_v1 (`fire_v1`) finiscono comunque adiacenti nell'ordine alfabetico di sortById,
   * come per ogni altra categoria della pagina. */
  protected readonly elementItems = computed<CollectionItem[]>(() => {
    const ownedIds = new Set(this.auth.profile()?.unlockedElementVariants ?? []);
    return this.sortById(
      COLLECTIBLE_ELEMENT_IDS.flatMap((id) => {
        const name = this.i18n.t(`common.elements.${id}`);
        const current: CollectionItem = {
          id,
          imageUrl: elementImagePath(id),
          owned: true,
          name,
          description: this.i18n.t('collection.elementCatalog.currentDescription'),
          unlockInfo: this.i18n.t('collection.alwaysAvailable'),
        };
        const owned = ownedIds.has(id);
        const objective = OBJECTIVE_CATALOG.find((o) => o.id === `variant_${id}`);
        const legacy: CollectionItem = {
          id: `${id}_v1`,
          imageUrl: `/cards/v1/${id}.webp`,
          owned,
          name: this.i18n.t('collection.legacyLabel', { name }),
          description: this.i18n.t('collection.elementCatalog.legacyDescription'),
          unlockInfo: objective
            ? this.unlockInfoFor(objective, owned)
            : this.i18n.t('collection.descriptionPending'),
        };
        return [current, legacy];
      }),
    );
  });

  /** Mana: stesso schema di elementItems sopra (arte v1 sbloccata da `unlockedElementVariants`,
   * stesso reward type `elementVariant`) ma un solo pseudo-elemento invece di 11 — 'mana' non è un
   * `CollectibleElement` (v. element.model.ts, resta fuori da COLLECTIBLE_ELEMENT_IDS/elementItems),
   * quindi una categoria a parte invece di un dodicesimo `flatMap` sopra: l'obiettivo che sblocca la
   * variante (`mana_200`) si basa su `manaConsumed`, non su `elementsObtained`, un contatore
   * concettualmente diverso (mana SPESO lanciando, non OTTENUTO raccogliendo/combinando). */
  protected readonly manaItems = computed<CollectionItem[]>(() => {
    const owned = (this.auth.profile()?.unlockedElementVariants ?? []).includes('mana');
    const name = this.i18n.t('common.elements.mana');
    const objective = OBJECTIVE_CATALOG.find((o) => o.id === 'mana_200');
    const current: CollectionItem = {
      id: 'mana',
      imageUrl: elementImagePath('mana'),
      owned: true,
      name,
      description: this.i18n.t('collection.manaCatalog.currentDescription'),
      unlockInfo: this.i18n.t('collection.alwaysAvailable'),
    };
    const legacy: CollectionItem = {
      id: 'mana_v1',
      imageUrl: '/cards/v1/mana.webp',
      owned,
      name: this.i18n.t('collection.legacyLabel', { name }),
      description: this.i18n.t('collection.manaCatalog.legacyDescription'),
      unlockInfo: objective
        ? this.unlockInfoFor(objective, owned)
        : this.i18n.t('collection.descriptionPending'),
    };
    return [current, legacy];
  });

  /** Incantesimi: stesso schema di elementItems sopra (arte nuova sempre posseduta, arte v1 in
   * griglia da sbloccare) ma con una condizione chiara e già misurabile — `spellCastCounts`
   * (UserStats, aggiornato ad ogni lancio da AuthService.applyGameStats) invece di un segreto. */
  protected readonly spellItems = computed<CollectionItem[]>(() => {
    const castCounts = this.auth.profile()?.stats?.spellCastCounts ?? {};
    return this.sortById(
      SPELL_CATALOG.flatMap((spell) => {
        const name = this.i18n.t(`spells.${spell.id}.name`);
        const description = this.i18n.t(`spells.${spell.id}.flavorText`);
        const castCount = castCounts[spell.id] ?? 0;
        const owned = castCount >= CollectionComponent.SPELL_LEGACY_UNLOCK_COUNT;
        const current: CollectionItem = {
          id: spell.id,
          imageUrl: `/cards-spell/${spell.id}.webp`,
          owned: true,
          name,
          description,
          unlockInfo: this.i18n.t('collection.alwaysAvailable'),
        };
        const legacy: CollectionItem = {
          id: `${spell.id}_v1`,
          imageUrl: `/cards-spell/v1/${spell.id}.webp`,
          owned,
          name: this.i18n.t('collection.legacyLabel', { name }),
          description,
          unlockInfo: this.i18n.t(
            owned ? 'collection.unlockedSpellUsage' : 'collection.lockedSpellUsage',
            {
              name,
              count: CollectionComponent.SPELL_LEGACY_UNLOCK_COUNT,
            },
          ),
        };
        return [current, legacy];
      }),
    );
  });

  /** % di completamento generale su TUTTE le categorie insieme (non solo quella selezionata) —
   * stesso trattamento di ObjectivesComponent.completionPercent, qui "completato" è semplicemente
   * CollectionItem.owned. */
  protected readonly completionPercent = computed(() => {
    const all = [
      ...this.cardBackItems(),
      ...this.backgroundItems(),
      ...this.titleItems(),
      ...this.elementItems(),
      ...this.manaItems(),
      ...this.spellItems(),
    ];
    if (all.length === 0) return 0;
    const owned = all.filter((item) => item.owned).length;
    return Math.round((owned / all.length) * 100);
  });

  private sortById(items: CollectionItem[]): CollectionItem[] {
    return [...items].sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: 'base' }));
  }

  /** Una voce di CARD_BACK_CATALOG/BACKGROUND_CATALOG — entrambe hanno arte reale e lo stesso set
   * di meccanismi di sblocco (v. RewardUnlock), solo `i18nNamespace` cambia. Il lucchetto copre
   * l'arte finché !owned (v. CollectionTileComponent), anche quando `imageUrl` è già noto: non
   * deve mai svelare l'aspetto reale di ciò che non si possiede ancora. */
  private catalogItem(
    id: string,
    imageUrl: string | null,
    i18nNamespace: 'cardBackCatalog' | 'backgroundCatalog',
    unlock: RewardUnlock,
    ownedIds: ReadonlySet<string>,
  ): CollectionItem {
    const owned = unlock.kind === 'free' || ownedIds.has(id);
    return {
      id,
      imageUrl,
      owned,
      name: this.i18n.t(`collection.${i18nNamespace}.${id}.name`),
      description: this.i18n.t(`collection.${i18nNamespace}.${id}.description`),
      unlockInfo: this.rewardUnlockInfo(unlock, owned),
    };
  }

  private rewardUnlockInfo(unlock: RewardUnlock, owned: boolean): string {
    switch (unlock.kind) {
      case 'free':
        return this.i18n.t('collection.alwaysAvailable');
      case 'objective': {
        // Guard difensivo: objectiveId dovrebbe sempre risolvere un Objective reale in
        // OBJECTIVE_CATALOG (v. data/card-backs.ts, data/backgrounds.ts) — non dovrebbe mai
        // capitare altrimenti.
        const objective = OBJECTIVE_CATALOG.find((o) => o.id === unlock.objectiveId);
        return objective
          ? this.unlockInfoFor(objective, owned)
          : this.i18n.t('collection.descriptionPending');
      }
      case 'redeemCode':
        return this.i18n.t(owned ? 'collection.unlockedViaCode' : 'collection.redeemCodeLocked');
      case 'purchase':
        return this.i18n.t(owned ? 'collection.unlockedPurchase' : 'collection.purchaseLocked');
      case 'seasonal':
        return this.i18n.t(owned ? 'collection.unlockedSeasonal' : 'collection.seasonalLocked');
      case 'inviteFriend':
        return this.i18n.t(
          owned ? 'collection.unlockedInviteFriend' : 'collection.inviteFriendLocked',
        );
      case 'exclusive':
        // Mostrato solo al proprietario (v. titleItems sopra, filtrato per chiunque altro) —
        // "sempre disponibile" è corretto dal SUO punto di vista, l'unico che possa mai vederlo qui.
        return this.i18n.t('collection.alwaysAvailable');
    }
  }

  /** Un dorso/sfondo posseduto ma esterno a CARD_BACK_CATALOG/BACKGROUND_CATALOG (fallback
   * difensivo, v. cardBackItems sopra) — `nameKey` risolto se tradotto, altrimenti l'id
   * capitalizzato (nessuna traduzione prevedibile in anticipo per una skin non ancora documentata). */
  private realItem(
    id: string,
    imageUrl: string,
    nameKey: string,
    unlockInfoKey: 'alwaysAvailable' | 'unlockedViaCode',
  ): CollectionItem {
    return {
      id,
      imageUrl,
      owned: true,
      name: this.translatedOr(nameKey, this.capitalize(id)),
      description: this.i18n.t('collection.descriptionPending'),
      unlockInfo: this.i18n.t(`collection.${unlockInfoKey}`),
    };
  }

  /** Una voce di TITLE_CATALOG — mai un'arte reale (`imageUrl: null` sempre, anche da posseduto).
   * A differenza di dorsi/sfondi, "posseduto" non è un singolo id ma una delle varianti di genere
   * (v. titleRewardVariantIds): basta possederne una qualunque. `exclusive` è owned automaticamente
   * per l'unico uid per cui compare in griglia (v. titleItems sopra, già filtrato altrove) — stesso
   * trattamento di `free`, solo ristretto a un account. Il nome mostra tutte le forme disponibili
   * (v. TranslationService.titleForms, separate da "/") una volta che il contenuto reale è deciso;
   * resta il placeholder neutro finché non lo è. */
  private titleItem(def: TitleDefinition, ownedIds: ReadonlySet<string>): CollectionItem {
    const owned =
      def.unlock.kind === 'free' ||
      def.unlock.kind === 'exclusive' ||
      titleRewardVariantIds(def.id).some((v) => ownedIds.has(v));
    const forms = this.i18n.titleForms(def.id);
    return {
      id: def.id,
      imageUrl: null,
      owned,
      name: forms.length > 0 ? forms.join(' / ') : this.i18n.t('objectives.rewardPending'),
      description: this.i18n.t('collection.descriptionPending'),
      unlockInfo: this.rewardUnlockInfo(def.unlock, owned),
    };
  }

  private unlockInfoFor(objective: Objective, owned: boolean): string {
    const name = this.i18n.t(`objectives.names.${objective.id}`);
    if (owned) {
      return this.i18n.t('collection.unlockedCondition', { condition: name });
    }
    if (objective.hidden) return this.i18n.t('collection.secretConditionTooltip');
    return this.i18n.t('collection.lockedCondition', { condition: name });
  }

  /** "Chiave non risolta = testo grezzo" (stesso schema di RedeemDialogComponent.errorMessage): se
   * la traduzione non esiste, usa il fallback invece di mostrare la chiave i18n grezza. */
  private translatedOr(key: string, fallback: string): string {
    const translated = this.i18n.t(key);
    return translated === key ? fallback : translated;
  }

  private capitalize(id: string): string {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }
}
