import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DiningTabBar from '@/components/DiningTabBar';
import HallTabBar from '@/components/HallTabBar';
import NativePager, { type NativePagerHandle } from '@/components/NativePager';
import { AppShell, HallChrome } from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';
import { DimProvider } from '@/lib/dim';
import { DayProvider } from '@/lib/day';
import { orderedHalls } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import { TabNavProvider } from '@/lib/tabNav';
import McConnellPage from '@/app/(tabs)/mcconnell';
import FraryPage from '@/app/(tabs)/frary';
import HochPage from '@/app/(tabs)/hoch';
import MalottPage from '@/app/(tabs)/malott';
import CollinsPage from '@/app/(tabs)/collins';
import FrankPage from '@/app/(tabs)/frank';
import OldenborgPage from '@/app/(tabs)/oldenborg';

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
 * The `/no-routes` edition: halls switch in memory via a pager and
 * settings/search open as overlays, so the address bar never changes.
 * Always opens on the first hall in the user's order.
 */
export default function FrozenHalls() {
  return (
    <DayProvider>
      <DimProvider>
        <FrozenHallsGate />
      </DimProvider>
    </DayProvider>
  );
}

function FrozenHallsGate() {
  const { loaded } = usePrefs();
  if (!loaded) return <View style={[styles.fill, styles.boot]} />;
  return <FrozenHallsInner />;
}

function FrozenHallsInner() {
  const { hallOrder } = usePrefs();
  const pagerRef = useRef<NativePagerHandle>(null);

  const order: string[] = useMemo(
    () => orderedHalls(hallOrder).map((h) => h.id),
    [hallOrder],
  );

  const [activeKey, setActiveKey] = useState(order[0] ?? '');
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

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
    pagerRef.current?.setPageWithoutAnimation(
      Math.max(0, order.indexOf(activeKeyRef.current)),
    );
  }, [order]);

  return (
    <TabNavProvider activeKey={activeKey} navigate={navigate}>
      <AppShell>
        <StatusBar style="light" />
        <HallChrome>
          <HallTabBar />
          <NativePager
            ref={pagerRef}
            initialPage={Math.max(0, order.indexOf(activeKey))}
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  boot: { backgroundColor: Theme.black },
});
