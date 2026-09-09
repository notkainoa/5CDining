import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export interface NativePagerHandle {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
}

export interface PageScrollEvent {
  /** Index of the left (lower-index) page involved in the scroll. */
  position: number;
  /** 0..1 progress from `position` toward `position + 1`. */
  offset: number;
}

interface Props {
  initialPage: number;
  onPageSelected: (index: number) => void;
  onPageScroll?: (e: PageScrollEvent) => void;
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
