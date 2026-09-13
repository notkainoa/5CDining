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
import { dateCardLabel } from '@/lib/dates';
import { cornerSideInset, estimateScreenCornerRadius } from '@/lib/screenCorners';
import { useDay } from '@/lib/day';
import { HALL_BY_ID } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import { useDim } from '@/lib/dim';
import { useTabNav } from '@/lib/tabNav';

const DAY_H = 48;
const DAY_RADIUS = 14;
const IDLE_OP = 0.5;
const MOVE_SPRING = { duration: 340, dampingRatio: 1 };
const PILL_TOP = 8;

const SEARCH_SYMBOL = { ios: 'magnifyingglass', android: 'search', web: 'search' } as const;
const SETTINGS_SYMBOL = { ios: 'gearshape', android: 'settings', web: 'settings' } as const;

interface ItemLayout {
  x: number;
  w: number;
  r: number;
}

function rectsEqual(a: Record<string, ItemLayout>, b: Record<string, ItemLayout>): boolean {
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
 * Bottom bar: the sliding pill only covers the three day cards. Search and
 * settings sit beside them and open their own stack screens.
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
  const { activeKey } = useTabNav();
  const router = useRouter();
  const { dimmed, dismiss } = useDim();
  const { setJoin } = useHallBottomJoin();
  const [earL, setEarL] = useState(0);
  const [earR, setEarR] = useState(0);
  const [rowBox, setRowBox] = useState({ w: 0, h: 0 });
  const wrapRef = useRef<View>(null);
  const daysChromeRef = useRef<View>(null);
  const wrapW = useRef(0);
  const rowRef = useRef<View>(null);
  const dayNodeRefs = useRef<Record<number, View | null>>({});
  const nest = useRef({ chromeX: 0, chromeW: 0 });
  const parentRel = useRef<Record<number, { x: number; w: number }>>({});
  const locals = useRef<Record<number, { x: number; w: number }>>({});
  const [rects, setRects] = useState<Record<string, ItemLayout>>({});

  const onHall = activeKey in HALL_BY_ID;
  const tabId = `day:${selected}`;
  const blobL = useSharedValue(0);
  const blobR = useSharedValue(0);
  const blobRad = useSharedValue(DAY_RADIUS);
  const blobOn = useSharedValue(0);

  const publishRects = useCallback(() => {
    const next: Record<string, ItemLayout> = {};
    for (const [k, v] of Object.entries(locals.current)) {
      if (v.w <= 0) continue;
      next[`day:${k}`] = { x: v.x, w: v.w, r: DAY_RADIUS };
    }
    setRects((prev) => (rectsEqual(prev, next) ? prev : next));
  }, []);

  const bootOrIgnore = useCallback(
    (id: string, x: number, w: number) => {
      if (id !== tabId || w <= 0) return;
      if (blobR.value - blobL.value >= 0.5) return;
      blobL.set(x);
      blobR.set(x + w);
      blobRad.set(DAY_RADIUS);
      blobOn.set(1);
    },
    [tabId, blobL, blobR, blobRad, blobOn],
  );

  const placeInRow = useCallback((node: View | null, parentX: number, localX: number, w: number, apply: (x: number, w: number) => void) => {
    const composed = parentX + localX;
    const row = rowRef.current;
    if (Platform.OS === 'web' && node && row) {
      node.measureInWindow((ix, _iy, iw) => {
        row.measureInWindow((rx) => {
          apply(ix - rx, iw);
        });
      });
      return;
    }
    apply(composed, w);
  }, []);

  const commitDay = useCallback(
    (i: number, x: number, w: number) => {
      locals.current[i] = { x, w };
      publishRects();
      bootOrIgnore(`day:${i}`, x, w);
    },
    [publishRects, bootOrIgnore],
  );

  const takeDay = useCallback(
    (i: number, localX: number, w: number) => {
      parentRel.current[i] = { x: localX, w };
      placeInRow(dayNodeRefs.current[i], nest.current.chromeX, localX, w, (x, rw) => commitDay(i, x, rw));
    },
    [placeInRow, commitDay],
  );

  const remeasureBar = useCallback(() => {
    for (const [k, v] of Object.entries(parentRel.current)) {
      takeDay(Number(k), v.x, v.w);
    }
  }, [takeDay]);

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
        <View
          ref={rowRef}
          collapsable={false}
          style={styles.row}
          onLayout={(e) => {
            const { width: rowW, height: rowH } = e.nativeEvent.layout;
            setRowBox((prev) => (prev.w === rowW && prev.h === rowH ? prev : { w: rowW, h: rowH }));
            remeasureBar();
            measureJoin();
          }}
        >
          <View
            ref={daysChromeRef}
            collapsable={false}
            style={styles.daysChrome}
            onLayout={(e) => {
              nest.current.chromeX = e.nativeEvent.layout.x;
              nest.current.chromeW = e.nativeEvent.layout.width;
              remeasureBar();
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
                  ref={(n) => {
                    dayNodeRefs.current[i] = n;
                  }}
                  onLayout={(e) => {
                    const { x, width: w } = e.nativeEvent.layout;
                    queueMicrotask(() => takeDay(i, x, w));
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
          </View>
          <View
            style={styles.iconGroup}
            onLayout={() => {
              measureJoin();
            }}
          >
            {searchEnabled ? (
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
        <View
          pointerEvents="none"
          style={[styles.pillLayer, rowBox.w > 0 ? { width: rowBox.w, height: rowBox.h } : null]}
        >
          <Animated.View style={[styles.pill, pillStyle]}>
            <Animated.View style={[styles.brightRow, brightRowStyle]}>
              {days.map((d, i) => {
                const lay = rects[`day:${i}`];
                if (!lay) return null;
                return (
                  <View key={d.toISOString()} style={[styles.brightCell, { left: lay.x, width: lay.w }]}>
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
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    backgroundColor: Theme.darkerGray,
    borderBottomLeftRadius: CHROME_RADIUS,
    borderBottomRightRadius: CHROME_RADIUS,
    padding: 8,
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
