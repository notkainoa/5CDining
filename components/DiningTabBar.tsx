import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import {
  CHROME_BOTTOM_RADIUS,
  CHROME_INSET,
  CHROME_JOIN_EAR,
  CHROME_RADIUS,
  joinRadii,
  useHallBottomJoin,
} from '@/components/HallChrome';
import { Theme } from '@/constants/Theme';
import { DATE_WINDOW_DAYS, dateCardLabel } from '@/lib/dates';
import {
  rectsFromWidths,
  DAY_CHROME_PAD,
  DAY_RADIUS,
  DAY_SLOT_GAP,
  type DaySlotRect,
} from '@/lib/dayPillLayout';
import { cornerSideInset, estimateScreenCornerRadius } from '@/lib/screenCorners';
import { useDay } from '@/lib/day';
import { HALL_BY_ID } from '@/lib/diningHalls';
import { SEARCH_FEATURES, usePrefs } from '@/lib/settings';
import { useDim } from '@/lib/dim';
import { useTabNav } from '@/lib/tabNav';

const DAY_H = 48;
const IDLE_OP = 0.5;
const MOVE_SPRING = { duration: 340, dampingRatio: 1 };
const PILL_TOP = DAY_CHROME_PAD;

const SEARCH_SYMBOL = { ios: 'magnifyingglass', android: 'search', web: 'search' } as const;
const SETTINGS_SYMBOL = { ios: 'gearshape', android: 'settings', web: 'settings' } as const;

function rectsEqual(a: Record<string, DaySlotRect>, b: Record<string, DaySlotRect>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    const l = a[k];
    const r = b[k];
    if (!r || l.x !== r.x || l.w !== r.w || l.r !== r.r) return false;
  }
  return true;
}

/**
 * Bottom bar: the sliding pill only covers the three day cards. Search opens
 * an overlay on top of the current hall; settings still pushes its own screen.
 */
