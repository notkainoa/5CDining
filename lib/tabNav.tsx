import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { HALL_BY_ID, type HallId } from './diningHalls';

interface TabNav {
  activeKey: string;
  lastHallId: HallId;
  navigate: (name: string) => void;
}

const TabNavContext = createContext<TabNav>({
  activeKey: 'mcconnell',
  lastHallId: 'mcconnell',
  navigate: () => {},
});

export function TabNavProvider({
  activeKey,
  navigate,
  fallbackHall,
  children,
}: {
  activeKey: string;
  navigate: (name: string) => void;
  fallbackHall: HallId;
  children: ReactNode;
}) {
  const lastRef = useRef<HallId>(activeKey in HALL_BY_ID ? (activeKey as HallId) : fallbackHall);
  if (activeKey in HALL_BY_ID) lastRef.current = activeKey as HallId;

  const value = useMemo<TabNav>(
    () => ({ activeKey, lastHallId: lastRef.current, navigate }),
    [activeKey, navigate],
  );

  return <TabNavContext.Provider value={value}>{children}</TabNavContext.Provider>;
}

export function useTabNav(): TabNav {
  return useContext(TabNavContext);
}
