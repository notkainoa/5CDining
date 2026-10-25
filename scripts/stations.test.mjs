import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDessertStation,
  moveDessertStationsLast,
  normalizeStationName,
} from '../lib/stations.ts';

const meal = (period, ...names) => ({
  name: period,
  period,
  stations: names.map((name) => ({ name, items: [] })),
});
const order = (m) => m.stations.map((st) => st.name);

test('a dessert station moves last', () => {
  const m = moveDessertStationsLast('malott', meal('dinner', 'sweets', 'global', 'salad bar'));
  assert.deepEqual(order(m), ['global', 'salad bar', 'sweets']);
});

test('multiple dessert stations keep their original relative order', () => {
  const m = moveDessertStationsLast(
    'hoch',
    meal('dinner', 'BAKERY', 'GRILL', 'Desserts', 'SOUP BAR', 'sweets'),
  );
  assert.deepEqual(order(m), ['GRILL', 'SOUP BAR', 'BAKERY', 'Desserts', 'sweets']);
});

test('non-dessert names keep their order and the meal is returned untouched', () => {
  const m = meal('lunch', 'Mainline', 'Pizza', 'Expo Station');
  assert.equal(moveDessertStationsLast('frary', m), m);
  const already = meal('lunch', 'Mainline', 'Desserts');
  assert.equal(moveDessertStationsLast('frary', already), already);
});

test('matching ignores case and surrounding whitespace', () => {
  for (const name of ['SWEETS', 'Sweets', '  sweets ', 'desserts', 'DESSERTS', ' Desserts\t']) {
    assert.equal(isDessertStation('frary', 'dinner', name), true, name);
  }
  assert.equal(normalizeStationName('  Sweet   Potato  Bar '), 'sweet potato bar');
});

test('matching is exact, not substring', () => {
  for (const name of ['sweet potato bar', 'sweet chili', 'dessert pizza', 'breakfast bakery']) {
    assert.equal(isDessertStation('collins', 'dinner', name), false, name);
  }
});

test('Hoch BAKERY is dessert at lunch/dinner but breakfast pastry at breakfast/brunch', () => {
  assert.equal(isDessertStation('hoch', 'lunch', 'BAKERY'), true);
  assert.equal(isDessertStation('hoch', 'dinner', 'BAKERY'), true);
  assert.equal(isDessertStation('hoch', 'breakfast', 'BAKERY'), false);
  assert.equal(isDessertStation('hoch', 'brunch', 'BAKERY'), false);
  assert.equal(isDessertStation('hoch', undefined, 'BAKERY'), false);
});

test('McConnell ovens is dessert at lunch/dinner/late night only; elsewhere ovens is pizza', () => {
  assert.equal(isDessertStation('mcconnell', 'lunch', 'ovens'), true);
  assert.equal(isDessertStation('mcconnell', 'dinner', 'ovens'), true);
  assert.equal(isDessertStation('mcconnell', 'late_night', 'ovens'), true);
  assert.equal(isDessertStation('mcconnell', 'breakfast', 'ovens'), false);
  assert.equal(isDessertStation('mcconnell', 'brunch', 'ovens'), false);
  assert.equal(isDessertStation('collins', 'dinner', 'Ovens'), false);
  assert.equal(isDessertStation('malott', 'lunch', 'ovens'), false);
});

test('the meal and its other fields are preserved', () => {
  const m = { ...meal('lunch', 'sweets', 'grill'), startTime: '11:00' };
  const out = moveDessertStationsLast('collins', m);
  assert.equal(out.startTime, '11:00');
  assert.equal(out.period, 'lunch');
  assert.deepEqual(order(m), ['sweets', 'grill'], 'input not mutated');
});
