import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Tabs, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { useCallback } from 'react';
import DiningTabBar from '@/components/DiningTabBar';
import HallTabBar from '@/components/HallTabBar';
import { AppShell, HallChrome } from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';
import { DimProvider } from '@/lib/dim';
import { DayProvider } from '@/lib/day';
import { hallIdFromParts } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import { TabNavProvider } from '@/lib/tabNav';

/**
 * Web layout: plain expo-router Tabs (no swipe — mouse-driven browsers don't
 * need it). Native uses _layout.tsx with the real paged NativePager.
 */
export default function TabLayoutWeb() {
  return (
    <DayProvider>
      <DimProvider>
        <TabLayoutWebInner />
      </DimProvider>
    </DayProvider>
  );
}

function TabLayoutWebInner() {
  const { loaded } = usePrefs();
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const activeKey = hallIdFromParts(pathname.split('/')) ?? hallIdFromParts(segments) ?? '';

  const navigate = useCallback(
    (name: string) => {
      router.navigate(`/(tabs)/${name}` as Href);
    },
    [router],
  );

  // Wait for stored prefs (hall order, filters) so first paint never flashes
  // defaults. Matches the native layout.
  if (!loaded) return <View style={[styles.fill, styles.boot]} />;

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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  boot: { backgroundColor: Theme.black },
});
