import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { ALLERGEN_LABELS, ALLERGENS, impliedAllergens } from '@/lib/allergens';
import { orderedHalls } from '@/lib/diningHalls';
import { SEARCH_FEATURES, usePrefs } from '@/lib/settings';
import { Theme } from '@/constants/Theme';
import { useWebStack } from '@/lib/webStack';

const BACK_SYMBOL = { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as const;

const DIET_FILTERS = [
  { key: 'veganOnly', label: 'Vegan', badge: 'vegan' },
  { key: 'vegetarianOnly', label: 'Vegetarian', badge: 'vegetarian' },
  { key: 'glutenFreeOnly', label: 'Gluten-free', badge: 'glutenFree' },
  { key: 'plantBasedOnly', label: 'Plant-based', badge: 'plantBased' },
] as const;

export default function SettingsScreen() {
  const prefs = usePrefs();
  const router = useRouter();
  const webStack = useWebStack();
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

  const hideRoutesOn = useRef(prefs.hideRoutes);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (hideRoutesOn.current && !prefs.hideRoutes) {
      router.replace('/settings');
    }
    hideRoutesOn.current = prefs.hideRoutes;
  }, [prefs.hideRoutes, router]);

  const goBack = () => {
    if (Platform.OS === 'web' && webStack.screen) {
      webStack.close();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const lockedAllergens = impliedAllergens(prefs);

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
            <Text style={styles.subSection}>Highlight dishes that are</Text>
            <View style={styles.chips}>
              {DIET_FILTERS.map((filter) => (
                <FilterChip
                  key={filter.key}
                  label={filter.label}
                  badge={filter.badge}
                  on={prefs[filter.key]}
                  disabled={!prefs.loaded}
                  onToggle={() => prefs.update({ [filter.key]: !prefs[filter.key] })}
                />
              ))}
            </View>
            <Text style={styles.subSection}>Hide dishes with these ingredients</Text>
            <Text style={styles.hint}>
              Highlights above lock matching ingredients on. Collins, Malott, and McConnell do not
              publish ingredient lists.
            </Text>
            <View style={styles.chips}>
              {ALLERGENS.map((allergen) => {
                const locked = lockedAllergens.includes(allergen);
                const on = locked || prefs.avoidedAllergens.includes(allergen);
                return (
                  <FilterChip
                    key={allergen}
                    label={ALLERGEN_LABELS[allergen]}
                    on={on}
                    locked={locked}
                    disabled={!prefs.loaded}
                    onToggle={() => {
                      if (locked) return;
                      const avoidedAllergens = prefs.avoidedAllergens.includes(allergen)
                        ? prefs.avoidedAllergens.filter((a) => a !== allergen)
                        : [...prefs.avoidedAllergens, allergen];
                      prefs.update({ avoidedAllergens });
                    }}
                  />
                );
              })}
            </View>
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

          {Platform.OS === 'web' ? (
            <View style={[styles.card, styles.dangerCard]}>
              <Text style={[styles.section, styles.dangerSection]}>Danger zone</Text>
              <Row
                label="Disable page URLs"
                hint="Keeps the address bar on the site root while you switch halls or open settings. You can also turn this on by visiting /no-routes."
                value={prefs.hideRoutes}
                disabled={!prefs.loaded}
                danger
                onToggle={() => {
                  const next = !prefs.hideRoutes;
                  if (!next) webStack.close();
                  prefs.update({ hideRoutes: next });
                }}
              />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  badge,
  on,
  locked,
  disabled,
  onToggle,
}: {
  label: string;
  badge?: 'vegan' | 'vegetarian' | 'glutenFree' | 'plantBased';
  on: boolean;
  locked?: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled || locked}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled: disabled || locked }}
      accessibilityLabel={locked ? `${label}, required by a highlight` : label}
      style={({ pressed }) => [
        styles.chip,
        on && styles.chipOn,
        pressed && !locked && styles.chipPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      {badge ? <DietBadge kind={badge} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Row({
  label,
  hint,
  value,
  onToggle,
  disabled,
  danger,
}: {
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  danger?: boolean;
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
        <Text style={[styles.rowLabel, danger && styles.dangerLabel]}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <View
        style={[
          styles.switch,
          { backgroundColor: value ? (danger ? '#c92a2a' : Theme.vegan) : Theme.gray },
        ]}
      >
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
  dangerCard: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: 'rgba(201, 42, 42, 0.25)',
  },
  section: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.black,
  },
  dangerSection: {
    color: '#c92a2a',
  },
  hint: {
    fontSize: 13,
    color: Theme.foodItem,
  },
  subSection: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.black,
    marginTop: 4,
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
  rowLabel: { fontSize: 15, fontWeight: '600', color: Theme.black },
  dangerLabel: { color: '#c92a2a' },
  rowHint: { fontSize: 12, color: Theme.foodItem },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.white,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.14)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: Theme.black,
    borderColor: Theme.black,
  },
  chipPressed: { transform: [{ scale: 0.97 }] },
  chipText: { fontSize: 13, fontWeight: '600', color: Theme.black },
  chipTextOn: { color: Theme.white },
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
