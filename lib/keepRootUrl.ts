import { useEffect } from 'react';
import { Platform } from 'react-native';

function normalizedPath(): string {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

/**
 * When “disable page URLs” is on, pin the address bar to `/`. Leave `/no-routes`
 * alone so that page can turn the setting on, then redirect home.
 */
export function useKeepRootUrl(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const { history } = window;
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);

    const pin = () => {
      if (normalizedPath() === '/no-routes') return;
      if (normalizedPath() === '/' && !window.location.search && !window.location.hash) return;
      replace(history.state, '', '/');
    };

    history.pushState = (data, unused, url) => {
      push(data, unused, url);
      pin();
    };
    history.replaceState = (data, unused, url) => {
      replace(data, unused, url);
      pin();
    };
    pin();

    return () => {
      history.pushState = push;
      history.replaceState = replace;
    };
  }, [enabled]);
}
