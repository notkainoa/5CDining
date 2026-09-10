import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/Theme';
import { HALL_BY_ID, hallChipName, orderedHalls, type DiningHall } from '@/lib/diningHalls';
import { useDim } from '@/lib/dim';
import { usePrefs } from '@/lib/settings';
import { useTabNav } from '@/lib/tabNav';

/** Horizontal inset of the hall card below the bar (HallScreen `school` marginHorizontal). */
const HALL_INSET = 8;
const H_PAD = HALL_INSET;
const GAP = 8;
const CHIP_H = 36;
const CHIP_RADIUS = 14;
/** Height of the bridge that joins an attached chip to the hall card. */
const STEM = 10;
/** Radius of the concave fillets where the bridge meets the card's top edge. */
const EAR = 10;
/** Radius of the hall card's top corners. Drawn here as masks so they can un-round. */
const CORNER = 18;
/** Minimum chip/card horizontal overlap before the bridge lets go. */
const DETACH_W = 18;
/** Theme.darkerGray under Theme.overlay, for the masks while the bar is dimmed. */
const DIMMED_CHROME = '#0f0f0f';

/** ~150ms settle with a hint of overshoot, so a switch reads as one quick snap. */
const SPRING = { damping: 38, stiffness: 700, mass: 1 };
const PRESS_SPRING = { damping: 20, stiffness: 400 };

interface ChipLayout {
  x: number;
  w: number;
}

/** Shared geometry every chip and mask reads from. */
interface BarState {
  scrollX: SharedValue<number>;
  barW: SharedValue<number>;
  layouts: SharedValue<Record<string, ChipLayout>>;
  activeId: SharedValue<string>;
  prevId: SharedValue<string>;
  /** 0..1 attach progress of the active chip's bridge. */
  pCur: SharedValue<number>;
  /** Attach progress of the chip that just lost focus (retracting). */
  pPrev: SharedValue<number>;
}

interface Geo {
  /** Chip's left edge minus the card's left edge (negative: overhanging). */
  dl: number;
  /** Card's right edge minus the chip's right edge. */
  dr: number;
  /** Horizontal overlap between chip and card. */
  overlap: number;
}

function geoOf(id: string, s: BarState): Geo | null {
  'worklet';
  const l = s.layouts.value[id];
  const w = s.barW.value;
  if (!l || w === 0) return null;
  const cl = l.x - s.scrollX.value;
  const cr = cl + l.w;
  const hl = HALL_INSET;
  const hr = w - HALL_INSET;
  return { dl: cl - hl, dr: hr - cr, overlap: Math.min(cr, hr) - Math.max(cl, hl) };
}

/**
 * As a chip nears the card's edge the gap between them is shared by the
 * fillet and the card corner, both shrinking to zero so the S-curve flattens
 * into one straight edge when the chip is flush.
 */
function filletR(d: number): number {
  'worklet';
  return Math.min(EAR, Math.max(0, d) * (EAR / (EAR + CORNER)));
}

function cornerR(d: number): number {
  'worklet';
  return Math.min(CORNER, Math.max(0, d) * (CORNER / (EAR + CORNER)));
}

function clamp01(v: number): number {
  'worklet';
  return Math.min(1, Math.max(0, v));
}

