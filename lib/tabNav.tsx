import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useSegments } from 'expo-router';
import { HALL_BY_ID, hallIdFromParts, type HallId } from './diningHalls';

interface TabNav {
  activeKey: string;
  lastHallId: HallId;
  navigate: (name: string) => void;
}

const DEFAULT_HALL: HallId = 'mcconnell';

const TabNavContext = createContext<TabNav>({
  activeKey: DEFAULT_HALL,
  lastHallId: DEFAULT_HALL,
  navigate: () => {},
});

const HallRouteContext = createContext<HallId>(DEFAULT_HALL);

/**
 * Remembers the current dining hall from the URL. Lives in the root layout
 * so the search overlay can remount tabs without resetting the selected chip.
 */
export function HallRouteProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const segments = useSegments();
  const hallId = hallIdFromParts(pathname.split('/')) ?? hallIdFromParts(segments);
  const [lastHallId, setLastHallId] = useState<HallId>(hallId ?? DEFAULT_HALL);
  if (hallId !== undefined && hallId !== lastHallId) {
    setLastHallId(hallId);
  }
  return (
    <HallRouteContext.Provider value={hallId ?? lastHallId}>{children}</HallRouteContext.Provider>
  );
}

export function TabNavProvider({
  activeKey,
  navigate,
  children,
}: {
  activeKey: string;
  navigate: (name: string) => void;
  children: ReactNode;
}) {
  const remembered = useContext(HallRouteContext);
  const hallId = activeKey in HALL_BY_ID ? (activeKey as HallId) : undefined;
  const lastHallId = hallId ?? remembered;
  const value = useMemo<TabNav>(
    () => ({ activeKey, lastHallId, navigate }),
    [activeKey, lastHallId, navigate],
  );
  return <TabNavContext.Provider value={value}>{children}</TabNavContext.Provider>;
}

export function useTabNav(): TabNav {
  return useContext(TabNavContext);
}
