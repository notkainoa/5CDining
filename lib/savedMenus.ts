import type { HallMenu } from './api';

/**
 * Menus saved on the device so the app still shows something with no
 * connection. Only menus with meals are saved, one per hall per day, and
 * days before today are pruned.
 *
 * Storage is injected (AsyncStorage in the app) so this stays testable in node.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface SavedMenu {
  menu: HallMenu;
  /** When this device saved it (ISO). */
  savedAt: string;
}

const PREFIX = 'savedMenu:v1:';

export function savedMenuKey(hall: string, ymd: string): string {
  return `${PREFIX}${hall}:${ymd}`;
}

/** Worth keeping offline: a real menu with at least one meal. */
export function isSavable(menu: HallMenu): boolean {
  return (
    (menu.status === 'ok' || menu.status === 'stale') &&
    !menu.problem &&
    Array.isArray(menu.meals) &&
    menu.meals.length > 0
  );
}

export async function saveMenu(
  store: KeyValueStore,
  hall: string,
  ymd: string,
  menu: HallMenu,
  now: Date = new Date(),
): Promise<void> {
  if (!isSavable(menu)) return;
  const entry: SavedMenu = { menu, savedAt: now.toISOString() };
  try {
    await store.setItem(savedMenuKey(hall, ymd), JSON.stringify(entry));
  } catch {
    // Storage full or unavailable: saving is best-effort.
  }
}

export async function readSavedMenu(
  store: KeyValueStore,
  hall: string,
  ymd: string,
): Promise<SavedMenu | null> {
  try {
    const raw = await store.getItem(savedMenuKey(hall, ymd));
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<SavedMenu>;
    if (
      !entry ||
      typeof entry.savedAt !== 'string' ||
      !entry.menu ||
      !Array.isArray(entry.menu.meals) ||
      entry.menu.meals.length === 0
    ) {
      return null;
    }
    return entry as SavedMenu;
  } catch {
    return null;
  }
}

/** Remove saved menus for days before `todayYmd`. */
export async function pruneSavedMenus(store: KeyValueStore, todayYmd: string): Promise<void> {
  try {
    const keys = await store.getAllKeys();
    const old = keys.filter((k) => {
      if (!k.startsWith(PREFIX)) return false;
      const ymd = k.slice(k.lastIndexOf(':') + 1);
      return ymd < todayYmd;
    });
    await Promise.all(old.map((k) => store.removeItem(k)));
  } catch {
    // best-effort
  }
}
