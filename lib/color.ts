/** Mix two hex colors. `amount` (0–1) is how much of `color` to keep. */
export function mix(base: string, color: string, amount: number): string {
  const a = parseHex(base);
  const b = parseHex(color);
  const t = Math.min(Math.max(amount, 0), 1);
  const ch = [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
