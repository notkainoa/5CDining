import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/Theme';
import { HALL_BY_ID, hallChipName, orderedHalls } from '@/lib/diningHalls';
import { useDim } from '@/lib/dim';
import { usePrefs } from '@/lib/settings';
import { useTabNav } from '@/lib/tabNav';

const H_PAD = 8;
const GAP = 8;
const STEM = 10;
const EAR = 10;
const OVERLAP = 6;
const CHIP_RADIUS = 14;

/**
 * CSS-Tricks scoop: hall-colored square beside the stem, chrome circle
 * cutting the outer corner. Lives on the chip so it scrolls with the bar.
 */
function Scoop({ side, color }: { side: 'left' | 'right'; color: string }) {
  return (
    <View
      style={[
        styles.scoop,
        side === 'left' ? styles.scoopLeft : styles.scoopRight,
        { backgroundColor: color },
      ]}
    >
      <View style={[styles.scoopCut, side === 'left' ? styles.scoopCutLeft : styles.scoopCutRight]} />
    </View>
  );
}

export default function HallTabBar() {
  const insets = useSafeAreaInsets();
  const { hallOrder } = usePrefs();
  const { activeKey, navigate } = useTabNav();
  const { dimmed, dismiss } = useDim();
  const halls = orderedHalls(hallOrder);
  const scrollRef = useRef<ScrollView>(null);
  const xOf = useRef<Record<string, number>>({});
  const wOf = useRef<Record<string, number>>({});
  const barW = useRef(0);
  const scrollX = useRef(0);

  const reveal = useCallback((id: string, animated: boolean) => {
    const x = xOf.current[id];
    const w = wOf.current[id];
    if (x == null || w == null || barW.current === 0) return;
    const left = scrollX.current;
    const right = left + barW.current;
    if (x < left + H_PAD) {
      scrollRef.current?.scrollTo({ x: Math.max(0, x - H_PAD), animated });
    } else if (x + w > right - H_PAD) {
      scrollRef.current?.scrollTo({ x: x + w - barW.current + H_PAD, animated });
    }
  }, []);

  useEffect(() => {
    if (activeKey in HALL_BY_ID) reveal(activeKey, true);
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
        }}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
      >
        {halls.map((h, i) => {
          const active = activeKey === h.id;
          return (
            <View
              key={h.id}
              style={styles.chipWrap}
              onLayout={(e) => {
                xOf.current[h.id] = e.nativeEvent.layout.x;
                wOf.current[h.id] = e.nativeEvent.layout.width;
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={h.name}
                onPress={() => navigate(h.id)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  {
                    backgroundColor: h.color,
                    opacity: active ? 1 : 0.92,
                    transform: [{ scale: pressed && !active ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text style={[styles.label, { color: h.onColor }]} numberOfLines={1}>
                  {hallChipName(h)}
                </Text>
              </Pressable>
              {active ? (
                <>
                  <View style={[styles.stem, { backgroundColor: h.color }]} />
                  {i > 0 ? <Scoop side="left" color={h.color} /> : null}
                  {i < halls.length - 1 ? <Scoop side="right" color={h.color} /> : null}
                </>
              ) : null}
            </View>
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
    zIndex: 10,
    overflow: 'visible',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -OVERLAP,
    backgroundColor: Theme.overlay,
    zIndex: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: GAP,
    paddingHorizontal: H_PAD,
    paddingBottom: STEM,
  },
  chipWrap: {
    overflow: 'visible',
  },
  chip: {
    borderRadius: CHIP_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  stem: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: STEM + OVERLAP,
    pointerEvents: 'none',
  },
  scoop: {
    position: 'absolute',
    top: '100%',
    width: EAR,
    height: EAR,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  scoopLeft: {
    left: -EAR,
  },
  scoopRight: {
    right: -EAR,
  },
  scoopCut: {
    position: 'absolute',
    width: EAR * 2,
    height: EAR * 2,
    borderRadius: EAR,
    backgroundColor: Theme.darkerGray,
    top: -EAR,
  },
  scoopCutLeft: {
    left: -EAR,
  },
  scoopCutRight: {
    right: -EAR,
  },
});
