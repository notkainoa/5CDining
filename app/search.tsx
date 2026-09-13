import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import {
  CHROME_BOTTOM_RADIUS,
  CHROME_INSET,
  CHROME_RADIUS,
} from '@/components/HallChrome';
import HeartButton from '@/components/HeartButton';
import { Theme } from '@/constants/Theme';
import { todayInLA } from '@/lib/dates';
import { HALL_BY_ID, type HallId } from '@/lib/diningHalls';
import { loadSearchIndex, searchDishes, type DishGroup, type SearchHit } from '@/lib/search';
import { favoriteId, usePrefs } from '@/lib/settings';

const BACK_SYMBOL = { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as const;
const SEARCH_SYMBOL = { ios: 'magnifyingglass', android: 'search', web: 'search' } as const;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function SearchScreen() {
  const prefs = usePrefs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadedDay = useRef('');
  const bottomPad = Math.max((insets.bottom * 6) / 10, CHROME_INSET);

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
        occ: g.occ.sort((a, b) =>
          a.day === b.day ? a.hallName.localeCompare(b.hallName) : a.day === 'Today' ? -1 : 1,
        ),
      }))
      .sort((a, b) => a.dish.localeCompare(b.dish));
  }, [index, prefs.favorites, favSet]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const c = {
    text: Theme.black,
    sub: Theme.foodItem,
    card: Theme.white,
    border: 'rgba(0, 0, 0, 0.08)',
  };

  let body: ReactNode;
  if (!prefs.searchEnabled) {
    body = (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search is off</Text>
        <Text style={styles.hint}>Enable it in Settings to search dishes across all dining halls.</Text>
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
        <Pressable onPress={load} style={styles.retry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  } else if (query.trim()) {
    body =
      groups.length === 0 ? (
        <Text style={styles.pageHint}>No dishes match “{query.trim()}”.</Text>
      ) : (
        groups.map((g) => <DishCard key={g.id} group={g} c={c} />)
      );
  } else if (prefs.favoritesEnabled) {
    body =
      prefs.favorites.length === 0 ? (
        <Text style={styles.pageHint}>
          Tap ♥ on any dish to save it here. Search above to find dishes across all halls.
        </Text>
      ) : (
        favGroups.map((g) => <DishCard key={g.id} group={g} c={c} />)
      );
  } else {
    body = (
      <Text style={styles.pageHint}>Search dishes across all 7 dining halls, today and tomorrow.</Text>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        {
          paddingTop: Math.max(insets.top, CHROME_INSET),
          paddingLeft: Math.max(insets.left, CHROME_INSET),
          paddingRight: Math.max(insets.right, CHROME_INSET),
          paddingBottom: bottomPad,
        },
      ]}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={4}
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
        >
          <SymbolView
            name={BACK_SYMBOL}
            tintColor={Theme.white}
            size={22}
            weight={{ ios: 'medium', android: mediumWeight }}
          />
        </Pressable>
        <Text style={styles.title}>Search</Text>
      </View>
      <View style={styles.chrome}>
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {prefs.searchEnabled ? (
            <View style={styles.searchBar}>
              <SymbolView
                name={SEARCH_SYMBOL}
                tintColor={Theme.foodItem}
                size={18}
                weight={{ ios: 'medium', android: mediumWeight }}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search dishes…"
                placeholderTextColor={Theme.foodItem}
                autoCorrect={false}
                style={styles.input}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                  <Text style={styles.clear}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {body}
        </ScrollView>
      </View>
    </View>
  );
}

type CardColors = { text: string; sub: string; card: string; border: string };

function DishCard({ group, c }: { group: DishGroup; c: CardColors }) {
  const shown = group.occ.slice(0, 5);
  return (
    <View style={styles.card}>
      <View style={styles.favRow}>
        <Text style={[styles.dish, { color: c.text }]}>{group.dish}</Text>
        <HeartButton label={group.dish} />
      </View>
      {group.occ.length === 0 ? (
        <Text style={[styles.occSub, { color: c.sub }]}>Not on today/tomorrow menus</Text>
      ) : (
        <>
          <View style={[styles.occList, { borderTopColor: c.border }]}>
            {shown.map((o, i) => {
              const hall = HALL_BY_ID[o.hallId as HallId];
              return (
                <View
                  key={`${o.hallId}-${o.day}-${o.meal}-${o.station}`}
                  style={[styles.occ, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]}
                >
                  {hall ? (
                    <Image source={hall.logo} style={styles.occLogo} resizeMode="contain" />
                  ) : null}
                  <View style={styles.occTexts}>
                    <Text style={[styles.occMain, { color: c.text }]}>
                      {o.hallName} · {o.day} {o.dateLabel}
                    </Text>
                    <Text style={[styles.occSub, { color: c.sub }]}>
                      {o.meal}
                      {o.hours ? ` ${o.hours}` : ''} · {o.station}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          {group.occ.length > shown.length ? (
            <Text style={[styles.more, { color: c.sub }]}>
              +{group.occ.length - shown.length} more
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Theme.black,
  },
  chrome: {
    flex: 1,
    backgroundColor: Theme.darkerGray,
    borderTopLeftRadius: CHROME_RADIUS,
    borderTopRightRadius: CHROME_RADIUS,
    borderBottomLeftRadius: CHROME_BOTTOM_RADIUS,
    borderBottomRightRadius: CHROME_BOTTOM_RADIUS,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.darkGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    transform: [{ scale: 0.97 }],
  },
  title: {
    color: Theme.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    flex: 1,
  },
  page: { flex: 1 },
  body: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: 14, color: Theme.black },
  clear: { fontSize: 16, fontWeight: '700', color: Theme.foodItem },
  card: {
    backgroundColor: Theme.white,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Theme.black },
  hint: { fontSize: 13, color: Theme.foodItem },
  pageHint: { fontSize: 14, color: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingTop: 4 },
  dish: { flex: 1, fontSize: 16, fontWeight: '800' },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  occList: { borderTopWidth: 1, marginTop: 8 },
  occ: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  occLogo: { width: 26, height: 26 },
  occTexts: { flex: 1, gap: 1 },
  occMain: { fontSize: 14, fontWeight: '600' },
  occSub: { fontSize: 12 },
  more: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
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
