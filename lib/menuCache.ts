import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchHallMenu, formatYMDForApi, type HallMenu } from './api';
import { todayInLA } from './dates';
import type { HallId } from './diningHalls';
import { problemFromError } from './menuErrors';
import { isSavable, pruneSavedMenus, readSavedMenu, removeSavedMenu, saveMenu } from './savedMenus';

const cache = new Map<string, HallMenu>();
const requestGen = new Map<string, number>();
const cachedGen = new Map<string, number>();
let prunedFor: string | null = null;
/** A saved copy served offline is reused for this long before asking the network again. */
const OFFLINE_REUSE_MS = 2 * 60 * 1000;
const offlineUntil = new Map<string, number>();

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
  const key = menuCacheKey(hall, date);
  if (!force) {
    const hit = getCachedMenu(hall, date);
    // A saved copy shown offline is reused briefly (switching days or halls
    // shouldn't wait on a dead connection each time), then the network is
    // tried again so the app recovers on its own once you're back online.
    if (hit && (!hit.savedOffline || Date.now() < (offlineUntil.get(key) ?? 0))) return hit;
  }
  const ymd = formatYMDForApi(date);
  const gen = (requestGen.get(key) ?? 0) + 1;
  requestGen.set(key, gen);

  let data: HallMenu;
  try {
    data = await fetchHallMenu(hall, date);
  } catch (e) {
    const saved = await readSavedMenu(AsyncStorage, hall, ymd);
    if (!saved) throw e;
    const fallback: HallMenu = {
      ...saved.menu,
      savedOffline: { savedAt: saved.savedAt, problem: problemFromError(e).problem },
    };
    // Replace any earlier in-memory copy too, so the offline note stays until
    // the network is tried again (same data: it was saved when fetched).
    if (gen >= (cachedGen.get(key) ?? 0)) {
      setCachedMenu(hall, date, fallback);
      offlineUntil.set(key, Date.now() + OFFLINE_REUSE_MS);
    }
    return fallback;
  }

  // Only cache real menus. "Not posted yet" or "hall site down" can change
  // minutes later, so the next visit should ask again instead of replaying it.
  if (gen >= (cachedGen.get(key) ?? 0)) {
    cachedGen.set(key, gen);
    offlineUntil.delete(key);
    if (data.status === 'ok' && !data.problem) setCachedMenu(hall, date, data);
    // The newest answer says there's no current menu, so an older good copy
    // must not come back when the user returns to this day.
    else cache.delete(key);
    if (isSavable(data)) void saveMenu(AsyncStorage, hall, ymd, data);
    // The school now says closed / nothing posted: don't show the old copy offline.
    else if (
      data.problem === 'closed' ||
      data.problem === 'no_meals' ||
      data.problem === 'not_published'
    )
      void removeSavedMenu(AsyncStorage, hall, ymd);
  }
  return data;
}

/** Drop cached menus so a new Claremont day does not reuse yesterday's "tomorrow" fetch. */
export function invalidateMenuCache(): void {
  cache.clear();
}
