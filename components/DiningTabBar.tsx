import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import {
  CHROME_BOTTOM_RADIUS,
  CHROME_INSET,
  CHROME_JOIN_EAR,
  CHROME_RADIUS,
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

/** Treat this close as flush — no curve, a straight edge. */
const JOIN_FLUSH = 2;

function filletR(d: number): number {
  if (d < JOIN_FLUSH) return 0;
  return Math.min(CHROME_JOIN_EAR, (d * CHROME_JOIN_EAR) / (CHROME_JOIN_EAR + CHROME_BOTTOM_RADIUS));
}

function hallCornerR(d: number): number {
  if (d < JOIN_FLUSH) return 0;
  return CHROME_BOTTOM_RADIUS;
}

/**
 * Bottom bar: day cards sit in the hall chrome; search and settings sit on the
 * app background so the days read as part of the dining hall.
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
  const { activeKey, lastHallId, navigate } = useTabNav();
  const { dimmed, dismiss } = useDim();
  const { setJoin } = useHallBottomJoin();
  const [earL, setEarL] = useState(0);
  const [earR, setEarR] = useState(0);
  const joinLayout = useRef({ rowW: 0, x: 0, w: 0 });

  const onHall = activeKey in HALL_BY_ID;

  const goHall = () => {
    if (!onHall) navigate(lastHallId);
  };

  const applyJoin = useCallback(
    (x: number, w: number, rowW: number) => {
      if (rowW < 1 || w < 1) return;
      const hallW = rowW + 2 * sideClear;
      const left = sideClear + x;
      const dl = left;
      const dr = hallW - (left + w);
      const nextL = filletR(dl);
      const nextR = filletR(dr);
      const nextBl = hallCornerR(dl);
      const nextBr = hallCornerR(dr);
      setEarL((v) => (v === nextL ? v : nextL));
      setEarR((v) => (v === nextR ? v : nextR));
      setJoin((prev) => (prev.bl === nextBl && prev.br === nextBr ? prev : { bl: nextBl, br: nextBr }));
    },
    [setJoin, sideClear],
  );

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad, paddingHorizontal: sideClear }]}>
      <View
        style={styles.row}
        onLayout={(e) => {
          const rowW = e.nativeEvent.layout.width;
          joinLayout.current.rowW = rowW;
          applyJoin(joinLayout.current.x, joinLayout.current.w, rowW);
        }}
      >
        <View
          style={styles.daysChrome}
          onLayout={(e) => {
            const { x, width: w } = e.nativeEvent.layout;
            joinLayout.current.x = x;
            joinLayout.current.w = w;
            applyJoin(x, w, joinLayout.current.rowW);
          }}
        >
          <JoinEar side="left" size={earL} />
          <JoinEar side="right" size={earR} />
          {days.map((d, i) => {
            const label = dateCardLabel(d, i, compactDays);
            const active = onHall && selected === i;
            const a11y = dateCardLabel(d, i);
            return (
              <Pressable
                key={d.toISOString()}
                accessibilityRole="button"
                accessibilityLabel={a11y}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  selectDate(i);
                  goHall();
                }}
                style={({ pressed }) => [
                  styles.dayCard,
                  { opacity: active ? 1 : 0.7, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <Text style={styles.dayLabel} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.iconGroup}>
          {searchEnabled ? (
            <IconCard
              label="Search"
              symbol={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              active={activeKey === 'search'}
              onPress={() => navigate('search')}
            />
          ) : null}
          <IconCard
            label="Settings"
            symbol={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
            active={activeKey === 'settings'}
            onPress={() => navigate('settings')}
          />
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
  active,
  onPress,
}: {
  label: string;
  symbol: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconCard,
        { opacity: active ? 1 : 0.7, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <SymbolView
        name={symbol}
        tintColor={Theme.white}
        size={22}
        weight={{ ios: 'medium', android: mediumWeight }}
      />
    </Pressable>
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
  dayCard: {
    height: 48,
    backgroundColor: Theme.darkGray,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dayLabel: {
    color: Theme.white,
    fontSize: 13,
    fontWeight: '700',
  },
  iconCard: {
    width: 48,
    height: 48,
    backgroundColor: Theme.darkGray,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
