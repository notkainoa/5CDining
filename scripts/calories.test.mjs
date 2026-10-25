import assert from 'node:assert/strict';
import test from 'node:test';

import { CALORIE_CEILING, hallCaloriesReliable, isPlausibleCalories } from '../lib/calories.ts';

const day = (...calories) => [
  { stations: [{ items: calories.map((c, i) => ({ name: `dish ${i}`, calories: c })) }] },
];

test('whole numbers in range are shown', () => {
  assert.equal(isPlausibleCalories(190, 'scrambled eggs'), true);
  assert.equal(isPlausibleCalories(3070, '24 oz 4-1 cheese and pepperoni pizza'), true);
  assert.equal(isPlausibleCalories(CALORIE_CEILING, 'anything'), true);
});

test('fractional values from the Pomona feed are hidden', () => {
  assert.equal(isPlausibleCalories(234.07, 'Chicken Apple Sausage'), false);
  assert.equal(isPlausibleCalories(0.01, 'Salt'), false);
});

test('values above the ceiling are hidden', () => {
  assert.equal(isPlausibleCalories(17940, 'pesto'), false);
  assert.equal(isPlausibleCalories(121235, 'Acai Bowl'), false);
  assert.equal(isPlausibleCalories(CALORIE_CEILING + 1, 'anything'), false);
});

test('non-numbers, non-finite and negative values are hidden', () => {
  for (const c of [undefined, null, '190', NaN, Infinity, -5]) {
    assert.equal(isPlausibleCalories(c, 'dish'), false, String(c));
  }
});

test('zero is shown only for zero-calorie dishes', () => {
  assert.equal(isPlausibleCalories(0, 'Sautéed Mushrooms'), false);
  assert.equal(isPlausibleCalories(0, 'dill pickles'), true);
  assert.equal(isPlausibleCalories(0, 'Iced Tea'), true);
  assert.equal(isPlausibleCalories(0, 'steak'), false);
});

test('a clean hall with one outlier stays reliable', () => {
  assert.equal(hallCaloriesReliable(day(190, 240, 410, 17940, 120, 80)), true);
});

test('a hall whose source is mostly garbage is hidden entirely', () => {
  // Frary-like: most values fractional, a few round ones mixed in.
  assert.equal(hallCaloriesReliable(day(234.07, 149.12, 72.83, 180, 121235, 62.92)), false);
});

test('the share threshold is inclusive at 25%', () => {
  assert.equal(hallCaloriesReliable(day(100, 200, 300, 0.5)), true);
  assert.equal(hallCaloriesReliable(day(100, 200, 0.5, 0.5)), false);
});

test('items without calories do not count either way', () => {
  const meals = [
    { stations: [{ items: [{ name: 'a' }, { name: 'b' }, { name: 'c', calories: 150 }] }] },
  ];
  assert.equal(hallCaloriesReliable(meals), true);
  assert.equal(hallCaloriesReliable([]), true);
});
