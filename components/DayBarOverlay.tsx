import { Animated, StyleSheet } from 'react-native';
import DayStrip from '@/components/DayStrip';
import { useDay } from '@/lib/day';

/**
 * Floating day bar: absolutely positioned over the pager (no layout space),
 * so search/settings pages are full-screen while hall pages pad for it
 * (see HallScreen). The parent drives `translateX` from the pager's scroll
 * offset, gluing the bar to the hall page: fixed between halls, sliding away
 * with the hall toward search/settings.
 */
export default function DayBarOverlay({ translateX }: { translateX: Animated.Value }) {
  const { setStripHeight } = useDay();
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.overlay, { transform: [{ translateX }] }]}
      onLayout={(e) => setStripHeight(e.nativeEvent.layout.height)}
    >
      <DayStrip />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
});
