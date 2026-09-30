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
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Theme } from '@/constants/Theme';
import {
  CHROME_INSET,
  CHROME_JOIN_EAR,
  CHROME_RADIUS,
  INNER_CHIP_RADIUS,
  useFlight,
  useTopCorners,
} from '@/components/HallChrome';
import { HALL_BY_ID, hallChipName, orderedHalls, type DiningHall } from '@/lib/diningHalls';
import { useDim } from '@/lib/dim';
import { usePrefs } from '@/lib/settings';
import { usePagerProgress, usePrep, useTabNav } from '@/lib/tabNav';

/** Horizontal inset of the hall card below the bar (HallScreen `school` marginHorizontal). */
const HALL_INSET = CHROME_INSET;
const H_PAD = HALL_INSET;
const GAP = 8;
const CHIP_H = 40;
const CHIP_RADIUS = INNER_CHIP_RADIUS;
/**
 * Height of the bridge that joins an attached chip to the hall card.
 */
const STEM = HALL_INSET;
/** Concave fillet where a chip stem meets the hall chrome. */
const EAR = CHROME_JOIN_EAR;
/**
 * Underside fillet where an overhanging chip meets the hall card's side.
 */
const GUTTER_EAR = EAR;
/**
 * Inner radius of the hall chrome's top corners (outer is CHROME_RADIUS).
 * Drawn here as masks so they can un-round.
 */
const CORNER = CHROME_RADIUS - HALL_INSET;
/**
 * Stay attached until the last pixel of the chip still overlaps the hall
 * card. Lets go when that edge lines up with the card's edge.
 */
const DETACH_W = 1;
/**
 * Overlap needed to re-join once popped. Wider than DETACH_W so a drag that
 * rests on the edge can't flicker between pop and reattach.
 */
const ATTACH_W = 3;
/** Theme.darkerGray under Theme.overlay, for the masks while the bar is dimmed. */
const DIMMED_CHROME = '#0f0f0f';
const FALLBACK_COLOR = '#228be6';

const HALL_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(HALL_BY_ID).map(([id, hall]) => [id, hall.color]),
);

/** Same critically damped spring on both edges so width never balloons past the chips. */
const MOVE_SPRING = { duration: 380, dampingRatio: 1 };
const COLOR_SPRING = { duration: 380, dampingRatio: 1 };
/**
 * The pop. One spring (blobH) drives the whole release in stages: the fillets
 * melt, then the stem retracts into the chip like a droplet while the card
 * corner springs back round. Underdamped so the corner over-rounds a touch
 * and settles; the stem and fillets clamp at 0 so only the corner wobbles.
 *
 * Physics springs with a release velocity (blobH/s): it snaps free almost at
 * once (fillets gone ~3ms), the corner is round by ~28ms, settled by ~100ms.
 */
const ATTACH_SPRING = { stiffness: 400, damping: 34, mass: 1, velocity: 60 };
const DETACH_SPRING = { stiffness: 3200, damping: 100, mass: 1, velocity: -650 };
/**
 * Before the pop: once the chip's overlap with the card drops below this, the
 * fillets thin toward TAUT_MIN so the connector reads as stretched taut.
 */
const STRETCH_W = EAR;
const TAUT_MIN = 0.2;
/** Pop progress (blobH / STEM) below which the stem retracts and the card corner re-rounds. */
const CORNER_STAGE = 0.8;
/** Pop progress above which the fillets exist; they're gone before the corner moves much. */
const EAR_STAGE = 0.6;
/** Extra corner radius the spring may overshoot to (the mask is sized for it). */
const CORNER_OVERSHOOT = 3;
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
}

function clamp01(v: number): number {
  'worklet';
  return Math.min(1, Math.max(0, v));
}

/** Raw pop progress: 1 joined, 0 released; the detach spring dips below 0. */
function popOf(s: BarState): number {
  'worklet';
  return s.blobH.value / STEM;
}

/**
 * How joined the card corner is. Linear in the spring so the corner moves with
 * spring timing; goes negative on overshoot, which over-rounds the corner.
 */
function cornerJoin(p: number): number {
  'worklet';
  return Math.max(-CORNER_OVERSHOOT / CORNER, Math.min(1, p / CORNER_STAGE));
}

