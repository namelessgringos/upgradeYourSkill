import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Button, IconButton, List, Text } from 'react-native-paper';
import { JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session/SessionProvider';
import { searchExercises } from '@/lib/session/store';
import type { Exercise } from '@/lib/session/types';

const WEIGHT_STEP = 2.5;
const SECTION_LIMIT = 5;
/** How long the tick stays up before the sheet closes itself. */
const SUCCESS_MS = 700;
/**
 * One height for both modes, defined once at module scope.
 *
 * Not derived from `mode`: changing snapPoints in the same render that opens
 * the sheet lets gorhom re-clamp the index back to closed, which fires
 * `onClose`, which resets the mode — and the sheet never appears.
 */
const SNAP_POINTS = ['75%'];

/**
 * `null` is closed. `picker` opens on the exercise list; `config` opens
 * straight on the steppers for an exercise already chosen.
 */
export type SheetMode = null | 'picker' | 'config';

interface Props {
  mode: SheetMode;
  onModeChange: (mode: SheetMode) => void;
}

/**
 * The only place a set is logged. Everything that used to sit permanently on
 * the live screen — picker, reps, weight, Complete set — lives in here, so the
 * screen behind it stays the session record rather than a control panel.
 */
export function ExerciseSheet({ mode, onModeChange }: Props) {
  const { state, dispatch, store } = useSession();
  const sheetRef = useRef<BottomSheet>(null);

  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedExerciseIdRef = useRef<string | null>(null);
  const successScale = useRef(new Animated.Value(0)).current;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drive the sheet from the mode prop so the parent stays the single source
  // of truth — the sheet's own gestures report back through onClose.
  useEffect(() => {
    if (mode === null) sheetRef.current?.close();
    else sheetRef.current?.expand();
  }, [mode]);

  useEffect(() => {
    if (mode !== 'picker') return;
    let cancelled = false;

    store
      .listExercises()
      .then((list) => !cancelled && setExercises(list))
      .catch(() => !cancelled && setExercises([]));
    store
      .recentExercises(SECTION_LIMIT)
      .then((list) => !cancelled && setRecentIds(list.map((e) => e.id)))
      .catch(() => !cancelled && setRecentIds([]));
    store
      .favouriteExercises(SECTION_LIMIT)
      .then((list) => !cancelled && setFavouriteIds(list.map((e) => e.id)))
      .catch(() => !cancelled && setFavouriteIds([]));

    return () => {
      cancelled = true;
    };
  }, [mode, store]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    [],
  );

  const filtered = searchExercises(exercises, query);
  const byId = (id: string) => filtered.find((exercise) => exercise.id === id);
  const favourites = favouriteIds.map(byId).filter((e): e is Exercise => e !== undefined);
  const recents = recentIds
    .map(byId)
    .filter((e): e is Exercise => e !== undefined)
    .filter((e) => !favouriteIds.includes(e.id));
  const shownIds = new Set([...favourites, ...recents].map((e) => e.id));
  const rest = filtered.filter((e) => !shownIds.has(e.id));

  const select = (exercise: Exercise) => {
    setQuery('');
    setCustomName('');
    selectedExerciseIdRef.current = exercise.id;
    // Guarded against a slow store returning after a newer pick — without the
    // ref check, picking A then B silently reverts to A when A resolves last.
    store
      .lastPerformance(exercise.id)
      .then((last) => {
        if (selectedExerciseIdRef.current !== exercise.id) return;
        dispatch({
          type: 'selectExercise',
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          ...(last === null ? {} : { lastReps: last.reps, lastWeight: last.weight }),
        });
        onModeChange('config');
      })
      .catch(() => {
        if (selectedExerciseIdRef.current !== exercise.id) return;
        dispatch({ type: 'selectExercise', exerciseId: exercise.id, exerciseName: exercise.name });
        onModeChange('config');
      });
  };

  const addCustom = () => {
    const name = customName.trim();
    if (name === '') return;
    store
      .addExercise(name, [])
      .then((exercise) => {
        setExercises((current) => [...current, exercise]);
        select(exercise);
      })
      .catch(() => {
        // Leave the typed name in place so it can be retried.
      });
  };

  const onCompleteSet = () => {
    dispatch({ type: 'completeSet', now: Date.now() });
    setShowSuccess(true);
    successScale.setValue(0);
    Animated.timing(successScale, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    }).start();
    closeTimer.current = setTimeout(() => {
      setShowSuccess(false);
      onModeChange(null);
    }, SUCCESS_MS);
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  // gorhom fires onClose for its own dismissals AND for our programmatic
  // close(). Reporting a close we already know about would set the mode to a
  // value it already holds; worse, a late-arriving one could cancel an open
  // that has just begun.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const handleSheetClose = useCallback(() => {
    if (modeRef.current !== null) onModeChange(null);
  }, [onModeChange]);

  const completedForExercise =
    state.currentExerciseId === null
      ? 0
      : state.sets.filter((set) => set.exerciseId === state.currentExerciseId).length;

  const canLogSet = state.currentExerciseId !== null && state.timer.status === 'running';

  const renderSection = (title: string, items: Exercise[]) =>
    items.length === 0 ? null : (
      <List.Section key={title}>
        <List.Subheader>{title}</List.Subheader>
        {items.map((exercise) => (
          <List.Item
            key={exercise.id}
            title={exercise.name}
            description={exercise.muscleGroups.join(', ')}
            onPress={() => select(exercise)}
          />
        ))}
      </List.Section>
    );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      // v5 defaults this to true, which makes the sheet size to its content
      // and quietly ignore snapPoints. A non-measuring child then yields a
      // zero-height sheet: it opens, and nothing is visible.
      enableDynamicSizing={false}
      animateOnMount={false}
      enablePanDownToClose
      onClose={handleSheetClose}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={styles.sheetBackground}
    >
      {mode === 'picker' ? (
        <BottomSheetScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>Choose an exercise</Text>
          <BottomSheetTextInput
            placeholder="Search"
            placeholderTextColor={JournalColors.inkFaint}
            value={query}
            onChangeText={setQuery}
            style={styles.input}
          />
          {renderSection('Favourites', favourites)}
          {renderSection('Recent', recents)}
          {renderSection('All', rest)}
          <View style={styles.addRow}>
            <BottomSheetTextInput
              placeholder="Add custom exercise"
              placeholderTextColor={JournalColors.inkFaint}
              value={customName}
              onChangeText={setCustomName}
              style={[styles.input, styles.addInput]}
            />
            <Button mode="contained" onPress={addCustom} disabled={customName.trim() === ''}>
              Add
            </Button>
          </View>
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={styles.body}>
          <View style={styles.configHeader}>
            <View style={styles.configTitleBlock}>
              <Text style={styles.title}>{state.currentExerciseName ?? 'No exercise'}</Text>
              <Text style={styles.subtitle}>Set {completedForExercise + 1}</Text>
            </View>
            <Button mode="text" onPress={() => onModeChange('picker')}>
              Change
            </Button>
          </View>

          <Stepper
            label="Reps"
            value={state.reps}
            onDecrement={() => dispatch({ type: 'setReps', reps: state.reps - 1 })}
            onIncrement={() => dispatch({ type: 'setReps', reps: state.reps + 1 })}
          />
          <Stepper
            label="Weight (kg)"
            value={state.weight}
            onDecrement={() => dispatch({ type: 'setWeight', weight: state.weight - WEIGHT_STEP })}
            onIncrement={() => dispatch({ type: 'setWeight', weight: state.weight + WEIGHT_STEP })}
          />

          <Button
            mode="contained"
            disabled={!canLogSet || showSuccess}
            onPress={onCompleteSet}
            style={styles.completeButton}
            contentStyle={styles.completeButtonContent}
          >
            Complete set
          </Button>

          {showSuccess && (
            <View style={styles.successOverlay} pointerEvents="none">
              <Animated.View style={[styles.successBadge, { transform: [{ scale: successScale }] }]}>
                <IconButton icon="check" size={44} iconColor={JournalColors.white} />
              </Animated.View>
              <Text style={styles.successText}>
                {state.reps} × {state.weight}kg logged
              </Text>
            </View>
          )}
        </BottomSheetView>
      )}
    </BottomSheet>
  );
}

function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <IconButton icon="minus" mode="outlined" size={22} onPress={onDecrement} />
      <Text style={styles.stepperValue}>{value}</Text>
      <IconButton icon="plus" mode="outlined" size={22} onPress={onIncrement} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: JournalColors.white },
  body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.md },
  title: { fontSize: 19, fontWeight: '800', color: JournalColors.inkBlack },
  subtitle: { fontSize: 13, color: JournalColors.inkFaint, marginTop: 2 },
  configHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  configTitleBlock: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: JournalColors.gridLine,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: JournalColors.inkBlack,
    backgroundColor: JournalColors.paperBg,
  },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  addInput: { flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepperLabel: { flex: 1, fontSize: 15, color: JournalColors.inkFaint, fontWeight: '600' },
  stepperValue: {
    minWidth: 64,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontVariant: ['tabular-nums'],
  },
  completeButton: { marginTop: Spacing.sm },
  completeButtonContent: { paddingVertical: Spacing.md },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: JournalColors.white,
    gap: Spacing.md,
  },
  successBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: JournalColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: { fontSize: 17, fontWeight: '700', color: JournalColors.inkBrown },
});
