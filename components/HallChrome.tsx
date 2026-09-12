import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '@/constants/Theme';

/** Black strip around the grouped hall chrome. */
export const CHROME_INSET = 8;
/**
 * Outer corners of the hall chrome (top) and the day-button card.
 * Nested with 14pt inner chips / day pills: inner + inset.
 */
export const CHROME_RADIUS = 14 + CHROME_INSET;
/**
 * Bottom corners of the hall chrome. Nested with the school card's 24pt
 * bottom corners: inner + inset.
 */
export const CHROME_BOTTOM_RADIUS = 24 + CHROME_INSET;
/** Concave fillet where a hall chip or the days card joins the hall chrome. */
export const CHROME_JOIN_EAR = CHROME_RADIUS;

type BottomJoin = { bl: number; br: number };

const DEFAULT_JOIN: BottomJoin = { bl: CHROME_BOTTOM_RADIUS, br: CHROME_BOTTOM_RADIUS };

const BottomJoinContext = createContext<{
  join: BottomJoin;
  setJoin: Dispatch<SetStateAction<BottomJoin>>;
}>({ join: DEFAULT_JOIN, setJoin: () => {} });

export function useHallBottomJoin() {
  return useContext(BottomJoinContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [join, setJoin] = useState<BottomJoin>(DEFAULT_JOIN);
  const joinValue = useMemo(() => ({ join, setJoin }), [join]);
  return (
    <BottomJoinContext.Provider value={joinValue}>
      <View
        style={[
          styles.shell,
          {
            paddingTop: Math.max(insets.top, CHROME_INSET),
            paddingLeft: Math.max(insets.left, CHROME_INSET),
            paddingRight: Math.max(insets.right, CHROME_INSET),
          },
        ]}
      >
        {children}
      </View>
    </BottomJoinContext.Provider>
  );
}

/** Rounded card around the hall tabs and the dining hall page. */
export function HallChrome({ children }: { children: ReactNode }) {
  const { join } = useHallBottomJoin();
  return (
    <View
      style={[
        styles.hall,
        { borderBottomLeftRadius: join.bl, borderBottomRightRadius: join.br },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Theme.black,
  },
  hall: {
    flex: 1,
    backgroundColor: Theme.darkerGray,
    borderTopLeftRadius: CHROME_RADIUS,
    borderTopRightRadius: CHROME_RADIUS,
    paddingBottom: CHROME_INSET,
    overflow: 'hidden',
  },
});
