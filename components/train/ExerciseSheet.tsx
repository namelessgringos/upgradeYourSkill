import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Button, IconButton, List, Text } from 'react-native-paper';
import { JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session/SessionProvider';
import { searchExercises } from '@/lib/session/store';
import type { Exercise } from '@/lib/session/types';

const WEIGHT_STEP = 2.5;
/** Slider ceiling. Above this the ± buttons still work, so it is not a cap. */
const WEIGHT_SLIDER_MAX = 200;
const SECTION_LIMIT = 5;
/** How long the tick stays up before the sheet zooms out. */
const SUCCESS_MS = 600;

/**
 * Heights are fixed at module scope, not derived from the mode.
 *
 * Deriving them changes snapPoints in the same render that opens the sheet,
 * which lets gorhom re-clamp the index back to closed, fire `onClose`, and
 * reset the mode — the sheet closing itself as part of opening.
 */
const SNAP_POINTS = ['92%'];

/**
 * `null` is closed. `picker` chooses what to do next; `active` is the working
 * set, which deliberately takes almost the whole screen — it is the only thing
 * being touched while a set is under way.
 */
export type SheetMode = null | 'picker' | 'active';

interface Props {
  mode: SheetMode;
  onModeChange: (mode: SheetMode) => void;
  /** Chosen an exercise from the picker — the parent ends any running rest. */
  onExerciseChosen: () => void;
}

export function ExerciseSheet({ mode, onModeChange, onExerciseChosen }: Props) {
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
    onExerciseChosen();

    const open = (last: { reps: number; weight: number } | null) => {
      if (selectedExerciseIdRef.current !== exercise.id) return;
      dispatch({
        type: 'selectExercise',
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        ...(last === null ? {} : { lastReps: last.reps, lastWeight: last.weight }),
      });
      onModeChange('active');
    };

    // Guarded against a slow store: picking A then B would otherwise revert to
    // A when A's lookup resolves last.
    store
      .lastPerformance(exercise.id)
      .then(open)
      .catch(() => open(null));
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

  const onFinishSet = () => {
    dispatch({ type: 'completeSet', now: Date.now() });
    setShowSuccess(true);
    successScale.setValue(0);
    Animated.timing(successScale, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    }).start();
    // Zoom out to the session behind, where rest is now running.
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
  // close(). Reporting a close we already know about could cancel an open
  // that has just begun.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const handleSheetClose = useCallback(() => {
    if (modeRef.current !== null) onModeChange(null);
  }, [onModeChange]);

  const setsForExercise =
    state.currentExerciseId === null
      ? []
      : state.sets.filter((set) => set.exerciseId === state.currentExerciseId);

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
      // v5 defaults this to true, which sizes the sheet to its content and
      // ignores snapPoints. A non-measuring child then yields a zero-height
      // sheet: it opens, and nothing is visible.
      enableDynamicSizing={false}
      animateOnMount={false}
      enablePanDownToClose
      onClose={handleSheetClose}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={styles.sheetBackground}
    >
      {mode === 'picker' ? (
        <BottomSheetScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>Next exercise</Text>
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
          <View style={styles.activeHeader}>
            <View style={styles.activeTitleBlock}>
              <Text style={styles.title}>{state.currentExerciseName ?? 'No exercise'}</Text>
              <Text style={styles.subtitle}>Set {setsForExercise.length + 1}</Text>
            </View>
            <Button mode="text" onPress={() => onModeChange('picker')}>
              Change
            </Button>
          </View>

          {setsForExercise.length > 0 && (
            <View style={styles.doneRow}>
              {setsForExercise.map((set, index) => (
                <View key={`${set.completedAt}-${index}`} style={styles.doneChip}>
                  <Text style={styles.doneChipText}>
                    {set.reps} × {set.weight}kg
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Reps</Text>
            <View style={styles.stepperRow}>
              <IconButton
                icon="minus"
                mode="outlined"
                size={26}
                onPress={() => dispatch({ type: 'setReps', reps: state.reps - 1 })}
              />
              <Text style={styles.bigValue}>{state.reps}</Text>
              <IconButton
                icon="plus"
                mode="outlined"
                size={26}
                onPress={() => dispatch({ type: 'setReps', reps: state.reps + 1 })}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Weight</Text>
            <View style={styles.stepperRow}>
              <IconButton
                icon="minus"
                mode="outlined"
                size={22}
                onPress={() =>
                  dispatch({ type: 'setWeight', weight: state.weight - WEIGHT_STEP })
                }
              />
              <Text style={styles.bigValue}>{state.weight}</Text>
              <Text style={styles.unit}>kg</Text>
              <IconButton
                icon="plus"
                mode="outlined"
                size={22}
                onPress={() =>
                  dispatch({ type: 'setWeight', weight: state.weight + WEIGHT_STEP })
                }
              />
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={WEIGHT_SLIDER_MAX}
              step={WEIGHT_STEP}
              value={Math.min(state.weight, WEIGHT_SLIDER_MAX)}
              // Android's slider drifts off the step by a float epsilon, which
              // shows up as 12.500000000000002 in a 46px number.
              onValueChange={(weight) =>
                dispatch({ type: 'setWeight', weight: Math.round(weight / WEIGHT_STEP) * WEIGHT_STEP })
              }
              minimumTrackTintColor={JournalColors.accent}
              maximumTrackTintColor={JournalColors.gridLine}
              thumbTintColor={JournalColors.accent}
            />
          </View>

          <View style={styles.spacer} />

          <Button
            mode="contained"
            disabled={!canLogSet || showSuccess}
            onPress={onFinishSet}
            style={styles.finishButton}
            contentStyle={styles.finishButtonContent}
          >
            Finish set
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

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: JournalColors.white },
  body: { flex: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: JournalColors.inkBlack },
  subtitle: { fontSize: 14, color: JournalColors.inkFaint, marginTop: 2 },
  activeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  activeTitleBlock: { flex: 1 },
  doneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  doneChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: JournalColors.paperBg,
    borderWidth: 1,
    borderColor: JournalColors.gridLine,
  },
  doneChipText: { fontSize: 14, fontWeight: '700', color: JournalColors.inkBrown },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: JournalColors.inkFaint },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  bigValue: {
    minWidth: 90,
    textAlign: 'center',
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 18, fontWeight: '700', color: JournalColors.inkFaint, marginLeft: -Spacing.sm },
  slider: { width: '100%', height: 40 },
  spacer: { flex: 1 },
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
  finishButton: { marginTop: Spacing.sm },
  finishButtonContent: { paddingVertical: Spacing.lg },
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
