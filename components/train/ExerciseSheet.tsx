import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, List, Portal, Text } from 'react-native-paper';
import { JournalColors, Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { formatSetReps } from '@/lib/session/selectors';
import { useSession } from '@/lib/session/SessionProvider';
import { searchExercises } from '@/lib/session/store';
import { elapsedMs, formatElapsed, restElapsedMs } from '@/lib/session/timer';
import type { Exercise } from '@/lib/session/types';

const WEIGHT_STEP = 2.5;
/** Slider ceiling. The ± buttons still go past it, so it is not a cap. */
const WEIGHT_SLIDER_MAX = 200;
const SECTION_LIMIT = 5;
/** Reps planned for a fresh exercise, before any history says otherwise. */
const DEFAULT_REP_TARGET = 3;
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
  /** The screen's single clock, so the relax timer starts no interval of its own. */
  now: number;
}

export function ExerciseSheet({ mode, onModeChange, onExerciseChosen, now }: Props) {
  const { state, dispatch, store } = useSession();
  const sheetRef = useRef<BottomSheet>(null);

  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [repTarget, setRepTarget] = useState(DEFAULT_REP_TARGET);
  const [askFinish, setAskFinish] = useState(false);
  /** Index of the logged rep being edited, or null. */
  const [editingRep, setEditingRep] = useState<number | null>(null);
  /**
   * Session-elapsed ms at which the current rep began — the same offset
   * timeline `restStartedAt` uses, so a pause mid-rep is excluded from the
   * duration for free. Null while resting between reps.
   */
  const [repStartedAt, setRepStartedAt] = useState<number | null>(null);

  const selectedExerciseIdRef = useRef<string | null>(null);
  const successScale = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mode === null) sheetRef.current?.close();
    else sheetRef.current?.expand();
  }, [mode]);

  /**
   * Every opening of the working sheet is a fresh set: no reps done yet, and
   * a target seeded from the last time this exercise was performed in this
   * session. Keyed on the mode rather than the exercise id so reopening the
   * same exercise starts a new set instead of resuming the last one.
   */
  const setsRef = useRef(state.sets);
  setsRef.current = state.sets;
  const currentIdRef = useRef(state.currentExerciseId);
  currentIdRef.current = state.currentExerciseId;
  const timerRef = useRef(state.timer);
  timerRef.current = state.timer;
  useEffect(() => {
    if (mode !== 'active') return;
    checkScale.setValue(0);
    const previous = [...setsRef.current]
      .reverse()
      .find((set) => set.exerciseId === currentIdRef.current);
    setRepTarget(previous?.reps.length ?? DEFAULT_REP_TARGET);
    // The first rep is under way the moment the sheet is up.
    setRepStartedAt(elapsedMs(timerRef.current, Date.now()));
  }, [mode, checkScale]);

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
        ...(last === null ? {} : { lastWeight: last.weight }),
      });
      if (last !== null) setRepTarget(last.reps);
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

  const onFinishRep = () => {
    const now_ = Date.now();
    const elapsed = elapsedMs(state.timer, now_);
    dispatch({
      type: 'logRep',
      weight: state.weight,
      durationMs: repStartedAt === null ? 0 : Math.max(0, elapsed - repStartedAt),
    });
    // The rep is over, so rest is running and no rep is under way.
    setRepStartedAt(null);
    dispatch({ type: 'startRest', now: now_ });

    const done = state.repEntries.length + 1;
    if (done < repTarget) {
      haptics.tap();
      return;
    }
    // The planned reps are done: a stronger confirmation, and a decision.
    haptics.success();
    checkScale.setValue(0);
    Animated.timing(checkScale, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    }).start();
    setAskFinish(true);
  };

  const onAddOneRep = () => {
    setAskFinish(false);
    setRepTarget((target) => target + 1);
  };

  /** Rest is over: the next rep starts counting from now. */
  const onStopRelax = () => {
    dispatch({ type: 'stopRest' });
    setRepStartedAt(elapsedMs(state.timer, Date.now()));
  };

  const onFinishSet = () => {
    setAskFinish(false);
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

  const repsDone = state.repEntries.length;
  const repsComplete = repsDone >= repTarget;
  const resting = state.restStartedAt !== null;
  const canLog = state.currentExerciseId !== null && state.timer.status === 'running';

  /**
   * The rep currently being performed: the next empty marker, but only while
   * one is genuinely under way. Resting, paused or finished, nothing pulses —
   * a marker that keeps breathing while the session is paused says the wrong
   * thing.
   */
  const repSlotCount = Math.max(repTarget, repsDone);
  const activeRepIndex =
    mode === 'active' && canLog && !resting && repsDone < repSlotCount ? repsDone : -1;

  useEffect(() => {
    if (activeRepIndex === -1) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [activeRepIndex, pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

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
    <>
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
              <Text style={styles.title}>{state.currentExerciseName ?? 'No exercise'}</Text>
              <Button mode="text" onPress={() => onModeChange(null)}>
                Close
              </Button>
            </View>

            {setsForExercise.length > 0 && (
              <View style={styles.doneRow}>
                {setsForExercise.map((set, index) => (
                  <View key={`${set.completedAt}-${index}`} style={styles.doneChip}>
                    <Text style={styles.doneChipText}>{formatSetReps(set)}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.field}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>Reps</Text>
                <View style={styles.targetStepper}>
                  <IconButton
                    icon="minus"
                    mode="outlined"
                    size={14}
                    onPress={() => setRepTarget((target) => Math.max(1, target - 1))}
                  />
                  <Text style={styles.targetValue}>{repTarget}</Text>
                  <IconButton
                    icon="plus"
                    mode="outlined"
                    size={14}
                    onPress={() => setRepTarget((target) => target + 1)}
                  />
                </View>
              </View>
              <View style={styles.repRow}>
                {Array.from({ length: repSlotCount }, (_, index) => {
                  const entry = state.repEntries[index];
                  const done = entry !== undefined;
                  const active = index === activeRepIndex;
                  return (
                    <Pressable
                      key={index}
                      disabled={!done}
                      onPress={() => setEditingRep(index)}
                      style={({ pressed }) => [styles.repSlot, pressed && styles.repDotPressed]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        done
                          ? `Rep ${index + 1}, ${entry.weight}kg. Edit.`
                          : active
                            ? `Rep ${index + 1}, in progress`
                            : `Rep ${index + 1}`
                      }
                    >
                      {active && (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.repHalo,
                            { opacity: haloOpacity, transform: [{ scale: haloScale }] },
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.repDot,
                          done && styles.repDotDone,
                          active && styles.repDotActive,
                        ]}
                      >
                        <Text style={[styles.repDotText, done && styles.repDotTextDone]}>
                          {index + 1}
                        </Text>
                        {done && <Text style={styles.repDotWeight}>{entry.weight}</Text>}
                      </View>
                    </Pressable>
                  );
                })}
                {repsComplete && (
                  <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                    <IconButton
                      icon="check-circle"
                      size={30}
                      iconColor={JournalColors.selectedBorder}
                      style={styles.repCheck}
                    />
                  </Animated.View>
                )}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Weight</Text>
              <View style={styles.stepperRow}>
                <IconButton
                  icon="minus"
                  mode="outlined"
                  size={22}
                  onPress={() => dispatch({ type: 'setWeight', weight: state.weight - WEIGHT_STEP })}
                />
                <Text style={styles.bigValue}>{state.weight}</Text>
                <Text style={styles.unit}>kg</Text>
                <IconButton
                  icon="plus"
                  mode="outlined"
                  size={22}
                  onPress={() => dispatch({ type: 'setWeight', weight: state.weight + WEIGHT_STEP })}
                />
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={WEIGHT_SLIDER_MAX}
                step={WEIGHT_STEP}
                value={Math.min(state.weight, WEIGHT_SLIDER_MAX)}
                // Android's slider drifts off the step by a float epsilon,
                // which reads as 12.500000000000002 in a 46px number.
                onValueChange={(weight) =>
                  dispatch({
                    type: 'setWeight',
                    weight: Math.round(weight / WEIGHT_STEP) * WEIGHT_STEP,
                  })
                }
                minimumTrackTintColor={JournalColors.accent}
                maximumTrackTintColor={JournalColors.gridLine}
                thumbTintColor={JournalColors.accent}
              />
            </View>

            {resting && state.restStartedAt !== null ? (
              <View style={[styles.timerRow, styles.relaxRow]}>
                <Text style={styles.relaxLabel}>RELAX</Text>
                <Text style={styles.timerValue}>
                  {formatElapsed(restElapsedMs(state.timer, state.restStartedAt, now))}
                </Text>
              </View>
            ) : (
              <View style={styles.timerRow}>
                <Text style={styles.repTimerLabel}>REP {repsDone + 1}</Text>
                <Text style={styles.timerValue}>
                  {formatElapsed(
                    repStartedAt === null
                      ? 0
                      : restElapsedMs(state.timer, repStartedAt, now),
                  )}
                </Text>
              </View>
            )}

            <View style={styles.spacer} />

            {/* One primary action at a time. While resting the only honest
                next moves are ending the rest or ending the set — a live
                "Finish rep" would log a rep whose duration is really rest. */}
            {resting ? (
              <Button
                mode="contained"
                onPress={onStopRelax}
                style={styles.repButton}
                contentStyle={styles.repButtonContent}
              >
                Stop relax
              </Button>
            ) : (
              <Button
                mode="contained"
                disabled={!canLog || repsComplete || showSuccess}
                onPress={onFinishRep}
                style={styles.repButton}
                contentStyle={styles.repButtonContent}
              >
                Finish rep
              </Button>
            )}
            <Button
              mode="contained-tonal"
              disabled={!canLog || repsDone === 0 || showSuccess}
              onPress={onFinishSet}
              contentStyle={styles.finishButtonContent}
            >
              Finish set
            </Button>

            {showSuccess && (
              <View style={styles.successOverlay} pointerEvents="none">
                <Animated.View
                  style={[styles.successBadge, { transform: [{ scale: successScale }] }]}
                >
                  <IconButton icon="check" size={44} iconColor={JournalColors.white} />
                </Animated.View>
                <Text style={styles.successText}>{repsDone} reps logged</Text>
              </View>
            )}
          </BottomSheetView>
        )}
      </BottomSheet>

      <Portal>
        <Dialog visible={askFinish} onDismiss={() => setAskFinish(false)}>
          <Dialog.Title>{repsDone} reps done</Dialog.Title>
          <Dialog.Content>
            <Text>That is every rep you planned. Finish the set, or push one more?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={onAddOneRep}>Add one rep</Button>
            <Button mode="contained" onPress={onFinishSet}>
              Finish set
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={editingRep !== null} onDismiss={() => setEditingRep(null)}>
          <Dialog.Title>Rep {(editingRep ?? 0) + 1}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.stepperRow}>
              <IconButton
                icon="minus"
                mode="outlined"
                size={20}
                onPress={() =>
                  editingRep !== null &&
                  dispatch({
                    type: 'setRepWeight',
                    index: editingRep,
                    weight: (state.repEntries[editingRep]?.weight ?? 0) - WEIGHT_STEP,
                  })
                }
              />
              <Text style={styles.editWeight}>
                {editingRep === null ? 0 : (state.repEntries[editingRep]?.weight ?? 0)}
              </Text>
              <Text style={styles.unit}>kg</Text>
              <IconButton
                icon="plus"
                mode="outlined"
                size={20}
                onPress={() =>
                  editingRep !== null &&
                  dispatch({
                    type: 'setRepWeight',
                    index: editingRep,
                    weight: (state.repEntries[editingRep]?.weight ?? 0) + WEIGHT_STEP,
                  })
                }
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              textColor={JournalColors.accent}
              onPress={() => {
                if (editingRep !== null) dispatch({ type: 'removeRep', index: editingRep });
                setEditingRep(null);
              }}
            >
              Delete rep
            </Button>
            <Button mode="contained" onPress={() => setEditingRep(null)}>
              Done
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: JournalColors.white },
  body: { flex: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: JournalColors.inkBlack, flex: 1 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: JournalColors.inkFaint },
  targetStepper: { flexDirection: 'row', alignItems: 'center' },
  targetValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: JournalColors.inkBrown,
  },
  repRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  repSlot: { alignItems: 'center', justifyContent: 'center' },
  repDot: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: JournalColors.gridLine,
    backgroundColor: JournalColors.white,
  },
  repDotActive: { borderWidth: 2, borderColor: JournalColors.accent },
  /**
   * The pulse rides behind the marker rather than resizing it, so the row
   * never reflows while a rep is under way.
   */
  repHalo: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: JournalColors.accent,
  },
  repDotDone: {
    backgroundColor: JournalColors.selected,
    borderColor: JournalColors.selectedBorder,
  },
  repDotPressed: { opacity: 0.6 },
  repDotText: { fontSize: 15, fontWeight: '800', color: JournalColors.inkBlack },
  repDotTextDone: { color: JournalColors.selectedBorder },
  repDotWeight: { fontSize: 10, fontWeight: '700', color: JournalColors.selectedBorder },
  repCheck: { margin: 0 },
  editWeight: {
    minWidth: 80,
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontVariant: ['tabular-nums'],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
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
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    backgroundColor: JournalColors.paperBg,
  },
  relaxRow: { backgroundColor: JournalColors.selected },
  relaxLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: JournalColors.accent },
  repTimerLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: JournalColors.inkFaint,
  },
  timerValue: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontVariant: ['tabular-nums'],
  },
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
  repButton: { marginTop: Spacing.sm },
  repButtonContent: { paddingVertical: Spacing.lg },
  // Half the working button's height: it ends the exercise, which happens once
  // per exercise rather than once per rep.
  finishButtonContent: { paddingVertical: Spacing.xs },
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
