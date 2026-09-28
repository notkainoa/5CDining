import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNativeHallRouteState,
  observeNativeHallRoute,
  reconcileNativeHallOrder,
  selectNativeHall,
} from '../lib/native-hall-route-sync.ts';

const DEFAULT_ORDER = ['mcconnell', 'frary', 'hoch'];

test('uses the loaded preference order when launch has no hall deep link', () => {
  const state = createNativeHallRouteState(undefined, ['frary', 'hoch', 'mcconnell']);
  assert.deepEqual(state, { activeHall: 'frary', lastRoutedHall: undefined });
});

test('a local pager transition is not bounced back to the unchanged route', () => {
  let state = createNativeHallRouteState('mcconnell', DEFAULT_ORDER);
  state = selectNativeHall(state, 'frary');
  state = observeNativeHallRoute(state, 'mcconnell');

  assert.deepEqual(state, { activeHall: 'frary', lastRoutedHall: 'mcconnell' });
});

test('settings and hall reordering retain the locally selected hall', () => {
  let state = createNativeHallRouteState('mcconnell', DEFAULT_ORDER);
  state = selectNativeHall(state, 'hoch');
  state = observeNativeHallRoute(state, undefined);
  state = reconcileNativeHallOrder(state, ['hoch', 'mcconnell', 'frary']);
  state = observeNativeHallRoute(state, 'mcconnell');

  assert.deepEqual(state, { activeHall: 'hoch', lastRoutedHall: 'mcconnell' });
});

test('a new hall deep link overrides the local pager selection', () => {
  let state = createNativeHallRouteState('mcconnell', DEFAULT_ORDER);
  state = selectNativeHall(state, 'frary');
  state = observeNativeHallRoute(state, undefined);
  state = observeNativeHallRoute(state, 'hoch');

  assert.deepEqual(state, { activeHall: 'hoch', lastRoutedHall: 'hoch' });
});
