import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export interface NativePagerHandle {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
}

interface Props {
  initialPage: number;
  onPageSelected: (index: number) => void;
  progress: SharedValue<number>;
  children: ReactNode;
}

/**
 * Web fallback so `react-native-pager-view` (native-only) never enters the
 * web bundle. Unused while _layout.web.tsx exists; renders all children so
 * the app still paints if that file is ever removed.
 */
const NativePager = forwardRef<NativePagerHandle, Props>(function NativePager(
  { initialPage, onPageSelected, children },
  ref,
) {
  const indexRef = useRef(initialPage);

  useImperativeHandle(
    ref,
    () => ({
      setPage: (index: number) => {
        if (index !== indexRef.current) {
          indexRef.current = index;
          onPageSelected(index);
        }
      },
      setPageWithoutAnimation: (index: number) => {
        if (index !== indexRef.current) {
          indexRef.current = index;
          onPageSelected(index);
        }
      },
    }),
    [onPageSelected],
  );

  return <View style={styles.fill}>{children}</View>;
});

export default NativePager;

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
