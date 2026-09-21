import assert from 'node:assert/strict';
import test from 'node:test';

import {
  automaticMealSelection,
  mealKey,
  mealIndexForSelection,
  shouldClearMealSelection,
} from '../lib/mealSelection.ts';

const meal = (name, period) => ({ name, period, stations: [] });

test('normalizes source-specific meal labels to stable cross-hall keys', () => {
  assert.equal(mealKey(meal('  Continental   Breakfast  ')), 'breakfast');
  assert.equal(mealKey(meal('Late-Night')), 'late_night');
  assert.equal(mealKey(meal('DINNER')), 'dinner');
});

test('prefers an exact slot over equivalents and the automatic fallback', () => {
  const meals = [meal('Brunch', 'brunch'), meal('Lunch', 'lunch'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, 'lunch', 2), 1);
});

test('keeps every exact meal period stable regardless of the clock fallback', () => {
  const periods = ['breakfast', 'brunch', 'lunch', 'dinner', 'late_night'];
  const meals = periods.map((period) => meal(period, period));
  for (const [index, period] of periods.entries()) {
    for (let autoIndex = 0; autoIndex < periods.length; autoIndex += 1) {
      assert.equal(mealIndexForSelection(meals, period, autoIndex), index);
    }
  }
});

test('keeps an explicit meal when the app resumes on the same day', () => {
  assert.equal(shouldClearMealSelection({ windowShifted: false, selectedDateKept: true }), false);
});

test('keeps the same meal slot when another hall uses a breakfast variant', () => {
  const meals = [meal('Continental Breakfast'), meal('Lunch', 'lunch'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, 'breakfast', 2), 0);
});

test('uses the equivalent breakfast slot when another hall calls brunch breakfast', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, 'brunch', 1), 0);
});

test('prefers lunch when brunch is missing and both adjacent slots exist', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Lunch', 'lunch'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, 'brunch', 2), 1);
});

test('keeps an explicit meal when its date moves within the refreshed window', () => {
  assert.equal(shouldClearMealSelection({ windowShifted: true, selectedDateKept: true }), false);
});

test('clears the explicit meal only when its selected date expires', () => {
  assert.equal(shouldClearMealSelection({ windowShifted: true, selectedDateKept: false }), true);
});

test('uses the automatic meal only before the user has chosen one', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Lunch', 'lunch')];
  assert.equal(mealIndexForSelection(meals, null, 1), 1);
});

test('falls back to the automatic slot when a hall does not offer the selected meal', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, 'late_night', 1), 1);
});

test('returns the first index for an empty menu', () => {
  assert.equal(mealIndexForSelection([], 'dinner', 4), 0);
});

test('captures the active hall automatic meal so hall changes keep its slot', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(
    automaticMealSelection({
      meals,
      selectedMeal: null,
      autoIndex: 1,
      autoIndexChanged: false,
      selectionIsManual: false,
      isActiveHall: true,
      isCurrentMenu: true,
      isToday: true,
    }),
    'dinner',
  );
});

test('does not initialize from the previous date menu during a rollover', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(
    automaticMealSelection({
      meals,
      selectedMeal: null,
      autoIndex: 1,
      autoIndexChanged: false,
      selectionIsManual: false,
      isActiveHall: true,
      isCurrentMenu: false,
      isToday: true,
    }),
    null,
  );
});

test('does not let a background pager screen choose the shared meal', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(
    automaticMealSelection({
      meals,
      selectedMeal: null,
      autoIndex: 1,
      autoIndexChanged: false,
      selectionIsManual: false,
      isActiveHall: false,
      isCurrentMenu: true,
      isToday: true,
    }),
    null,
  );
});

test('does not seed automatic state from a future date', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(
    automaticMealSelection({
      meals,
      selectedMeal: null,
      autoIndex: 0,
      autoIndexChanged: false,
      selectionIsManual: false,
      isActiveHall: true,
      isCurrentMenu: true,
      isToday: false,
    }),
    null,
  );
});

test('advances an automatic selection when the live meal boundary changes', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Lunch', 'lunch')];
  assert.equal(
    automaticMealSelection({
      meals,
      selectedMeal: 'breakfast',
      autoIndex: 1,
      autoIndexChanged: true,
      selectionIsManual: false,
      isActiveHall: true,
      isCurrentMenu: true,
      isToday: true,
    }),
    'lunch',
  );
});

test('keeps the automatic slot when changing halls between meal boundaries', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(
    automaticMealSelection({
      meals,
      selectedMeal: 'breakfast',
      autoIndex: 1,
      autoIndexChanged: false,
      selectionIsManual: false,
      isActiveHall: true,
      isCurrentMenu: true,
      isToday: true,
    }),
    'breakfast',
  );
});

test('never advances a manual selection at a live meal boundary', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Lunch', 'lunch')];
  assert.equal(
    automaticMealSelection({
      meals,
      selectedMeal: 'breakfast',
      autoIndex: 1,
      autoIndexChanged: true,
      selectionIsManual: true,
      isActiveHall: true,
      isCurrentMenu: true,
      isToday: true,
    }),
    'breakfast',
  );
});
