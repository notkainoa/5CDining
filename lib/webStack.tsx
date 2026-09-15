import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type WebScreen = 'settings' | 'search' | null;

interface WebStack {
  screen: WebScreen;
  open: (screen: Exclude<WebScreen, null>) => void;
  close: () => void;
}

const WebStackContext = createContext<WebStack>({
  screen: null,
  open: () => {},
  close: () => {},
});

/** Web-only overlay stack so settings/search do not change the address bar. */
export function WebStackProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<WebScreen>(null);
  const open = useCallback((next: Exclude<WebScreen, null>) => setScreen(next), []);
  const close = useCallback(() => setScreen(null), []);
  const value = useMemo(() => ({ screen, open, close }), [screen, open, close]);
  return <WebStackContext.Provider value={value}>{children}</WebStackContext.Provider>;
}

export function useWebStack(): WebStack {
  return useContext(WebStackContext);
}
