import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NativePager, { type NativePagerHandle } from '@/components/NativePager';
import DiningTabBar from '@/components/DiningTabBar';
import HallTabBar from '@/components/HallTabBar';
import { AppShell, HallChrome } from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';
import { DimProvider } from '@/lib/dim';
import { DayProvider } from '@/lib/day';
import { orderedHalls } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import { TabNavProvider } from '@/lib/tabNav';
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
    const name = segments.at(1) ?? '';
    return order.includes(name) ? name : order[0];
  });
  const [activeKey, setActiveKey] = useState(initialKey);

  const handlePageSelected = useCallback(
    (i: number) => {
      setActiveKey(order[i] ?? '');
    },
    [order],
  );

  const navigate = useCallback(
    (name: string) => {
      const i = order.indexOf(name);
      if (i >= 0) {
        setActiveKey(name);
        pagerRef.current?.setPage(i);
      }
    },
    [order],
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
    const name = segments.at(1) ?? '';
    if (!order.includes(name) || name === activeKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time external nav sync
    setActiveKey(name);
    pagerRef.current?.setPageWithoutAnimation(order.indexOf(name));
  }, [segments, order, activeKey]);

  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(Math.max(0, order.indexOf(activeKey)));
  }, [order, activeKey]);

  if (!loaded) return <View style={[styles.fill, styles.boot]} />;

  return (
    <TabNavProvider activeKey={activeKey} navigate={navigate} fallbackHall={hallOrder[0]}>
      <AppShell>
        <StatusBar style="light" />
        <HallChrome>
          <HallTabBar />
          <NativePager
            ref={pagerRef}
            initialPage={Math.max(0, order.indexOf(initialKey))}
            onPageSelected={handlePageSelected}
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
