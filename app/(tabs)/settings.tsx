import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DietBadge from '@/components/DietBadge';
import HallOrderList from '@/components/HallOrderList';
import { orderedHalls } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import { Theme } from '@/constants/Theme';

export default function SettingsScreen() {
  const prefs = usePrefs();
  const [scrollLocked, setScrollLocked] = useState(false);
  const [edgeDir, setEdgeDir] = useState<-1 | 0 | 1>(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  // Edge auto-scroll while dragging a hall to the top/bottom of the screen.
  useEffect(() => {
    if (edgeDir === 0) return;
    const t = setInterval(() => {
      scrollY.current += edgeDir * 30;
      scrollRef.current?.scrollTo({ y: scrollY.current, animated: false });
    }, 50);
    return () => clearInterval(t);
  }, [edgeDir]);

  const c = {
    bg: Theme.darkerGray,
    card: Theme.white,
    text: Theme.black,
    sub: Theme.foodItem,
    border: '#E5E5EA',
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.page, { backgroundColor: c.bg }]}
      contentContainerStyle={styles.body}
      scrollEnabled={!scrollLocked}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      }}
    >
      <Text style={styles.title}>Settings</Text>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.section, { color: c.text }]}>Dining hall order</Text>
        <Text style={[styles.hint, { color: c.sub }]}>
          Drag the ≡ handle to reorder. Order is used in the top hall bar. The app opens to the
          first one.
        </Text>
        <HallOrderList
          key={prefs.loaded ? 'ready' : 'loading'}
          order={orderedHalls(prefs.hallOrder).map((h) => h.id)}
          onChange={(hallOrder) => prefs.update({ hallOrder })}
          onScrollLock={setScrollLocked}
          onEdgeScroll={setEdgeDir}
          scrollY={scrollY}
        />
      </View>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.section, { color: c.text }]}>Search & favorites</Text>
        <Row
          label="Search page"
          hint="Adds a search button in the bottom bar for finding dishes."
          value={prefs.searchEnabled}
          onToggle={() =>
            prefs.update(
              prefs.searchEnabled
                ? { searchEnabled: false, favoritesEnabled: false }
                : { searchEnabled: true },
            )
          }
          c={c}
        />
        <Row
          label="Favorites"
          hint="Hearts on dishes, favorites first in results."
          value={prefs.favoritesEnabled}
          disabled={!prefs.searchEnabled}
          onToggle={() => prefs.update({ favoritesEnabled: !prefs.favoritesEnabled })}
          c={c}
        />
      </View>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.section, { color: c.text }]}>Dietary filters</Text>
        <Text style={[styles.hint, { color: c.sub }]}>
          Matching dishes stay bright — everything else grays out but stays visible.
        </Text>
        <Row
          label="Vegan"
          badge="vegan"
          hint="Highlights vegan dishes."
          value={prefs.veganOnly}
          onToggle={() => prefs.update({ veganOnly: !prefs.veganOnly })}
          c={c}
        />
        <Row
          label="Vegetarian"
          badge="vegetarian"
          hint="Highlights vegetarian (and vegan) dishes."
          value={prefs.vegetarianOnly}
          onToggle={() => prefs.update({ vegetarianOnly: !prefs.vegetarianOnly })}
          c={c}
        />
      </View>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.section, { color: c.text }]}>Menu display</Text>
        <Row
          label="Show calories"
          hint="Calorie counts next to item names."
          value={prefs.showCalories}
          onToggle={() => prefs.update({ showCalories: !prefs.showCalories })}
          c={c}
        />
        <Row
          label="Show descriptions"
          hint="Short description under each dish."
          value={prefs.showDescriptions}
          onToggle={() => prefs.update({ showDescriptions: !prefs.showDescriptions })}
          c={c}
        />
      </View>

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.section, { color: c.text }]}>About</Text>
        <Text style={[styles.hint, { color: c.sub }]}>
          Menus by the 5C Menu API · Claremont time (America/Los_Angeles)
        </Text>
        <Pressable
          onPress={() =>
            Linking.openURL('https://five-c-menu-api.kainoanewton.workers.dev/v1/menus')
          }
          hitSlop={8}
        >
          <Text style={styles.link}>five-c-menu-api.kainoanewton.workers.dev</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Row({
  label,
  badge,
  hint,
  value,
  onToggle,
  disabled,
  c,
}: {
  label: string;
  badge?: 'vegan' | 'vegetarian';
  hint: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  c: { text: string; sub: string; border: string };
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[styles.row, { borderTopColor: c.border }, disabled && styles.rowDisabled]}
    >
      <View style={styles.rowText}>
        <View style={styles.rowLabelRow}>
          <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
          {badge ? <DietBadge kind={badge} /> : null}
        </View>
        <Text style={[styles.rowHint, { color: c.sub }]}>{hint}</Text>
      </View>
      <View style={[styles.switch, { backgroundColor: value ? '#34C759' : '#8E8E93' }]}>
        <View style={[styles.knob, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 8, color: Theme.white },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  section: { fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 12,
  },
  rowDisabled: { opacity: 0.4 },
  rowText: { flex: 1, gap: 2 },
  rowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowHint: { fontSize: 12 },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center',
  },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  link: { color: '#0A84FF', fontSize: 13, marginTop: 4 },
});
