import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/Theme';
import { mealHoursCompact, shortMealName, type Meal } from '@/lib/api';

export default function MealPicker({
  meals,
  selected,
  onSelect,
}: {
  meals: Meal[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View style={styles.list} pointerEvents="auto">
      {meals.map((m, i) => {
        const hours = mealHoursCompact(m);
        const name = shortMealName(m.name);
        return (
          <Pressable
            key={`${m.name}-${i}`}
            onPress={() => onSelect(i)}
            accessibilityRole="button"
            accessibilityLabel={hours ? `${name}, ${hours}` : name}
            accessibilityState={{ selected: i === selected }}
            style={({ pressed }) => [styles.item, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Text style={styles.itemName}>{name}</Text>
            {hours ? <Text style={styles.itemHours}>{hours}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 8,
    alignSelf: 'flex-start',
    minWidth: 180,
    backgroundColor: Theme.trigger,
    borderRadius: 14,
    padding: 8,
    gap: 6,
  },
  item: {
    backgroundColor: Theme.mealItem,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  itemName: {
    color: Theme.white,
    fontSize: 16,
    fontWeight: '700',
  },
  itemHours: {
    color: Theme.white,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.85,
  },
});
