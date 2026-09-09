import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { weekDates } from './dates';

interface DayCtx {
  days: Date[];
  selected: number;
  date: Date;
  selectDate: (i: number) => void;
  /** Normalized name of the manually picked meal (e.g. "lunch"), or null if none yet. */
  mealName: string | null;
  selectMealName: (name: string) => void;
}

const DayContext = createContext<DayCtx>({
  days: [],
  selected: 0,
  date: new Date(),
  selectDate: () => {},
  mealName: null,
  selectMealName: () => {},
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
  const value = useMemo<DayCtx>(
    () => ({
      days,
      selected,
      date: days[selected] ?? days[0],
      selectDate: setSelected,
      mealName,
      selectMealName: (name: string) => setMealName(normalizeMealName(name)),
    }),
    [days, selected, mealName],
  );
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useDay(): DayCtx {
  return useContext(DayContext);
}
