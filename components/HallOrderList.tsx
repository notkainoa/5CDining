import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { HALL_BY_ID, type HallId } from '@/lib/diningHalls';

const ROW_H = 60;

interface RowHandlers {
  dy: Animated.Value;
  begin: (id: HallId) => void;
  move: (gestureDy: number) => void;
  end: () => void;
}

/**
 * Drag-to-reorder list with zero extra dependencies (plain PanResponder).
 *
 * Only the grip handle claims the touch, on touch-down before any scrolling
 * starts, so the parent ScrollView never competes for handle touches while
 * touches anywhere else still scroll normally. The handle sets
 * touch-action: none on web so the browser doesn't steal pointer moves.
 *
 * Rendered row positions NEVER move mid-gesture: reordering native views
 * inside the iOS pager page permanently blanks the page (no error, no
 * unmount — the native content is just gone). Instead, views stay put while
 * dragging: the dragged row follows the finger via an Animated translate,
 * displaced rows shift by static offsets, and position numbers track the live
 * logical order. The reorder commits to prefs on drop, when nothing is
 * mid-gesture — pager-level moves outside a drag are safe.
 */
export default function HallOrderList({
  order,
  onChange,
  onScrollLock,
  onEdgeScroll,
  scrollY,
  dark,
}: {
  order: HallId[];
  onChange: (order: HallId[]) => void;
  onScrollLock: (locked: boolean) => void;
  onEdgeScroll: (dir: -1 | 0 | 1) => void;
  scrollY: { current: number };
  dark?: boolean;
}) {
  const [dragId, setDragId] = useState<HallId | null>(null);
  const [dy] = useState(() => new Animated.Value(0));

  // Logical order (live during a drag, committed on drop). Rendered positions
  // come from `order`/`frozen` only — never from this mid-gesture.
  const [local, setLocal] = useState(order);
  // Rendered order, frozen at drag start so a concurrent prefs change can't
  // move views mid-gesture either. Null when idle (renders `order` directly).
  const [frozen, setFrozen] = useState<HallId[] | null>(null);
  const box = useRef({
    ids: order,
    startIds: order,
    dragId: null as HallId | null,
    baseTop: 0,
    shift: 0,
    grantScroll: 0,
    edge: 0 as -1 | 0 | 1,
  });
  const cbs = useRef({ onChange, onScrollLock, onEdgeScroll });
  useEffect(() => {
    cbs.current = { onChange, onScrollLock, onEdgeScroll };
  }, [onChange, onScrollLock, onEdgeScroll]);

  // Keep local state in sync when prefs load/arrive (but never mid-drag).
  useEffect(() => {
    if (box.current.dragId) return;
    if (box.current.ids.join(',') !== order.join(',')) {
      box.current.ids = [...order];
      setLocal([...order]);
    }
  }, [order]);

  const lock = (locked: boolean) => cbs.current.onScrollLock(locked);
  const edge = (dir: -1 | 0 | 1) => {
    if (box.current.edge !== dir) {
      box.current.edge = dir;
      cbs.current.onEdgeScroll(dir);
    }
  };

  const handlers = useMemo<RowHandlers>(
    () => ({
      dy,
      begin: (id) => {
        const ids = box.current.ids;
        const idx = ids.indexOf(id);
        if (idx < 0 || box.current.dragId) return;
        box.current.dragId = id;
        box.current.startIds = [...ids];
        box.current.baseTop = idx * ROW_H;
        box.current.shift = 0;
        box.current.grantScroll = scrollY.current;
        dy.setValue(0);
        setFrozen([...ids]);
        setDragId(id);
        lock(true);
      },
      move: (gestureDy) => {
        const id = box.current.dragId;
        if (!id || !Number.isFinite(gestureDy)) return;
        const ids = box.current.ids;
        const baseTop = box.current.baseTop;
        const dyEff = gestureDy + (scrollY.current - box.current.grantScroll);
        const listH = ids.length * ROW_H;
        const lower = -baseTop;
        const upper = listH - ROW_H - baseTop;
        const clamped = Math.min(Math.max(dyEff, lower), upper);
        const target = Math.round((baseTop + clamped) / ROW_H);
        const cur = ids.indexOf(id);
        if (target !== cur && target >= 0 && target < ids.length) {
          const next = [...ids];
          next.splice(cur, 1);
          next.splice(target, 0, id);
          box.current.shift += (target - cur) * ROW_H;
          box.current.ids = next;
          setLocal(next);
        }
        dy.setValue(clamped - box.current.shift);
        // Auto-scroll the parent only while pushing past a bound, not at rest.
        edge(clamped <= lower && dyEff < 0 ? -1 : clamped >= upper && dyEff > 0 ? 1 : 0);
      },
      end: () => {
        const ids = [...box.current.ids];
        const changed =
          box.current.dragId !== null && ids.join(',') !== box.current.startIds.join(',');
        box.current.dragId = null;
        box.current.shift = 0;
        setDragId(null);
        setFrozen(null);
        dy.setValue(0);
        edge(0);
        lock(false);
        // Skip no-op drops: every commit rebuilds the native pager children,
        // so only commit when the order actually changed.
        if (changed) cbs.current.onChange(ids);
      },
    }),
    [dy, scrollY],
  );

  const rendered = frozen ?? order;
  return (
    <View>
      {rendered.map((id) => {
        // Displacement in row units vs. the live logical order: rows the
        // dragged item passed shift aside to show where it will land. The
        // dragged row itself follows the finger via `dy`; every view keeps
        // its rendered slot the whole gesture.
        const renderedIdx = rendered.indexOf(id);
        const logicalIdx = local.indexOf(id);
        const disp = dragId && id !== dragId ? logicalIdx - renderedIdx : 0;
        return (
          <OrderRow
            key={id}
            id={id}
            rank={logicalIdx + 1}
            total={rendered.length}
            handlers={handlers}
            active={dragId === id}
            displacement={disp}
            dark={dark}
          />
        );
      })}
    </View>
  );
}

