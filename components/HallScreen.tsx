import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchHallMenu,
  isGlutenFree,
  matchesDiet,
  mealHoursCompact,
  mealTitle,
  mergeStations,
  pickCurrentMeal,
  shortMealName,
  type HallMenu,
  type Meal,
  type MenuItem,
} from '@/lib/api';
import { nowMinutesInLA } from '@/lib/dates';
import { normalizeMealName, useDay } from '@/lib/day';
import { closureLabel, getClosure, type HallClosure } from '@/lib/closures';
import { HALL_BY_ID, type HallId } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import { useColorScheme } from '@/components/useColorScheme';
import HeartButton from '@/components/HeartButton';

/** In-memory menu cache: `${hall}:${yyyy-m-d}` -> HallMenu */
const cache = new Map<string, HallMenu>();

function cacheKey(hall: HallId, d: Date): string {
  return `${hall}:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function HallScreen({ hallId }: { hallId: HallId }) {
  const hall = HALL_BY_ID[hallId];
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  const theme = hall.colorDark;
  const onTheme = hall.onColor;
  // Solid school color at full opacity behind the menu.
  const contentBg = hall.color;

  // Selected day is shared across all hall pages via DayProvider — the
  // persistent DayStrip above the pager owns selection, so swiping halls
  // keeps the same day. The manually picked meal is shared the same way
  // (by name), so McConnell lunch -> Frary lunch; halls missing that meal
  // fall back to their live/first meal.
  const { selected, date, mealName, selectMealName, stripHeight } = useDay();
  const insets = useSafeAreaInsets();
  // The day bar floats over the pager (absolute), so hall pages pad for it.
  // Falls back to an estimate on the very first frame before measurement.
  const stripPad = stripHeight > 0 ? stripHeight : insets.top + 78;

  const [menu, setMenu] = useState<HallMenu | null>(null);
  const [closure, setClosure] = useState<HallClosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStations, setOpenStations] = useState<number[]>([]);
  const reqId = useRef(0);

  // Stations are deduped: sources repeat e.g. "breakfast @ home" 3x per meal.
  const meals: Meal[] = useMemo(() => (menu?.meals ?? []).map(mergeStations), [menu]);

  // Per-hall default: the live meal today, else the first meal.
  const autoIndex = useMemo(
    () => (meals.length === 0 ? 0 : selected === 0 ? pickCurrentMeal(meals, nowMinutesInLA()) : 0),
    [meals, selected],
  );

  // Shared manual pick wins when this hall serves a meal by that name.
  const mealIndex = useMemo(() => {
    if (meals.length === 0) return 0;
    if (mealName) {
      const j = meals.findIndex((m) => normalizeMealName(m.name) === mealName);
      if (j >= 0) return j;
    }
    return autoIndex;
  }, [meals, mealName, autoIndex]);

  // Collapse stations when the hall, day, or visible meal changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on context change
    setOpenStations([]);
  }, [hallId, date, mealIndex]);

  const load = useCallback(
    async (force = false) => {
      // Disabled halls never hit the API — show the closure message instead.
      const closed = getClosure(hallId, date);
      setClosure(closed);
      if (closed) {
        setMenu(null);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const key = cacheKey(hallId, date);
      const apply = (data: HallMenu) => {
        setMenu(data);
      };
      if (!force && cache.has(key)) {
        apply(cache.get(key)!);
        setLoading(false);
        setError(null);
        return;
      }
      const id = ++reqId.current;
      if (!force) setLoading(true);
      setError(null);
      try {
        const data = await fetchHallMenu(hallId, date);
        if (reqId.current !== id) return;
        cache.set(key, data);
        apply(data);
      } catch (e) {
        if (reqId.current !== id) return;
        setError(e instanceof Error ? e.message : 'Could not load menu');
      } finally {
        if (reqId.current === id) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [hallId, date],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch when hall/date changes
    load();
  }, [load]);

  const selectMeal = (i: number) => {
    const m = meals[i];
    if (m) selectMealName(m.name);
    setOpenStations([]);
  };

  const c = {
    bg: dark ? '#000' : '#F2F2F7',
    card: dark ? '#1C1C1E' : '#fff',
    text: dark ? '#fff' : '#111',
    sub: dark ? '#AEAEB2' : '#666',
    border: dark ? '#38383A' : '#E5E5EA',
  };

  const meal = meals[mealIndex];

  return (
    <View style={[styles.page, { backgroundColor: contentBg }]}>
      {/* Themed header: hall name, then meal tabs (day bar floats above) */}
      <View style={[styles.hero, { backgroundColor: theme, paddingTop: stripPad }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.hallName, { color: onTheme }]}>{hall.name}</Text>
            <Text style={[styles.college, { color: onTheme }]}>{hall.college}</Text>
          </View>
          {hall.logoOnWhite ? (
            <View style={styles.badge}>
              <Image source={hall.logo} style={styles.badgeLogo} resizeMode="contain" />
            </View>
          ) : (
            <Image source={hall.logo} style={styles.logo} resizeMode="contain" />
          )}
        </View>

        {!loading && !error && meals.length > 0 ? (
          <View style={styles.mealTabs}>
            {meals.map((m, i) => {
              const isSel = i === mealIndex;
              const hours = mealHoursCompact(m);
              return (
                <Pressable
                  key={`${m.name}-${i}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={mealTitle(m).name}
                  onPress={() => selectMeal(i)}
                  style={[
                    styles.mealTab,
                    { backgroundColor: hall.color, borderColor: isSel ? '#fff' : 'transparent' },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.mealTabName, { color: '#fff' }]}
                  >
                    {shortMealName(m.name)}
                  </Text>
                  {hours ? (
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[styles.mealTabHours, { color: '#fff' }]}
                    >
                      {hours}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Content: the selected meal only, directly on the school color */}
      <ScrollView
        style={[styles.menu, { backgroundColor: contentBg }]}
        contentContainerStyle={styles.menuContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
      >
        {loading ? (
          <View style={[styles.stateCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <ActivityIndicator size="large" />
            <Text style={[styles.stateText, { color: c.sub }]}>Loading menu…</Text>
          </View>
        ) : error ? (
          <View style={[styles.stateCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.stateTitle, { color: c.text }]}>Couldn&apos;t load menu</Text>
            <Text style={[styles.stateText, { color: c.sub }]}>{error}</Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                load(true);
              }}
              style={[styles.retry, { backgroundColor: theme }]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : closure ? (
          <View style={[styles.stateCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.stateTitle, { color: c.text }]}>
              {hall.name} closed until {closureLabel(closure)}
            </Text>
            <Text style={[styles.stateText, { color: c.sub }]}>{closure.reason}</Text>
          </View>
        ) : !meal ? (
          <View style={[styles.stateCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.stateTitle, { color: c.text }]}>No menu posted</Text>
            <Text style={[styles.stateText, { color: c.sub }]}>
              {menu?.status === 'unavailable'
                ? 'This hall has no data for this date yet — often posted closer to the day.'
                : 'Nothing posted for this date yet.'}
            </Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                load(true);
              }}
              style={[styles.retry, { backgroundColor: theme }]}
            >
              <Text style={styles.retryText}>Check again</Text>
            </Pressable>
          </View>
        ) : (
          <MealBody
            meal={meal}
            accent={hall.colorDark}
            openStations={openStations}
            setOpenStations={setOpenStations}
          />
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function MealBody({
  meal,
  accent,
  openStations,
  setOpenStations,
}: {
  meal: Meal;
  accent: string;
  openStations: number[];
  setOpenStations: (v: number[] | ((p: number[]) => number[])) => void;
}) {
  const prefs = usePrefs();
  const { name, hours } = mealTitle(meal);

  // Menu body always sits directly on the school color, so all text is white
  // in both modes (secondary text at reduced opacity).
  const text = '#fff';
  const sub = 'rgba(255, 255, 255, 0.75)';
  const border = 'rgba(255, 255, 255, 0.25)';

  const itemCount = meal.stations.reduce((n, s) => n + s.items.length, 0);

  const toggleStation = (i: number) =>
    setOpenStations((prev: number[]) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const filtersActive = prefs.veganOnly || prefs.vegetarianOnly;

  const isMatch = (it: MenuItem) => matchesDiet(it, prefs);

  const allOpen =
    meal.stations.length > 0 && meal.stations.every((_, i) => openStations.includes(i));

  return (
    <View style={styles.mealBody}>
      <View style={styles.mealHead}>
        <View style={styles.mealTitles}>
          <Text style={[styles.mealName, { color: text }]}>{name}</Text>
          {hours ? (
            <Text style={[styles.mealHours, { color: sub }]}>{hours}</Text>
          ) : (
            <Text style={[styles.mealHours, { color: sub }]}>
              {meal.stations.length} stations · {itemCount} items
            </Text>
          )}
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => setOpenStations(allOpen ? [] : meal.stations.map((_, i) => i))}
          style={styles.bulkBtn}
        >
          <Text style={[styles.bulk, { color: accent }]}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Text>
        </Pressable>
      </View>
      {meal.stations.map((st, si) => {
        const matchCount = st.items.filter(isMatch).length;
        const sOpen = openStations.includes(si);
        const vg = st.items.filter((i) => i.vegan).length;
        return (
          <View key={`${st.name}-${si}`} style={[styles.station, { backgroundColor: accent }]}>
            <Pressable
              onPress={() => toggleStation(si)}
              accessibilityRole="button"
              accessibilityState={{ expanded: sOpen }}
              style={styles.stationHeader}
            >
              <Text style={[styles.stationName, { color: text }]}>{toTitle(st.name)}</Text>
              <Text style={[styles.stationMeta, { color: sub }]}>
                {filtersActive ? `${matchCount} of ${st.items.length} match` : st.items.length}
                {prefs.veganOnly ? ` · ${vg} VG` : ''}
              </Text>
              <Text style={[styles.chev, { color: sub }]}>{sOpen ? '▾' : '▸'}</Text>
            </Pressable>
            {sOpen ? (
              <View style={styles.items}>
                {st.items.map((it, ii) => {
                  const match = !filtersActive || isMatch(it);
                  return (
                    <View
                      key={`${it.name}-${ii}`}
                      style={[styles.item, { borderTopColor: border, opacity: match ? 1 : 0.4 }]}
                    >
                      <View style={styles.itemRow}>
                        <Text style={[styles.itemName, { color: text }]}>{it.name}</Text>
                        <DietBadges item={it} showCalories={prefs.showCalories} dimmed={!match} />
                        {prefs.favoritesEnabled ? <HeartButton label={it.name} /> : null}
                      </View>
                      {prefs.showDescriptions && it.description ? (
                        <Text style={[styles.itemDesc, { color: sub }]}>{it.description}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function DietBadges({
  item,
  showCalories,
  dimmed,
}: {
  item: MenuItem;
  showCalories: boolean;
  dimmed: boolean;
}) {
  return (
    <View style={[styles.badges, dimmed && styles.badgesDimmed]}>
      {item.vegan ? (
        <View style={[styles.badgeChip, { backgroundColor: '#2E7D32' }]}>
          <Text style={styles.chipText}>VG</Text>
        </View>
      ) : item.vegetarian ? (
        <View style={[styles.badgeChip, { backgroundColor: '#7CB342' }]}>
          <Text style={styles.chipText}>V</Text>
        </View>
      ) : null}
      {isGlutenFree(item) ? (
        <View style={[styles.badgeChip, { backgroundColor: '#8D6E63' }]}>
          <Text style={styles.chipText}>GF</Text>
        </View>
      ) : null}
      {showCalories && typeof item.calories === 'number' ? (
        <Text style={[styles.cal, { color: 'rgba(255, 255, 255, 0.75)' }]}>
          {item.calories} cal
        </Text>
      ) : null}
    </View>
  );
}

function toTitle(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  hero: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  headerLeft: { flex: 1 },
  hallName: { fontSize: 26, fontWeight: '800' },
  college: { fontSize: 14, marginTop: 2, opacity: 0.9 },
  logo: { width: 56, height: 56 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeLogo: { width: 44, height: 44 },
  mealTabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  mealTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  mealTabName: { fontSize: 13, fontWeight: '700' },
  mealTabHours: { fontSize: 10, marginTop: 2, opacity: 0.9 },
  menu: { flex: 1 },
  menuContent: { paddingHorizontal: 12, paddingTop: 12, gap: 12 },
  stateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  stateTitle: { fontSize: 18, fontWeight: '700' },
  stateText: { fontSize: 14, textAlign: 'center' },
  retry: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '700' },
  mealBody: { gap: 8 },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealTitles: { flex: 1 },
  mealName: { fontSize: 19, fontWeight: '800' },
  mealHours: { fontSize: 13, marginTop: 2 },
  bulk: { fontSize: 13, fontWeight: '800' },
  bulkBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  station: { borderRadius: 10, overflow: 'hidden' },
  stationHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  stationName: { flex: 1, fontSize: 15, fontWeight: '700' },
  stationMeta: { fontSize: 12 },
  chev: { fontSize: 18, width: 20, textAlign: 'center' },
  items: { paddingHorizontal: 12, paddingBottom: 8 },
  item: { borderTopWidth: 1, paddingVertical: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600' },
  itemDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgesDimmed: { opacity: 0.6 },
  badgeChip: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  chipText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cal: { fontSize: 11, color: '#8E8E93' },
});
