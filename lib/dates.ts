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

/** Today + tomorrow + the next day. */
export const DATE_WINDOW_DAYS = 3;

export function weekDates(from: Date = todayInLA()): Date[] {
  return Array.from({ length: DATE_WINDOW_DAYS }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dateCardLabel(date: Date, index: number, compact = false): string {
  if (index === 0) return 'Today';
  if (index === 1) return compact ? 'Tmr' : 'Tomorrow';
  return (compact ? WEEKDAY_SHORT : WEEKDAY)[date.getDay()];
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface DayWindowUpdate {
  windowShifted: boolean;
  selected: number;
  selectedDateKept: boolean;
}

export function reconcileDayWindow(
  previousDays: Date[],
  previousSelected: number,
  nextDays: Date[],
): DayWindowUpdate {
  const windowShifted = !sameDay(nextDays[0], previousDays[0]);
  if (!windowShifted) {
    return { windowShifted: false, selected: previousSelected, selectedDateKept: true };
  }

  const previousDate = previousDays[previousSelected];
  const kept = previousDate ? nextDays.findIndex((date) => sameDay(date, previousDate)) : -1;
  return {
    windowShifted: true,
    selected: kept >= 0 ? kept : 0,
    selectedDateKept: kept >= 0,
  };
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
