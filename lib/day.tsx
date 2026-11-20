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

interface DayCtx {
  days: Date[];
  selected: number;
  date: Date;
  selectDate: (i: number) => void;
  /** Claremont minutes after midnight. Refreshed every minute and when the app is opened. */
  nowMinutes: number;
  /** Goes up each time the app comes back from the background. */
  openCount: number;
}

const DayContext = createContext<DayCtx>({
  days: [],
  selected: 0,
  date: new Date(),
  selectDate: () => {},
  nowMinutes: 0,
  openCount: 0,
});

/** Shared selected day across all hall pages. */
export function DayProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState(() => weekDates());
  const [selected, setSelected] = useState(0);
  const [nowMinutes, setNowMinutes] = useState(nowMinutesInLA);
  const [openCount, setOpenCount] = useState(0);
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
      setOpenCount((n) => n + 1);
    });
    const tick = setInterval(syncWindow, 60_000);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
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
      nowMinutes,
      openCount,
    }),
    [days, selected, selectDate, nowMinutes, openCount],
  );
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useDay(): DayCtx {
  return useContext(DayContext);
}
