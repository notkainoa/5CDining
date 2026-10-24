// Generates the hall "logo" images as plain two-letter monogram badges.
// Replaces the college seals so the app does not imply college endorsement.
// Usage: node scripts/hall-badges.mjs   (requires rsvg-convert from librsvg)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// file -> { initials, fill, text }. Colors match lib/diningHalls.ts.
const BADGES = {
  pitzer: { initials: 'PZ', fill: '#fd7e14', text: '#000000' },
  pomona: { initials: 'PO', fill: '#228be6', text: '#FFFFFF' },
  hmc: { initials: 'HM', fill: '#fab005', text: '#000000' },
  scripps: { initials: 'SC', fill: '#40c057', text: '#000000' },
  cmc: { initials: 'CM', fill: '#e03131', text: '#FFFFFF' },
};

const SIZE = 512;
const RING = 34; // white ring so the badge reads on a same-color header

function svg({ initials, fill, text }) {
  const inset = RING / 2;
  const r = 118;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect x="${inset}" y="${inset}" width="${SIZE - RING}" height="${SIZE - RING}" rx="${r}" ry="${r}" fill="${fill}" stroke="#FFFFFF" stroke-width="${RING}"/>
  <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="220" letter-spacing="-6" fill="${text}">${initials}</text>
</svg>`;
}

const tmp = mkdtempSync(join(tmpdir(), 'hall-badges-'));
for (const [name, badge] of Object.entries(BADGES)) {
  const svgPath = join(tmp, `${name}.svg`);
  writeFileSync(svgPath, svg(badge));
  const out = new URL(`../assets/images/${name}.png`, import.meta.url).pathname;
  execFileSync('rsvg-convert', ['-w', String(SIZE), '-h', String(SIZE), '-o', out, svgPath]);
  console.log('wrote', out);
}
