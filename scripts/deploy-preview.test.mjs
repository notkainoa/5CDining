import assert from 'node:assert/strict';
import test from 'node:test';
import { previewAliasFromRef } from './deploy-preview.mjs';

test('turns a git branch into a wrangler preview alias', () => {
  assert.equal(
    previewAliasFromRef('t3code/cloudflare-preview-deployments'),
    't3code-cloudflare-preview-deployments',
  );
});

test('prefixes aliases that would start with a number', () => {
  assert.equal(previewAliasFromRef('89df6ba7'), 'p-89df6ba7');
});

test('truncates so alias plus worker name fit in a DNS label', () => {
  const alias = previewAliasFromRef('a'.repeat(80));
  assert.equal(alias.length + 1 + 'better5cmenu'.length, 63);
  assert.match(alias, /^a+$/);
});
