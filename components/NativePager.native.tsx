import {
  Children,
  forwardRef,
  isValidElement,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';

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

/** Native-only pager (ViewPager2 / UIPageViewController). Web uses the .web stub. */
const NativePager = forwardRef<NativePagerHandle, Props>(function NativePager(
  { initialPage, onPageSelected, onPageScroll, children },
  ref,
) {
  const inner = useRef<PagerView>(null);
  useImperativeHandle(
    ref,
    () => ({
      setPage: (index: number) => inner.current?.setPage(index),
      setPageWithoutAnimation: (index: number) => inner.current?.setPageWithoutAnimation(index),
    }),
    [],
  );
  return (
    <PagerView
      ref={inner}
      style={styles.fill}
      initialPage={initialPage}
      onPageSelected={(e) => onPageSelected(e.nativeEvent.position)}
      onPageScroll={(e) =>
        onPageScroll?.({ position: e.nativeEvent.position, offset: e.nativeEvent.offset })
      }
    >
      {Children.map(children, (child, i) => (
        // Key by page name (set in _layout), NOT by index: reordering halls
        // shifts positions, and index keys unmount/remount every page.
        // Stable keys let React move each page's view instead.
        <View
          key={isValidElement(child) && child.key != null ? child.key : i}
          collapsable={false}
          style={styles.fill}
        >
          {child}
        </View>
      ))}
    </PagerView>
  );
});

export default NativePager;

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
