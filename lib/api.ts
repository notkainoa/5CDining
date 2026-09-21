import type { HallId } from './diningHalls';
import type { Allergen } from './allergens';

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
  error?: string;
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

/**
 * Fetch one hall + one date.
 * 400/404 (including "date must be today or tomorrow") map to `unavailable`
 * so the screen can show the empty state instead of a hard error.
 * Other HTTP/network failures still throw.
 */
export async function fetchHallMenu(hall: HallId, date: Date): Promise<HallMenu> {
  const ymd = formatYMDForApi(date);
  const res = await fetch(`${BASE}/v1/menus/${hall}?date=${ymd}`);
  if (res.status === 400 || res.status === 404) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: { code?: string } };
      code = body.error?.code;
    } catch {
      // empty or non-JSON body
    }
    return {
      hall,
      date: ymd,
      status: 'unavailable',
      error: code ?? `http_${res.status}`,
      meals: null,
    };
  }
  if (!res.ok) throw new Error(`Menu request failed (${res.status})`);
  return (await res.json()) as HallMenu;
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

/**
 * Pick the meal tab to open: the one being served now, else the nearest
 * upcoming one, else the most recent meal. Handles unsorted meals and service
 * windows that cross midnight. `nowMinutes` is minutes after midnight.
 */
export function pickCurrentMeal(meals: Meal[], nowMinutes: number): number {
  let nextIndex = -1;
  let nextStart = Number.POSITIVE_INFINITY;
  let previousIndex = -1;
  let previousStart = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < meals.length; i++) {
    const s = toMinutes(meals[i].startTime);
    const e = toMinutes(meals[i].endTime);
    if (s === null) continue;

    const crossesMidnight = e !== null && e < s;
    const isActive =
      e !== null &&
      (crossesMidnight ? nowMinutes >= s || nowMinutes < e : nowMinutes >= s && nowMinutes < e);
    if (isActive) return i;

    if (s > nowMinutes && s < nextStart) {
      nextStart = s;
      nextIndex = i;
    } else if (s <= nowMinutes && s > previousStart) {
      previousStart = s;
      previousIndex = i;
    }
  }

  if (nextIndex >= 0) return nextIndex;
  if (previousIndex >= 0) return previousIndex;
  return 0;
}
