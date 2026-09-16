export const DAY_RADIUS = 14;

export const DAY_CHROME_PAD = 8;
export const DAY_SLOT_GAP = 8;

export interface DaySlotRect {
  x: number;
  w: number;
  r: number;
}

/** Pill x comes from chrome padding and slot widths, not onLayout x (web only reports size). */
export function rectsFromWidths(widths: number[]): Record<string, DaySlotRect> {
  const next: Record<string, DaySlotRect> = {};
  let x = DAY_CHROME_PAD;
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i] ?? 0;
    if (w <= 0) break;
    next[`day:${i}`] = { x, w, r: DAY_RADIUS };
    x += w + DAY_SLOT_GAP;
  }
  return next;
}
