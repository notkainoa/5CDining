import { StyleSheet, View } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import DiningTabBar from '@/components/DiningTabBar';
import DayStrip from '@/components/DayStrip';
import { DayProvider } from '@/lib/day';
import { HALL_BY_ID } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';

/**
 * Web layout: plain expo-router Tabs (no swipe — mouse-driven browsers don't
 * need it). Native uses _layout.tsx with the real paged NativePager.
 * The day strip renders once above Tabs on hall pages so it persists like
 * the bottom bar; hidden on search/settings.
 */
export default function TabLayoutWeb() {
  return (
    <DayProvider>
      <TabLayoutWebInner />
    </DayProvider>
  );
}

function TabLayoutWebInner() {
  const { searchEnabled } = usePrefs();
  const segments = useSegments();
  const activeName = segments[1] ?? '';
  const showDayStrip = activeName in HALL_BY_ID;
  return (
    <View style={styles.fill}>
      {showDayStrip ? <DayStrip /> : null}
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
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
