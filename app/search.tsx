import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Redirect, useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import { CHROME_INSET, CHROME_RADIUS, INNER_CHIP_RADIUS } from '@/components/HallChrome';
import HeartButton from '@/components/HeartButton';
import { Theme } from '@/constants/Theme';
import { todayInLA } from '@/lib/dates';
import { HALL_BY_ID, type HallId } from '@/lib/diningHalls';
import {
  compareOccurrences,
  loadSearchIndex,
  searchDishes,
  type DishGroup,
  type SearchHit,
} from '@/lib/search';
import { favoriteId, SEARCH_FEATURES, usePrefs } from '@/lib/settings';

const SEARCH_SYMBOL = { ios: 'magnifyingglass', android: 'search', web: 'search' } as const;
const CLOSE_SYMBOL = { ios: 'xmark', android: 'close', web: 'close' } as const;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER_SPRING = { duration: 340, dampingRatio: 1 };
const EXIT_MS = 180;
const REDUCE_MS = 140;

const webInputStyle =
  Platform.OS === 'web'
    ? ({
        outlineWidth: 0,
        outlineStyle: 'none',
        outlineColor: 'transparent',
        boxShadow: 'none',
        caretColor: Theme.white,
        cursor: 'text',
      } as Record<string, string | number>)
    : null;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function SearchScreen() {
  if (!SEARCH_FEATURES) return <Redirect href="/(tabs)" />;
  return <SearchScreenInner />;
}

