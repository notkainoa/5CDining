import {
  Children,
  forwardRef,
  isValidElement,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
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
 * Web stand-in for `react-native-pager-view`. No swipe — clicking a hall chip
 * swaps the visible page in memory so the address bar can stay on `/webapp`.
 * Inactive pages stay mounted (hidden) so scroll position, expanded stations,
 * and loaded state survive switching back.
 */
const NativePager = forwardRef<NativePagerHandle, Props>(function NativePager(
  { initialPage, onPageSelected, children },
  ref,
) {
  const [index, setIndex] = useState(initialPage);
  const pages = Children.toArray(children);

  useImperativeHandle(
    ref,
    () => ({
      setPage: (next) => {
        setIndex(next);
        onPageSelected(next);
      },
      setPageWithoutAnimation: (next) => {
        setIndex(next);
        onPageSelected(next);
      },
    }),
    [onPageSelected],
  );

  return (
    <View style={styles.fill}>
      {pages.map((page, i) => (
        <View
          key={isValidElement(page) && page.key != null ? page.key : i}
          style={[styles.fill, i === index ? null : styles.hidden]}
        >
          {page}
        </View>
      ))}
    </View>
  );
});

export default NativePager;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
});
