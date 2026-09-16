import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'dayPillLayout.ts'),
  'utf8',
);
const { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { rectsFromWidths } = await import(`data:text/javascript,${encodeURIComponent(outputText)}`);

test('day pill left is padding plus earlier widths and gaps, never parent x', () => {
  const rects = rectsFromWidths([63, 89, 85]);
  assert.equal(rects['day:0'].x, 8);
  assert.equal(rects['day:1'].x, 8 + 63 + 8);
  assert.equal(rects['day:2'].x, 8 + 63 + 8 + 89 + 8);
  assert.equal(rects['day:1'].w, 89);
});

test('skips later days until earlier widths exist', () => {
  const rects = rectsFromWidths([0, 89, 85]);
  assert.deepEqual(rects, {});
});
