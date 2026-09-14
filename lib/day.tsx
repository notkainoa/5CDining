import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { nowMinutesInLA, weekDates } from './dates';

interface DayCtx {
  days: Date[];
  selected: number;
  date: Date;
  selectDate: (i: number) => void;
  /** Normalized name of the manually picked meal (e.g. "lunch"), or null if none yet. */
  mealName: string | null;
  selectMealName: (name: string) => void;
  /** Claremont minutes after midnight. Refreshed when the app is opened. */
  nowMinutes: number;
}

const DayContext = createContext<DayCtx>({
  days: [],
  selected: 0,
  date: new Date(),
  selectDate: () => {},
  mealName: null,
  selectMealName: () => {},
  nowMinutes: 0,
});

/** Meal identity across halls: case/whitespace-insensitive name. */
export function normalizeMealName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Shared selected day across all hall pages. */
export function DayProvider({ children }: { children: ReactNode }) {
  const days = useMemo(() => weekDates(), []);
  const [selected, setSelected] = useState(0);
  const [mealName, setMealName] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(nowMinutesInLA);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    let leftForBackground = false;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        leftForBackground = true;
        return;
      }
      if (next !== 'active' || !leftForBackground) return;
      leftForBackground = false;
      setNowMinutes(nowMinutesInLA());
      // Opening the app on today always shows the live meal, not the last pick.
      if (selectedRef.current === 0) setMealName(null);
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<DayCtx>(
    () => ({
      days,
      selected,
      date: days[selected] ?? days[0],
      selectDate: setSelected,
      mealName,
      selectMealName: (name: string) => setMealName(normalizeMealName(name)),
      nowMinutes,
    }),
    [days, selected, mealName, nowMinutes],
  );
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useDay(): DayCtx {
  return useContext(DayContext);
}
