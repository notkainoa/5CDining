import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';

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

/**
 * Shared Back behavior for settings/search: close the `/webapp` overlay when
 * open, otherwise navigate with the router. Keeps both screens in sync.
 */
export function useWebStackBack(fallback: Href = '/(tabs)') {
  const router = useRouter();
  const webStack = useWebStack();
  return useCallback(() => {
    if (Platform.OS === 'web' && webStack.screen) {
      webStack.close();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, webStack, fallback]);
}
