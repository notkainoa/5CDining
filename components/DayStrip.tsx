import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateCardLabels, sameDay } from '@/lib/dates';
import { useDay } from '@/lib/day';

/**
 * Persistent day strip — rendered once above the pager (not inside each hall
 * page), so swiping between halls leaves it in place, like the bottom bar.
 * Hall pages consume the same selection via useDay().
 */
export default function DayStrip() {
  const { days, selected, selectDate } = useDay();
  const insets = useSafeAreaInsets();
  const date = days[selected];

  return (
    <View style={[styles.stripSection, { paddingTop: insets.top }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {days.map((d, i) => {
          const { top, bottom } = dateCardLabels(d, i);
          const isSel = date ? sameDay(d, date) : i === selected;
          return (
            <Pressable
              key={d.toISOString()}
              accessibilityRole="button"
              accessibilityLabel={`${top} ${bottom}`}
              accessibilityState={{ selected: isSel }}
              onPress={() => selectDate(i)}
              style={[styles.dateCard, { borderColor: isSel ? '#fff' : 'transparent' }]}
            >
              <Text style={styles.dateTop}>{top}</Text>
              <Text style={styles.dateBottom}>{bottom}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stripSection: { backgroundColor: '#222' },
  strip: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 8 },
  dateCard: {
    width: 84,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: '#444',
  },
  dateTop: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dateBottom: { fontSize: 13, marginTop: 4, color: '#fff' },
});
