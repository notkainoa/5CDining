/** Minimal shapes so this file stays importable from `node --test` (no runtime imports). */
interface ItemLike {
  name: string;
  calories?: unknown;
}
interface MealLike {
  stations: { items: ItemLike[] }[];
}

/**
 * Calorie sanity rules, measured 2026-10-25 through 2026-10-29 (today + 4 days,
 * GET /v1/menus, every hall):
 *
 * - Bon Appétit (Collins, Malott, McConnell) and Hoch publish whole numbers.
 *   Medians 110-220 cal. The only bad value was Malott "pesto" at 17,940.
 *   The largest real values are whole pizzas at Collins ("24 oz 4-1 cheese and
 *   pepperoni pizza" 3,070, cheese 2,640), so the ceiling sits above those.
 * - Pomona (Frary, Frank) is mostly garbage: 88% and 93% of values were
 *   fractional (234.07, 4366.13) and ranged up to 256,701 (BURGER BAR).
 *   Even the "normal looking" ones aren't trustworthy (Sour Cream 4,366).
 * - Oldenborg published no menus in that window.
 * - The only zeros were McConnell "dill pickles", which really are ~0 cal.
 */
export const CALORIE_CEILING = 4000;

/**
 * If more than this share of a day's calorie values are implausible, the
 * hall's source is broken: hide calories for the whole hall instead of
 * showing a scattered few. Pomona sat near 90%, every other hall under 1%.
 */
export const HALL_GARBAGE_SHARE = 0.25;

/** Dishes where 0 cal is a real value, not a missing one. */
const ZERO_CAL_NAME = /\b(pickles?|water|coffee|tea|seltzer|diet|hot sauce|vinegar)\b/i;

/** A single value is believable: a whole number in (0, ceiling], or 0 for a zero-cal dish. */
export function isPlausibleCalories(calories: unknown, name: string): calories is number {
  if (typeof calories !== 'number' || !Number.isInteger(calories)) return false;
  if (calories === 0) return ZERO_CAL_NAME.test(name);
  return calories > 0 && calories <= CALORIE_CEILING;
}

/** False when the hall's calorie data for these meals is mostly garbage. */
export function hallCaloriesReliable(meals: readonly MealLike[]): boolean {
  let present = 0;
  let bad = 0;
  for (const meal of meals) {
    for (const station of meal.stations) {
      for (const item of station.items) {
        if (item.calories === undefined || item.calories === null) continue;
        present++;
        if (!isPlausibleCalories(item.calories, item.name)) bad++;
      }
    }
  }
  return present === 0 || bad / present <= HALL_GARBAGE_SHARE;
}
