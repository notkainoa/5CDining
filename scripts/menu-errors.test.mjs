import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchHallMenu } from '../lib/api.ts';
import { MenuLoadError, describeMenuProblem, problemFromError } from '../lib/menuErrors.ts';

const day = new Date(2026, 10, 13);
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockFetch(...responses) {
  let calls = 0;
  globalThis.fetch = async () => {
    const r = responses[Math.min(calls++, responses.length - 1)];
    if (r instanceof Error) throw r;
    return typeof r === 'function' ? r() : r;
  };
  return () => calls;
}

async function failure(promise) {
  try {
    await promise;
  } catch (e) {
    return problemFromError(e);
  }
  assert.fail('expected a rejection');
}

test('503 MENU_NOT_PUBLISHED is "not published", not an error', async () => {
  mockFetch(
    json(503, { status: 'unavailable', meals: null, error: { code: 'MENU_NOT_PUBLISHED' } }),
  );
  const menu = await fetchHallMenu('hoch', day);
  assert.equal(menu.status, 'unavailable');
  assert.equal(menu.problem, 'not_published');
});

test('503 SOURCE_FETCH_FAILED means the hall site is down', async () => {
  mockFetch(
    json(503, { status: 'unavailable', meals: null, error: { code: 'SOURCE_FETCH_FAILED' } }),
  );
  assert.equal((await fetchHallMenu('frank', day)).problem, 'source_down');
});

test('400 unsupported_date is out of range', async () => {
  mockFetch(json(400, { error: { code: 'unsupported_date' } }));
  assert.equal((await fetchHallMenu('frary', day)).problem, 'out_of_range');
});

test('ok menu with no meals reads as closed', async () => {
  mockFetch(json(200, { hall: 'frary', status: 'ok', meals: [] }));
  assert.equal((await fetchHallMenu('frary', day)).problem, 'no_meals');
});

test('ok menu with meals has no problem', async () => {
  mockFetch(json(200, { hall: 'frary', status: 'ok', meals: [{ name: 'Lunch', stations: [] }] }));
  const menu = await fetchHallMenu('frary', day);
  assert.equal(menu.problem, undefined);
  assert.equal(menu.meals.length, 1);
});

test('unknown 500 is a server error with its status', async () => {
  const calls = mockFetch(new Response('oops', { status: 500 }));
  assert.deepEqual(await failure(fetchHallMenu('frary', day)), { problem: 'server', status: 500 });
  assert.equal(calls(), 2, 'retried once');
});

test('a network failure retries once, then reports offline', async () => {
  const calls = mockFetch(new TypeError('Network request failed'));
  assert.equal((await failure(fetchHallMenu('frary', day))).problem, 'offline');
  assert.equal(calls(), 2);
});

test('a network blip that recovers on retry still loads the menu', async () => {
  mockFetch(
    new TypeError('Failed to fetch'),
    json(200, { status: 'ok', meals: [{ name: 'Dinner', stations: [] }] }),
  );
  assert.equal((await fetchHallMenu('frary', day)).status, 'ok');
});

test('a non-JSON 200 body is a bad response', async () => {
  mockFetch(new Response('<html>', { status: 200 }));
  assert.equal((await failure(fetchHallMenu('frary', day))).problem, 'bad_response');
});

test('an aborted request reads as a timeout', () => {
  const e = new Error('aborted');
  e.name = 'AbortError';
  assert.equal(problemFromError(e).problem, 'timeout');
  assert.equal(problemFromError(new MenuLoadError('timeout')).problem, 'timeout');
});

test('copy names the hall, day and college', () => {
  const ctx = { hallName: 'Hoch-Shanahan', college: 'Harvey Mudd', dayPhrase: 'tomorrow' };
  assert.equal(describeMenuProblem('not_published', ctx).title, 'No menu posted tomorrow');
  assert.equal(describeMenuProblem('source_down', ctx).title, 'Harvey Mudd menu site is down');
  assert.equal(describeMenuProblem('offline', ctx).title, 'No internet connection');
  assert.match(describeMenuProblem('server', { ...ctx, status: 502 }).detail, /error 502/);
  assert.equal(describeMenuProblem('out_of_range', ctx).action, null);
});
