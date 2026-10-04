import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  mealHoursCompact,
  mergeStations,
  pickCurrentMeal,
  type HallMenu,
  type Meal,
  type MealPeriod,
  type MenuItem,
} from '@/lib/api';
import {
  SCHOOL_RADIUS,
  nestedRadius,
  useFlight,
  useHallBottomJoin,
  useTopCorners,
} from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';
import { useDay } from '@/lib/day';
import { orderedHalls, type DiningHall, type HallId } from '@/lib/diningHalls';
import { loadHallMenu } from '@/lib/menuCache';
import {
  mealIndexForSelection,
  mealSelectionIntent,
  type MealSelectionIntent,
} from '@/lib/mealSelection';
import { usePrefs } from '@/lib/settings';
import { useTabNav } from '@/lib/tabNav';
import SchoolLogo from '@/components/SchoolLogo';

type HallResult =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; menu: HallMenu };

const PERIOD_ORDER: MealPeriod[] = ['breakfast', 'brunch', 'lunch', 'dinner', 'late_night'];
const PERIOD_LABEL: Record<MealPeriod, string> = {
  breakfast: 'Breakfast',
  brunch: 'Brunch',
  lunch: 'Lunch',
  dinner: 'Dinner',
  late_night: 'Late night',
};

const LOW_PRIORITY_STATION =
  /bakery|beverage|condiment|dessert|salad bar|sauce|soup|stock pot|sweet/i;
const HIGH_PRIORITY_STATION = /@home|entree|expo|grill|main|option|oven|plant forward|special|wok/i;
const MAIN_WORDS =
  /beef|burger|burrito|chicken|chili|curry|fish|lasagna|noodle|pasta|pork|ramen|salmon|sandwich|steak|stew|tempeh|tofu|turkey/i;

function itemScore(item: MenuItem, stationName: string): number {
  let score = item.featured === true ? 4 : 0;
  if (HIGH_PRIORITY_STATION.test(stationName)) score += 5;
  if (LOW_PRIORITY_STATION.test(stationName)) score -= 12;
  if (MAIN_WORDS.test(item.name)) score += 4;
  if (typeof item.calories === 'number') score += Math.min(item.calories, 900) / 300;
  return score;
}

/** Temporary preview picker. The API's highlight IDs should replace this ranking. */
function previewHighlights(meal: Meal): MenuItem[] {
  const stationPicks = meal.stations
    .filter((station) => station.items.length > 0 && !LOW_PRIORITY_STATION.test(station.name))
    .map(
      (station) =>
        [...station.items]
          .map((item) => ({ item, score: itemScore(item, station.name) }))
          .sort((left, right) => right.score - left.score)[0],
    )
    .filter((pick): pick is { item: MenuItem; score: number } => Boolean(pick))
    .sort((left, right) => right.score - left.score);

  const seen = new Set<string>();
  const picks: MenuItem[] = [];
  for (const { item } of stationPicks) {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picks.push(item);
    if (picks.length === 4) break;
  }
  return picks;
}

function emptyResults(halls: DiningHall[]): Record<HallId, HallResult> {
  return Object.fromEntries(halls.map((hall) => [hall.id, { status: 'loading' }])) as Record<
    HallId,
    HallResult
  >;
}

