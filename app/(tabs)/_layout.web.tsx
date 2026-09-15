import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Tabs, useRouter, useSegments, type Href } from 'expo-router';
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
 * Web layout: expo-router Tabs so hall/settings URLs work. When the user turns
 * on “disable page URLs”, halls switch in memory instead and the address bar
 * stays on `/`.
 */

// Last hall seen in this session, so enabling the setting from Settings keeps
// the user on the hall they were viewing instead of jumping to the first one.
let lastHallName = '';
export default function TabLayoutWeb() {
  return (
    <DayProvider>
      <DimProvider>
        <TabLayoutWebSwitch />
      </DimProvider>
    </DayProvider>
  );
}

function TabLayoutWebSwitch() {
  const { loaded, hideRoutes } = usePrefs();
  // Module-level memory (not a ref): the switch unmounts when the real
  // `/settings` route focuses, so a ref would forget the hall.
  const rememberHall = useCallback((name: string) => {
    if (name && name !== 'index') lastHallName = name;
  }, []);

  if (!loaded) return <View style={[styles.fill, styles.boot]} />;
  if (hideRoutes) {
    return <TabLayoutWebFrozen initialHall={lastHallName} onHall={rememberHall} />;
  }
  return <TabLayoutWebRouted onHall={rememberHall} />;
}

function TabLayoutWebRouted({ onHall }: { onHall: (name: string) => void }) {
  const segments = useSegments();
  const router = useRouter();
  const activeKey = segments.at(1) ?? '';

  useEffect(() => {
    onHall(activeKey);
  }, [activeKey, onHall]);

  const navigate = useCallback(
    (name: string) => {
      router.navigate(`/(tabs)/${name}` as Href);
    },
    [router],
  );

  return (
    <TabNavProvider activeKey={activeKey} navigate={navigate}>
      <AppShell>
        <StatusBar style="light" />
        <HallChrome>
          <HallTabBar />
          <View style={styles.fill}>
            <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
              <Tabs.Screen name="mcconnell" options={{ title: 'McConnell' }} />
              <Tabs.Screen name="frary" options={{ title: 'Frary' }} />
              <Tabs.Screen name="hoch" options={{ title: 'Hoch-Shanahan' }} />
              <Tabs.Screen name="malott" options={{ title: 'Malott' }} />
              <Tabs.Screen name="collins" options={{ title: 'Collins' }} />
              <Tabs.Screen name="frank" options={{ title: 'Frank' }} />
              <Tabs.Screen name="oldenborg" options={{ title: 'Oldenborg' }} />
              <Tabs.Screen name="index" options={{ href: null }} />
            </Tabs>
          </View>
        </HallChrome>
        <DiningTabBar />
      </AppShell>
    </TabNavProvider>
  );
}

function TabLayoutWebFrozen({
  initialHall,
  onHall,
}: {
  initialHall: string;
  onHall: (name: string) => void;
}) {
  const { hallOrder } = usePrefs();
  const pagerRef = useRef<NativePagerHandle>(null);

  const order: string[] = useMemo(
    () => orderedHalls(hallOrder).map((h) => h.id),
    [hallOrder],
  );

  const [activeKey, setActiveKey] = useState(() =>
    order.includes(initialHall) ? initialHall : (order[0] ?? ''),
  );
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  useEffect(() => {
    onHall(activeKey);
  }, [activeKey, onHall]);

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
