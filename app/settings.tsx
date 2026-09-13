import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import DietBadge from '@/components/DietBadge';
import HallOrderList from '@/components/HallOrderList';
import {
  CHROME_BOTTOM_RADIUS,
  CHROME_INSET,
  CHROME_RADIUS,
} from '@/components/HallChrome';
import { orderedHalls } from '@/lib/diningHalls';
import { SEARCH_FEATURES, usePrefs } from '@/lib/settings';
import { Theme } from '@/constants/Theme';

const BACK_SYMBOL = { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as const;

export default function SettingsScreen() {
  const prefs = usePrefs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scrollLocked, setScrollLocked] = useState(false);
  const [edgeDir, setEdgeDir] = useState<-1 | 0 | 1>(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const maxScrollY = useRef<number | null>(null);
  const viewportH = useRef(0);
  const contentH = useRef(0);
  const bottomPad = Math.max((insets.bottom * 6) / 10, CHROME_INSET);

  const syncMaxScroll = () => {
    if (viewportH.current <= 0 || contentH.current <= 0) return;
    maxScrollY.current = Math.max(0, contentH.current - viewportH.current);
  };

  useEffect(() => {
    if (edgeDir === 0) return;
    const t = setInterval(() => {
      const next = Math.max(0, scrollY.current + edgeDir * 30);
      const max = maxScrollY.current;
      const y = max == null ? next : Math.min(next, max);
      scrollY.current = y;
      if (max === 0) return;
      scrollRef.current?.scrollTo({ y, animated: false });
    }, 50);
    return () => clearInterval(t);
  }, [edgeDir]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

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
        <Text style={styles.title}>Settings</Text>
      </View>
      <View style={styles.chrome}>
        <ScrollView
          ref={scrollRef}
          style={styles.page}
          contentContainerStyle={styles.body}
          scrollEnabled={!scrollLocked}
          scrollEventThrottle={16}
          onLayout={(e) => {
            viewportH.current = e.nativeEvent.layout.height;
            syncMaxScroll();
          }}
          onContentSizeChange={(_w, h) => {
            contentH.current = h;
            syncMaxScroll();
          }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            scrollY.current = contentOffset.y;
            maxScrollY.current = Math.max(0, contentSize.height - layoutMeasurement.height);
          }}
        >
          <View style={styles.card}>
            <Text style={styles.section}>Dining hall order</Text>
            <Text style={styles.hint}>
              Drag the ≡ handle to reorder. Order is used in the top hall bar. The app opens to the
              first one.
            </Text>
            <HallOrderList
              key={prefs.loaded ? 'ready' : 'loading'}
              order={orderedHalls(prefs.hallOrder).map((h) => h.id)}
              onChange={(hallOrder) => {
                if (prefs.loaded) prefs.update({ hallOrder });
              }}
              onScrollLock={setScrollLocked}
              onEdgeScroll={setEdgeDir}
              scrollY={scrollY}
            />
          </View>

          {SEARCH_FEATURES ? (
            <View style={styles.card}>
              <Text style={styles.section}>Search & favorites</Text>
              <Row
                label="Search page"
                hint="Adds a search button in the bottom bar for finding dishes."
                value={prefs.searchEnabled}
                disabled={!prefs.loaded}
                onToggle={() =>
                  prefs.update(
                    prefs.searchEnabled
                      ? { searchEnabled: false, favoritesEnabled: false }
                      : { searchEnabled: true },
                  )
                }
              />
              <Row
                label="Favorites"
                hint="Hearts on dishes, favorites first in results."
                value={prefs.favoritesEnabled}
                disabled={!prefs.loaded || !prefs.searchEnabled}
                onToggle={() => prefs.update({ favoritesEnabled: !prefs.favoritesEnabled })}
              />
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.section}>Dietary filters</Text>
            <Text style={styles.hint}>
              Matching dishes stay bright — everything else grays out but stays visible.
            </Text>
            <Row
              label="Vegan"
              badge="vegan"
              hint="Highlights vegan dishes."
              value={prefs.veganOnly}
              disabled={!prefs.loaded}
              onToggle={() => prefs.update({ veganOnly: !prefs.veganOnly })}
            />
            <Row
              label="Vegetarian"
              badge="vegetarian"
              hint="Highlights vegetarian (and vegan) dishes."
              value={prefs.vegetarianOnly}
              disabled={!prefs.loaded}
              onToggle={() => prefs.update({ vegetarianOnly: !prefs.vegetarianOnly })}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Menu display</Text>
            <Row
              label="Show calories"
              hint="Calorie counts next to item names."
              value={prefs.showCalories}
              disabled={!prefs.loaded}
              onToggle={() => prefs.update({ showCalories: !prefs.showCalories })}
            />
            <Row
              label="Show descriptions"
              hint="Short description under each dish."
              value={prefs.showDescriptions}
              disabled={!prefs.loaded}
              onToggle={() => prefs.update({ showDescriptions: !prefs.showDescriptions })}
            />
            <Row
              label="Expand all by default"
              hint="Open every station when you open a menu. You can still collapse them."
              value={prefs.expandAllDefault}
              disabled={!prefs.loaded}
              onToggle={() => prefs.update({ expandAllDefault: !prefs.expandAllDefault })}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>About</Text>
            <Text style={styles.hint}>
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
      </View>
    </View>
  );
}

function Row({
  label,
  badge,
  hint,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  badge?: 'vegan' | 'vegetarian';
  hint: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[styles.row, disabled && styles.rowDisabled]}
    >
      <View style={styles.rowText}>
        <View style={styles.rowLabelRow}>
          <Text style={styles.rowLabel}>{label}</Text>
          {badge ? <DietBadge kind={badge} /> : null}
        </View>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <View style={[styles.switch, { backgroundColor: value ? Theme.vegan : Theme.gray }]}>
        <View style={[styles.knob, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
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
  card: {
    backgroundColor: Theme.white,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  section: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.black,
  },
  hint: {
    fontSize: 13,
    color: Theme.foodItem,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    paddingTop: 12,
    gap: 12,
  },
  rowDisabled: { opacity: 0.4 },
  rowText: { flex: 1, gap: 2 },
  rowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: Theme.black },
  rowHint: { fontSize: 12, color: Theme.foodItem },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center',
  },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: Theme.white },
  link: { color: Theme.foodItem, fontSize: 13, marginTop: 4, textDecorationLine: 'underline' },
});