export default function OverviewScreen() {
  const { hallOrder } = usePrefs();
  const halls = useMemo(() => orderedHalls(hallOrder), [hallOrder]);
  const { date, selected, mealSelection, selectMeal, selectAutomaticMeal, nowMinutes } = useDay();
  const { navigate } = useTabNav();
  const { join } = useHallBottomJoin();
  const [results, setResults] = useState<Record<HallId, HallResult>>(() => emptyResults(halls));
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const flight = useFlight();
  const topCorners = useTopCorners();
  const topStyle = useAnimatedStyle(() => ({
    borderTopLeftRadius: (flight?.value ?? 0) * (topCorners?.l.value ?? 0),
    borderTopRightRadius: (flight?.value ?? 0) * (topCorners?.r.value ?? 0),
  }));

  const load = useCallback(
    async (force = false) => {
      const id = ++requestId.current;
      if (!force) setResults(emptyResults(halls));

      const settled = await Promise.allSettled(
        halls.map(async (hall) => ({
          hallId: hall.id,
          menu: await loadHallMenu(hall.id, date, force),
        })),
      );
      if (requestId.current !== id) return;

      const next = emptyResults(halls);
      settled.forEach((result, index) => {
        const hallId = halls[index].id;
        next[hallId] =
          result.status === 'fulfilled'
            ? { status: 'ready', menu: result.value.menu }
            : {
                status: 'error',
                message:
                  result.reason instanceof Error ? result.reason.message : 'Could not load menu',
              };
      });
      setResults(next);
      setRefreshing(false);
    },
    [date, halls],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch when date/order changes
    load();
  }, [load]);

  const menus = useMemo(
    () =>
      halls.flatMap((hall) => {
        const result = results[hall.id];
        return result?.status === 'ready' ? [result.menu] : [];
      }),
    [halls, results],
  );

  const periods = useMemo(() => {
    const found = new Set<MealPeriod>();
    menus.forEach((menu) =>
      (menu.meals ?? []).forEach((meal) => {
        const period = mealSelectionIntent(meal).period;
        if (period) found.add(period);
      }),
    );
    return PERIOD_ORDER.filter((period) => found.has(period));
  }, [menus]);

  useEffect(() => {
    if (mealSelection || menus.length === 0) return;
    const meals = (menus[0].meals ?? []).map(mergeStations);
    if (meals.length === 0) return;
    const automatic = meals[selected === 0 ? pickCurrentMeal(meals, nowMinutes) : 0];
    if (automatic) selectAutomaticMeal(mealSelectionIntent(automatic));
  }, [mealSelection, menus, nowMinutes, selectAutomaticMeal, selected]);

  const choosePeriod = (period: MealPeriod) => {
    selectMeal({ service: period, period });
  };

  return (
    <View style={styles.page}>
      <Animated.View
        style={[
          styles.overview,
          {
            borderBottomLeftRadius: nestedRadius(join.bl),
            borderBottomRightRadius: nestedRadius(join.br),
          },
          topStyle,
        ]}
      >
        <View style={styles.mealSelector}>
          <Text style={styles.eyebrow}>MEAL</Text>
          <FlatList
            horizontal
            data={periods}
            keyExtractor={(period) => period}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mealList}
            renderItem={({ item: period }) => {
              const active = mealSelection?.period === period;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => choosePeriod(period)}
                  style={({ pressed }) => [
                    styles.mealChip,
                    active && styles.mealChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.mealChipText, active && styles.mealChipTextActive]}>
                    {PERIOD_LABEL[period]}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.mealChipPlaceholder}>
                <Text style={styles.mealChipPlaceholderText}>Loading meals…</Text>
              </View>
            }
          />
        </View>

        <FlatList
          data={halls}
          keyExtractor={(hall) => hall.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.cards}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={Theme.white}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
            />
          }
          renderItem={({ item: hall }) => (
            <HallOverviewCard
              hall={hall}
              result={results[hall.id] ?? { status: 'loading' }}
              selection={mealSelection}
              selectedDay={selected}
              nowMinutes={nowMinutes}
              onOpen={() => navigate(hall.id)}
              onRetry={() => load(true)}
            />
          )}
        />
      </Animated.View>
    </View>
  );
}