export default function HallTabBar() {
  const insets = useSafeAreaInsets();
  const { hallOrder } = usePrefs();
  const { activeKey, navigate } = useTabNav();
  const { dimmed, dismiss } = useDim();
  const halls = orderedHalls(hallOrder);
  const activeHall = activeKey in HALL_BY_ID ? activeKey : '';

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const layoutsRef = useRef<Record<string, ChipLayout>>({});
  const barWRef = useRef(0);

  const scrollX = useSharedValue(0);
  const barW = useSharedValue(0);
  const layouts = useSharedValue<Record<string, ChipLayout>>({});
  const activeId = useSharedValue(activeHall);
  const prevId = useSharedValue('');
  const pCur = useSharedValue(1);
  const pPrev = useSharedValue(0);

  const state = useMemo<BarState>(
    () => ({ scrollX, barW, layouts, activeId, prevId, pCur, pPrev }),
    [scrollX, barW, layouts, activeId, prevId, pCur, pPrev],
  );

  const reveal = useCallback(
    (id: string, animated: boolean) => {
      const l = layoutsRef.current[id];
      const w = barWRef.current;
      if (!l || w === 0) return;
      const left = scrollX.value;
      const right = left + w;
      if (l.x < left + H_PAD) {
        scrollRef.current?.scrollTo({ x: Math.max(0, l.x - H_PAD), animated });
      } else if (l.x + l.w > right - H_PAD) {
        scrollRef.current?.scrollTo({ x: l.x + l.w - w + H_PAD, animated });
      }
    },
    [scrollRef, scrollX],
  );

  useEffect(() => {
    activeId.set(activeHall);
    if (activeHall) reveal(activeHall, true);
  }, [activeHall, activeId, reveal]);

  const onChipLayout = useCallback(
    (id: string, x: number, w: number) => {
      layoutsRef.current[id] = { x, w };
      layouts.set({ ...layoutsRef.current });
      if (id === activeHall) reveal(id, false);
    },
    [layouts, activeHall, reveal],
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  // Owns the attach/detach springs. Runs every frame the scroll moves, so it
  // has to detect its own edges: a new active chip, or the active chip
  // crossing the detach threshold.
  useAnimatedReaction(
    () => {
      const id = activeId.value;
      let attached: boolean | null = false;
      if (id) {
        const g = geoOf(id, state);
        attached = g ? g.overlap >= DETACH_W : null;
      }
      return { id, attached };
    },
    (cur, prev) => {
      const switched = prev !== null && prev.id !== cur.id;
      if (switched) {
        prevId.set(prev.id);
        pPrev.set(pCur.value);
        pPrev.set(withSpring(0, SPRING));
        pCur.set(0);
      }
      if (cur.attached === null) return;
      if (!switched && prev !== null && prev.attached === cur.attached) return;
      pCur.set(withSpring(cur.attached ? 1 : 0, SPRING));
    },
    [state],
  );

  // Card corner radii: fully round unless a bridge is pulling a corner square.
  const maskL = useDerivedValue(() => {
    let cut = 0;
    const a = geoOf(activeId.value, state);
    if (a) cut += clamp01(pCur.value) * (CORNER - cornerR(a.dl));
    const p = geoOf(prevId.value, state);
    if (p) cut += clamp01(pPrev.value) * (CORNER - cornerR(p.dl));
    return Math.max(0, CORNER - cut);
  });
  const maskR = useDerivedValue(() => {
    let cut = 0;
    const a = geoOf(activeId.value, state);
    if (a) cut += clamp01(pCur.value) * (CORNER - cornerR(a.dr));
    const p = geoOf(prevId.value, state);
    if (p) cut += clamp01(pPrev.value) * (CORNER - cornerR(p.dr));
    return Math.max(0, CORNER - cut);
  });

  const chrome = dimmed ? DIMMED_CHROME : Theme.darkerGray;

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]}>
      <CornerMask side="left" radius={maskL} color={chrome} />
      <CornerMask side="right" radius={maskR} color={chrome} />
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          barWRef.current = w;
          barW.set(w);
          if (activeHall) reveal(activeHall, false);
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {halls.map((h) => (
          <Chip
            key={h.id}
            hall={h}
            active={activeHall === h.id}
            state={state}
            onPress={() => navigate(h.id)}
            onLayout={onChipLayout}
          />
        ))}
      </Animated.ScrollView>
      {dimmed ? (
        <Pressable style={styles.overlay} onPress={dismiss} accessibilityLabel="Dismiss" />
      ) : null}
    </View>
  );
}

