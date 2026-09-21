import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initialMealSelection,
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

test('captures the active hall automatic meal so hall changes keep its slot', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(
    initialMealSelection({
      meals,
      selectedMeal: null,
      autoIndex: 1,
      isActiveHall: true,
      isCurrentMenu: true,
    }),
    'dinner',
  );
});

test('does not initialize from the previous date menu during a rollover', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(
    initialMealSelection({
      meals,
      selectedMeal: null,
      autoIndex: 1,
      isActiveHall: true,
      isCurrentMenu: false,
    }),
    null,
  );
});

test('does not let a background pager screen choose the shared meal', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(
    initialMealSelection({
      meals,
      selectedMeal: null,
      autoIndex: 1,
      isActiveHall: false,
      isCurrentMenu: true,
    }),
    null,
  );
});
