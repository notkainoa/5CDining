import type { HallId } from './diningHalls';
import type { Allergen } from './allergens';
import {
  EXPECTED_PROBLEMS,
  MenuLoadError,
  TRANSIENT_PROBLEMS,
  problemFromApiCode,
  problemFromError,
  type MenuProblem,
} from './menuErrors.ts';
import { moveDessertStationsLast } from './stations.ts';

const BASE = 'https://five-c-menu-api.kainoanewton.workers.dev';

export interface MenuItem {
  name: string;
  description?: string;
  vegan?: boolean;
  vegetarian?: boolean;
  glutenFree?: boolean;
  plantBased?: boolean;
  calories?: number;
  allergens?: Allergen[];
  /**
   * Bon Appétit halls (Collins, Malott, McConnell) publish this.
   * `true` = today's dish, `false` = always-on catalog (bagels, pizza, oatmeal).
   * Hoch and Pomona omit the key; missing is unknown, not "not featured".
   */
  featured?: boolean;
}

export interface Station {
  name: string;
  items: MenuItem[];
}

/** Normalized meal slot from the API. Omitted when the school name matches none of these. */
export type MealPeriod = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'late_night';

export interface Meal {
  name: string;
  period?: MealPeriod;
  stations: Station[];
  startTime?: string;
  endTime?: string;
}

export interface HallMenu {
  hall: string;
  date: string;
  status: 'ok' | 'unavailable' | string;
  /** Set when there is nothing to show, saying why. See lib/menuErrors.ts. */
  problem?: MenuProblem;
  sourceUrl?: string;
  menuUpdatedAt?: string;
  meals: Meal[] | null;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatYMDForApi(d: Date): string {
  return toYMD(d);
}

const TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 700;

/** fetch with a timeout; a stuck request rejects with MenuLoadError('timeout'). */
async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new MenuLoadError('timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function apiErrorCode(body: unknown): string | undefined {
  const err = (body as { error?: unknown } | undefined)?.error;
  if (typeof err === 'string') return err;
  const code = (err as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

async function fetchHallMenuOnce(hall: HallId, ymd: string): Promise<HallMenu> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE}/v1/menus/${hall}?date=${ymd}`);
  } catch (e) {
    const { problem, status } = problemFromError(e);
    throw new MenuLoadError(problem, status);
  }
  const body = await readJson(res);

  if (!res.ok) {
    // "Not published", "source down" and "out of range" come back as 4xx/503
    // with a code in the body. They describe the menu, not a broken request.
    const problem = problemFromApiCode(apiErrorCode(body));
    if (problem && EXPECTED_PROBLEMS.has(problem)) {
      const b = (body ?? {}) as Partial<HallMenu>;
      return {
        hall,
        date: ymd,
        status: 'unavailable',
        sourceUrl: b.sourceUrl,
        problem,
        meals: null,
      };
    }
    throw new MenuLoadError('server', res.status);
  }

  if (!body || typeof body !== 'object') throw new MenuLoadError('bad_response', res.status);
  const menu = body as HallMenu;
  if (menu.status !== 'ok') {
    return {
      ...menu,
      meals: null,
      problem: problemFromApiCode(apiErrorCode(body)) ?? 'not_published',
    };
  }
  if (menu.meals != null && !Array.isArray(menu.meals)) {
    throw new MenuLoadError('bad_response', res.status);
  }
  // Dessert ordering needs the hall id, which mergeStations (called from the
  // screens) does not have. mergeStations keeps first-seen order, so this holds.
  const meals = (menu.meals ?? []).map((m) => moveDessertStationsLast(hall, m));
  return { ...menu, meals, problem: meals.length === 0 ? 'no_meals' : undefined };
}

/**
 * Fetch one hall + one date. Dessert stations are moved to the end of each meal.
 *
 * Returns `status: 'unavailable'` with a `problem` when the API says the menu
 * isn't there (not published, hall site down, date out of range), and
 * `problem: 'no_meals'` for an ok menu with no meals. Throws MenuLoadError for
 * real request failures (offline, timeout, server error, garbage body), after
 * one quiet retry for blips like a dropped connection.
 */
export async function fetchHallMenu(hall: HallId, date: Date): Promise<HallMenu> {
  const ymd = formatYMDForApi(date);
  try {
    return await fetchHallMenuOnce(hall, ymd);
  } catch (e) {
    if (!(e instanceof MenuLoadError) || !TRANSIENT_PROBLEMS.has(e.problem)) throw e;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return fetchHallMenuOnce(hall, ymd);
  }
}

/** "07:30" -> "7:30 AM", "17:00" -> "5:00 PM". Pass through anything unexpected. */
export function formatTime(t?: string): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const mins = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mins} ${ampm}`;
}

/** "Dinner" + optional times -> "Dinner · 5:00 PM – 7:30 PM" */
export function mealTitle(meal: Meal): { name: string; hours: string | null } {
  const start = formatTime(meal.startTime);
  const end = formatTime(meal.endTime);
  const name = meal.name.charAt(0) + meal.name.slice(1).toLowerCase();
  if (start && end) return { name, hours: `${start} – ${end}` };
  if (start) return { name, hours: `from ${start}` };
  return { name, hours: null };
}

/** Short tab label that fits an end-to-end tab (e.g. "Continental Breakfast" -> "Cont. Bkfst"). */
export function shortMealName(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'continental breakfast') return 'Cont. Bkfst';
  if (lower === 'continental') return 'Cont.';
  return name.charAt(0) + name.slice(1).toLowerCase();
}

