import { Injectable, signal } from '@angular/core';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../models/language.model';
import type { Element } from '../models/element.model';
import type { SpecialMana } from '../models/card.model';
import type { TurnPhase } from '../models/turn-phase.model';
import { titleRewardVariantIds } from '../data/titles';

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
   * (v. `resolveTitleForm`) vengono incluse: array vuoto finché il contenuto reale non è deciso. */
  titleForms(baseId: string): string[] {
    return titleRewardVariantIds(baseId)
      .map((variantId) => this.resolveTitleForm(variantId))
      .filter((form): form is string => form !== null);
  }

  /** Il testo di UNA specifica variant-id già scelta (v. UserProfile.title/TitlePickerComponent) —
   * a differenza di `titleForms` (tutte le forme disponibili di un titolo, per l'anteprima), qui
   * serve la forma esatta equipaggiata. Fallback all'id grezzo se non ancora tradotta. */
  titleLabel(variantId: string): string {
    return this.resolveTitleForm(variantId) ?? variantId;
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
      const response = await fetch(`/i18n/${language}.json`, { headers: { 'Cache-Control': 'no-cache' } });
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
