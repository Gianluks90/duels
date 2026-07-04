import type { Element } from './element.model';

export type SpellEffectType =
  | 'damage'
  | 'damage_ignore_shields'
  | 'damage_self'
  | 'damage_halve_opponent'
  | 'damage_cursed'
  | 'damage_from_fonte'
  | 'heal'
  | 'shield_add'
  | 'shield_remove_opponent'
  | 'ice_add'
  | 'ice_clear_self'
  | 'poison_add'
  | 'poison_clear_self'
  | 'opponent_discard_random'
  | 'opponent_discard_hand'
  | 'opponent_lose_mana'
  | 'opponent_reduce_next_collect'
  | 'opponent_skip_collect'
  | 'reveal_opponent_hand'
  | 'element_immunity'
  | 'fonte_reset';

export interface SpellEffect {
  type: SpellEffectType;
  amount?: number;
}

export interface Spell {
  id: string;
  name: string;
  formula: Element[];
  manaCost: number;
  effects: SpellEffect[];
  flavorText?: string;
}
