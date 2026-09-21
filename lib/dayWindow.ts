function sameCalendarDay(a: Date, b: Date): boolean {
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
  const windowShifted = !sameCalendarDay(nextDays[0], previousDays[0]);
  if (!windowShifted) {
    return { windowShifted: false, selected: previousSelected, selectedDateKept: true };
  }

  const previousDate = previousDays[previousSelected];
  const kept = previousDate
    ? nextDays.findIndex((date) => sameCalendarDay(date, previousDate))
    : -1;
  return {
    windowShifted: true,
    selected: kept >= 0 ? kept : 0,
    selectedDateKept: kept >= 0,
  };
}
