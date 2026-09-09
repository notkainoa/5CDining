import { Pressable, StyleSheet, Text } from 'react-native';
import { usePrefs } from '@/lib/settings';

export default function HeartButton({ label }: { label: string }) {
  const prefs = usePrefs();
  const fav = prefs.isFavorite(label);
  return (
    <Pressable
      onPress={() => prefs.toggleFavorite(label)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={fav ? `Remove ${label} from favorites` : `Save ${label} to favorites`}
      accessibilityState={{ selected: fav }}
    >
      <Text style={[styles.heart, { color: fav ? '#DA2C46' : '#8E8E93' }]}>{fav ? '♥' : '♡'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heart: { fontSize: 22 },
});