function earEase(p: number): number {
  'worklet';
  return Math.pow(clamp01(p), 1.75);
}

function earJoin(p: number): number {
  'worklet';
  return earEase((p - EAR_STAGE) / (1 - EAR_STAGE));
}

/** Fillet scale from how far the connector is stretched: 1 slack, TAUT_MIN at the pop. */
function tautOf(g: Geo | null): number {
  'worklet';
  if (!g) return 1;
  const t = clamp01(g.overlap / STRETCH_W);
  return TAUT_MIN + (1 - TAUT_MIN) * t * t * (3 - 2 * t);
}

function neededScrollX(x: number, w: number, barW: number, scrollX: number): number | null {
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
  return Math.min(STEM, Math.max(0, o));
}

function gutterEarR(o: number): number {
  'worklet';
  return Math.min(GUTTER_EAR, Math.max(0, o));
}

export default function HallTabBar() {
  const { hallOrder } = usePrefs();
  const { activeKey, lastHallId, navigate } = useTabNav();
  const { dimmed, dismiss } = useDim();
  const halls = orderedHalls(hallOrder);
  const activeHall = activeKey in HALL_BY_ID ? activeKey : lastHallId;
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
    }),
    [scrollX, barW, layouts, activeId, blobL, blobR, blobH, fromCol, toCol, colorT],
  );

  const applyScroll = useCallback(
    (x: number) => {
      scrollRef.current?.scrollTo({ x, y: 0, animated: false });
    },
    [scrollRef],
  );

  // With a pager (native), the pager is the only writer of the blob's
  // left/right edges so the blob and pages share one timeline. The pour below
  // still owns color and bar scroll. progressCtx is null on web (no pager);
  // there the pour springs the edges instead.
  const progressCtx = usePagerProgress();
  const prepCtx = usePrep();
  const orderSV = useSharedValue<string[]>([]);
  useEffect(() => {
    orderSV.set(halls.map((h) => h.id));
  }, [halls, orderSV]);

  useAnimatedReaction(
    () => ({
      p: progressCtx ? progressCtx.value : -1,
      order: orderSV.value,
      lay: layouts.value,
    }),
    (cur, prev) => {
      if (cur.p < 0) return;
      const n = cur.order.length;
      if (n === 0) return;
      const pc = Math.min(n - 1, Math.max(0, cur.p));
      // Tap intent ends when the pager lands on a page. Only on a real
      // progress change, so the tap itself (prep set, pager not yet moving)
      // can't clear it early. Any page counts, not just the tapped one, so a
      // tap interrupted by a swipe can't leave prep stuck; landing on an
      // intermediate page mid-flight is covered by the inFlight backstop.
      if (prepCtx && prepCtx.value === 1 && prev !== null && prev.p !== cur.p) {
        if (Math.abs(pc - Math.round(pc)) < 0.002) prepCtx.set(0);
      }
      const i0 = Math.min(n - 1, Math.floor(pc));
      const f = pc - i0;
      const a = cur.lay[cur.order[i0]];
      const b = f > 0 && i0 + 1 < n ? cur.lay[cur.order[i0 + 1]] : a;
      if (!a || !b) return;
      const L = a.x + (b.x - a.x) * f;
      const R = a.x + a.w + (b.x + b.w - (a.x + a.w)) * f;
      if (Math.abs(L - blobL.value) > 0.05) blobL.set(L);
      if (Math.abs(R - blobR.value) > 0.05) blobR.set(R);
    },
    [state],
  );

  // EXP-6: true while the pager sits between two pages (swipes and animated
  // taps). Null progress (web) means never in flight.
  const inFlight = useDerivedValue(() => {
    if (!progressCtx) return false;
    const order = orderSV.value;
    const n = order.length;
    if (n < 2) return false;
    const pc = Math.min(n - 1, Math.max(0, progressCtx.value));
    // Finger down: first pixel of pager movement counts — no waiting.
    if (Math.abs(pc - Math.round(pc)) > 0.002) return true;
    // Tap: chip changed but the pager hasn't arrived yet. Hide before
    // anything on screen starts moving.
    const target = order.indexOf(state.activeId.value);
    if (target >= 0 && Math.abs(target - Math.round(pc)) > 0.5) return true;
    return false;
  });
  // EXP-9: explicit prep (tap intent) forces hiding ahead of motion; the
  // progress-derived inFlight below is the backstop (swipes, missed clears).
  const hidden = useDerivedValue(() => (prepCtx ? prepCtx.value : 0) === 1 || inFlight.value);
  const joineryFadeStyle = useAnimatedStyle(() => ({
    // EXP-6/9: snap, staged one beat after the card corners snap (those read
    // flight directly, no delay): corners → gray → motion. Instant back.
    opacity: hidden.value ? withDelay(16, withTiming(0, { duration: 1 })) : 1,
  }));

  // EXP-7: publish flight 0/1 for hall pages (top-corner rounding in flight).
  const flightCtx = useFlight();
  useAnimatedReaction(
    () => hidden.value,
    (flying) => {
      flightCtx?.set(flying ? 1 : 0);
    },
    [state],
  );

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
        snapBarScroll(
          scrollRef,
          applyScroll,
          scrollAnim,
          scrollDrive,
          neededScrollX(nl, cur.w, barW.value, scrollX.value),
        );
        return;
      }
      const pagerOwnsEdges = !!progressCtx;
      if (prev.id === cur.id) {
        const moved = prev.x !== cur.x || prev.w !== cur.w;
        if (moved && !pagerOwnsEdges) {
          blobL.set(withSpring(nl, MOVE_SPRING));
          blobR.set(withSpring(nr, MOVE_SPRING));
        }
        if (moved || prev.bar !== cur.bar) {
          snapBarScroll(
            scrollRef,
            applyScroll,
            scrollAnim,
            scrollDrive,
            neededScrollX(nl, cur.w, barW.value, scrollX.value),
          );
        }
        return;
      }
      if (!pagerOwnsEdges) {
        blobL.set(withSpring(nl, MOVE_SPRING));
        blobR.set(withSpring(nr, MOVE_SPRING));
      }
      fromCol.set(blobColorOf(state));
      toCol.set(hallColor(cur.id));
      colorT.set(0);
      colorT.set(withSpring(1, COLOR_SPRING));
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
  const joined = useSharedValue(true);
  useAnimatedReaction(
    () => {
      const g = blobGeo(state);
      if (!activeId.value || !g) return null;
      return g.overlap >= (joined.value ? DETACH_W : ATTACH_W);
    },
    (attached, prev) => {
      joined.set(attached === true);
      // Settings/search (or no geometry): hide instantly. Grow-in is for
      // hall↔hall pours and the scroll-off pop, not for entering a hall page.
      if (attached === null) {
        blobH.set(0);
        return;
      }
      if (prev === attached) return;
      if (attached) {
        if (prev === false) {
          blobH.set(withSpring(STEM, ATTACH_SPRING));
        } else {
          blobH.set(STEM);
        }
      } else if (prev === true) {
        blobH.set(withSpring(0, DETACH_SPRING));
      } else {
        blobH.set(0);
      }
    },
    [state],
  );

  const cornerP = useDerivedValue(() => cornerJoin(popOf(state)));

  const maskL = useDerivedValue(() => {
    const g = blobGeo(state);
    if (!g) return CORNER;
    return Math.max(0, CORNER - cornerP.value * (CORNER - cornerR(g.dl)));
  });
  const maskR = useDerivedValue(() => {
    const g = blobGeo(state);
    if (!g) return CORNER;
    return Math.max(0, CORNER - cornerP.value * (CORNER - cornerR(g.dr)));
  });

  // EXP-8: publish live mask radii so hall pages' own top corners match,
  // including attach morphs.
  const topCornersCtx = useTopCorners();
  useAnimatedReaction(
    () => ({ l: maskL.value, r: maskR.value }),
    (v) => {
      topCornersCtx?.l.set(v.l);
      topCornersCtx?.r.set(v.r);
    },
    [state],
  );

  const chrome = dimmed ? DIMMED_CHROME : Theme.darkerGray;

  return (
    <View style={styles.wrap}>
      {/* EXP-6: corner masks + gutter ears hide while the pager is between
          pages. The JoinStrip connector below is untouched original behavior. */}
      <Animated.View pointerEvents="none" style={[styles.joineryWrap, joineryFadeStyle]}>
        <CornerMask side="left" radius={maskL} color={chrome} />
        <CornerMask side="right" radius={maskR} color={chrome} />
        <GutterEar side="left" state={state} chrome={chrome} />
        <GutterEar side="right" state={state} chrome={chrome} />
      </Animated.View>
      <JoinStrip state={state} chrome={chrome} />
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
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
        <LiquidBlob state={state} />
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

function LiquidBlob({ state }: { state: BarState }) {
  const geo = useDerivedValue(() => blobGeo(state));
  const p = useDerivedValue(() => clamp01(popOf(state)));

  const boxStyle = useAnimatedStyle(() => {
    const w = Math.max(0, state.blobR.value - state.blobL.value);
    // The stem holds until the fillets have mostly melted, then retracts in
    // step with the card corner re-rounding.
    const j = clamp01(cornerJoin(p.value));
    const stemH = STEM * j;
    // Reach 2px into the hall card while joined so a hairline of chrome never
    // shows while the tab pours.
    const h = CHIP_H + stemH + 2 * j;
    const g = geo.value;
    // Retracting, the stem's bottom corners round back to the chip's own
    // radius, so it pulls up like a droplet and leaves a plain chip.
    const free = CHIP_RADIUS * (1 - j);
    return {
      left: state.blobL.value,
      width: w,
      height: h,
      backgroundColor: blobColorOf(state),
      borderTopLeftRadius: CHIP_RADIUS,
      borderTopRightRadius: CHIP_RADIUS,
      borderBottomLeftRadius: (g ? Math.min(stemH, overhangStemR(-g.dl)) : 0) * j + free,
      borderBottomRightRadius: (g ? Math.min(stemH, overhangStemR(-g.dr)) : 0) * j + free,
      opacity: p.value > 0.02 ? 1 : 0,
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.blob, boxStyle]} />;
}

function JoinStrip({ state, chrome }: { state: BarState; chrome: string }) {
  const geo = useDerivedValue(() => blobGeo(state));
  const e = useDerivedValue(() => earJoin(popOf(state)) * tautOf(geo.value));
  const earL = useDerivedValue(() => (geo.value ? e.value * filletR(geo.value.dl) : 0));
  const earR = useDerivedValue(() => (geo.value ? e.value * filletR(geo.value.dr) : 0));

  const stripStyle = useAnimatedStyle(() => ({
    left: state.blobL.value - state.scrollX.value,
    width: Math.max(0, state.blobR.value - state.blobL.value),
    opacity: e.value > 0.01 ? 1 : 0,
  }));

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
    <Animated.View pointerEvents="none" style={[styles.joinStrip, stripStyle]}>
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
    return earJoin(popOf(state)) * tautOf(g) * gutterEarR(o);
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
    backgroundColor: 'transparent',
    paddingTop: 8,
    zIndex: 10,
    overflow: 'visible',
  },
  joineryWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  scroller: {
    backgroundColor: 'transparent',
    zIndex: 1,
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
    fontSize: 15,
    fontWeight: '600',
  },
  joinStrip: {
    position: 'absolute',
    bottom: 0,
    height: STEM,
    overflow: 'visible',
    zIndex: 0,
  },
  ear: {
    position: 'absolute',
    bottom: 0,
    overflow: 'hidden',
    // Android only clips overflow when a radius is set.
    borderRadius: 0.1,
  },
  earCut: {
    position: 'absolute',
  },
  gutterEar: {
    position: 'absolute',
    top: '100%',
    overflow: 'hidden',
    pointerEvents: 'none',
    borderRadius: 0.1,
  },
  gutterEarCut: {
    position: 'absolute',
  },
  mask: {
    position: 'absolute',
    bottom: -(CORNER + CORNER_OVERSHOOT),
    width: CORNER + CORNER_OVERSHOOT + HALL_INSET,
    height: CORNER + CORNER_OVERSHOOT + HALL_INSET,
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
