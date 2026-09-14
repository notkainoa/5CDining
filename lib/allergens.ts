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

const PUBLISHING_HALLS: ReadonlySet<HallId> = new Set(['hoch', 'frary', 'frank', 'oldenborg']);

/** Hoch and Pomona publish `item.allergens`. Bon Appétit halls omit the field entirely. */
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
