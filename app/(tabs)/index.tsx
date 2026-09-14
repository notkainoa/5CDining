import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { usePrefs } from '@/lib/settings';

/** Launch routing: first hall in the user's order. */
export default function Index() {
  const { loaded, hallOrder } = usePrefs();
  if (!loaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <Redirect href={`/(tabs)/${hallOrder[0]}`} />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
