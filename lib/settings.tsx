import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DINING_HALLS, type HallId } from './diningHalls';
import { sanitizeAllergens, type Allergen } from './allergens';

/**
 * Search page, dish hearts, and the Settings rows for both.
 * Flip to true to ship those features again; stored prefs are kept as-is.
 */
export const SEARCH_FEATURES = false;

export interface Prefs {
  /** Left-to-right dining hall order. First hall is the launch page. */
  hallOrder: HallId[];
  veganOnly: boolean;
  vegetarianOnly: boolean;
  glutenFreeOnly: boolean;
  plantBasedOnly: boolean;
  /** Allergens the user wants grayed out when a hall lists them. */
  avoidedAllergens: Allergen[];
  showCalories: boolean;
  showDescriptions: boolean;
  searchEnabled: boolean;
  favoritesEnabled: boolean;
  /** Open every station when a hall menu first appears. */
  expandAllDefault: boolean;
  /** Favorite dish labels (matched by normalized name). */
  favorites: string[];
}

const DEFAULT_ORDER: HallId[] = DINING_HALLS.map((h) => h.id);

const DEFAULTS: Prefs = {
  hallOrder: DEFAULT_ORDER,
  veganOnly: false,
  vegetarianOnly: false,
  glutenFreeOnly: false,
  plantBasedOnly: false,
  avoidedAllergens: [],
  showCalories: false,
  showDescriptions: true,
  searchEnabled: false,
  favoritesEnabled: false,
  expandAllDefault: true,
  favorites: [],
};

/** Favorite identity: case/whitespace-insensitive dish name. */
export function favoriteId(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Drop unknown ids, append any missing halls (forward-compatible). */
export function sanitizeOrder(order: unknown): HallId[] {
  const ids = new Set<HallId>(DINING_HALLS.map((h) => h.id));
  const out: HallId[] = [];
  if (Array.isArray(order)) {
    for (const id of order) {
      if (ids.has(id) && !out.includes(id)) out.push(id);
    }
  }
  for (const id of ids) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function withSearchFeatures(prefs: Prefs): Prefs {
  if (SEARCH_FEATURES) return prefs;
  return { ...prefs, searchEnabled: false, favoritesEnabled: false };
}

const KEY = 'better5cmenu:prefs:v1';

interface Ctx extends Prefs {
  loaded: boolean;
  update: (patch: Partial<Prefs>) => void;
  isFavorite: (label: string) => boolean;
  toggleFavorite: (label: string) => void;
}

const SettingsContext = createContext<Ctx>({
  ...DEFAULTS,
  loaded: false,
  update: () => {},
  isFavorite: () => false,
  toggleFavorite: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setPrefs({
              ...DEFAULTS,
              ...parsed,
              hallOrder: sanitizeOrder(parsed.hallOrder),
              favorites: Array.isArray(parsed.favorites)
                ? parsed.favorites.filter((f: unknown) => typeof f === 'string')
                : [],
              avoidedAllergens: sanitizeAllergens(parsed.avoidedAllergens),
            });
          } catch {
            // corrupted prefs -> keep defaults
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const update = (patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const isFavorite = (label: string) =>
    prefs.favorites.some((f) => favoriteId(f) === favoriteId(label));

  const toggleFavorite = (label: string) => {
    const id = favoriteId(label);
    setPrefs((prev) => {
      const has = prev.favorites.some((f) => favoriteId(f) === id);
      const next = {
        ...prev,
        favorites: has
          ? prev.favorites.filter((f) => favoriteId(f) !== id)
          : [...prev.favorites, label.trim()],
      };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <SettingsContext.Provider
      value={{ ...withSearchFeatures(prefs), loaded, update, isFavorite, toggleFavorite }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function usePrefs(): Ctx {
  return useContext(SettingsContext);
}
