import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NativePager, {
  type NativePagerHandle,
  type PageScrollEvent,
} from '@/components/NativePager';
import DiningTabBar from '@/components/DiningTabBar';
import DayBarOverlay from '@/components/DayBarOverlay';
import { DayProvider } from '@/lib/day';
import { HALL_BY_ID, orderedHalls } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import SearchPage from './search';
import McConnellPage from './mcconnell';
import FraryPage from './frary';
import HochPage from './hoch';
import MalottPage from './malott';
import CollinsPage from './collins';
import FrankPage from './frank';
import OldenborgPage from './oldenborg';
import SettingsPage from './settings';

const PAGES = {
  search: SearchPage,
  mcconnell: McConnellPage,
  frary: FraryPage,
  hoch: HochPage,
  malott: MalottPage,
  collins: CollinsPage,
  frank: FrankPage,
  oldenborg: OldenborgPage,
  settings: SettingsPage,
} as const;

/**
 * Native tab navigator: the pager owns position (real ViewPager2 /
 * UIPageViewController swipes). Swipes and taps never touch the router, so
 * there is no sync loop and no second animation. The route only matters at
 * launch / deep links, which snap the pager without animation.
 * Web uses _layout.web.tsx (expo-router Tabs, no swipe).
 */
function TabLayoutNative() {
  const segments = useSegments();
  const { loaded, hallOrder, searchEnabled } = usePrefs();
  const pagerRef = useRef<NativePagerHandle>(null);

  const order: string[] = useMemo(
    () => [
      ...(searchEnabled ? (['search'] as const) : []),
      ...orderedHalls(hallOrder).map((h) => h.id),
      'settings' as const,
    ],
    [hallOrder, searchEnabled],
  );

  const [initialKey] = useState(() => {
    const name = segments[1] ?? '';
    return order.includes(name) ? name : order[0];
  });
  const [activeKey, setActiveKey] = useState(initialKey);
  const index = Math.max(0, order.indexOf(activeKey));

  // Floating day bar position, driven imperatively (no re-renders) from the
  // pager's scroll offset. Between halls it stays at 0; toward
  // search/settings it glues to the hall page and slides off with it.
  const { width } = useWindowDimensions();
  const [stripX] = useState(
    () =>
      new Animated.Value(
        initialKey in HALL_BY_ID ? 0 : order.indexOf(initialKey) === 0 ? width : -width,
      ),
  );

  const snapStrip = useCallback(
    (key: string) => {
      stripX.setValue(key in HALL_BY_ID ? 0 : order.indexOf(key) === 0 ? width : -width);
    },
    [order, width, stripX],
  );

  const handlePageScroll = useCallback(
    ({ position, offset }: PageScrollEvent) => {
      const leftHall = (order[position] ?? '') in HALL_BY_ID;
      const rightHall = (order[position + 1] ?? '') in HALL_BY_ID;
      if (leftHall && rightHall) stripX.setValue(0);
      else if (leftHall) stripX.setValue(-width * offset);
      else if (rightHall) stripX.setValue(width * (1 - offset));
      // Both non-hall is impossible (search/settings are never adjacent).
    },
    [order, width, stripX],
  );

  const handlePageSelected = useCallback(
    (i: number) => {
      const key = order[i] ?? '';
      setActiveKey(key);
      snapStrip(key);
    },
    [order, snapStrip],
  );

  // Memoized so unrelated re-renders don't hand the native pager new children.
  const pages = useMemo(
    () =>
      order.map((name) => {
        const Page = PAGES[name as keyof typeof PAGES];
        return (
          <View key={name} collapsable={false} style={styles.fill}>
            <Page />
          </View>
        );
      }),
    [order],
  );

  // Launch redirect / deep links only: snap (no animation). Swipes and taps
  // never change the route, so this can't fight the pager. Unknown segments
  // (e.g. the modal being open) are ignored.
  useEffect(() => {
    const name = segments[1] ?? '';
    if (!order.includes(name) || name === activeKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time external nav sync
    setActiveKey(name);
    pagerRef.current?.setPageWithoutAnimation(order.indexOf(name));
    snapStrip(name);
  }, [segments, order, activeKey, snapStrip]);

  // Order changes (search toggled, halls reordered) shift native positions —
  // e.g. enabling search inserts index 0 and Settings slides to Oldenborg.
  // Snap back to the active page without animation.
  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(Math.max(0, order.indexOf(activeKey)));
    snapStrip(activeKey);
  }, [order, activeKey, snapStrip]);

  if (!loaded) return <View style={styles.fill} />;

  return (
    <View style={styles.fill}>
      <NativePager
        ref={pagerRef}
        initialPage={Math.max(0, order.indexOf(initialKey))}
        onPageSelected={handlePageSelected}
        onPageScroll={handlePageScroll}
      >
        {pages}
      </NativePager>
      {/* Floating day bar: fixed between halls, glued to the hall page toward
          search/settings. Absolute (no layout space) so search/settings are
          full-screen while sliding. */}
      <DayBarOverlay translateX={stripX} />
      <DiningTabBar
        state={{ index, routes: order.map((name) => ({ name })) }}
        navigation={{
          navigate: (name: string) => {
            const i = order.indexOf(name);
            if (i >= 0) {
              setActiveKey(name);
              pagerRef.current?.setPage(i);
            }
          },
        }}
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <DayProvider>
      <TabLayoutNative />
    </DayProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
