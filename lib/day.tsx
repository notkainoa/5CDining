import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { weekDates } from './dates';

interface DayCtx {
  days: Date[];
  selected: number;
  date: Date;
  selectDate: (i: number) => void;
  /** Normalized name of the manually picked meal (e.g. "lunch"), or null if none yet. */
  mealName: string | null;
  selectMealName: (name: string) => void;
  /** Measured height of the floating day bar (0 until measured). */
  stripHeight: number;
  setStripHeight: (h: number) => void;
}

const DayContext = createContext<DayCtx>({
  days: [],
  selected: 0,
  date: new Date(),
  selectDate: () => {},
  mealName: null,
  selectMealName: () => {},
  stripHeight: 0,
  setStripHeight: () => {},
});

/** Meal identity across halls: case/whitespace-insensitive name. */
export function normalizeMealName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Shared selected day across all hall pages — the date strip persists like the bottom bar. */
export function DayProvider({ children }: { children: ReactNode }) {
  const days = useMemo(() => weekDates(), []);
  const [selected, setSelected] = useState(0);
  const [mealName, setMealName] = useState<string | null>(null);
  const [stripHeight, setStripHeightState] = useState(0);
  const setStripHeight = useCallback(
    (h: number) => setStripHeightState((prev) => (prev === h ? prev : h)),
    [],
  );
  const value = useMemo<DayCtx>(
    () => ({
      days,
      selected,
      date: days[selected] ?? days[0],
      selectDate: setSelected,
      mealName,
      selectMealName: (name: string) => setMealName(normalizeMealName(name)),
      stripHeight,
      setStripHeight,
    }),
    [days, selected, mealName, stripHeight, setStripHeight],
  );
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useDay(): DayCtx {
  return useContext(DayContext);
}
