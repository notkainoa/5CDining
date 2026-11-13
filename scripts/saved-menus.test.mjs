import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSavedOffline } from '../lib/menuErrors.ts';
import {
  isSavable,
  pruneSavedMenus,
  readSavedMenu,
  removeSavedMenu,
  saveMenu,
  savedMenuKey,
} from '../lib/savedMenus.ts';

function memoryStore() {
  const map = new Map();
  return {
    map,
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
    getAllKeys: async () => [...map.keys()],
  };
}

const lunch = { status: 'ok', meals: [{ name: 'Lunch', stations: [] }] };

test('a good menu round-trips', async () => {
  const store = memoryStore();
  const now = new Date('2026-11-13T20:00:00Z');
  await saveMenu(store, 'frary', '2026-11-13', lunch, now);
  const saved = await readSavedMenu(store, 'frary', '2026-11-13');
  assert.equal(saved.savedAt, now.toISOString());
  assert.equal(saved.menu.meals[0].name, 'Lunch');
});

test('empty, closed and unavailable menus are not saved', () => {
  assert.equal(isSavable({ status: 'ok', meals: [], problem: 'no_meals' }), false);
  assert.equal(isSavable({ status: 'closed', meals: [], problem: 'closed' }), false);
  assert.equal(isSavable({ status: 'unavailable', meals: null, problem: 'not_published' }), false);
  assert.equal(isSavable({ status: 'stale', meals: lunch.meals }), true);
});

test('corrupt or missing entries read as nothing', async () => {
  const store = memoryStore();
  store.map.set(savedMenuKey('frank', '2026-11-13'), '{not json');
  assert.equal(await readSavedMenu(store, 'frank', '2026-11-13'), null);
  assert.equal(await readSavedMenu(store, 'frank', '2026-11-14'), null);
});

test('storage failures never throw', async () => {
  const broken = {
    getItem: async () => {
      throw new Error('x');
    },
    setItem: async () => {
      throw new Error('quota');
    },
    removeItem: async () => {},
    getAllKeys: async () => {
      throw new Error('x');
    },
  };
  await saveMenu(broken, 'frary', '2026-11-13', lunch);
  assert.equal(await readSavedMenu(broken, 'frary', '2026-11-13'), null);
  await pruneSavedMenus(broken, '2026-11-13');
});

test('pruning drops past days and leaves other keys alone', async () => {
  const store = memoryStore();
  await saveMenu(store, 'frary', '2026-11-12', lunch);
  await saveMenu(store, 'frary', '2026-11-13', lunch);
  store.map.set('prefs', '{}');
  await pruneSavedMenus(store, '2026-11-13');
  assert.deepEqual([...store.map.keys()].sort(), ['prefs', savedMenuKey('frary', '2026-11-13')]);
});

test('offline note says why and how old', () => {
  const now = new Date('2026-11-13T20:00:00Z');
  assert.equal(
    describeSavedOffline('offline', '2026-11-13T19:00:00Z', now),
    'No internet connection. Showing the menu saved on this device 1 hour ago. Pull down to refresh.',
  );
});

test('a saved entry with a broken meal shape reads as nothing', async () => {
  const store = memoryStore();
  store.map.set(
    savedMenuKey('frary', '2026-11-13'),
    JSON.stringify({
      savedAt: '2026-11-13T19:00:00Z',
      menu: { status: 'ok', meals: [{ name: 'Lunch' }] },
    }),
  );
  assert.equal(await readSavedMenu(store, 'frary', '2026-11-13'), null);
});

test('removing a saved menu deletes only that hall and day', async () => {
  const store = memoryStore();
  await saveMenu(store, 'frary', '2026-11-13', lunch);
  await saveMenu(store, 'frary', '2026-11-14', lunch);
  await removeSavedMenu(store, 'frary', '2026-11-13');
  assert.equal(await readSavedMenu(store, 'frary', '2026-11-13'), null);
  assert.ok(await readSavedMenu(store, 'frary', '2026-11-14'));
});
