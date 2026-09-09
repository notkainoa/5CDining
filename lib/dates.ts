/** Date helpers. All "today" math is done in America/Los_Angeles (Claremont time). */

const LA_TZ = 'America/Los_Angeles';

/** Current date in Claremont as a local Date at midnight. */
export function todayInLA(): Date {
  const now = new Date();
  // Extract LA calendar parts, rebuild as a local-midnight Date.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LA_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(get('year'), get('month') - 1, get('day'));
}

/** Today + 7 days = 8 selectable dates (one week in advance). */
export const DATE_WINDOW_DAYS = 8;

export function weekDates(from: Date = todayInLA()): Date[] {
  return Array.from({ length: DATE_WINDOW_DAYS }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dateCardLabels(date: Date, index: number): { top: string; bottom: string } {
  const bottom = `${date.getMonth() + 1}/${date.getDate()}`;
  if (index === 0) return { top: 'Today', bottom };
  if (index === 1) return { top: 'Tomorrow', bottom };
  return { top: WEEKDAY_SHORT[date.getDay()], bottom };
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Current time in Claremont as minutes after midnight (for picking the live meal). */
export function nowMinutesInLA(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LA_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}
