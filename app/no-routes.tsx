import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import FrozenHalls from '@/components/FrozenHalls';
import { usePinUrlPath } from '@/lib/keepRootUrl';

/**
 * `/no-routes`: the same halls without page URLs. Hall switches and
 * settings/search open in memory, so the address bar stays on `/no-routes`.
 * The normal app at `/` is untouched. Native has no URLs, so it renders the
 * normal app instead.
 */
export default function NoRoutes() {
  usePinUrlPath(Platform.OS === 'web' ? '/no-routes' : null);
  if (Platform.OS !== 'web') {
    return <Redirect href="/" />;
  }
  return <FrozenHalls />;
}
