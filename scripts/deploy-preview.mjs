import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKER_NAME = '5c-dining';

export function previewAliasFromRef(ref, workerName = WORKER_NAME) {
  let alias = String(ref ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!alias || !/^[a-z]/.test(alias)) alias = `p-${alias || 'preview'}`;
  const maxAlias = 63 - 1 - workerName.length;
  if (alias.length > maxAlias) alias = alias.slice(0, maxAlias).replace(/-+$/g, '');
  return alias;
}

function gitRef() {
  const branch = execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).trim();
  if (branch) return branch;
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  const alias = previewAliasFromRef(gitRef());
  const wrangler = path.join(process.cwd(), 'node_modules', '.bin', 'wrangler');
  console.log(`Uploading Worker version with preview alias: ${alias}`);
  const result = spawnSync(
    wrangler,
    ['versions', 'upload', '--preview-alias', alias, ...process.argv.slice(2)],
    { encoding: 'utf8', env: process.env },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  const previewUrl = result.stdout?.match(/Version Preview Alias URL:\s+(\S+)/)?.[1];
  if (!previewUrl) {
    console.error('Wrangler uploaded the version but did not print an aliased preview URL.');
    process.exit(1);
  }
  console.log(`PREVIEW_URL=${previewUrl}`);
}
