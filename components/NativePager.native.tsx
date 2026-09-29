import {
  Children,
  forwardRef,
  isValidElement,
  useImperativeHandle,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { useEvent, type SharedValue } from 'react-native-reanimated';

export interface NativePagerHandle {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
}

interface Props {
  initialPage: number;
  onPageSelected: (index: number) => void;
  /**
   * Written with the live float page index (`position + offset`) on the UI
   * thread, so animations that follow the pager stay in lockstep even while
   * JS is busy re-rendering.
   */
  progress: SharedValue<number>;
  children: ReactNode;
}

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

/** Native-only pager (ViewPager2 / UIPageViewController). Web uses the .web stub. */
const NativePager = forwardRef<NativePagerHandle, Props>(function NativePager(
  { initialPage, onPageSelected, progress, children },
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
  // Reanimated's worklet handler stands in for the synthetic-event callback,
  // which the PagerView prop types don't model.
  const onPageScroll = useEvent<{ position: number; offset: number }>(
    (e) => {
      'worklet';
      progress.set(e.position + e.offset);
    },
    ['onPageScroll'],
  ) as unknown as ComponentProps<typeof PagerView>['onPageScroll'];
  return (
    <AnimatedPagerView
      ref={inner}
      style={styles.fill}
      initialPage={initialPage}
      onPageSelected={(e) => onPageSelected(e.nativeEvent.position)}
      onPageScroll={onPageScroll}
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
    </AnimatedPagerView>
  );
});

export default NativePager;

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
