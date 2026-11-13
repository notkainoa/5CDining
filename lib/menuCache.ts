import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchHallMenu, formatYMDForApi, type HallMenu } from './api';
import { todayInLA } from './dates';
import type { HallId } from './diningHalls';
import { problemFromError } from './menuErrors';
import { pruneSavedMenus, readSavedMenu, saveMenu } from './savedMenus';

const cache = new Map<string, HallMenu>();
const requestGen = new Map<string, number>();
const cachedGen = new Map<string, number>();
let prunedFor: string | null = null;

export function menuCacheKey(hall: HallId, d: Date): string {
  return `${hall}:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function getCachedMenu(hall: HallId, d: Date): HallMenu | undefined {
  return cache.get(menuCacheKey(hall, d));
}

export function setCachedMenu(hall: HallId, d: Date, data: HallMenu): void {
  cache.set(menuCacheKey(hall, d), data);
}

function pruneOnceADay(): void {
  const today = formatYMDForApi(todayInLA());
  if (prunedFor === today) return;
  prunedFor = today;
  void pruneSavedMenus(AsyncStorage, today);
}

/**
 * Load one hall's menu for one day.
 *
 * Good menus are kept in memory for the session and saved on the device.
 * If the request itself fails (offline, timeout, server error) and this
 * device saved that day's menu earlier, the saved copy is returned with
 * `savedOffline` set instead of throwing.
 */
export async function loadHallMenu(hall: HallId, date: Date, force = false): Promise<HallMenu> {
  pruneOnceADay();
  if (!force) {
    const hit = getCachedMenu(hall, date);
    if (hit) return hit;
  }
  const key = menuCacheKey(hall, date);
  const ymd = formatYMDForApi(date);
  const gen = (requestGen.get(key) ?? 0) + 1;
  requestGen.set(key, gen);

  let data: HallMenu;
  try {
    data = await fetchHallMenu(hall, date);
  } catch (e) {
    const saved = await readSavedMenu(AsyncStorage, hall, ymd);
    if (!saved) throw e;
    return {
      ...saved.menu,
      savedOffline: { savedAt: saved.savedAt, problem: problemFromError(e).problem },
    };
  }

  // Only cache real menus. "Not posted yet" or "hall site down" can change
  // minutes later, so the next visit should ask again instead of replaying it.
  if (gen >= (cachedGen.get(key) ?? 0)) {
    cachedGen.set(key, gen);
    if (data.status === 'ok' && !data.problem) setCachedMenu(hall, date, data);
    // The newest answer says there's no current menu, so an older good copy
    // must not come back when the user returns to this day.
    else cache.delete(key);
  }
  void saveMenu(AsyncStorage, hall, ymd, data);
  return data;
}

/** Drop cached menus so a new Claremont day does not reuse yesterday's "tomorrow" fetch. */
export function invalidateMenuCache(): void {
  cache.clear();
}
