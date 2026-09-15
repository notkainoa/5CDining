import type { HallId } from './diningHalls';

/** Canonical tokens from GET /v1 menus. Tree-nut varieties are already collapsed. */
export const ALLERGENS = [
  'egg',
  'fish',
  'gluten',
  'milk',
  'peanut',
  'sesame',
  'shellfish',
  'soy',
  'treenut',
  'wheat',
] as const;

export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  egg: 'Egg',
  fish: 'Fish',
  gluten: 'Gluten',
  milk: 'Milk',
  peanut: 'Peanut',
  sesame: 'Sesame',
  shellfish: 'Shellfish',
  soy: 'Soy',
  treenut: 'Tree nut',
  wheat: 'Wheat',
};

const PUBLISHING_HALLS: ReadonlySet<HallId> = new Set(['hoch', 'frary', 'frank']);

/** Hoch, Frary, and Frank publish `item.allergens`. Bon Appétit halls omit the field. */
export function hallPublishesAllergens(hallId: HallId): boolean {
  return PUBLISHING_HALLS.has(hallId);
}

export function isAllergen(value: unknown): value is Allergen {
  return typeof value === 'string' && (ALLERGENS as readonly string[]).includes(value);
}

export function sanitizeAllergens(value: unknown): Allergen[] {
  if (!Array.isArray(value)) return [];
  const out: Allergen[] = [];
  for (const item of value) {
    if (isAllergen(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

export interface DietHighlightPrefs {
  veganOnly: boolean;
  vegetarianOnly: boolean;
  glutenFreeOnly: boolean;
  plantBasedOnly: boolean;
}

/** Allergens a highlight forces on. Users cannot turn these off while that highlight is on. */
export const HIGHLIGHT_IMPLIED_ALLERGENS = {
  veganOnly: ['egg', 'fish', 'milk', 'shellfish'],
  vegetarianOnly: ['fish', 'shellfish'],
  glutenFreeOnly: ['gluten', 'wheat'],
  plantBasedOnly: ['egg', 'fish', 'milk', 'shellfish'],
} as const satisfies Record<keyof DietHighlightPrefs, readonly Allergen[]>;

export function impliedAllergens(prefs: DietHighlightPrefs): Allergen[] {
  const out: Allergen[] = [];
  for (const key of Object.keys(HIGHLIGHT_IMPLIED_ALLERGENS) as (keyof DietHighlightPrefs)[]) {
    if (!prefs[key]) continue;
    for (const allergen of HIGHLIGHT_IMPLIED_ALLERGENS[key]) {
      if (!out.includes(allergen)) out.push(allergen);
    }
  }
  return out;
}

export function effectiveAvoidedAllergens(
  prefs: DietHighlightPrefs & { avoidedAllergens: readonly Allergen[] },
): Allergen[] {
  return sanitizeAllergens([...impliedAllergens(prefs), ...prefs.avoidedAllergens]);
}
