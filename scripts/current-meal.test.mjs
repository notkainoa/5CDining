import assert from 'node:assert/strict';
import test from 'node:test';

import { pickCurrentMeal } from '../lib/api.ts';

const meal = (name, startTime, endTime) => ({ name, startTime, endTime, stations: [] });

test('selects the meal currently being served', () => {
  const meals = [meal('Breakfast', '07:00', '10:00'), meal('Lunch', '11:00', '14:00')];
  assert.equal(pickCurrentMeal(meals, 12 * 60), 1);
});

test('selects the next meal between service windows', () => {
  const meals = [meal('Breakfast', '07:00', '10:00'), meal('Lunch', '11:00', '14:00')];
  assert.equal(pickCurrentMeal(meals, 10 * 60 + 30), 1);
});

test('keeps the final meal selected after service ends', () => {
  const meals = [meal('Breakfast', '07:00', '10:00'), meal('Dinner', '17:00', '19:00')];
  assert.equal(pickCurrentMeal(meals, 20 * 60), 1);
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

test('falls back to the first meal when no schedule is published', () => {
  assert.equal(pickCurrentMeal([meal('Breakfast'), meal('Dinner')], 12 * 60), 0);
});
