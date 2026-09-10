import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Tabs, useRouter, useSegments, type Href } from 'expo-router';
import { useCallback } from 'react';
import DiningTabBar from '@/components/DiningTabBar';
import HallTabBar from '@/components/HallTabBar';
import { Theme } from '@/constants/Theme';
import { DimProvider } from '@/lib/dim';
import { DayProvider } from '@/lib/day';
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
  const { searchEnabled, hallOrder } = usePrefs();
  const segments = useSegments();
  const router = useRouter();
  const activeKey = segments.at(1) ?? '';

  const navigate = useCallback(
    (name: string) => {
      router.navigate(`/(tabs)/${name}` as Href);
    },
    [router],
  );

  return (
    <TabNavProvider activeKey={activeKey} navigate={navigate} fallbackHall={hallOrder[0]}>
      <View style={styles.shell}>
        <StatusBar style="light" />
        <HallTabBar />
        <View style={styles.fill}>
          <Tabs
            tabBar={(props) => <DiningTabBar {...props} />}
            screenOptions={{ headerShown: false }}
          >
            <Tabs.Screen
              name="search"
              options={{ title: 'Search', href: searchEnabled ? undefined : null }}
            />
            <Tabs.Screen name="mcconnell" options={{ title: 'McConnell' }} />
            <Tabs.Screen name="frary" options={{ title: 'Frary' }} />
            <Tabs.Screen name="hoch" options={{ title: 'Hoch-Shanahan' }} />
            <Tabs.Screen name="malott" options={{ title: 'Malott' }} />
            <Tabs.Screen name="collins" options={{ title: 'Collins' }} />
            <Tabs.Screen name="frank" options={{ title: 'Frank' }} />
            <Tabs.Screen name="oldenborg" options={{ title: 'Oldenborg' }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
            <Tabs.Screen name="index" options={{ href: null }} />
          </Tabs>
        </View>
      </View>
    </TabNavProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shell: { flex: 1, backgroundColor: Theme.darkerGray },
});
