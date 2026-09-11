import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Theme } from '@/constants/Theme';
import { HALL_BY_ID, hallChipName, orderedHalls, type DiningHall } from '@/lib/diningHalls';
import { useDim } from '@/lib/dim';
import { usePrefs } from '@/lib/settings';
import { useTabNav } from '@/lib/tabNav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
/**
 * Radius of the fillet in the gutter where the card's side meets the underside
 * of an overhanging chip. Fits inside the gutter.
 */
const GUTTER_EAR = HALL_INSET;
/** Radius of the hall card's top corners. Drawn here as masks so they can un-round. */
const CORNER = 18;
/**
 * Chip/card horizontal overlap at which the bridge lets go. Near zero so the
 * chip hangs on right up to the card's corner before popping off.
 */
const DETACH_W = 2;
/** Theme.darkerGray under Theme.overlay, for the masks while the bar is dimmed. */
const DIMMED_CHROME = '#0f0f0f';
const FALLBACK_COLOR = '#228be6';

const HALL_COLOR: Record<string, string> = {
  mcconnell: '#fd7e14',
  frary: '#228be6',
  hoch: '#fab005',
  malott: '#40c057',
  collins: '#e03131',
  frank: '#228be6',
  oldenborg: '#228be6',
};

/** Same critically damped spring on both edges so width never balloons past the chips. */
const MOVE_SPRING = { duration: 380, dampingRatio: 1 };
const COLOR_SPRING = { duration: 380, dampingRatio: 1 };
const ATTACH_SPRING = { duration: 260, dampingRatio: 0.88 };
const DETACH_SPRING = { duration: 200, dampingRatio: 0.72, overshootClamping: true };
const SQUASH_SPRING = { duration: 340, dampingRatio: 0.58, clamp: { min: 0.93, max: 1.07 } };
const RELEASE_VEL = -2.1;
const LAND_VEL = 1.4;
const PRESS_SPRING = { damping: 20, stiffness: 400 };

interface ChipLayout {
  x: number;
  w: number;
}

interface BarState {
  scrollX: SharedValue<number>;
  barW: SharedValue<number>;
  layouts: SharedValue<Record<string, ChipLayout>>;
  activeId: SharedValue<string>;
  blobL: SharedValue<number>;
  blobR: SharedValue<number>;
  blobH: SharedValue<number>;
  fromCol: SharedValue<string>;
  toCol: SharedValue<string>;
  colorT: SharedValue<number>;
  squash: SharedValue<number>;
}

function clamp01(v: number): number {
  'worklet';
  return Math.min(1, Math.max(0, v));
}

function stemEase(p: number): number {
  'worklet';
  const t = clamp01(p);
  return t * t * (3 - 2 * t);
}

function earEase(p: number): number {
  'worklet';
  return Math.pow(clamp01(p), 1.75);
}

function neededScrollX(
  x: number,
  w: number,
  barW: number,
  scrollX: number,
): number | null {
  'worklet';
  if (barW === 0) return null;
  const left = scrollX;
  const right = left + barW;
  if (x < left + H_PAD) return Math.max(0, x - H_PAD);
  if (x + w > right - H_PAD) return x + w - barW + H_PAD;
  return null;
}

function snapBarScroll(
  ref: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>,
  applyScroll: (x: number) => void,
  scrollAnim: SharedValue<number>,
  scrollDrive: SharedValue<number>,
  target: number | null,
) {
  'worklet';
  if (target == null) return;
  scrollDrive.set(0);
  scrollAnim.set(target);
  if (Platform.OS === 'web') {
    runOnJS(applyScroll)(target);
  } else {
    scrollTo(ref, target, 0, false);
  }
}

function springBarScroll(
  scrollX: SharedValue<number>,
  scrollAnim: SharedValue<number>,
  scrollDrive: SharedValue<number>,
  target: number | null,
) {
  'worklet';
  if (target == null) {
    scrollDrive.set(0);
    return;
  }
  if (Math.abs(target - scrollX.value) < 0.5) return;
  scrollAnim.set(scrollX.value);
  scrollDrive.set(1);
  scrollAnim.set(
    withSpring(target, MOVE_SPRING, (finished) => {
      if (finished) scrollDrive.set(0);
    }),
  );
}

function hallColor(id: string): string {
  'worklet';
  return HALL_COLOR[id] ?? FALLBACK_COLOR;
}

