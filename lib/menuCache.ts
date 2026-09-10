import { fetchHallMenu, type HallMenu } from './api';
import type { HallId } from './diningHalls';

const cache = new Map<string, HallMenu>();

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
  const data = await fetchHallMenu(hall, date);
  setCachedMenu(hall, date, data);
  return data;
}
