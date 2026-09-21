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
import { nowMinutesInLA, reconcileDayWindow, weekDates } from './dates';
import { invalidateMenuCache } from './menuCache';
import { normalizeMealName, shouldClearMealSelection } from './mealSelection';

interface DayCtx {
  days: Date[];
  selected: number;
  date: Date;
  selectDate: (i: number) => void;
  /** Shared meal slot across halls: API `period` when present, else the normalized school name. */
  mealName: string | null;
  mealSelectionIsManual: boolean;
  selectMealName: (name: string) => void;
  selectAutomaticMealName: (name: string) => void;
  /** Claremont minutes after midnight. Refreshed when the app is opened. */
  nowMinutes: number;
}

const DayContext = createContext<DayCtx>({
  days: [],
  selected: 0,
  date: new Date(),
  selectDate: () => {},
  mealName: null,
  mealSelectionIsManual: false,
  selectMealName: () => {},
  selectAutomaticMealName: () => {},
  nowMinutes: 0,
});

interface MealSelection {
  name: string | null;
  manual: boolean;
}

const EMPTY_MEAL_SELECTION: MealSelection = { name: null, manual: false };

/** Shared selected day across all hall pages. */
export function DayProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState(() => weekDates());
  const [selected, setSelected] = useState(0);
  const [mealSelection, setMealSelection] = useState<MealSelection>(EMPTY_MEAL_SELECTION);
  const [nowMinutes, setNowMinutes] = useState(nowMinutesInLA);
  const selectedRef = useRef(selected);
  const daysRef = useRef(days);
  const mealSelectionRef = useRef(mealSelection);

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
        mealSelectionRef.current = EMPTY_MEAL_SELECTION;
        setMealSelection(EMPTY_MEAL_SELECTION);
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
    const next = { name: normalizeMealName(name), manual: true };
    mealSelectionRef.current = next;
    setMealSelection(next);
  }, []);

  const selectAutomaticMealName = useCallback((name: string) => {
    const current = mealSelectionRef.current;
    if (current.manual) return;
    const normalized = normalizeMealName(name);
    if (current.name === normalized) return;
    const next = { name: normalized, manual: false };
    mealSelectionRef.current = next;
    setMealSelection(next);
  }, []);

  const selectDate = useCallback((index: number) => {
    if (index < 0 || index >= daysRef.current.length) return;
    if (index !== selectedRef.current && !mealSelectionRef.current.manual) {
      mealSelectionRef.current = EMPTY_MEAL_SELECTION;
      setMealSelection(EMPTY_MEAL_SELECTION);
    }
    selectedRef.current = index;
    setSelected(index);
  }, []);

  const value = useMemo<DayCtx>(
    () => ({
      days,
      selected,
      date: days[selected] ?? days[0],
      selectDate,
      mealName: mealSelection.name,
      mealSelectionIsManual: mealSelection.manual,
      selectMealName,
      selectAutomaticMealName,
      nowMinutes,
    }),
    [
      days,
      selected,
      selectDate,
      mealSelection,
      selectMealName,
      selectAutomaticMealName,
      nowMinutes,
    ],
  );
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useDay(): DayCtx {
  return useContext(DayContext);
}
