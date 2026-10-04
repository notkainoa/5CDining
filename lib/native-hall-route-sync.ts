import type { DiningTabId } from './diningHalls';

export interface NativeHallRouteState {
  activeHall: DiningTabId;
  lastRoutedHall: DiningTabId | undefined;
}

/** Start the native pager from a deep link, or from the user's first stored hall. */
export function createNativeHallRouteState(
  routedHall: DiningTabId | undefined,
  order: readonly DiningTabId[],
): NativeHallRouteState {
  const activeHall = routedHall ?? order[0];
  if (activeHall === undefined) {
    throw new Error('Native hall navigation requires at least one dining hall.');
  }
  return { activeHall, lastRoutedHall: routedHall };
}

/** Local taps and swipes change the pager without rewriting its Expo Router route. */
export function selectNativeHall(
  state: NativeHallRouteState,
  activeHall: DiningTabId,
): NativeHallRouteState {
  if (activeHall === state.activeHall) return state;
  return { ...state, activeHall };
}

/**
 * Apply a hall only when Expo Router reports a different routed hall.
 * Routes outside the tabs, such as Settings, leave the native selection alone.
 */
export function observeNativeHallRoute(
  state: NativeHallRouteState,
  routedHall: DiningTabId | undefined,
): NativeHallRouteState {
  if (routedHall === undefined || routedHall === state.lastRoutedHall) return state;
  return { activeHall: routedHall, lastRoutedHall: routedHall };
}

/** Keep the selected hall at its new index after the user reorders the pager. */
export function reconcileNativeHallOrder(
  state: NativeHallRouteState,
  order: readonly DiningTabId[],
): NativeHallRouteState {
  if (order.includes(state.activeHall) || order[0] === undefined) return state;
  return { ...state, activeHall: order[0] };
}
