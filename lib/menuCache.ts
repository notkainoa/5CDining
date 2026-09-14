import { fetchHallMenu, type HallMenu } from './api';
import type { HallId } from './diningHalls';

const cache = new Map<string, HallMenu>();
const requestGen = new Map<string, number>();
const cachedGen = new Map<string, number>();

export function menuCacheKey(hall: HallId, d: Date): string {
  return `${hall}:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function getCachedMenu(hall: HallId, d: Date): HallMenu | undefined {
  return cache.get(menuCacheKey(hall, d));
}

export function setCachedMenu(hall: HallId, d: Date, data: HallMenu): void {
  cache.set(menuCacheKey(hall, d), data);
}

export async function loadHallMenu(hall: HallId, date: Date, force = false): Promise<HallMenu> {
  if (!force) {
    const hit = getCachedMenu(hall, date);
    if (hit) return hit;
  }
  const key = menuCacheKey(hall, date);
  const gen = (requestGen.get(key) ?? 0) + 1;
  requestGen.set(key, gen);
  const data = await fetchHallMenu(hall, date);
  if (gen >= (cachedGen.get(key) ?? 0)) {
    setCachedMenu(hall, date, data);
    cachedGen.set(key, gen);
  }
  return data;
}

/** Drop cached menus so a new Claremont day does not reuse yesterday's "tomorrow" fetch. */
export function invalidateMenuCache(): void {
  cache.clear();
}
