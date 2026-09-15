import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { flattenExportAssets, rewriteAssetRefs } from './flatten-export-assets.mjs';

test('rewrites metro node_modules asset urls', () => {
  const src =
    'url("/assets/node_modules/@expo-google-fonts/material-symbols/500Medium/font.ttf")';
  assert.equal(
    rewriteAssetRefs(src),
    'url("/assets/vendor/@expo-google-fonts/material-symbols/500Medium/font.ttf")',
  );
});

test('moves exported fonts out of a node_modules folder', () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'flatten-assets-'));
  const fontRel = path.join(
    'assets',
    'node_modules',
    '@expo-google-fonts',
    'material-symbols',
    '500Medium',
    'MaterialSymbols_500Medium.hash.ttf',
  );
  const fontPath = path.join(dist, fontRel);
  fs.mkdirSync(path.dirname(fontPath), { recursive: true });
  fs.writeFileSync(fontPath, 'OTTO');
  const jsPath = path.join(dist, '_expo', 'static', 'js', 'web', 'entry.js');
  fs.mkdirSync(path.dirname(jsPath), { recursive: true });
  fs.writeFileSync(jsPath, `u="${fontRel.replaceAll(path.sep, '/')}"`);

  const result = flattenExportAssets(dist);

  assert.equal(result.moved, 1);
  assert.equal(result.rewritten, 1);
  assert.equal(fs.existsSync(path.join(dist, 'assets', 'node_modules')), false);
  const moved = path.join(
    dist,
    'assets',
    'vendor',
    '@expo-google-fonts',
    'material-symbols',
    '500Medium',
    'MaterialSymbols_500Medium.hash.ttf',
  );
  assert.equal(fs.readFileSync(moved, 'utf8'), 'OTTO');
  assert.match(fs.readFileSync(jsPath, 'utf8'), /assets\/vendor\//);
  fs.rmSync(dist, { recursive: true, force: true });
});
