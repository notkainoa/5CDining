import { useSegments } from 'expo-router';

/**
 * True when the web app is showing the `/webapp` edition, where hall
 * switches and settings/search open without changing the address bar.
 * Derived from the route itself — there is no preference to read.
 */
export function useIsWebApp(): boolean {
  const segments = useSegments();
  return segments[0] === 'webapp';
}
