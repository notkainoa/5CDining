import type { HallId } from './diningHalls';

/** Minimal shapes so this file stays importable from `node --test` (no runtime imports). */
interface StationLike {
  name: string;
}
interface MealLike<S extends StationLike> {
  period?: string;
  stations: S[];
}

/**
 * Station names that are always dessert, at every hall, in every meal.
 * Compared after `normalizeStationName`, exact match only (never substring), so
 * "sweet potato bar" and "Sweet Chili" are not dessert.
 *
 * Observed 2026-10-23 through 2026-10-29 (today + 6 days, GET /v1/menus):
 * - `sweets`   Collins (all meals), Malott (all), McConnell (some lunch/dinner)
 * - `Desserts` Frary (all meals)
 * Frank (Pomona, same feed as Frary) and Oldenborg returned no menu on any of
 * those days, so their station names are unverified. Frank is assumed to use
 * Frary's `Desserts`.
 *
 * `Desserts` and `sweets` also hold pastries at breakfast/brunch. They are still
 * the hall's dessert station by name, so they sort last in every meal.
 */
const ALWAYS_DESSERT = new Set(['sweets', 'desserts']);

type MealPeriod = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'late_night';

interface HallDessertRule {
  /** Normalized station name. */
  name: string;
  /** Only dessert in these meals. Anywhere else the station is breakfast pastries or food. */
  periods: readonly MealPeriod[];
}

const AFTERNOON_AND_EVENING: readonly MealPeriod[] = ['lunch', 'dinner', 'late_night'];

/**
 * Names that are dessert only at certain halls and meals. Checked 2026-10-23..29.
 * - Hoch `BAKERY`: bagels/muffins/croissants at breakfast, donuts + bagel at brunch,
 *   cakes/pies/cookies/brownies at lunch and dinner.
 * - McConnell `ovens`: scones/danishes at breakfast, scones mixed with cookies at
 *   brunch, only cookies/bars/brownies at lunch and dinner. At Collins and Malott
 *   `ovens` is pizza, and at Hoch `OVEN` is pizza, so this stays McConnell-only.
 * - Collins `breakfast bakery` (bagel, muffin) is deliberately absent: breakfast food.
 */
const HALL_DESSERT_RULES: Partial<Record<HallId, readonly HallDessertRule[]>> = {
  hoch: [{ name: 'bakery', periods: AFTERNOON_AND_EVENING }],
  mcconnell: [{ name: 'ovens', periods: AFTERNOON_AND_EVENING }],
};

/** Case- and whitespace-insensitive key: "  Desserts " -> "desserts". */
export function normalizeStationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** True when `stationName` is that hall's dessert station in a meal with this `period`. */
export function isDessertStation(hall: HallId, period: string | undefined, stationName: string) {
  const key = normalizeStationName(stationName);
  if (ALWAYS_DESSERT.has(key)) return true;
  if (!period) return false;
  return (HALL_DESSERT_RULES[hall] ?? []).some(
    (rule) => rule.name === key && (rule.periods as readonly string[]).includes(period),
  );
}

/**
 * Move dessert stations to the end of the meal. Both groups keep their relative
 * order. Returns the same meal when nothing needs to move.
 */
export function moveDessertStationsLast<S extends StationLike, M extends MealLike<S>>(
  hall: HallId,
  meal: M,
): M {
  const rest: S[] = [];
  const dessert: S[] = [];
  for (const station of meal.stations) {
    if (isDessertStation(hall, meal.period, station.name)) dessert.push(station);
    else rest.push(station);
  }
  if (dessert.length === 0 || rest.length === 0) return meal;
  const stations = [...rest, ...dessert];
  if (stations.every((st, i) => st === meal.stations[i])) return meal;
  return { ...meal, stations };
}
