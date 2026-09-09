import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import type { HallId } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';

/** Launch routing: search page when enabled, else the first hall in the order. */
export default function Index() {
  const { loaded, searchEnabled, hallOrder } = usePrefs();
  if (!loaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  const target: HallId | 'search' = searchEnabled ? 'search' : hallOrder[0];
  return <Redirect href={target === 'search' ? '/(tabs)/search' : `/(tabs)/${target}`} />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