function HallOverviewCard({
  hall,
  result,
  selection,
  selectedDay,
  nowMinutes,
  onOpen,
  onRetry,
}: {
  hall: DiningHall;
  result: HallResult;
  selection: MealSelectionIntent | null;
  selectedDay: number;
  nowMinutes: number;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const meals = useMemo(
    () => (result.status === 'ready' ? (result.menu.meals ?? []).map(mergeStations) : []),
    [result],
  );
  const autoIndex =
    meals.length === 0 ? 0 : selectedDay === 0 ? pickCurrentMeal(meals, nowMinutes) : 0;
  const mealIndex = mealIndexForSelection(meals, selection, autoIndex);
  const meal = meals[mealIndex];
  const items = meal ? previewHighlights(meal) : [];
  const hours = meal ? mealHoursCompact(meal) : null;

  return (
    <View style={[styles.card, { backgroundColor: hall.color }]}>
      <View style={styles.cardHeader}>
        <View style={styles.hallIdentity}>
          <SchoolLogo hall={hall} size={40} />
          <View style={styles.hallText}>
            <Text style={[styles.hallName, { color: hall.onColor }]}>{hall.name}</Text>
            <Text style={[styles.mealName, { color: hall.onColor }]} numberOfLines={1}>
              {meal ? `${meal.name}${hours ? ` · ${hours}` : ''}` : hall.collegeShort}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open full ${hall.name} menu`}
          onPress={onOpen}
          style={({ pressed }) => [styles.fullMenu, pressed && styles.pressed]}
        >
          <Text style={styles.fullMenuText}>Full menu</Text>
          <Text style={styles.fullMenuArrow}>›</Text>
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        {result.status === 'loading' ? (
          <View style={styles.cardState}>
            <ActivityIndicator color={Theme.darkGray} />
            <Text style={styles.stateText}>Loading highlights…</Text>
          </View>
        ) : result.status === 'error' ? (
          <View style={styles.cardState}>
            <Text style={styles.stateTitle}>Couldn&apos;t load this menu</Text>
            <Pressable onPress={onRetry} accessibilityRole="button">
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : !meal || items.length === 0 ? (
          <View style={styles.cardState}>
            <Text style={styles.stateTitle}>No highlights posted</Text>
            <Text style={styles.stateText}>Check the full menu for availability.</Text>
          </View>
        ) : (
          items.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.dishRow}>
              <View style={[styles.dot, { backgroundColor: hall.color }]} />
              <Text style={styles.dishName}>{item.name}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Theme.darkerGray },
  overview: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: Theme.darkGray,
    overflow: 'hidden',
    borderBottomLeftRadius: SCHOOL_RADIUS,
    borderBottomRightRadius: SCHOOL_RADIUS,
  },
  mealSelector: { paddingTop: 10, paddingBottom: 12, gap: 7 },
  eyebrow: {
    paddingHorizontal: 16,
    color: Theme.gray,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  mealList: { paddingHorizontal: 12, gap: 8 },
  mealChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Theme.darkerGray,
  },
  mealChipActive: { backgroundColor: Theme.white },
  mealChipText: { color: Theme.white, fontSize: 15, fontWeight: '700' },
  mealChipTextActive: { color: Theme.black },
  mealChipPlaceholder: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: Theme.darkerGray,
  },
  mealChipPlaceholderText: { color: Theme.gray, fontSize: 14, fontWeight: '600' },
  cards: { paddingHorizontal: 8, paddingBottom: 12, gap: 10 },
  card: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardHeader: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hallIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hallText: { flex: 1, minWidth: 0 },
  hallName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  mealName: { marginTop: 2, fontSize: 12, fontWeight: '600', opacity: 0.78 },
  fullMenu: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 13,
    paddingRight: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    gap: 5,
  },
  fullMenuText: { color: Theme.white, fontSize: 13, fontWeight: '700' },
  fullMenuArrow: { color: Theme.white, fontSize: 20, lineHeight: 20, fontWeight: '500' },
  cardBody: {
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    minHeight: 76,
    backgroundColor: Theme.white,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  dishRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  dishName: { flex: 1, color: Theme.foodItem, fontSize: 15, fontWeight: '600' },
  cardState: { minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 7 },
  stateTitle: { color: Theme.black, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  stateText: { color: Theme.foodMuted, fontSize: 13, textAlign: 'center' },
  retry: { color: Theme.darkGray, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
