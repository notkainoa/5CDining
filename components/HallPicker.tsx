import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/Theme';
import type { DiningHall, HallId } from '@/lib/diningHalls';
import SchoolLogo from './SchoolLogo';

export default function HallPicker({
  halls,
  currentId,
  mealsByHall,
  onSelect,
}: {
  halls: DiningHall[];
  currentId: HallId;
  mealsByHall: Record<string, string>;
  onSelect: (id: HallId) => void;
}) {
  return (
    <View style={styles.list} pointerEvents="auto">
      {halls.map((h) => (
        <Pressable
          key={h.id}
          onPress={() => onSelect(h.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: h.id === currentId }}
          accessibilityLabel={`${h.name}${mealsByHall[h.id] ? `, ${mealsByHall[h.id]}` : ''}`}
          style={({ pressed }) => [
            styles.item,
            { backgroundColor: h.color, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <SchoolLogo hall={h} size={36} />
          <Text style={styles.itemName} numberOfLines={1}>
            {h.name}
          </Text>
          <Text style={styles.itemMeals} numberOfLines={2}>
            {mealsByHall[h.id] ?? ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: Theme.trigger,
    borderRadius: 16,
    padding: 8,
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    minHeight: 52,
  },
  itemName: {
    flex: 1,
    color: Theme.white,
    fontSize: 16,
    fontWeight: '700',
  },
  itemMeals: {
    color: Theme.white,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '42%',
    opacity: 0.95,
  },
});
