import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { nowMinutesInLA, weekDates } from './dates';
import { reconcileDayWindow } from './dayWindow';
import { invalidateMenuCache } from './menuCache';
import { normalizeMealName, shouldClearMealSelection } from './mealSelection';

interface DayCtx {
  days: Date[];
  selected: number;
  date: Date;
  selectDate: (i: number) => void;
  /** Shared meal slot across halls: API `period` when present, else the normalized school name. */
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

/** Shared selected day across all hall pages. */
export function DayProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState(() => weekDates());
  const [selected, setSelected] = useState(0);
  const [mealName, setMealName] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(nowMinutesInLA);
  const selectedRef = useRef(selected);
  const daysRef = useRef(days);

  useEffect(() => {
    const syncWindow = () => {
      const nextDays = weekDates();
      const prevDays = daysRef.current;
      const update = reconcileDayWindow(prevDays, selectedRef.current, nextDays);
      if (update.windowShifted) {
        invalidateMenuCache();
        daysRef.current = nextDays;
        selectedRef.current = update.selected;
        setDays(nextDays);
        setSelected(update.selected);
      }
      setNowMinutes(nowMinutesInLA());
      if (
        shouldClearMealSelection({
          windowShifted: update.windowShifted,
          selectedDateKept: update.selectedDateKept,
        })
      ) {
        setMealName(null);
      }
    };

    let leftForBackground = false;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        leftForBackground = true;
        return;
      }
      if (next !== 'active' || !leftForBackground) return;
      leftForBackground = false;
      syncWindow();
    });
    const tick = setInterval(syncWindow, 60_000);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
  }, []);

  const selectMealName = useCallback((name: string) => {
    setMealName(normalizeMealName(name));
  }, []);

  const selectDate = useCallback((index: number) => {
    if (index < 0 || index >= daysRef.current.length) return;
    selectedRef.current = index;
    setSelected(index);
  }, []);

  const value = useMemo<DayCtx>(
    () => ({
      days,
      selected,
      date: days[selected] ?? days[0],
      selectDate,
      mealName,
      selectMealName,
      nowMinutes,
    }),
    [days, selected, selectDate, mealName, selectMealName, nowMinutes],
  );
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useDay(): DayCtx {
  return useContext(DayContext);
}
