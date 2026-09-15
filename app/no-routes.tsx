import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { usePrefs } from '@/lib/settings';

/**
 * Turn on “disable page URLs” (no-op if it is already on), then go to `/`.
 */
export default function NoRoutes() {
  const { loaded, hideRoutes, update } = usePrefs();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    // Web-only setting: a native deep link here must not mutate it.
    if (Platform.OS === 'web' && !hideRoutes) update({ hideRoutes: true });
    setReady(true);
  }, [hideRoutes, loaded, update]);

  if (!loaded || !ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href="/" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
