import { useCallback, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { todayInLA } from '@/lib/dates';
import { HALL_BY_ID, type HallId } from '@/lib/diningHalls';
import { loadSearchIndex, searchDishes, type DishGroup, type SearchHit } from '@/lib/search';
import { favoriteId, usePrefs } from '@/lib/settings';
import { Theme } from '@/constants/Theme';
import HeartButton from '@/components/HeartButton';

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function SearchScreen() {
  const prefs = usePrefs();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadedDay = useRef('');

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

  // Tabs stay mounted — (re)load only on focus, and only when needed.
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

  // Favorites as full dish cards, A–Z, including ones missing from the menus.
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

  const c = {
    bg: Theme.darkerGray,
    card: Theme.white,
    text: Theme.black,
    sub: Theme.foodItem,
    border: '#E5E5EA',
  };

  if (!prefs.searchEnabled) {
    return (
      <View style={[styles.page, { backgroundColor: c.bg }]}>
        <View style={styles.body}>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Search is off</Text>
            <Text style={[styles.hint, { color: c.sub }]}>
              Enable it in Settings to search dishes across all dining halls.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Search</Text>
        <View style={[styles.searchBar, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.searchIcon, { color: c.sub }]}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search dishes…"
            placeholderTextColor={c.sub}
            autoCorrect={false}
            style={[styles.input, { color: c.text }]}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Text style={[styles.clear, { color: c.sub }]}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {loading && index === null ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <ActivityIndicator size="large" />
            <Text style={[styles.hint, { color: c.sub }]}>Loading today + tomorrow…</Text>
          </View>
        ) : failed && index === null ? (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Couldn&apos;t load menus</Text>
            <Pressable onPress={load} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : query.trim() ? (
          groups.length === 0 ? (
            <Text style={styles.pageHint}>No dishes match “{query.trim()}”.</Text>
          ) : (
            groups.map((g) => <DishCard key={g.id} group={g} c={c} />)
          )
        ) : prefs.favoritesEnabled ? (
          prefs.favorites.length === 0 ? (
            <Text style={styles.pageHint}>
              Tap ♥ on any dish to save it here. Search above to find dishes across all halls.
            </Text>
          ) : (
            favGroups.map((g) => <DishCard key={g.id} group={g} c={c} />)
          )
        ) : (
          <Text style={styles.pageHint}>
            Search dishes across all 7 dining halls, today and tomorrow.
          </Text>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

type CardColors = { text: string; sub: string; card: string; border: string };

function DishCard({ group, c }: { group: DishGroup; c: CardColors }) {
  const shown = group.occ.slice(0, 5);
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
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
  page: { flex: 1 },
  body: { padding: 16, gap: 10, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 8, color: Theme.white },
  cardTitle: { fontSize: 20, fontWeight: '800' },
  hint: { fontSize: 14 },
  pageHint: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 18 },
  input: { flex: 1, fontSize: 17, paddingVertical: 12 },
  clear: { fontSize: 16, fontWeight: '700' },
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
    backgroundColor: '#0A84FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryText: { color: '#fff', fontWeight: '700' },
});
