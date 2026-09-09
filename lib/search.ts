import Fuse from 'fuse.js';
import { fetchHallMenu, mealTitle, mergeStations } from './api';
import { todayInLA } from './dates';
import { DINING_HALLS } from './diningHalls';
import { favoriteId } from './settings';

export interface SearchHit {
  key: string;
  dish: string;
  desc?: string;
  hallId: string;
  hallName: string;
  day: 'Today' | 'Tomorrow';
  dateLabel: string;
  meal: string;
  hours: string | null;
  station: string;
  fav: boolean;
}

/** Fetch today + tomorrow for every hall in parallel. Failures yield no hits. */
export async function loadSearchIndex(favLabels: string[]): Promise<SearchHit[]> {
  const favIds = new Set(favLabels.map(favoriteId));
  const base = todayInLA();
  const days = [0, 1].map((off) => {
    const d = new Date(base);
    d.setDate(d.getDate() + off);
    return d;
  });

  const jobs: { hall: (typeof DINING_HALLS)[number]; di: number }[] = [];
  for (const hall of DINING_HALLS) {
    for (let di = 0; di < days.length; di++) jobs.push({ hall, di });
  }

  const pages = await Promise.all(
    jobs.map(async ({ hall, di }): Promise<SearchHit[]> => {
      try {
        const menu = await fetchHallMenu(hall.id, days[di]);
        if (menu.status !== 'ok' || !menu.meals) return [];
        const day = (di === 0 ? 'Today' : 'Tomorrow') as 'Today' | 'Tomorrow';
        const dateLabel = `${days[di].getMonth() + 1}/${days[di].getDate()}`;
        const out: SearchHit[] = [];
        for (const meal of menu.meals.map(mergeStations)) {
          const { name, hours } = mealTitle(meal);
          for (const st of meal.stations) {
            for (const item of st.items) {
              out.push({
                key: `${hall.id}|${di}|${meal.name}|${st.name}|${item.name}`,
                dish: item.name,
                desc: item.description,
                hallId: hall.id,
                hallName: hall.name,
                day,
                dateLabel,
                meal: name,
                hours,
                station: toTitle(st.name),
                fav: favIds.has(favoriteId(item.name)),
              });
            }
          }
        }
        return out;
      } catch {
        return [];
      }
    }),
  );
  return pages.flat();
}

/** Substring match on name + description; favorites first, then A–Z. */
export function rankHits(hits: SearchHit[], query: string, cap = 100): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return hits
    .filter((h) => h.dish.toLowerCase().includes(q) || (h.desc?.toLowerCase().includes(q) ?? false))
    .sort((a, b) => Number(b.fav) - Number(a.fav) || a.dish.localeCompare(b.dish))
    .slice(0, cap);
}

export interface Occurrence {
  day: string;
  dateLabel: string;
  hallId: string;
  hallName: string;
  meal: string;
  hours: string | null;
  station: string;
}

export interface DishGroup {
  id: string;
  dish: string;
  fav: boolean;
  score: number;
  occ: Occurrence[];
}

function dayRank(day: string): number {
  return day === 'Today' ? 0 : 1;
}

/**
 * Fuzzy dish search: typo-tolerant name matching (Fuse.js), grouped so each
 * dish appears once with all its day/hall/meal occurrences. Favorites first,
 * then best fuzzy score, then A–Z.
 */
export function searchDishes(index: SearchHit[], query: string, favLabels: string[]): DishGroup[] {
  const q = query.trim();
  if (!q || index.length === 0) return [];
  const favIds = new Set(favLabels.map(favoriteId));

  const byDish = new Map<string, { dish: string; occ: Occurrence[] }>();
  for (const h of index) {
    const id = favoriteId(h.dish);
    let g = byDish.get(id);
    if (!g) {
      g = { dish: h.dish, occ: [] };
      byDish.set(id, g);
    }
    g.occ.push({
      day: h.day,
      dateLabel: h.dateLabel,
      hallId: h.hallId,
      hallName: h.hallName,
      meal: h.meal,
      hours: h.hours,
      station: h.station,
    });
  }

  const fuse = new Fuse(
    [...byDish.entries()].map(([id, g]) => ({ id, ...g })),
    {
      keys: ['dish'],
      threshold: 0.3,
      ignoreLocation: true,
      includeScore: true,
      minMatchCharLength: 2,
    },
  );

  return fuse
    .search(q)
    .slice(0, 60)
    .map((r) => {
      const g = r.item;
      return {
        id: g.id,
        dish: g.dish,
        fav: favIds.has(g.id),
        score: r.score ?? 1,
        occ: g.occ.sort(
          (a, b) => dayRank(a.day) - dayRank(b.day) || a.hallName.localeCompare(b.hallName),
        ),
      } satisfies DishGroup;
    })
    .sort(
      (a, b) => Number(b.fav) - Number(a.fav) || a.score - b.score || a.dish.localeCompare(b.dish),
    )
    .slice(0, 50);
}

function toTitle(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
