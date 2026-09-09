import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import mediumWeight from 'expo-symbols/androidWeights/medium';
import { Theme } from '@/constants/Theme';
import { dateCardLabels } from '@/lib/dates';
import { useDay } from '@/lib/day';
import { HALL_BY_ID } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';
import { useDim } from '@/lib/dim';
import { useTabNav } from '@/lib/tabNav';

interface TabBarProps {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}

/**
 * Bottom bar: 3 day cards + search + settings.
 * Selected card is full opacity; the rest sit at 70%.
 */
export default function DiningTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { days, selected, selectDate } = useDay();
  const { searchEnabled } = usePrefs();
  const { lastHallId } = useTabNav();
  const { dimmed, dismiss } = useDim();

  const activeName = state.routes[state.index]?.name ?? '';
  const onHall = activeName in HALL_BY_ID;

  const goHall = () => {
    if (!onHall) navigation.navigate(lastHallId);
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.row}>
        {days.map((d, i) => {
          const { top, bottom } = dateCardLabels(d, i);
          const active = onHall && selected === i;
          return (
            <Pressable
              key={d.toISOString()}
              accessibilityRole="button"
              accessibilityLabel={`${top} ${bottom}`}
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
              <Text style={styles.dayTop}>{top}</Text>
              <Text style={styles.dayBottom}>{bottom}</Text>
            </Pressable>
          );
        })}
        {searchEnabled ? (
          <IconCard
            label="Search"
            symbol={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            active={activeName === 'search'}
            onPress={() => navigation.navigate('search')}
          />
        ) : null}
        <IconCard
          label="Settings"
          symbol={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
          active={activeName === 'settings'}
          onPress={() => navigation.navigate('settings')}
        />
      </View>
      {dimmed ? (
        <Pressable style={styles.overlay} onPress={dismiss} accessibilityLabel="Dismiss" />
      ) : null}
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
        size={24}
        weight={{ ios: 'medium', android: mediumWeight }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Theme.darkerGray,
    paddingHorizontal: 10,
    paddingTop: 8,
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
  dayCard: {
    flex: 1,
    minHeight: 54,
    backgroundColor: Theme.gray,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dayTop: {
    color: Theme.white,
    fontSize: 13,
    fontWeight: '700',
  },
  dayBottom: {
    color: Theme.white,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  iconCard: {
    width: 54,
    minHeight: 54,
    backgroundColor: Theme.gray,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
