import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface TabNav {
  activeKey: string;
  navigate: (name: string) => void;
}

const TabNavContext = createContext<TabNav>({
  activeKey: 'mcconnell',
  navigate: () => {},
});

export function TabNavProvider({
  activeKey,
  navigate,
  children,
}: {
  activeKey: string;
  navigate: (name: string) => void;
  children: ReactNode;
}) {
  const value = useMemo<TabNav>(() => ({ activeKey, navigate }), [activeKey, navigate]);
  return <TabNavContext.Provider value={value}>{children}</TabNavContext.Provider>;
}

export function useTabNav(): TabNav {
  return useContext(TabNavContext);
}
