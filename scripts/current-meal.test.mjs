import assert from 'node:assert/strict';
import test from 'node:test';

import { pickCurrentMeal } from '../lib/api.ts';

const meal = (name, startTime, endTime) => ({ name, startTime, endTime, stations: [] });

const permutations = ([first, ...rest]) => {
  if (first === undefined) return [[]];
  return permutations(rest).flatMap((permutation) =>
    Array.from({ length: permutation.length + 1 }, (_, index) => [
      ...permutation.slice(0, index),
      first,
      ...permutation.slice(index),
    ]),
  );
};

const selectedMeal = (meals, nowMinutes) => meals[pickCurrentMeal(meals, nowMinutes)];

test('selects the meal currently being served', () => {
  const meals = [meal('Breakfast', '07:00', '10:00'), meal('Lunch', '11:00', '14:00')];
  assert.equal(pickCurrentMeal(meals, 12 * 60), 1);
});

test('selects the latest-starting active service for every API ordering', () => {
  const overlapping = [
    meal('Brunch', '10:00', '13:30'),
    meal('Lunch', '11:00', '14:00'),
    meal('Express Lunch', '11:30', '13:00'),
  ];

  for (const meals of permutations(overlapping)) {
    assert.equal(selectedMeal(meals, 12 * 60).name, 'Express Lunch');
  }
});

test('breaks equal-start overlaps by name and then time, independent of API ordering', () => {
  const overlapping = [
    meal('Supper', '17:00', '20:00'),
    meal('Dinner', '17:00', '20:00'),
    meal('Dinner', '17:00', '19:00'),
  ];

  for (const meals of permutations(overlapping)) {
    assert.equal(selectedMeal(meals, 18 * 60), overlapping[2]);
  }
});

test('selects the next meal between service windows', () => {
  const meals = [meal('Breakfast', '07:00', '10:00'), meal('Lunch', '11:00', '14:00')];
  assert.equal(pickCurrentMeal(meals, 10 * 60 + 30), 1);
});

test('keeps the final meal selected after service ends', () => {
  const meals = [meal('Breakfast', '07:00', '10:00'), meal('Dinner', '17:00', '19:00')];
  assert.equal(pickCurrentMeal(meals, 20 * 60), 1);
});

test('breaks equal-start upcoming and recent fallbacks independently of API ordering', () => {
  const tied = [meal('Supper', '17:00', '20:00'), meal('Dinner', '17:00', '20:00')];

  for (const meals of permutations(tied)) {
    assert.equal(selectedMeal(meals, 16 * 60).name, 'Dinner');
    assert.equal(selectedMeal(meals, 21 * 60).name, 'Dinner');
  }
});

test('finds the nearest upcoming meal even when API order is unexpected', () => {
  const meals = [
    meal('Dinner', '17:00', '19:00'),
    meal('Breakfast', '07:00', '10:00'),
    meal('Lunch', '11:00', '14:00'),
  ];
  assert.equal(pickCurrentMeal(meals, 10 * 60 + 30), 2);
});

test('recognizes a late-night meal that crosses midnight', () => {
  const meals = [meal('Dinner', '17:00', '19:00'), meal('Late Night', '22:00', '01:00')];
  assert.equal(pickCurrentMeal(meals, 23 * 60), 1);
  assert.equal(pickCurrentMeal(meals, 30), 1);
});

test('ranks an overnight start on the prior day against a competing after-midnight window', () => {
  const overlapping = [
    meal('Late Night', '22:00', '01:30'),
    meal('Midnight Breakfast', '00:00', '02:00'),
  ];

  for (const meals of permutations(overlapping)) {
    assert.equal(selectedMeal(meals, 30).name, 'Midnight Breakfast');
  }
});

test('falls back to the first meal when no schedule is published', () => {
  assert.equal(pickCurrentMeal([meal('Breakfast'), meal('Dinner')], 12 * 60), 0);
});
