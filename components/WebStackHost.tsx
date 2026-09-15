import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import SearchScreen from '@/app/search';
import SettingsScreen from '@/app/settings';
import { SEARCH_FEATURES } from '@/lib/settings';
import { useIsWebApp } from '@/lib/webApp';
import { useWebStack } from '@/lib/webStack';

/** Covers the `/webapp` app on web when settings or search is open. */
export default function WebStackHost() {
  const { screen, close } = useWebStack();
  const webApp = useIsWebApp();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // The stack outlives route changes (it sits above the router). Leaving
  // `/webapp` with an overlay open must not poison Back on normal routes
  // or resurrect the overlay on return.
  useEffect(() => {
    if (!webApp && screen) close();
  }, [webApp, screen, close]);

  if (Platform.OS !== 'web' || !webApp || !screen) return null;
  // Search is a shipped feature flag: never mount its redirecting screen as
  // an overlay while disabled, or the router would leave `/webapp` behind
  // the pinned address bar.
  if (screen === 'search' && !SEARCH_FEATURES) return null;
  return (
    <View
      style={styles.cover}
      role="dialog"
      accessibilityLabel={screen === 'settings' ? 'Settings' : 'Search'}
    >
      {screen === 'settings' ? <SettingsScreen /> : <SearchScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
  },
});
