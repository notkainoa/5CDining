import assert from 'node:assert/strict';
import test from 'node:test';

import {
  firstMealWithDishes,
  mealIndexFor,
  mealKey,
  withTypicalMealTimes,
} from '../lib/mealSelection.ts';

const meal = (name, period) => ({ name, period, stations: [] });

test('uses normalized published names as exact service identities', () => {
  assert.equal(mealKey(meal('  Continental   Breakfast  ', 'breakfast')), 'continental breakfast');
  assert.equal(mealKey(meal('Breakfast', 'breakfast')), 'breakfast');
  assert.equal(mealKey(meal('Late-Night')), 'late-night');
});

test('meals without published times get typical windows from their period', () => {
  const meals = [meal('BREAKFAST', 'breakfast'), meal('LUNCH', 'lunch'), meal('DINNER', 'dinner')];
  const timed = withTypicalMealTimes(meals);
  assert.deepEqual(
    timed.map((m) => [m.startTime, m.endTime]),
    [
      ['07:00', '10:30'],
      ['11:00', '14:00'],
      ['17:00', '20:00'],
    ],
  );
});

test('menus with any published time are left unchanged', () => {
  const meals = [
    { ...meal('Breakfast', 'breakfast'), startTime: '07:30' },
    meal('Dinner', 'dinner'),
  ];
  assert.equal(withTypicalMealTimes(meals), meals);
});

test('first meal with dishes skips empty continental services', () => {
  const withItems = (name, period) => ({
    name,
    period,
    stations: [{ name: 'Main', items: [{ name: 'Eggs' }] }],
  });
  const meals = [meal('Continental Breakfast', 'breakfast'), withItems('Brunch', 'brunch')];
  assert.equal(firstMealWithDishes(meals), 1);
  assert.equal(firstMealWithDishes([meal('Breakfast', 'breakfast')]), 0);
});

const timed = (name, startTime, endTime, items = []) => ({
  name,
  startTime,
  endTime,
  stations: [{ name: 'Main', items }],
});
const day = [
  timed('Breakfast', '07:30', '10:00'),
  timed('Lunch', '11:00', '14:00', [{ name: 'Soup' }]),
  timed('Dinner', '17:00', '20:00', [{ name: 'Pasta' }]),
];
const at = (h, m = 0) => h * 60 + m;
const shown = (meals, opts) =>
  meals[mealIndexFor(meals, { isToday: true, pickedKey: null, ...opts })].name;

test('today opens on the meal being served right now', () => {
  assert.equal(shown(day, { nowMinutes: at(8) }), 'Breakfast');
  assert.equal(shown(day, { nowMinutes: at(12, 30) }), 'Lunch');
  assert.equal(shown(day, { nowMinutes: at(19, 59) }), 'Dinner');
});

test('between meals, today opens on the next one', () => {
  assert.equal(shown(day, { nowMinutes: at(6) }), 'Breakfast');
  assert.equal(shown(day, { nowMinutes: at(10, 30) }), 'Lunch');
  assert.equal(shown(day, { nowMinutes: at(14) }), 'Dinner');
});

test('after the last meal, today stays on it', () => {
  assert.equal(shown(day, { nowMinutes: at(22) }), 'Dinner');
});

test('a hall without published times uses typical meal windows', () => {
  const untimed = [
    meal('Breakfast', 'breakfast'),
    meal('Lunch', 'lunch'),
    meal('Dinner', 'dinner'),
  ];
  assert.equal(shown(untimed, { nowMinutes: at(15) }), 'Dinner');
});

test('other days open on the first meal with dishes, ignoring the clock', () => {
  assert.equal(shown(day, { isToday: false, nowMinutes: at(18) }), 'Lunch');
});

test('a picked meal wins while it is still on the menu', () => {
  assert.equal(shown(day, { nowMinutes: at(8), pickedKey: 'dinner' }), 'Dinner');
  assert.equal(shown(day, { nowMinutes: at(8), pickedKey: 'late night' }), 'Breakfast');
});

test('an empty menu returns the first index', () => {
  assert.equal(mealIndexFor([], { isToday: true, nowMinutes: at(12), pickedKey: 'lunch' }), 0);
});