function SearchScreenInner() {
  const prefs = usePrefs();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const reduceMotion = useReducedMotion() === true;
  const progress = useSharedValue(0);
  const allowingRemove = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resultsH, setResultsH] = useState(0);
  const [wrapH, setWrapH] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const loadedDay = useRef('');

  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  useEffect(() => {
    progress.set(
      reduceMotion
        ? withTiming(1, { duration: REDUCE_MS, easing: EASE_OUT })
        : withSpring(1, ENTER_SPRING),
    );
  }, [progress, reduceMotion]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (allowingRemove.current) return;
      e.preventDefault();
      allowingRemove.current = true;
      const action = e.data.action;
      const finish = () => navigation.dispatch(action);
      const unlock = () => {
        allowingRemove.current = false;
      };
      progress.set(
        withTiming(
          0,
          { duration: reduceMotion ? REDUCE_MS : EXIT_MS, easing: EASE_OUT },
          (finished) => {
            if (finished) runOnJS(finish)();
            else runOnJS(unlock)();
          },
        ),
      );
    });
    return sub;
  }, [navigation, progress, reduceMotion]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (event: Event) => {
      if ('key' in event && event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [dismiss]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setIndex(await loadSearchIndex(prefs.favorites));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [prefs.favorites]);

  useFocusEffect(
    useCallback(() => {
      const key = dayKey(todayInLA());
      if (index === null || loadedDay.current !== key) {
        loadedDay.current = key;
        load();
      }
    }, [index, load]),
  );

  const favSet = useMemo(() => new Set(prefs.favorites.map(favoriteId)), [prefs.favorites]);

  const groups = useMemo(
    () => searchDishes(index ?? [], query, prefs.favorites),
    [index, query, prefs.favorites],
  );

  const favGroups = useMemo(() => {
    const byId = new Map<string, DishGroup>();
    for (const h of index ?? []) {
      const id = favoriteId(h.dish);
      if (!favSet.has(id)) continue;
      let g = byId.get(id);
      if (!g) {
        g = { id, dish: h.dish, fav: true, score: 0, occ: [] };
        byId.set(id, g);
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
    for (const label of prefs.favorites) {
      const id = favoriteId(label);
      if (!byId.has(id)) byId.set(id, { id, dish: label, fav: true, score: 0, occ: [] });
    }
    return [...byId.values()]
      .map((g) => ({
        ...g,
        occ: g.occ.sort(compareOccurrences),
      }))
      .sort((a, b) => a.dish.localeCompare(b.dish));
  }, [index, prefs.favorites, favSet]);

  let body: ReactNode;
  if (!prefs.searchEnabled) {
    body = (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search is off</Text>
        <Text style={styles.hint}>
          Enable it in Settings to search dishes across all dining halls.
        </Text>
      </View>
    );
  } else if (loading && index === null) {
    body = (
      <View style={styles.card}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Loading today + tomorrow…</Text>
      </View>
    );
  } else if (failed && index === null) {
    body = (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Couldn&apos;t load menus</Text>
        <Pressable
          onPress={load}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  } else if (query.trim()) {
    body =
      groups.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.hint}>{`No dishes match "${query.trim()}".`}</Text>
        </View>
      ) : (
        groups.map((g) => <DishCard key={g.id} group={g} />)
      );
  } else if (prefs.favoritesEnabled) {
    body =
      prefs.favorites.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.hint}>
            Tap ♥ on any dish to save it here. Search above to find dishes across all halls.
          </Text>
        </View>
      ) : (
        favGroups.map((g) => <DishCard key={g.id} group={g} />)
      );
  } else {
    body = (
      <View style={styles.card}>
        <Text style={styles.hint}>
          Search dishes across all 7 dining halls, today and tomorrow.
        </Text>
      </View>
    );
  }

  const listing =
    (query.trim() && groups.length > 0) ||
    (!query.trim() && prefs.favoritesEnabled && favGroups.length > 0);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const panelStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (reduceMotion) return { opacity: p };
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * -10 }, { scale: 0.96 + 0.04 * p }],
    };
  });

  const sideGutter = Math.max(insets.left, insets.right, CHROME_INSET) + (winW < 600 ? 18 : 8);
  const padTop = Math.max(insets.top, CHROME_INSET) + 48;
  const bottomPad = Math.max((insets.bottom * 6) / 10, CHROME_INSET) + 56;
  // winH doesn't shrink with the iOS keyboard (behavior="padding" shrinks the
  // wrap instead), so also clamp to the measured space the panel can occupy.
  // Otherwise the ScrollView viewport equals its content height and the portion
  // clipped by panelLift's maxHeight: '100%' has a zero scroll range.
  const winCap = Math.max(96, Math.round(winH * 0.5));
  const panelOverhead = CHROME_INSET * 2 + 8;
  const measuredCap = wrapH > 0 ? wrapH - padTop - bottomPad - headerH - panelOverhead : undefined;
  const maxResults =
    measuredCap != null ? Math.max(48, Math.min(winCap, Math.floor(measuredCap))) : winCap;
  const resultsHeight = listing && resultsH > 0 ? Math.min(resultsH, maxResults) : undefined;

  return (
    <View style={styles.shell} accessibilityViewIsModal>
      <StatusBar style="light" />
      <Animated.View style={[styles.scrim, scrimStyle]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss search"
        onPress={dismiss}
        style={styles.dismissHit}
      />
      <KeyboardAvoidingView
        style={styles.avoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.wrap,
            {
              paddingTop: padTop,
              paddingLeft: sideGutter,
              paddingRight: sideGutter,
              paddingBottom: bottomPad,
            },
          ]}
          onLayout={(e) => {
            const next = Math.round(e.nativeEvent.layout.height);
            setWrapH((prev) => (prev === next ? prev : next));
          }}
        >
          <Animated.View
            accessibilityRole="search"
            accessibilityLabel="Search dishes"
            style={[styles.panelLift, panelStyle]}
          >
            <View style={styles.panel}>
              <View
                style={styles.searchHeader}
                onLayout={(e) => {
                  const next = Math.round(e.nativeEvent.layout.height);
                  setHeaderH((prev) => (prev === next ? prev : next));
                }}
              >
                {prefs.searchEnabled ? (
                  <View style={styles.searchBar}>
                    <SymbolView
                      name={SEARCH_SYMBOL}
                      tintColor={Theme.white}
                      size={22}
                      weight={{ ios: 'medium', android: mediumWeight }}
                    />
                    <TextInput
                      ref={inputRef}
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search dishes…"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      autoCorrect={false}
                      autoCapitalize="none"
                      autoComplete="off"
                      returnKeyType="search"
                      selectTextOnFocus={false}
                      underlineColorAndroid="transparent"
                      selectionColor="rgba(255, 255, 255, 0.28)"
                      cursorColor={Theme.white}
                      style={[styles.input, webInputStyle]}
                    />
                    {query.length > 0 ? (
                      <Pressable
                        onPress={() => setQuery('')}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <SymbolView
                          name={CLOSE_SYMBOL}
                          tintColor={Theme.white}
                          size={16}
                          weight={{ ios: 'medium', android: mediumWeight }}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.searchBarSpacer} />
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close search"
                  onPress={dismiss}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <SymbolView
                    name={CLOSE_SYMBOL}
                    tintColor={Theme.white}
                    size={22}
                    weight={{ ios: 'medium', android: mediumWeight }}
                  />
                </Pressable>
              </View>
              {listing ? (
                <ScrollView
                  style={[
                    styles.results,
                    { maxHeight: maxResults },
                    resultsHeight != null ? { height: resultsHeight } : null,
                  ]}
                  contentContainerStyle={styles.body}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  onContentSizeChange={(_w, h) => {
                    const next = Math.round(h);
                    setResultsH((prev) => (prev === next ? prev : next));
                  }}
                >
                  {body}
                </ScrollView>
              ) : (
                <View style={styles.body}>{body}</View>
              )}
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function DishCard({ group }: { group: DishGroup }) {
  const prefs = usePrefs();
  const shown = group.occ.slice(0, 5);
  return (
    <View style={styles.card}>
      <View style={styles.favRow}>
        <Text style={styles.dish}>{group.dish}</Text>
        {prefs.favoritesEnabled ? <HeartButton label={group.dish} /> : null}
      </View>
      {group.occ.length === 0 ? (
        <Text style={styles.occSub}>Not on today/tomorrow menus</Text>
      ) : (
        <>
          <View style={styles.occList}>
            {shown.map((o, i) => {
              const hall = HALL_BY_ID[o.hallId as HallId];
              return (
                <View key={`${o.hallId}-${o.day}-${o.meal}-${o.station}-${i}`} style={styles.occ}>
                  {hall ? (
                    <Image source={hall.logo} style={styles.occLogo} resizeMode="contain" />
                  ) : null}
                  <View style={styles.occTexts}>
                    <Text style={styles.occMain}>
                      {o.hallName} · {o.day} {o.dateLabel}
                    </Text>
                    <Text style={styles.occSub}>
                      {o.meal}
                      {o.hours ? ` ${o.hours}` : ''} · {o.station}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          {group.occ.length > shown.length ? (
            <Text style={styles.more}>+{group.occ.length - shown.length} more</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Theme.overlay,
    pointerEvents: 'none',
  },
  dismissHit: {
    ...StyleSheet.absoluteFill,
  },
  avoid: {
    flex: 1,
    pointerEvents: 'box-none',
  },
  wrap: {
    flex: 1,
    justifyContent: 'flex-start',
    pointerEvents: 'box-none',
  },
  panelLift: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    maxHeight: '100%',
  },
  panel: {
    backgroundColor: Theme.darkerGray,
    borderRadius: CHROME_RADIUS,
    padding: CHROME_INSET,
    gap: 8,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.darkGray,
    borderRadius: INNER_CHIP_RADIUS,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchBarSpacer: { flex: 1 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Theme.white,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.darkGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  results: { flexGrow: 0, flexShrink: 1 },
  body: {
    gap: 8,
  },
  card: {
    backgroundColor: Theme.white,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Theme.black },
  hint: { fontSize: 13, color: Theme.foodItem },
  dish: { flex: 1, fontSize: 16, fontWeight: '700', color: Theme.black },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  occList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    marginTop: 4,
  },
  occ: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  occLogo: { width: 26, height: 26 },
  occTexts: { flex: 1, gap: 1 },
  occMain: { fontSize: 14, fontWeight: '600', color: Theme.black },
  occSub: { fontSize: 12, color: Theme.foodItem },
  more: { fontSize: 12, fontWeight: '600', color: Theme.foodItem },
  retry: {
    marginTop: 8,
    backgroundColor: Theme.darkGray,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryText: { color: Theme.white, fontWeight: '700' },
});
