import { Injectable, signal } from '@angular/core';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../models/language.model';
import type { Element } from '../models/element.model';
import type { SpecialMana } from '../models/card.model';
import type { TurnPhase } from '../models/turn-phase.model';
import type { ObjectiveReward } from '../models/objective.model';
import { TITLE_CATALOG, titleBaseId, titleRewardVariantIds } from '../data/titles';

interface DictionaryObject {
  [key: string]: DictionaryNode;
}

type DictionaryNode = string | DictionaryObject;
type Dictionary = DictionaryObject;

/**
 * Runtime i18n: JSON dictionaries fetched from /i18n/<lang>.json, switchable without a reload.
 * No persistence yet — every session starts in italiano (the fallback language) until the
 * language choice has somewhere real to live (the user profile, once it exists).
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly fallbackLanguage: LanguageCode = 'it';

  private readonly languageSignal = signal<LanguageCode>(this.fallbackLanguage);
  private readonly activeDictionarySignal = signal<Dictionary>({});
  private readonly fallbackDictionarySignal = signal<Dictionary>({});

  readonly language = this.languageSignal.asReadonly();
  readonly supportedLanguages = SUPPORTED_LANGUAGES;

  constructor() {
    void this.bootstrap();
  }

  async setLanguage(language: LanguageCode): Promise<void> {
    if (!this.supportedLanguages.includes(language) || language === this.languageSignal()) return;
    this.languageSignal.set(language);
    this.activeDictionarySignal.set(await this.loadDictionary(language));
  }

  /** Looks up a dot-separated key ("options.language.label"); falls back to italiano, then to the raw key. */
  t(key: string, params?: Record<string, string | number>): string {
    const active = this.resolveNested(this.activeDictionarySignal(), key);
    if (typeof active === 'string') return this.interpolate(active, params);

    const fallback = this.resolveNested(this.fallbackDictionarySignal(), key);
    if (typeof fallback === 'string') return this.interpolate(fallback, params);

    return key;
  }

  elementLabel(element: Element): string {
    return this.t(`common.elements.${element}`);
  }

  specialManaLabel(type: SpecialMana): string {
    return this.t(`common.specialMana.${type}`);
  }

  turnPhaseLabel(phase: TurnPhase): string {
    return this.t(`common.turnPhases.${phase}.label`);
  }

  turnPhaseDescription(phase: TurnPhase): string {
    return this.t(`common.turnPhases.${phase}.description`);
  }

  /** Le forme tradotte di un titolo (v. data/titles.ts) — una sola per un titolo invariante, fino a
   * tre (maschile/femminile/neutro) per uno con varianti di genere. Solo le chiavi già tradotte
   * (v. `resolveTitleForm`) vengono incluse: array vuoto finché il contenuto reale non è deciso.
   * Usata SOLO in contesti "da solo" (anteprima reward in ObjectiveCardComponent, tile Collezione)
   * — mai accanto al nome del giocatore — quindi antepone sempre l'ellissi ai titoli "suffisso" (v.
   * `TitleDefinition.suffix`, `titleMarker` sotto). */
  titleForms(baseId: string): string[] {
    const marker = this.titleMarker(baseId);
    return titleRewardVariantIds(baseId)
      .map((variantId) => this.resolveTitleForm(variantId))
      .filter((form): form is string => form !== null)
      .map((form) => `${marker}${form}`);
  }

  /** Il testo di UNA specifica variant-id già scelta (v. UserProfile.title) — a differenza di
   * `titleForms` (tutte le forme disponibili di un titolo, per l'anteprima), qui serve la forma
   * esatta equipaggiata. Fallback all'id grezzo se non ancora tradotta. Mai un'ellissi qui: pensata
   * per i contesti dove il nome del giocatore è già visibile accanto (PlayerHudComponent,
   * ProfileComponent) — lì il testo del titolo da solo rende già chiaro il continuo. Per il select
   * del picker (titolo mostrato SENZA nome accanto) v. `titleLabelStandalone` sotto. */
  titleLabel(variantId: string): string {
    return this.resolveTitleForm(variantId) ?? variantId;
  }

  /** Come `titleLabel`, ma per i contesti in cui il titolo compare DA SOLO (es. le `<option>` del
   * select in ProfileDialogComponent) — antepone l'ellissi ai titoli "suffisso", stesso principio di
   * `titleForms` sopra. */
  titleLabelStandalone(variantId: string): string {
    return `${this.titleMarker(titleBaseId(variantId))}${this.titleLabel(variantId)}`;
  }

  /** "…" se `baseId` è un titolo "suffisso" (v. TitleDefinition.suffix, data/titles.ts) — un
   * frammento che ha senso solo letto subito dopo il nome del giocatore (es. "della neve"), stringa
   * vuota altrimenti (un epiteto già completo da solo, es. "La muraglia", "Fortunato"). */
  private titleMarker(baseId: string): string {
    return TITLE_CATALOG.find((def) => def.id === baseId)?.suffix ? '…' : '';
  }

  /** Etichetta "Categoria "Nome"" di una singola ricompensa (es. `Sfondo "Dorato"`) — riusata da
   * ObjectiveCardComponent (anteprima ricompense di un obiettivo) e ProfileComponent (ultimi
   * elementi di collezione ottenuti), un solo posto che sa come mostrare un ObjectiveReward come
   * testo invece di duplicare lo switch sui quattro ObjectiveRewardType in ogni componente. */
  rewardLabel(reward: ObjectiveReward): string {
    if (reward.id.startsWith('TODO_')) return this.t('objectives.rewardPending');

    const name =
      reward.type === 'cardBack'
        ? this.t(`collection.cardBackCatalog.${reward.id}.name`)
        : reward.type === 'background'
          ? this.t(`collection.backgroundCatalog.${reward.id}.name`)
          : reward.type === 'elementVariant'
            ? this.t('objectives.elementVariantName', {
                name: this.elementLabel(reward.id as Element),
              })
            : this.titleForms(reward.id).join(' / ');
    if (!name) return this.t('objectives.rewardPending');

    return `${this.t(`objectives.rewardTypeLabels.${reward.type}`)} "${name}"`;
  }

  /** Unisce più etichette come un elenco in linguaggio naturale ("A, B e C",
   * `objectives.rewardConjunction` per l'ultima congiunzione) invece che con un semplice
   * separatore — riusato ovunque più ricompense/elementi vadano elencati in una frase. */
  joinWithConjunction(labels: readonly string[]): string {
    if (labels.length <= 1) return labels.join('');
    const last = labels[labels.length - 1];
    const rest = labels.slice(0, -1);
    return `${rest.join(', ')} ${this.t('objectives.rewardConjunction')} ${last}`;
  }

  private resolveTitleForm(variantId: string): string | null {
    const key = `collection.titleCatalog.${variantId}.name`;
    const value = this.t(key);
    return value === key ? null : value;
  }

  private async bootstrap(): Promise<void> {
    const fallbackDictionary = await this.loadDictionary(this.fallbackLanguage);
    this.fallbackDictionarySignal.set(fallbackDictionary);
    this.activeDictionarySignal.set(fallbackDictionary);
  }

  private async loadDictionary(language: LanguageCode): Promise<Dictionary> {
    try {
      const response = await fetch(`/i18n/${language}.json`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) return {};
      const dictionary = (await response.json()) as unknown;
      return dictionary && typeof dictionary === 'object' ? (dictionary as Dictionary) : {};
    } catch {
      return {};
    }
  }

  private resolveNested(dictionary: Dictionary, key: string): DictionaryNode | undefined {
    const path = key.split('.').filter(Boolean);
    let current: DictionaryNode | undefined = dictionary;
    for (const segment of path) {
      if (!current || typeof current === 'string') return undefined;
      current = current[segment];
    }
    return current;
  }

  private interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = params[key];
      return typeof value === 'undefined' ? `{${key}}` : String(value);
    });
  }
}