export default function DiningTabBar() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compactDays = width < 600;
  const bottomPad = Math.max((insets.bottom * 6) / 10, CHROME_INSET);
  const cornerR = estimateScreenCornerRadius(insets.bottom, width);
  const sideClear = Math.max(0, cornerSideInset(cornerR, bottomPad) - CHROME_INSET);
  const { days, selected, selectDate } = useDay();
  const { searchEnabled } = usePrefs();
  const { activeKey, lastHallId } = useTabNav();
  const router = useRouter();
  const { dimmed, dismiss } = useDim();
  const { setJoin } = useHallBottomJoin();
  const [earL, setEarL] = useState(0);
  const [earR, setEarR] = useState(0);
  const wrapRef = useRef<View>(null);
  const daysChromeRef = useRef<View>(null);
  const wrapW = useRef(0);
  const nest = useRef({ chromeX: 0, chromeW: 0 });
  const slotW = useRef<number[]>([]);
  const [rects, setRects] = useState<Record<string, DaySlotRect>>({});

  const onHall = (activeKey in HALL_BY_ID ? activeKey : lastHallId) in HALL_BY_ID;
  const tabId = `day:${selected}`;
  const blobL = useSharedValue(0);
  const blobR = useSharedValue(0);
  const blobRad = useSharedValue(DAY_RADIUS);
  const blobOn = useSharedValue(0);

  const publishRects = useCallback(() => {
    const next = rectsFromWidths(
      Array.from({ length: DATE_WINDOW_DAYS }, (_, i) => slotW.current[i] ?? 0),
    );
    setRects((prev) => (rectsEqual(prev, next) ? prev : next));
    const lay = next[tabId];
    if (!lay || lay.w <= 0) return;
    if (blobR.value - blobL.value >= 0.5) return;
    blobL.set(lay.x);
    blobR.set(lay.x + lay.w);
    blobRad.set(DAY_RADIUS);
    blobOn.set(1);
  }, [tabId, blobL, blobR, blobRad, blobOn]);

  useEffect(() => {
    const lay = rects[tabId];
    if (!lay || lay.w <= 0) {
      blobOn.set(withSpring(0, MOVE_SPRING));
      return;
    }
    const nl = lay.x;
    const nr = lay.x + lay.w;
    if (blobR.value - blobL.value < 0.5) {
      blobL.set(nl);
      blobR.set(nr);
      blobRad.set(lay.r);
      blobOn.set(1);
      return;
    }
    blobL.set(withSpring(nl, MOVE_SPRING));
    blobR.set(withSpring(nr, MOVE_SPRING));
    blobRad.set(withSpring(lay.r, MOVE_SPRING));
    blobOn.set(withSpring(1, MOVE_SPRING));
  }, [rects, tabId, blobL, blobR, blobRad, blobOn]);

  const pillStyle = useAnimatedStyle(() => ({
    left: blobL.value,
    width: Math.max(0, blobR.value - blobL.value),
    borderRadius: blobRad.value,
    opacity: blobOn.value,
    overflow: 'hidden' as const,
  }));

  const brightRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -blobL.value }],
  }));

  const applyJoin = useCallback(
    (x: number, w: number, hallW: number) => {
      if (hallW < 1 || w < 1) return;
      const snap = (n: number) => Math.round(n);
      const left = joinRadii(x, CHROME_JOIN_EAR, CHROME_BOTTOM_RADIUS);
      const right = joinRadii(hallW - (x + w), CHROME_JOIN_EAR, CHROME_BOTTOM_RADIUS);
      const earL = snap(left.ear);
      const earR = snap(right.ear);
      const bl = snap(left.corner);
      const br = snap(right.corner);
      setEarL((v) => (v === earL ? v : earL));
      setEarR((v) => (v === earR ? v : earR));
      setJoin((prev) => (prev.bl === bl && prev.br === br ? prev : { bl, br }));
    },
    [setJoin],
  );

  const measureJoin = useCallback(() => {
    const hallW = wrapW.current;
    const localX = nest.current.chromeX;
    const w = nest.current.chromeW;
    if (hallW < 1 || w < 1) return;
    const days = daysChromeRef.current;
    const wrap = wrapRef.current;
    if (Platform.OS === 'web' && days && wrap) {
      days.measureInWindow((dx, _dy, dw) => {
        wrap.measureInWindow((wx) => applyJoin(dx - wx, dw, hallW));
      });
      return;
    }
    applyJoin(sideClear + localX, w, hallW);
  }, [applyJoin, sideClear]);

  useEffect(() => {
    measureJoin();
    const id = requestAnimationFrame(() => measureJoin());
    return () => cancelAnimationFrame(id);
  }, [width, sideClear, searchEnabled, compactDays, measureJoin]);

  return (
    <View
      ref={wrapRef}
      collapsable={false}
      style={[styles.wrap, { paddingBottom: bottomPad, paddingHorizontal: sideClear }]}
      onLayout={(e) => {
        wrapW.current = e.nativeEvent.layout.width;
        measureJoin();
      }}
    >
      <View style={styles.rowHost}>
        <View collapsable={false} style={styles.row}>
          <View
            ref={daysChromeRef}
            collapsable={false}
            style={styles.daysChrome}
            onLayout={(e) => {
              const { x, width: w } = e.nativeEvent.layout;
              nest.current.chromeX = x;
              nest.current.chromeW = w;
              queueMicrotask(measureJoin);
            }}
          >
            <JoinEar side="left" size={earL} />
            <JoinEar side="right" size={earR} />
            {days.map((d, i) => {
              const label = dateCardLabel(d, i, compactDays);
              const active = onHall && selected === i;
              const a11y = dateCardLabel(d, i);
              return (
                <View
                  key={d.toISOString()}
                  collapsable={false}
                  onLayout={(e) => {
                    slotW.current[i] = e.nativeEvent.layout.width;
                    queueMicrotask(publishRects);
                  }}
                  style={styles.daySlot}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={a11y}
                    accessibilityState={{ selected: active }}
                    onPress={() => selectDate(i)}
                    style={styles.dayPress}
                  >
                    <Text style={styles.dayLabel} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            <View pointerEvents="none" style={styles.pillLayer}>
              <Animated.View style={[styles.pill, pillStyle]}>
                <Animated.View style={[styles.brightRow, brightRowStyle]}>
                  {days.map((d, i) => {
                    const lay = rects[`day:${i}`];
                    if (!lay) return null;
                    return (
                      <View
                        key={d.toISOString()}
                        style={[styles.brightCell, { left: lay.x, width: lay.w }]}
                      >
                        <Text style={styles.dayLabelBright} numberOfLines={1}>
                          {dateCardLabel(d, i, compactDays)}
                        </Text>
                      </View>
                    );
                  })}
                </Animated.View>
              </Animated.View>
            </View>
          </View>
          <View
            style={styles.iconGroup}
            onLayout={() => {
              measureJoin();
            }}
          >
            {SEARCH_FEATURES && searchEnabled ? (
              <IconCard
                label="Search"
                symbol={SEARCH_SYMBOL}
                onPress={() => router.push('/search')}
              />
            ) : null}
            <IconCard
              label="Settings"
              symbol={SETTINGS_SYMBOL}
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>
      </View>
      {dimmed ? (
        <Pressable style={styles.overlay} onPress={dismiss} accessibilityLabel="Dismiss" />
      ) : null}
    </View>
  );
}

function JoinEar({ side, size }: { side: 'left' | 'right'; size: number }) {
  if (size < 0.5) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.ear,
        { width: size, height: size },
        side === 'left' ? { left: -size } : { right: -size },
      ]}
    >
      <View
        style={[
          styles.earCut,
          {
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            bottom: -size,
            ...(side === 'left' ? { left: -size } : { right: -size }),
          },
        ]}
      />
    </View>
  );
}

function IconCard({
  label,
  symbol,
  onPress,
}: {
  label: string;
  symbol: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  onPress: () => void;
}) {
  return (
    <View style={styles.iconCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.iconPress, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <SymbolView
          name={symbol}
          tintColor={Theme.white}
          size={22}
          weight={{ ios: 'medium', android: mediumWeight }}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.overlay,
  },
  rowHost: {
    position: 'relative',
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'visible',
  },
  daysChrome: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: DAY_SLOT_GAP,
    backgroundColor: Theme.darkerGray,
    borderBottomLeftRadius: CHROME_RADIUS,
    borderBottomRightRadius: CHROME_RADIUS,
    padding: DAY_CHROME_PAD,
    overflow: 'visible',
  },
  ear: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
    backgroundColor: Theme.darkerGray,
  },
  earCut: {
    position: 'absolute',
    backgroundColor: Theme.black,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: 1,
  },
  pill: {
    position: 'absolute',
    top: PILL_TOP,
    left: 0,
    height: DAY_H,
    backgroundColor: Theme.darkGray,
    overflow: 'hidden',
  },
  brightRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: DAY_H,
  },
  brightCell: {
    position: 'absolute',
    top: 0,
    height: DAY_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySlot: {
    height: DAY_H,
    borderRadius: DAY_RADIUS,
    backgroundColor: Theme.darkGray,
    opacity: IDLE_OP,
    flexShrink: 0,
  },
  dayPress: {
    height: DAY_H,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    color: Theme.white,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
  dayLabelBright: {
    color: Theme.white,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
  iconCard: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.darkGray,
    opacity: IDLE_OP,
  },
  iconPress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
