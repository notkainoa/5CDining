import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const config = JSON.parse(readFileSync(new URL('app.json', root), 'utf8')).expo;
const icons = config.plugins.find((plugin) => plugin[0] === 'expo-awesome-app-icon')[1].icons;
const source = readFileSync(new URL('lib/appIcons.ts', root), 'utf8');

test('every configured app icon exists and has a matching picker option', () => {
  for (const [id, icon] of Object.entries(icons)) {
    assert.ok(existsSync(new URL(icon.ios.light, root)), id);
    assert.ok(existsSync(new URL(icon.android.image, root)), id);
    assert.ok(source.includes(`id: '${id}'`), id);
  }
  assert.equal(Object.keys(icons).length, 8);
  assert.ok(existsSync(new URL(config.icon, root)));
});

test('the removed Location icon is absent from config and the picker', () => {
  assert.equal(icons.loc, undefined);
  assert.equal(source.includes('icon_loc'), false);
  assert.equal(source.includes("'loc'"), false);
});