function OrderRow({
  id,
  rank,
  total,
  handlers,
  active,
  displacement,
  dark,
}: {
  id: HallId;
  rank: number;
  total: number;
  handlers: RowHandlers;
  active: boolean;
  displacement: number;
  dark?: boolean;
}) {
  const hall = HALL_BY_ID[id];
  // The grip alone is the drag responder, claimed on touch-down so the
  // parent ScrollView never gets a chance to steal the gesture.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => handlers.begin(id),
        onPanResponderMove: (_, g) => handlers.move(g.dy),
        onPanResponderRelease: () => handlers.end(),
        onPanResponderTerminate: () => handlers.end(),
        onPanResponderTerminationRequest: () => false,
      }),
    [handlers, id],
  );

  return (
    <Animated.View
      accessibilityLabel={`${hall.name}, ${rank} of ${total}`}
      style={[
        styles.row,
        Platform.OS === 'web' ? (styles.rowWeb as object) : null,
        active && styles.rowActive,
        active
          ? { transform: [{ translateY: handlers.dy }] }
          : displacement !== 0
            ? { transform: [{ translateY: displacement * ROW_H }] }
            : null,
      ]}
    >
      <View
        {...pan.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={`Drag ${hall.name} to reorder`}
        accessibilityHint="Touch and hold, then drag up or down"
        style={[styles.handle, Platform.OS === 'web' ? (styles.handleWeb as object) : null]}
      >
        <Text style={styles.grip}>≡</Text>
      </View>
      <View style={[styles.dot, { backgroundColor: hall.color }]}>
        <Text style={[styles.abbr, { color: hall.onColor }]}>{hall.abbr}</Text>
      </View>
      <View style={styles.texts}>
        <Text style={[styles.name, { color: dark ? '#fff' : '#111' }]}>
          {rank}. {hall.name}
        </Text>
        <Text style={[styles.college, { color: dark ? '#AEAEB2' : '#666' }]}>{hall.college}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  rowActive: {
    zIndex: 2,
    opacity: 0.92,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abbr: { color: '#fff', fontSize: 14, fontWeight: '800' },
  texts: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  college: { fontSize: 12 },
  handle: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { fontSize: 24, color: '#8E8E93', fontWeight: '700' },
  // Web-only: keep the browser from hijacking grip touches for scrolling or
  // text selection, so PanResponder sees every pointer move. Cast at use-site
  // since these CSS props aren't in RN's types.
  rowWeb: {
    userSelect: 'none',
  } as object,
  handleWeb: {
    touchAction: 'none',
    userSelect: 'none',
    cursor: 'grab',
  } as object,
});
