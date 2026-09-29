import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NativePager, { type NativePagerHandle } from '@/components/NativePager';
import { useSharedValue } from 'react-native-reanimated';
import DiningTabBar from '@/components/DiningTabBar';
import HallTabBar from '@/components/HallTabBar';
import { AppShell, HallChrome } from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';
import { DimProvider } from '@/lib/dim';
import { DayProvider } from '@/lib/day';
import { hallIdFromParts, orderedHalls, type HallId } from '@/lib/diningHalls';
import {
  createNativeHallRouteState,
  observeNativeHallRoute,
  reconcileNativeHallOrder,
  selectNativeHall,
} from '@/lib/native-hall-route-sync';
import { usePrefs } from '@/lib/settings';
import { TabNavProvider } from '@/lib/tabNav';
import McConnellPage from './mcconnell';
import FraryPage from './frary';
import HochPage from './hoch';
import MalottPage from './malott';
import CollinsPage from './collins';
import FrankPage from './frank';
import OldenborgPage from './oldenborg';

const PAGES = {
  mcconnell: McConnellPage,
  frary: FraryPage,
  hoch: HochPage,
  malott: MalottPage,
  collins: CollinsPage,
  frank: FrankPage,
  oldenborg: OldenborgPage,
} as const;

/**
 * Native tab navigator: the pager owns position (real ViewPager2 /
 * UIPageViewController swipes). Swipes and taps never touch the router, so
 * there is no sync loop and no second animation. The route only matters at
 * launch / deep links, which snap the pager without animation.
 * Web uses _layout.web.tsx (expo-router Tabs, no swipe).
 */
function TabLayoutNative() {
  const { loaded, hallOrder } = usePrefs();

  if (!loaded) return <View style={[styles.fill, styles.boot]} />;

  return <LoadedTabLayoutNative hallOrder={hallOrder} />;
}

function LoadedTabLayoutNative({ hallOrder }: { hallOrder: HallId[] }) {
  const segments = useSegments();
  const pagerRef = useRef<NativePagerHandle>(null);

  const order = useMemo(() => orderedHalls(hallOrder).map((hall) => hall.id), [hallOrder]);
  const routedHall = hallIdFromParts(segments);
  const [initialState] = useState(() => createNativeHallRouteState(routedHall, order));
  const routeStateRef = useRef(initialState);
  const [activeKey, setActiveKey] = useState(initialState.activeHall);
  const progress = useSharedValue(Math.max(0, order.indexOf(initialState.activeHall)));
  const prep = useSharedValue(0);

  const handlePageSelected = useCallback(
    (i: number) => {
      const hall = order[i];
      if (hall === undefined) return;
      progress.set(i);
      prep.set(0);
      routeStateRef.current = selectNativeHall(routeStateRef.current, hall);
      setActiveKey(routeStateRef.current.activeHall);
    },
    [order, prep, progress],
  );

  const navigate = useCallback(
    (name: string) => {
      if (name === routeStateRef.current.activeHall) return;
      const hall = name as HallId;
      const i = order.indexOf(hall);
      if (i >= 0) {
        prep.set(1);
        routeStateRef.current = selectNativeHall(routeStateRef.current, hall);
        setActiveKey(routeStateRef.current.activeHall);
        pagerRef.current?.setPage(i);
      }
    },
    [order, prep],
  );

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

  useEffect(() => {
    const current = routeStateRef.current;
    const next = observeNativeHallRoute(current, routedHall);
    routeStateRef.current = next;
    if (next.activeHall === current.activeHall) return;

    setActiveKey(next.activeHall);
    const i = order.indexOf(next.activeHall);
    progress.set(i);
    prep.set(0);
    pagerRef.current?.setPageWithoutAnimation(i);
  }, [routedHall, order, progress, prep]);

  useEffect(() => {
    const current = routeStateRef.current;
    const next = reconcileNativeHallOrder(current, order);
    routeStateRef.current = next;
    if (next.activeHall !== current.activeHall) {
      setActiveKey(next.activeHall);
    }
    const i = Math.max(0, order.indexOf(next.activeHall));
    progress.set(i);
    prep.set(0);
    pagerRef.current?.setPageWithoutAnimation(i);
  }, [order, progress, prep]);

  return (
    <TabNavProvider activeKey={activeKey} navigate={navigate} progress={progress} prep={prep}>
      <AppShell>
        <StatusBar style="light" />
        <HallChrome>
          <HallTabBar />
          <NativePager
            ref={pagerRef}
            initialPage={Math.max(0, order.indexOf(initialState.activeHall))}
            onPageSelected={handlePageSelected}
            onPageScroll={(e) => {
              progress.set(e.position + e.offset); // EXP-3
            }}
          >
            {pages}
          </NativePager>
        </HallChrome>
        <DiningTabBar />
      </AppShell>
    </TabNavProvider>
  );
}

export default function TabLayout() {
  return (
    <DayProvider>
      <DimProvider>
        <TabLayoutNative />
      </DimProvider>
    </DayProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  boot: { backgroundColor: Theme.black },
});
