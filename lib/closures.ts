import type { HallId } from './diningHalls';

export interface HallClosure {
  /** Static hall id, e.g. 'oldenborg'. */
  hall: HallId;
  /** Short reason shown under the message, e.g. 'Building construction'. */
  reason: string;
  /** Closure lifts after this date (YYYY-MM-DD, inclusive). */
  until: string;
  /** Display text for the date, e.g. 'Fall 2028'. Defaults to a formatted date. */
  untilLabel?: string;
}

/**
 * HOW TO DISABLE A DINING HALL:
 * Add one line below with the hall, why, and when it reopens.
 * The bottom-bar tab grays out and the hall page shows
 * "{Hall} closed until {label}" instead of hitting the API.
 *
 * Example:
 *   { hall: 'oldenborg', reason: 'Building construction', until: '2028-08-24', untilLabel: 'Fall 2028' },
 */
export const HALL_CLOSURES: HallClosure[] = [
  {
    hall: 'oldenborg',
    reason: 'Building construction',
    until: '2028-08-24',
    untilLabel: 'Fall 2028',
  },
];

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Active closure for a hall on a given date (defaults to today), if any. */
export function getClosure(hallId: HallId, on: Date = new Date()): HallClosure | null {
  const day = ymd(on);
  return HALL_CLOSURES.find((c) => c.hall === hallId && day <= c.until) ?? null;
}

/** '2028-08-24' -> 'Aug 24, 2028'. */
export function formatUntilDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function closureLabel(c: HallClosure): string {
  return c.untilLabel ?? formatUntilDate(c.until);
}