/** Compact time for meal tabs: "07:30" -> "7:30am", "09:00" -> "9am", "16:30" -> "4:30pm". */
export function formatTimeCompact(t?: string): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const mins = m[2];
  const suffix = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return mins === '00' ? `${h}${suffix}` : `${h}:${mins}${suffix}`;
}

/** Compact range for tabs: "7:30am - 9am". Null when the API has no times. */
export function mealHoursCompact(meal: Meal): string | null {
  const start = formatTimeCompact(meal.startTime);
  const end = formatTimeCompact(meal.endTime);
  if (start && end) return `${start} - ${end}`;
  return start ?? null;
}

/** Strict public-boolean check. Missing/`false` never count as today's dish. */
export function isTodaysDish(item: MenuItem): boolean {
  return item.featured === true;
}

/**
 * Keep station grouping; pin `featured: true` above catalog/`unknown` items.
 * No-op when a station is all today's, all catalog, or has no `featured` key.
 */
export function pinTodaysDishes(items: MenuItem[]): MenuItem[] {
  let todayCount = 0;
  for (const item of items) {
    if (isTodaysDish(item)) todayCount += 1;
  }
  if (todayCount === 0 || todayCount === items.length) return items;
  const today: MenuItem[] = [];
  const rest: MenuItem[] = [];
  for (const item of items) {
    if (isTodaysDish(item)) today.push(item);
    else rest.push(item);
  }
  return [...today, ...rest];
}

/**
 * Sources repeat stations (e.g. Collins lists "breakfast @ home" 3x per meal).
 * Merge case-insensitive duplicates, deduping items by name.
 */
export function mergeStations(meal: Meal): Meal {
  const order: string[] = [];
  const byKey = new Map<string, Station>();
  for (const st of meal.stations) {
    const key = st.name.trim().toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { name: st.name, items: [...st.items] });
      order.push(key);
    } else {
      const seen = new Set(existing.items.map((i) => i.name.trim().toLowerCase()));
      for (const item of st.items) {
        if (!seen.has(item.name.trim().toLowerCase())) {
          seen.add(item.name.trim().toLowerCase());
          existing.items.push(item);
        }
      }
    }
  }
  return { ...meal, stations: order.map((k) => byKey.get(k)!) };
}

/** True only when the API published `glutenFree: true`. Missing is not gluten-free. */
export function isGlutenFree(item: MenuItem): boolean {
  return item.glutenFree === true;
}

/** True when any item on this meal actually sent the flag (including explicit false). */
export function mealHasFlag(meal: Meal, key: 'glutenFree' | 'plantBased'): boolean {
  return meal.stations.some((st) => st.items.some((it) => typeof it[key] === 'boolean'));
}

