import { Platform, StyleSheet, View } from 'react-native';
import SearchScreen from '@/app/search';
import SettingsScreen from '@/app/settings';
import { useIsWebApp } from '@/lib/webApp';
import { useWebStack } from '@/lib/webStack';

/** Covers the `/webapp` app on web when settings or search is open. */
export default function WebStackHost() {
  const { screen } = useWebStack();
  const webApp = useIsWebApp();
  if (Platform.OS !== 'web' || !webApp || !screen) return null;
  return (
    <View style={styles.cover}>
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
