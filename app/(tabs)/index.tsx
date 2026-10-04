import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { usePrefs } from '@/lib/settings';

/** Launch routing: the cross-hall overview. */
export default function Index() {
  const { loaded } = usePrefs();
  if (!loaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <Redirect href="/(tabs)/overview" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