function Chip({
  hall,
  active,
  state,
  onPress,
  onLayout,
}: {
  hall: DiningHall;
  active: boolean;
  state: BarState;
  onPress: () => void;
  onLayout: (id: string, x: number, w: number) => void;
}) {
  const id = hall.id;
  const pressScale = useSharedValue(1);

  /** This chip's bridge progress: current, retracting, or none. */
  const mine = useDerivedValue(() => {
    const p =
      state.activeId.value === id
        ? state.pCur.value
        : state.prevId.value === id
          ? state.pPrev.value
          : 0;
    return Math.max(0, p);
  });
  const geo = useDerivedValue(() => geoOf(id, state));
  /** Chip bottom-corner radius: square while bridged, back to a pill when free. */
  const chipR = useDerivedValue(() => CHIP_RADIUS * (1 - clamp01(mine.value)));
  const earL = useDerivedValue(() => (geo.value ? mine.value * filletR(geo.value.dl) : 0));
  const earR = useDerivedValue(() => (geo.value ? mine.value * filletR(geo.value.dr) : 0));

  const chipStyle = useAnimatedStyle(() => ({
    borderBottomLeftRadius: chipR.value,
    borderBottomRightRadius: chipR.value,
    opacity: 0.92 + 0.08 * clamp01(mine.value),
    transform: [{ scale: mine.value > 0 ? 1 : pressScale.value }],
  }));

  // The bridge only spans the flat part of the chip's bottom edge, so while
  // the corners re-round during a retract nothing pokes out beside them.
  const bridgeStyle = useAnimatedStyle(() => ({
    height: STEM * mine.value,
    left: chipR.value,
    right: chipR.value,
  }));

  // Overhanging the card's edge, the stem rounds off by exactly the overhang
  // so its corner lands on the card's side. The extra 1px hides any seam with
  // the card and must vanish with the bridge.
  const stemStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const h = STEM * mine.value;
    return {
      bottom: mine.value > 0.01 ? -1 : 0,
      borderBottomLeftRadius: g ? Math.min(h, Math.max(0, -g.dl)) : 0,
      borderBottomRightRadius: g ? Math.min(h, Math.max(0, -g.dr)) : 0,
    };
  });

  const earLStyle = useAnimatedStyle(() => {
    const s = earL.value;
    return { width: s, height: s, left: -s };
  });
  const earLCut = useAnimatedStyle(() => {
    const s = earL.value;
    return { width: 2 * s, height: 2 * s, borderRadius: s, top: -s, left: -s };
  });
  const earRStyle = useAnimatedStyle(() => {
    const s = earR.value;
    return { width: s, height: s, right: -s };
  });
  const earRCut = useAnimatedStyle(() => {
    const s = earR.value;
    return { width: 2 * s, height: 2 * s, borderRadius: s, top: -s, right: -s };
  });

  return (
    <View
      style={styles.chipWrap}
      onLayout={(e) => onLayout(id, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.chip, { backgroundColor: hall.color }, chipStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={hall.name}
          onPress={() => {
            // Snap, don't spring: the bridge starts growing right away and a
            // still-shrunken chip would leave a hairline gap above it.
            pressScale.set(1);
            onPress();
          }}
          onPressIn={() => {
            if (!active) pressScale.set(withSpring(0.96, PRESS_SPRING));
          }}
          onPressOut={() => {
            pressScale.set(withSpring(1, PRESS_SPRING));
          }}
          style={styles.chipHit}
        >
          <Text style={[styles.label, { color: hall.onColor }]} numberOfLines={1}>
            {hallChipName(hall)}
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.bridge, bridgeStyle]}>
        <Animated.View style={[styles.stem, { backgroundColor: hall.color }, stemStyle]} />
        <Animated.View style={[styles.ear, { backgroundColor: hall.color }, earLStyle]}>
          <Animated.View style={[styles.earCut, earLCut]} />
        </Animated.View>
        <Animated.View style={[styles.ear, { backgroundColor: hall.color }, earRStyle]}>
          <Animated.View style={[styles.earCut, earRCut]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * Rounds one top corner of the hall card from above. A transparent view with
 * only two chrome-colored borders: the outer edge is chrome-on-chrome and
 * disappears, the inner edge is the visible corner curve.
 */
function CornerMask({
  side,
  radius,
  color,
}: {
  side: 'left' | 'right';
  radius: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() =>
    side === 'left'
      ? { borderTopLeftRadius: radius.value + HALL_INSET }
      : { borderTopRightRadius: radius.value + HALL_INSET },
  );
  return (
    <Animated.View
      style={[
        styles.mask,
        side === 'left' ? styles.maskLeft : styles.maskRight,
        { borderColor: color },
        style,
      ]}
    />
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
    bottom: 0,
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
    height: CHIP_H,
    borderRadius: CHIP_RADIUS,
  },
  chipHit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  bridge: {
    position: 'absolute',
    top: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
  },
  stem: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  ear: {
    position: 'absolute',
    bottom: 0,
    overflow: 'hidden',
  },
  earCut: {
    position: 'absolute',
    backgroundColor: Theme.darkerGray,
  },
  mask: {
    position: 'absolute',
    bottom: -CORNER,
    width: CORNER + HALL_INSET,
    height: CORNER + HALL_INSET,
    backgroundColor: 'transparent',
    borderTopWidth: HALL_INSET,
    pointerEvents: 'none',
  },
  maskLeft: {
    left: 0,
    borderLeftWidth: HALL_INSET,
  },
  maskRight: {
    right: 0,
    borderRightWidth: HALL_INSET,
  },
});
