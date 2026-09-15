import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FROM = 'assets/node_modules';
const TO = 'assets/vendor';
const TEXT_EXT = new Set(['.css', '.html', '.js', '.json', '.map', '.txt']);

export function rewriteAssetRefs(source) {
  return source.replaceAll(FROM, TO).replaceAll('assets\\node_modules', 'assets\\vendor');
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(next, out);
    else out.push(next);
  }
  return out;
}

export function flattenExportAssets(distDir) {
  const fromDir = path.join(distDir, 'assets', 'node_modules');
  const toDir = path.join(distDir, 'assets', 'vendor');
  if (!fs.existsSync(fromDir)) return { moved: 0, rewritten: 0 };

  fs.rmSync(toDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(toDir), { recursive: true });
  fs.renameSync(fromDir, toDir);

  let rewritten = 0;
  for (const file of walkFiles(distDir)) {
    if (!TEXT_EXT.has(path.extname(file))) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = rewriteAssetRefs(before);
    if (after === before) continue;
    fs.writeFileSync(file, after);
    rewritten += 1;
  }

  return { moved: walkFiles(toDir).length, rewritten };
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  const distDir = path.resolve(process.argv[2] ?? 'dist');
  const result = flattenExportAssets(distDir);
  console.log(`flatten-export-assets: moved ${result.moved} files, rewrote ${result.rewritten} refs`);
}