function blobColorOf(s: BarState): string {
  'worklet';
  return interpolateColor(s.colorT.value, [0, 1], [s.fromCol.value, s.toCol.value]);
}

interface Geo {
  dl: number;
  dr: number;
  overlap: number;
}

/** Blob vs the hall card, in screen space. */
function blobGeo(s: BarState): Geo | null {
  'worklet';
  const w = s.barW.value;
  if (w === 0 || s.blobR.value - s.blobL.value < 1) return null;
  const cl = s.blobL.value - s.scrollX.value;
  const cr = s.blobR.value - s.scrollX.value;
  const hl = HALL_INSET;
  const hr = w - HALL_INSET;
  return { dl: cl - hl, dr: hr - cr, overlap: Math.min(cr, hr) - Math.max(cl, hl) };
}

function filletR(d: number): number {
  'worklet';
  return Math.min(EAR, Math.max(0, d) * (EAR / (EAR + CORNER)));
}

function cornerR(d: number): number {
  'worklet';
  return Math.min(CORNER, Math.max(0, d) * (CORNER / (EAR + CORNER)));
}

function overhangStemR(o: number): number {
  'worklet';
  return Math.min(STEM, Math.max(0, o) * (STEM / (STEM + GUTTER_EAR)));
}

function gutterEarR(o: number): number {
  'worklet';
  return Math.min(GUTTER_EAR, Math.max(0, o) * (GUTTER_EAR / (STEM + GUTTER_EAR)));
}

