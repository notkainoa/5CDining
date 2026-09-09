import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { getClosure } from '@/lib/closures';
import { HALL_BY_ID, orderedHalls, type HallId } from '@/lib/diningHalls';
import { usePrefs } from '@/lib/settings';

interface TabBarProps {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
}

/**
 * Edge-to-edge rectangular bottom bar: 7 always-colored hall cells + settings.
 * Cell order follows the user's settings order; the launch page is the first cell.
 * No padding, no gaps, no rounded corners — tiles span the full width.
 * Active tab gets an indicator bar on top.
 */
export default function DiningTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const { hallOrder, searchEnabled } = usePrefs();

  const activeName = state.routes[state.index]?.name;

  const tabs = [
    ...(searchEnabled
      ? [
          {
            name: 'search',
            label: '🔍',
            color: '#636366',
            text: '#FFFFFF',
            fullName: 'Search',
            size: 24,
          },
        ]
      : []),
    ...orderedHalls(hallOrder).map((h) => ({
      name: h.id,
      label: h.abbr,
      color: dark ? h.colorDark : h.color,
      text: h.onColor,
      fullName: h.name,
      size: 15,
    })),
    {
      name: 'settings',
      label: '⚙',
      color: '#636366',
      text: '#FFFFFF',
      fullName: 'Settings',
      size: 26,
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {tabs.map((t) => {
          const active = activeName === t.name;
          const hallId = t.name as HallId;
          const closed = hallId in HALL_BY_ID && getClosure(hallId) !== null;
          return (
            <Pressable
              key={t.name}
              accessibilityRole="button"
              accessibilityLabel={t.fullName + (closed ? ' (closed)' : '')}
              accessibilityState={{ selected: active }}
              onPress={() => navigation.navigate(t.name)}
              style={[
                styles.cell,
                {
                  backgroundColor: t.color,
                  opacity: closed ? 0.45 : 1,
                  paddingBottom: 10 + insets.bottom / 2,
                },
              ]}
            >
              <View
                style={[styles.indicator, { backgroundColor: active ? t.text : 'transparent' }]}
              />
              <View style={styles.labelWrap}>
                <Text style={[styles.label, { color: t.text, fontSize: t.size }]}>{t.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#000',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 10,
  },
  indicator: {
    height: 3,
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  labelWrap: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontWeight: '700',
  },
});
