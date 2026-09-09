import { Image, StyleSheet, View } from 'react-native';
import type { DiningHall } from '@/lib/diningHalls';

/** Reuses the current logo treatment: white circle only when the asset needs it. */
export default function SchoolLogo({ hall, size = 56 }: { hall: DiningHall; size?: number }) {
  if (hall.logoOnWhite) {
    return (
      <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={hall.logo}
          style={{ width: size * 0.78, height: size * 0.78 }}
          resizeMode="contain"
        />
      </View>
    );
  }
  return <Image source={hall.logo} style={{ width: size, height: size }} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
