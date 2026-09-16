import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import { Theme } from '@/constants/Theme';
import { usePrefs } from '@/lib/settings';

const HEART = { ios: 'heart', android: 'favorite_border', web: 'favorite_border' } as const;
const HEART_FILL = { ios: 'heart.fill', android: 'favorite', web: 'favorite' } as const;
const HEART_ON = '#DA2C46';

export default function HeartButton({ label }: { label: string }) {
  const prefs = usePrefs();
  const fav = prefs.isFavorite(label);
  return (
    <Pressable
      onPress={() => prefs.toggleFavorite(label)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={fav ? `Remove ${label} from favorites` : `Save ${label} to favorites`}
      accessibilityState={{ selected: fav }}
      style={styles.hit}
    >
      <SymbolView
        name={fav ? HEART_FILL : HEART}
        tintColor={fav ? HEART_ON : Theme.gray}
        size={22}
        weight={{ ios: 'medium', android: mediumWeight }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