export default function HallTabBar() {
  const insets = useSafeAreaInsets();
  const { hallOrder } = usePrefs();
  const { activeKey, navigate } = useTabNav();
  const { dimmed, dismiss } = useDim();
  const halls = orderedHalls(hallOrder);
  const activeHall = activeKey in HALL_BY_ID ? activeKey : '';
  const startColor = HALL_BY_ID[activeHall as keyof typeof HALL_BY_ID]?.color ?? FALLBACK_COLOR;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const layoutsRef = useRef<Record<string, ChipLayout>>({});
  const barWRef = useRef(0);

  const scrollX = useSharedValue(0);
  const barW = useSharedValue(0);
  const layouts = useSharedValue<Record<string, ChipLayout>>({});
  const activeId = useSharedValue(activeHall);
  const blobL = useSharedValue(0);
  const blobR = useSharedValue(0);
  const blobH = useSharedValue(activeHall ? STEM : 0);
  const fromCol = useSharedValue(startColor);
  const toCol = useSharedValue(startColor);
  const colorT = useSharedValue(1);
  const squash = useSharedValue(1);
  const layoutGen = useSharedValue(0);
  /** Programmatic scroll position, sprung with the blob so clipped chips ease in. */
  const scrollAnim = useSharedValue(0);
  const scrollDrive = useSharedValue(0);

  const state = useMemo<BarState>(
    () => ({
      scrollX,
      barW,
      layouts,
      activeId,
      blobL,
      blobR,
      blobH,
      fromCol,
      toCol,
      colorT,
      squash,
    }),
    [scrollX, barW, layouts, activeId, blobL, blobR, blobH, fromCol, toCol, colorT, squash],
  );

  const applyScroll = useCallback((x: number) => {
    scrollRef.current?.scrollTo({ x, y: 0, animated: false });
  }, [scrollRef]);

  useEffect(() => {
    activeId.set(activeHall);
  }, [activeHall, activeId]);

  const onChipLayout = useCallback(
    (id: string, x: number, w: number) => {
      layoutsRef.current[id] = { x, w };
      layouts.set({ ...layoutsRef.current });
      layoutGen.set(layoutGen.value + 1);
      if (id === activeHall && blobR.value - blobL.value < 0.5) {
        blobL.set(x);
        blobR.set(x + w);
      }
    },
    [layouts, layoutGen, activeHall, blobL, blobR],
  );

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  useAnimatedReaction(
    () => scrollAnim.value,
    (x) => {
      if (!scrollDrive.value) return;
      scrollX.set(x);
      if (Platform.OS === 'web') {
        runOnJS(applyScroll)(x);
      } else {
        scrollTo(scrollRef, x, 0, false);
      }
    },
  );

  // Pour the blob to the active chip. Leading edge races, trailing edge follows.
  useAnimatedReaction(
    () => {
      const id = activeId.value;
      const lay = layouts.value[id];
      return {
        gen: layoutGen.value,
        id,
        x: lay?.x ?? -1,
        w: lay?.w ?? 0,
        bar: barW.value,
      };
    },
    (cur, prev) => {
      if (cur.w <= 0) return;
      const nl = cur.x;
      const nr = cur.x + cur.w;
      const fromHall = prev !== null && prev.w > 0 && !!HALL_COLOR[prev.id];
      const boot = !fromHall || blobR.value - blobL.value < 0.5;
      if (boot) {
        blobL.set(nl);
        blobR.set(nr);
        fromCol.set(hallColor(cur.id));
        toCol.set(hallColor(cur.id));
        colorT.set(1);
        blobH.set(STEM);
        squash.set(1);
        snapBarScroll(
          scrollRef,
          applyScroll,
          scrollAnim,
          scrollDrive,
          neededScrollX(nl, cur.w, barW.value, scrollX.value),
        );
        return;
      }
      if (prev.id === cur.id) {
        if (prev.x !== cur.x || prev.w !== cur.w) {
          blobL.set(withSpring(nl, MOVE_SPRING));
          blobR.set(withSpring(nr, MOVE_SPRING));
        }
        return;
      }
      blobL.set(withSpring(nl, MOVE_SPRING));
      blobR.set(withSpring(nr, MOVE_SPRING));
      fromCol.set(blobColorOf(state));
      toCol.set(hallColor(cur.id));
      colorT.set(0);
      colorT.set(withSpring(1, COLOR_SPRING));
      squash.set(1);
      springBarScroll(
        scrollX,
        scrollAnim,
        scrollDrive,
        neededScrollX(nl, cur.w, barW.value, scrollX.value),
      );
    },
    [state, layoutGen],
  );

  // Attach/detach vs the hall card — independent of which chip is selected.
  useAnimatedReaction(
    () => {
      const g = blobGeo(state);
      if (!activeId.value || !g) return null;
      return g.overlap >= DETACH_W;
    },
    (attached, prev) => {
      // Settings/search (or no geometry): hide instantly. Grow-in is for
      // hall↔hall pours and the scroll-off pop, not for entering a hall page.
      if (attached === null) {
        blobH.set(0);
        squash.set(1);
        return;
      }
      if (prev === attached) return;
      if (attached) {
        if (prev === false) {
          blobH.set(withSpring(STEM, ATTACH_SPRING));
          squash.set(withSpring(1, { ...SQUASH_SPRING, velocity: LAND_VEL }));
        } else {
          blobH.set(STEM);
          squash.set(1);
        }
      } else if (prev === true) {
        blobH.set(withSpring(0, DETACH_SPRING));
        squash.set(withSpring(1, { ...SQUASH_SPRING, velocity: RELEASE_VEL }));
      } else {
        blobH.set(0);
        squash.set(1);
      }
    },
    [state],
  );

  const attachP = useDerivedValue(() => stemEase(blobH.value / STEM));

  const maskL = useDerivedValue(() => {
    const g = blobGeo(state);
    if (!g) return CORNER;
    return Math.max(0, CORNER - attachP.value * (CORNER - cornerR(g.dl)));
  });
  const maskR = useDerivedValue(() => {
    const g = blobGeo(state);
    if (!g) return CORNER;
    return Math.max(0, CORNER - attachP.value * (CORNER - cornerR(g.dr)));
  });

  const chrome = dimmed ? DIMMED_CHROME : Theme.darkerGray;

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]}>
      <CornerMask side="left" radius={maskL} color={chrome} />
      <CornerMask side="right" radius={maskR} color={chrome} />
      <GutterEar side="left" state={state} chrome={chrome} />
      <GutterEar side="right" state={state} chrome={chrome} />
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w === barWRef.current) return;
          barWRef.current = w;
          barW.set(w);
          layoutGen.set(layoutGen.value + 1);
        }}
        onScrollBeginDrag={() => {
          scrollDrive.set(0);
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LiquidBlob state={state} chrome={chrome} />
        {halls.map((h) => (
          <Chip
            key={h.id}
            hall={h}
            active={activeHall === h.id}
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

function LiquidBlob({ state, chrome }: { state: BarState; chrome: string }) {
  const geo = useDerivedValue(() => blobGeo(state));
  const p = useDerivedValue(() => clamp01(state.blobH.value / STEM));
  const earL = useDerivedValue(() => (geo.value ? earEase(p.value) * filletR(geo.value.dl) : 0));
  const earR = useDerivedValue(() => (geo.value ? earEase(p.value) * filletR(geo.value.dr) : 0));

  const boxStyle = useAnimatedStyle(() => {
    const w = Math.max(0, state.blobR.value - state.blobL.value);
    const stemH = STEM * stemEase(p.value);
    // Always reach the hall card (+2px overlap) so a hairline of chrome
    // never shows while the tab pours.
    const h = CHIP_H * p.value + stemH + (p.value > 0.01 ? 2 : 0);
    const g = geo.value;
    return {
      left: state.blobL.value,
      width: w,
      height: h,
      backgroundColor: blobColorOf(state),
      borderTopLeftRadius: CHIP_RADIUS,
      borderTopRightRadius: CHIP_RADIUS,
      borderBottomLeftRadius: g ? Math.min(stemH, overhangStemR(-g.dl)) : 0,
      borderBottomRightRadius: g ? Math.min(stemH, overhangStemR(-g.dr)) : 0,
      opacity: p.value > 0.02 ? 1 : 0,
      transform: [{ scaleY: state.squash.value }],
    };
  });

  const earLStyle = useAnimatedStyle(() => {
    const s = earL.value;
    return { width: s, height: s, left: -s, backgroundColor: blobColorOf(state) };
  });
  const earLCut = useAnimatedStyle(() => {
    const s = earL.value;
    return { width: 2 * s, height: 2 * s, borderRadius: s, top: -s, left: -s };
  });
  const earRStyle = useAnimatedStyle(() => {
    const s = earR.value;
    return { width: s, height: s, right: -s, backgroundColor: blobColorOf(state) };
  });
  const earRCut = useAnimatedStyle(() => {
    const s = earR.value;
    return { width: 2 * s, height: 2 * s, borderRadius: s, top: -s, right: -s };
  });

  return (
    <Animated.View style={[styles.blob, boxStyle]}>
      <Animated.View style={[styles.ear, earLStyle]}>
        <Animated.View style={[styles.earCut, { backgroundColor: chrome }, earLCut]} />
      </Animated.View>
      <Animated.View style={[styles.ear, earRStyle]}>
        <Animated.View style={[styles.earCut, { backgroundColor: chrome }, earRCut]} />
      </Animated.View>
    </Animated.View>
  );
}

function Chip({
  hall,
  active,
  onPress,
  onLayout,
}: {
  hall: DiningHall;
  active: boolean;
  onPress: () => void;
  onLayout: (id: string, x: number, w: number) => void;
}) {
  const id = hall.id;
  const pressScale = useSharedValue(1);

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Animated.View
      collapsable={false}
      style={[styles.chip, { backgroundColor: hall.color, opacity: active ? 1 : 0.92 }, chipStyle]}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        queueMicrotask(() => onLayout(id, x, width));
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={hall.name}
        onPress={() => {
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
  );
}

function GutterEar({
  side,
  state,
  chrome,
}: {
  side: 'left' | 'right';
  state: BarState;
  chrome: string;
}) {
  const size = useDerivedValue(() => {
    const g = blobGeo(state);
    if (!g) return 0;
    const o = side === 'left' ? -g.dl : -g.dr;
    return earEase(state.blobH.value / STEM) * gutterEarR(o);
  });
  const boxStyle = useAnimatedStyle(() => {
    const s = size.value;
    return {
      width: s,
      height: s,
      backgroundColor: blobColorOf(state),
      ...(side === 'left' ? { left: HALL_INSET - s } : { right: HALL_INSET - s }),
    };
  });
  const cutStyle = useAnimatedStyle(() => {
    const s = size.value;
    return {
      width: 2 * s,
      height: 2 * s,
      borderRadius: s,
      bottom: -s,
      ...(side === 'left' ? { left: -s } : { right: -s }),
    };
  });
  return (
    <Animated.View style={[styles.gutterEar, boxStyle]}>
      <Animated.View style={[styles.gutterEarCut, { backgroundColor: chrome }, cutStyle]} />
    </Animated.View>
  );
}

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
    overflow: 'visible',
  },
  blob: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
    pointerEvents: 'none',
    zIndex: 0,
    transformOrigin: 'bottom',
  },
  chip: {
    height: CHIP_H,
    borderRadius: CHIP_RADIUS,
    zIndex: 1,
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
  ear: {
    position: 'absolute',
    bottom: 0,
    overflow: 'hidden',
  },
  earCut: {
    position: 'absolute',
  },
  gutterEar: {
    position: 'absolute',
    top: '100%',
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  gutterEarCut: {
    position: 'absolute',
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
