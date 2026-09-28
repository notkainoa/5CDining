import assert from 'node:assert/strict';
import test from 'node:test';

import {
  automaticMealSelection,
  mealKey,
  mealIndexForSelection,
  mealSelectionIntent,
  shouldClearMealSelection,
} from '../lib/mealSelection.ts';

const meal = (name, period) => ({ name, period, stations: [] });
const selection = (name, period) => mealSelectionIntent(meal(name, period));
const DATE = '2026-09-26';

const observation = ({
  name = 'Breakfast',
  period = 'breakfast',
  menuDate = DATE,
  selectedDate = DATE,
  isActiveHall = true,
  isToday = true,
} = {}) => ({
  service: name === null ? null : selection(name, period),
  menuDate,
  selectedDate,
  isActiveHall,
  isToday,
});

test('uses normalized published names as exact service identities', () => {
  assert.equal(mealKey(meal('  Continental   Breakfast  ', 'breakfast')), 'continental breakfast');
  assert.equal(mealKey(meal('Breakfast', 'breakfast')), 'breakfast');
  assert.equal(mealKey(meal('Late-Night')), 'late-night');
});

test('keeps the API period alongside an unusual published service name', () => {
  assert.deepEqual(selection("Chef's Choice", 'breakfast'), {
    service: "chef's choice",
    period: 'breakfast',
  });
});

test('prefers an exact service name when two services share a period', () => {
  const meals = [
    meal('Breakfast', 'breakfast'),
    meal('Continental Breakfast', 'breakfast'),
    meal('Lunch', 'lunch'),
  ];
  assert.equal(mealIndexForSelection(meals, selection('Continental Breakfast', 'breakfast'), 2), 1);
});

test('falls back to the same API period across halls after exact-name matching', () => {
  const meals = [meal('Continental Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, selection("Chef's Choice", 'breakfast'), 1), 0);
});

test('uses inferred periods for source-specific names without an API period', () => {
  const meals = [meal('Continental Breakfast'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, selection('Breakfast', 'breakfast'), 1), 0);
});

test('uses an adjacent breakfast slot when another hall has brunch instead', () => {
  const meals = [meal('Brunch', 'brunch'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, selection('Breakfast', 'breakfast'), 1), 0);
});

test('prefers lunch when brunch is missing and both adjacent slots exist', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Lunch', 'lunch'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, selection('Brunch', 'brunch'), 2), 1);
});

test('falls back to the automatic slot when no exact, period, or adjacent service exists', () => {
  const meals = [meal('Breakfast', 'breakfast'), meal('Dinner', 'dinner')];
  assert.equal(mealIndexForSelection(meals, selection('Late Night', 'late_night'), 1), 1);
});

test('returns the first index for an empty menu', () => {
  assert.equal(mealIndexForSelection([], selection('Dinner', 'dinner'), 4), 0);
});

test('seeds automatic intent from the first valid active observation', () => {
  const dinner = selection('Dinner', 'dinner');
  assert.deepEqual(
    automaticMealSelection({
      previous: null,
      current: observation({ name: 'Dinner', period: 'dinner' }),
      selectedMeal: null,
      selectionIsManual: false,
    }),
    dinner,
  );
});

test('menu arrival in a newly active hall preserves carried automatic intent', () => {
  const breakfast = selection('Breakfast', 'breakfast');
  assert.deepEqual(
    automaticMealSelection({
      previous: observation({ name: null, period: undefined, menuDate: null }),
      current: observation({ name: 'Dinner', period: 'dinner' }),
      selectedMeal: breakfast,
      selectionIsManual: false,
    }),
    breakfast,
  );
});

test('activating a loaded hall preserves carried automatic intent', () => {
  const breakfast = selection('Breakfast', 'breakfast');
  assert.deepEqual(
    automaticMealSelection({
      previous: observation({ name: 'Dinner', period: 'dinner', isActiveHall: false }),
      current: observation({ name: 'Dinner', period: 'dinner', isActiveHall: true }),
      selectedMeal: breakfast,
      selectionIsManual: false,
    }),
    breakfast,
  );
});

test('an ongoing active hall advances when the observed service changes', () => {
  assert.deepEqual(
    automaticMealSelection({
      previous: observation({ name: 'Breakfast', period: 'breakfast' }),
      current: observation({ name: 'Lunch', period: 'lunch' }),
      selectedMeal: selection('Breakfast', 'breakfast'),
      selectionIsManual: false,
    }),
    selection('Lunch', 'lunch'),
  );
});

test('a menu refresh advances when service identity changes at the same index', () => {
  assert.deepEqual(
    automaticMealSelection({
      previous: observation({ name: 'Breakfast', period: 'breakfast' }),
      current: observation({ name: 'Continental Breakfast', period: 'breakfast' }),
      selectedMeal: selection('Breakfast', 'breakfast'),
      selectionIsManual: false,
    }),
    selection('Continental Breakfast', 'breakfast'),
  );
});

test('an unchanged ongoing observation keeps cross-hall intent unchanged', () => {
  const breakfast = selection('Breakfast', 'breakfast');
  assert.deepEqual(
    automaticMealSelection({
      previous: observation({ name: 'Dinner', period: 'dinner' }),
      current: observation({ name: 'Dinner', period: 'dinner' }),
      selectedMeal: breakfast,
      selectionIsManual: false,
    }),
    breakfast,
  );
});

test('does not update automatic intent from an inactive, stale, or future observation', () => {
  const breakfast = selection('Breakfast', 'breakfast');
  const cases = [
    observation({ name: 'Dinner', period: 'dinner', isActiveHall: false }),
    observation({ name: 'Dinner', period: 'dinner', menuDate: '2026-09-25' }),
    observation({ name: 'Dinner', period: 'dinner', isToday: false }),
  ];

  for (const current of cases) {
    assert.deepEqual(
      automaticMealSelection({
        previous: observation({ name: 'Breakfast', period: 'breakfast' }),
        current,
        selectedMeal: breakfast,
        selectionIsManual: false,
      }),
      breakfast,
    );
  }
});

test('never replaces a manual selection when the observed service changes', () => {
  const breakfast = selection('Breakfast', 'breakfast');
  assert.deepEqual(
    automaticMealSelection({
      previous: observation({ name: 'Breakfast', period: 'breakfast' }),
      current: observation({ name: 'Lunch', period: 'lunch' }),
      selectedMeal: breakfast,
      selectionIsManual: true,
    }),
    breakfast,
  );
});

test('keeps an explicit meal when the app resumes on the same day', () => {
  assert.equal(shouldClearMealSelection({ windowShifted: false, selectedDateKept: true }), false);
});

test('keeps an explicit meal when its date moves within the refreshed window', () => {
  assert.equal(shouldClearMealSelection({ windowShifted: true, selectedDateKept: true }), false);
});

test('clears the explicit meal only when its selected date expires', () => {
  assert.equal(shouldClearMealSelection({ windowShifted: true, selectedDateKept: false }), true);
});
