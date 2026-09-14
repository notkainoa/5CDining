import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  isGlutenFree,
  matchesDiet,
  mealHoursCompact,
  mergeStations,
  pickCurrentMeal,
  shortMealName,
  type HallMenu,
  type Meal,
  type MenuItem,
} from '@/lib/api';
import { SCHOOL_RADIUS, nestedRadius, useHallBottomJoin } from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';
import { mealKey, useDay } from '@/lib/day';
import { closureLabel, getClosure, type HallClosure } from '@/lib/closures';
import { HALL_BY_ID, type HallId } from '@/lib/diningHalls';
import { loadHallMenu } from '@/lib/menuCache';
import { usePrefs } from '@/lib/settings';
import { useDim } from '@/lib/dim';
import DietBadge from '@/components/DietBadge';
import HeartButton from '@/components/HeartButton';
import MealPicker from '@/components/MealPicker';
import SchoolLogo from '@/components/SchoolLogo';

export default function HallScreen({ hallId }: { hallId: HallId }) {
  const hall = HALL_BY_ID[hallId];
  const { selected, date, mealName, selectMealName, nowMinutes } = useDay();
  const { arm, disarm } = useDim();
  const { join } = useHallBottomJoin();
  const { expandAllDefault } = usePrefs();

  const [menu, setMenu] = useState<HallMenu | null>(null);
  const [closure, setClosure] = useState<HallClosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStations, setOpenStations] = useState<number[]>([]);
  const [picker, setPicker] = useState<null | 'meal'>(null);
  const reqId = useRef(0);

  const meals: Meal[] = useMemo(() => (menu?.meals ?? []).map(mergeStations), [menu]);

  const autoIndex = useMemo(
    () => (meals.length === 0 ? 0 : selected === 0 ? pickCurrentMeal(meals, nowMinutes) : 0),
    [meals, selected, nowMinutes],
  );

  const mealIndex = useMemo(() => {
    if (meals.length === 0) return 0;
    if (mealName) {
      const j = meals.findIndex((m) => mealKey(m) === mealName);
      if (j >= 0) return j;
    }
    return autoIndex;
  }, [meals, mealName, autoIndex]);

  const expandAllRef = useRef(expandAllDefault);
  expandAllRef.current = expandAllDefault;
  const stationCount = meals[mealIndex]?.stations.length ?? 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset open stations for a new menu
    setOpenStations(
      expandAllRef.current && stationCount > 0 ? Array.from({ length: stationCount }, (_, i) => i) : [],
    );
  }, [hallId, date, mealIndex, stationCount]);

  const load = useCallback(
    async (force = false) => {
      const closed = getClosure(hallId, date);
      setClosure(closed);
      if (closed) {
        setMenu(null);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const id = ++reqId.current;
      if (!force) setLoading(true);
      setError(null);
      try {
        const data = await loadHallMenu(hallId, date, force);
        if (reqId.current !== id) return;
        setMenu(data);
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

  const closePicker = () => {
    setPicker(null);
    disarm();
  };

  const selectMeal = (i: number) => {
    const m = meals[i];
    if (m) selectMealName(mealKey(m));
    closePicker();
  };

  const openMealPicker = () => {
    if (picker === 'meal') {
      closePicker();
      return;
    }
    arm(closePicker);
    setPicker('meal');
  };

  const meal = meals[mealIndex];
  const hours = meal ? mealHoursCompact(meal) : null;

  return (
    <View style={styles.page}>
      {picker ? (
        <Pressable style={styles.pageOverlay} onPress={closePicker} accessibilityLabel="Dismiss" />
      ) : null}
      <View
        style={[
          styles.school,
          {
            backgroundColor: hall.color,
            borderBottomLeftRadius: nestedRadius(join.bl),
            borderBottomRightRadius: nestedRadius(join.br),
          },
          picker ? styles.schoolFront : null,
        ]}
      >
        {picker ? (
          <Pressable style={styles.overlay} onPress={closePicker} accessibilityLabel="Dismiss" />
        ) : null}

        <View style={styles.headerRow}>
          <Text style={[styles.hallName, { color: hall.onColor }]}>{hall.name}</Text>
          <SchoolLogo hall={hall} size={52} />
        </View>

        <View
          style={[styles.mealRow, picker === 'meal' && styles.raiseOn]}
          pointerEvents="box-none"
        >
          {!loading && !error && meals.length > 0 ? (
            <Pressable
              onPress={openMealPicker}
              style={[styles.mealHit, picker === 'meal' && styles.triggerOn]}
              accessibilityRole="button"
              accessibilityLabel={`${shortMealName(meal?.name ?? 'Meal')}, choose meal`}
            >
              <Text
                style={[
                  styles.mealPillName,
                  { color: picker === 'meal' ? Theme.white : hall.onColor },
                ]}
              >
                {shortMealName(meal?.name ?? '')}
              </Text>
              <Text
                style={[styles.mealChev, { color: picker === 'meal' ? Theme.white : hall.onColor }]}
              >
                ▾
              </Text>
            </Pressable>
          ) : null}
          {hours ? (
            <View style={styles.hoursWrap} pointerEvents="none">
              <Text style={[styles.mealHours, { color: hall.onColor }]}>{hours}</Text>
              {picker === 'meal' ? <View pointerEvents="none" style={styles.hoursScrim} /> : null}
            </View>
          ) : null}
          {picker === 'meal' ? (
            <View style={styles.dropAbs} pointerEvents="box-none">
              <MealPicker meals={meals} selected={mealIndex} onSelect={selectMeal} />
            </View>
          ) : null}
        </View>

        <View style={styles.food}>
          <ScrollView
            style={styles.menu}
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
              <View style={styles.state}>
                <ActivityIndicator size="large" color={Theme.darkGray} />
                <Text style={styles.stateText}>Loading menu…</Text>
              </View>
            ) : error ? (
              <View style={styles.state}>
                <Text style={styles.stateTitle}>Couldn&apos;t load menu</Text>
                <Text style={styles.stateText}>{error}</Text>
                <Pressable
                  onPress={() => {
                    setLoading(true);
                    load(true);
                  }}
                  style={[styles.retry, { backgroundColor: hall.color }]}
                >
                  <Text style={[styles.retryText, { color: hall.onColor }]}>Retry</Text>
                </Pressable>
              </View>
            ) : closure ? (
              <View style={styles.state}>
                <Text style={styles.stateTitle}>
                  {hall.name} closed until {closureLabel(closure)}
                </Text>
                <Text style={styles.stateText}>{closure.reason}</Text>
              </View>
            ) : !meal ? (
              <View style={styles.state}>
                <Text style={styles.stateTitle}>No menu posted</Text>
                <Text style={styles.stateText}>
                  {menu?.error === 'unsupported_date'
                    ? 'Only today and tomorrow are posted.'
                    : menu?.status === 'unavailable'
                      ? 'This hall has no data for this date yet. Menus often go up closer to the day.'
                      : 'Nothing posted for this date yet.'}
                </Text>
                <Pressable
                  onPress={() => {
                    setLoading(true);
                    load(true);
                  }}
                  style={[styles.retry, { backgroundColor: hall.color }]}
                >
                  <Text style={[styles.retryText, { color: hall.onColor }]}>Check again</Text>
                </Pressable>
              </View>
            ) : (
              <MealBody meal={meal} openStations={openStations} setOpenStations={setOpenStations} />
            )}
            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

function MealBody({
  meal,
  openStations,
  setOpenStations,
}: {
  meal: Meal;
  openStations: number[];
  setOpenStations: (v: number[] | ((p: number[]) => number[])) => void;
}) {
  const prefs = usePrefs();
  const filtersActive =
    prefs.veganOnly || prefs.vegetarianOnly || prefs.glutenFreeOnly || prefs.plantBasedOnly;
  const isMatch = (it: MenuItem) => matchesDiet(it, prefs);
  const allOpen =
    meal.stations.length > 0 && meal.stations.every((_, i) => openStations.includes(i));
  const dishCount = meal.stations.reduce((n, st) => n + st.items.length, 0);
  const matchCount = filtersActive
    ? meal.stations.reduce((n, st) => n + st.items.filter(isMatch).length, 0)
    : dishCount;

  const toggleStation = (i: number) =>
    setOpenStations((prev: number[]) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  return (
    <View style={styles.mealBody}>
      <View style={styles.bulkRow}>
        <Text style={styles.dishCount}>
          {filtersActive ? `${matchCount}/${dishCount}` : dishCount}{' '}
          {dishCount === 1 ? 'dish' : 'dishes'}
        </Text>
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={allOpen ? 'Collapse all stations' : 'Expand all stations'}
          onPress={() => setOpenStations(allOpen ? [] : meal.stations.map((_, i) => i))}
        >
          <Text style={styles.bulk}>{allOpen ? 'Collapse all' : 'Expand all'}</Text>
        </Pressable>
      </View>
      {meal.stations.map((st, si) => {
        const sOpen = openStations.includes(si);
        const matchCount = st.items.filter(isMatch).length;
        return (
          <View key={`${st.name}-${si}`} style={styles.station}>
            <Pressable
              onPress={() => toggleStation(si)}
              accessibilityRole="button"
              accessibilityState={{ expanded: sOpen }}
              style={styles.stationHeader}
            >
              <Text style={styles.stationName}>{toTitle(st.name)}</Text>
              <View style={styles.stationLine} />
              {filtersActive ? (
                <Text style={styles.stationMeta}>
                  {matchCount}/{st.items.length}
                </Text>
              ) : null}
              <Text style={styles.stationChev}>{sOpen ? '▾' : '›'}</Text>
            </Pressable>
            {sOpen
              ? st.items.map((it, ii) => {
                  const match = !filtersActive || isMatch(it);
                  return (
                    <View
                      key={`${it.name}-${ii}`}
                      style={[styles.item, { opacity: match ? 1 : 0.4 }]}
                    >
                      <View style={styles.itemRow}>
                        <Text style={styles.itemName}>{it.name}</Text>
                        <DietLabels item={it} showCalories={prefs.showCalories} />
                        {prefs.favoritesEnabled ? <HeartButton label={it.name} /> : null}
                      </View>
                      {prefs.showDescriptions && it.description ? (
                        <Text style={styles.itemDesc}>{it.description}</Text>
                      ) : null}
                    </View>
                  );
                })
              : null}
          </View>
        );
      })}
    </View>
  );
}

function DietLabels({ item, showCalories }: { item: MenuItem; showCalories: boolean }) {
  return (
    <View style={styles.labels}>
      {item.vegan ? (
        <DietBadge kind="vegan" />
      ) : item.vegetarian ? (
        <DietBadge kind="vegetarian" />
      ) : null}
      {isGlutenFree(item) ? <DietBadge kind="glutenFree" /> : null}
      {item.plantBased && !item.vegan ? <DietBadge kind="plantBased" /> : null}
      {showCalories && typeof item.calories === 'number' ? (
        <Text style={styles.label}>{item.calories} cal</Text>
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
  page: {
    flex: 1,
    backgroundColor: Theme.darkerGray,
  },
  pageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.overlay,
    zIndex: 1,
  },
  school: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: SCHOOL_RADIUS,
    borderBottomRightRadius: SCHOOL_RADIUS,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 10,
  },
  schoolFront: {
    zIndex: 2,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.overlay,
    zIndex: 1,
  },
  raiseOn: {
    zIndex: 2,
    elevation: 8,
    position: 'relative',
  },
  dropAbs: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  hallName: {
    color: Theme.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    minHeight: 44,
  },
  mealHit: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 6,
  },
  triggerOn: {
    backgroundColor: Theme.trigger,
    marginHorizontal: -8,
    paddingHorizontal: 12,
  },
  mealPillName: {
    color: Theme.white,
    fontSize: 17,
    fontWeight: '700',
  },
  mealChev: { color: Theme.white, fontSize: 14, fontWeight: '700' },
  mealHours: {
    color: Theme.white,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  hoursWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  hoursScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.overlay,
  },
  food: {
    flex: 1,
    zIndex: 0,
    backgroundColor: Theme.white,
    borderRadius: 20,
    marginHorizontal: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  menu: { flex: 1 },
  menuContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  state: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  stateTitle: { fontSize: 18, fontWeight: '700', color: Theme.black, textAlign: 'center' },
  stateText: { fontSize: 14, color: Theme.foodItem, textAlign: 'center' },
  retry: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: Theme.white, fontWeight: '700' },
  mealBody: { gap: 4 },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bulk: { fontSize: 13, fontWeight: '700', color: Theme.foodItem },
  dishCount: { fontSize: 13, fontWeight: '600', color: Theme.foodItem },
  station: { paddingBottom: 6 },
  stationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  stationName: {
    color: Theme.black,
    fontSize: 16,
    fontWeight: '700',
  },
  stationLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.black,
  },
  stationMeta: { fontSize: 11, color: Theme.foodItem, fontWeight: '600' },
  stationChev: { color: Theme.black, fontSize: 18, width: 18, textAlign: 'center' },
  item: { paddingLeft: 2, paddingBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Theme.foodItem,
  },
  itemDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
    color: Theme.foodMuted,
    paddingRight: 8,
  },
  labels: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 1 },
  label: { fontSize: 12, fontWeight: '600', color: Theme.foodItem },
});