/** Hall-level: a meal with no flags should not disable the filter if another meal published them. */
export function menusHaveFlag(meals: Meal[], key: 'glutenFree' | 'plantBased'): boolean {
  return meals.some((meal) => mealHasFlag(meal, key));
}

export interface DietPrefs {
  veganOnly: boolean;
  vegetarianOnly: boolean;
  glutenFreeOnly: boolean;
  plantBasedOnly: boolean;
  avoidedAllergens: Allergen[];
}

/**
 * Highlight (not hide) semantics: an item is "matching" when it satisfies
 * every enabled restriction. Non-matching items are grayed out but stay visible.
 * Plant-based also matches vegan dishes, because Bon Appétit halls omit `plantBased`.
 * Avoided allergens gray a dish out (caller should already include highlight-implied
 * allergens). Missing `allergens` is treated as none listed.
 */
export function matchesDiet(item: MenuItem, prefs: DietPrefs): boolean {
  if (prefs.veganOnly && !item.vegan) return false;
  if (prefs.vegetarianOnly && !(item.vegetarian || item.vegan)) return false;
  if (prefs.glutenFreeOnly && !isGlutenFree(item)) return false;
  if (prefs.plantBasedOnly && !(item.plantBased || item.vegan)) return false;
  if (prefs.avoidedAllergens.length > 0) {
    const listed = item.allergens;
    if (listed?.some((a) => prefs.avoidedAllergens.includes(a))) return false;
  }
  return true;
}

function toMinutes(t?: string): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function mealTieKey(meal: Meal): string {
  const name = meal.name.trim();
  return `${name.toLowerCase()}\u0000${name}\u0000${meal.startTime ?? ''}\u0000${meal.endTime ?? ''}`;
}

/**
 * Pick the meal tab to open: the latest-starting service active now, else the
 * nearest upcoming one, else the most recent meal. Handles unsorted meals and
 * service windows that cross midnight. `nowMinutes` is minutes after midnight.
 */
export function pickCurrentMeal(meals: Meal[], nowMinutes: number): number {
  let activeIndex = -1;
  let activeStart = Number.NEGATIVE_INFINITY;
  let activeTieKey = '';
  let nextIndex = -1;
  let nextStart = Number.POSITIVE_INFINITY;
  let nextTieKey = '';
  let previousIndex = -1;
  let previousStart = Number.NEGATIVE_INFINITY;
  let previousTieKey = '';

  for (let i = 0; i < meals.length; i++) {
    const startMinutes = toMinutes(meals[i].startTime);
    const endMinutes = toMinutes(meals[i].endTime);
    if (startMinutes === null) continue;

    const crossesMidnight = endMinutes !== null && endMinutes < startMinutes;
    const isActive =
      endMinutes !== null &&
      (crossesMidnight
        ? nowMinutes >= startMinutes || nowMinutes < endMinutes
        : nowMinutes >= startMinutes && nowMinutes < endMinutes);
    const tieKey = mealTieKey(meals[i]);
    if (isActive) {
      // After midnight, an overnight service began on the prior day. Ranking on
      // that relative timeline ensures a newly started service wins an overlap.
      const relativeStart =
        crossesMidnight && endMinutes !== null && nowMinutes < endMinutes
          ? startMinutes - 24 * 60
          : startMinutes;
      if (
        relativeStart > activeStart ||
        (relativeStart === activeStart && (activeIndex < 0 || tieKey < activeTieKey))
      ) {
        activeStart = relativeStart;
        activeTieKey = tieKey;
        activeIndex = i;
      }
      continue;
    }

    if (startMinutes > nowMinutes) {
      if (
        startMinutes < nextStart ||
        (startMinutes === nextStart && (nextIndex < 0 || tieKey < nextTieKey))
      ) {
        nextStart = startMinutes;
        nextTieKey = tieKey;
        nextIndex = i;
      }
    } else if (
      startMinutes > previousStart ||
      (startMinutes === previousStart && (previousIndex < 0 || tieKey < previousTieKey))
    ) {
      previousStart = startMinutes;
      previousTieKey = tieKey;
      previousIndex = i;
    }
  }

  if (activeIndex >= 0) return activeIndex;
  if (nextIndex >= 0) return nextIndex;
  if (previousIndex >= 0) return previousIndex;
  return 0;
}
