import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/Theme';
import { HALL_BY_ID, hallChipName, orderedHalls } from '@/lib/diningHalls';
import { useDim } from '@/lib/dim';
import { usePrefs } from '@/lib/settings';
import { useTabNav } from '@/lib/tabNav';

/**
 * Top bar: one chip per dining hall, school-colored, horizontally scrolling.
 * Selected chip is full opacity; the rest sit slightly dimmed so school
 * colors stay vivid (unlike the gray day cards, 70% turns yellow to olive).
 */
export default function HallTabBar() {
  const insets = useSafeAreaInsets();
  const { hallOrder } = usePrefs();
  const { activeKey, navigate } = useTabNav();
  const { dimmed, dismiss } = useDim();
  const halls = useMemo(() => orderedHalls(hallOrder), [hallOrder]);
  const scrollRef = useRef<ScrollView>(null);
  const xOf = useRef<Record<string, number>>({});
  const wOf = useRef<Record<string, number>>({});
  const barW = useRef(0);
  const scrollX = useRef(0);

  const reveal = useCallback((id: string, animated: boolean) => {
    const x = xOf.current[id];
    const w = wOf.current[id];
    if (x == null || w == null || barW.current === 0) return;
    const pad = 10;
    const left = scrollX.current;
    const right = left + barW.current;
    if (x < left + pad) {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - pad), animated });
    } else if (x + w > right - pad) {
      scrollRef.current?.scrollTo({ x: x + w - barW.current + pad, animated });
    }
  }, []);

  useEffect(() => {
    if (!(activeKey in HALL_BY_ID)) return;
    reveal(activeKey, true);
  }, [activeKey, reveal]);

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onLayout={(e) => {
          barW.current = e.nativeEvent.layout.width;
          if (activeKey in HALL_BY_ID) reveal(activeKey, false);
        }}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
      >
        {halls.map((h) => {
          const active = activeKey === h.id;
          return (
            <Pressable
              key={h.id}
              accessibilityRole="button"
              accessibilityLabel={h.name}
              accessibilityState={{ selected: active }}
              onPress={() => navigate(h.id)}
              onLayout={(e) => {
                xOf.current[h.id] = e.nativeEvent.layout.x;
                wOf.current[h.id] = e.nativeEvent.layout.width;
                if (h.id === activeKey) reveal(h.id, false);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: h.color,
                  opacity: active ? 1 : 0.92,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={[styles.label, { color: h.onColor }]} numberOfLines={1}>
                {hallChipName(h)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {dimmed ? (
        <Pressable style={styles.overlay} onPress={dismiss} accessibilityLabel="Dismiss" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Theme.darkerGray,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.overlay,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  chip: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
