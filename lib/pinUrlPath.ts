import { useEffect } from 'react';
import { Platform } from 'react-native';

function normalizedPath(): string {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

/**
 * Pin the web address bar to `target` while it is set. Any in-app
 * `pushState`/`replaceState` (including expo-router's own) is rewritten back
 * to the target. Browser Back/Forward is intentionally left alone: Back means
 * leave the page. Pass `null` to disable.
 */
export function usePinUrlPath(target: string | null) {
  useEffect(() => {
    if (target == null || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const { history } = window;
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);

    const pin = () => {
      if (normalizedPath() === target && !window.location.search && !window.location.hash)
        return;
      replace(history.state, '', target);
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
  }, [target]);
}
