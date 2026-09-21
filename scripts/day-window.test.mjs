import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileDayWindow } from '../lib/dates.ts';

const day = (date) => new Date(2026, 8, date);

test('keeps the same index while the date window is unchanged', () => {
  const days = [day(20), day(21), day(22)];
  assert.deepEqual(reconcileDayWindow(days, 1, days), {
    windowShifted: false,
    selected: 1,
    selectedDateKept: true,
  });
});

test('moves a retained date to its new index after midnight', () => {
  assert.deepEqual(
    reconcileDayWindow([day(20), day(21), day(22)], 1, [day(21), day(22), day(23)]),
    { windowShifted: true, selected: 0, selectedDateKept: true },
  );
});

test('resets when the selected date has expired', () => {
  assert.deepEqual(
    reconcileDayWindow([day(20), day(21), day(22)], 0, [day(21), day(22), day(23)]),
    { windowShifted: true, selected: 0, selectedDateKept: false },
  );
});

test('treats an invalid selected index as expired', () => {
  assert.deepEqual(
    reconcileDayWindow([day(20), day(21), day(22)], 99, [day(21), day(22), day(23)]),
    { windowShifted: true, selected: 0, selectedDateKept: false },
  );
});
