import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Dim {
  dimmed: boolean;
  dismiss: () => void;
  arm: (fn: () => void) => void;
  disarm: () => void;
}

const DimContext = createContext<Dim>({
  dimmed: false,
  dismiss: () => {},
  arm: () => {},
  disarm: () => {},
});

/** Lets the hall page dim the bottom bar while a picker is open. */
export function DimProvider({ children }: { children: ReactNode }) {
  const [fn, setFn] = useState<(() => void) | null>(null);
  const arm = useCallback((next: () => void) => setFn(() => next), []);
  const disarm = useCallback(() => setFn(null), []);
  const dismiss = useCallback(() => {
    fn?.();
    setFn(null);
  }, [fn]);
  const value = useMemo(
    () => ({ dimmed: fn !== null, dismiss, arm, disarm }),
    [fn, dismiss, arm, disarm],
  );
  return <DimContext.Provider value={value}>{children}</DimContext.Provider>;
}

export function useDim(): Dim {
  return useContext(DimContext);
}
