import type { HallId } from './diningHalls';

const BASE = 'https://five-c-menu-api.kainoanewton.workers.dev';

export interface MenuItem {
  name: string;
  description?: string;
  vegan?: boolean;
  vegetarian?: boolean;
  calories?: number;
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

/**
 * The API has no structured gluten-free flag — only menu text. Best-effort
 * check: counts when the name/description explicitly says so.
 */
export function isGlutenFree(item: MenuItem): boolean {
  const t = `${item.name} ${item.description ?? ''}`.toLowerCase();
  return /gluten[-\s]?free|\bno gluten\b|\bgluten friendly\b|\bgf\b/.test(t);
}

export interface DietPrefs {
  veganOnly: boolean;
  vegetarianOnly: boolean;
}

/**
 * Highlight (not hide) semantics: an item is "matching" when it satisfies
 * every enabled restriction. Non-matching items are grayed out but stay visible.
 */
export function matchesDiet(item: MenuItem, prefs: DietPrefs): boolean {
  if (prefs.veganOnly && !item.vegan) return false;
  if (prefs.vegetarianOnly && !(item.vegetarian || item.vegan)) return false;
  return true;
}

function toMinutes(t?: string): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Pick the meal tab to open: the one being served now, else the next
 * upcoming one, else the first. `nowMinutes` is minutes after midnight.
 */
export function pickCurrentMeal(meals: Meal[], nowMinutes: number): number {
  for (let i = 0; i < meals.length; i++) {
    const s = toMinutes(meals[i].startTime);
    const e = toMinutes(meals[i].endTime);
    if (s !== null && e !== null && nowMinutes >= s && nowMinutes < e) return i;
  }
  for (let i = 0; i < meals.length; i++) {
    const s = toMinutes(meals[i].startTime);
    if (s !== null && nowMinutes < s) return i;
  }
  return 0;
}
