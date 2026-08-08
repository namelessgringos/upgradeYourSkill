import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Surface, Text } from 'react-native-paper';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session/SessionProvider';
import type { Exercise } from '@/lib/session/types';
import { ExercisePicker } from './ExercisePicker';

const WEIGHT_STEP = 2.5;

/**
 * Gym-mode logging surface: current exercise, set counter, reps/weight
 * steppers, and the two actions that move a session forward.
 */
export function ExerciseCard() {
  const { state, dispatch, store } = useSession();
  const [pickerVisible, setPickerVisible] = useState(false);
  const selectedExerciseIdRef = useRef<string | null>(null);

  const completedForExercise =
    state.currentExerciseId === null
      ? 0
      : state.sets.filter((set) => set.exerciseId === state.currentExerciseId).length;

  const handleSelect = (exercise: Exercise) => {
    setPickerVisible(false);
    selectedExerciseIdRef.current = exercise.id;
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
      })
      .catch(() => {
        if (selectedExerciseIdRef.current !== exercise.id) return;
        // No remembered numbers — still select the exercise.
        dispatch({ type: 'selectExercise', exerciseId: exercise.id, exerciseName: exercise.name });
      });
  };

  const canLogSet = state.currentExerciseId !== null && state.timer.status === 'running';

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text variant="titleMedium" style={styles.exerciseName}>
            {state.currentExerciseName ?? 'No exercise selected'}
          </Text>
          {state.currentExerciseId !== null && (
            <Text variant="bodySmall" style={styles.setCounter}>
              Set {completedForExercise + 1}
            </Text>
          )}
        </View>
        <Button mode="outlined" onPress={() => setPickerVisible(true)}>
          Next exercise
        </Button>
      </View>

      <View style={styles.stepperRow}>
        <Text variant="labelLarge" style={styles.stepperLabel}>
          Reps
        </Text>
        <IconButton
          icon="minus"
          mode="outlined"
          onPress={() => dispatch({ type: 'setReps', reps: state.reps - 1 })}
        />
        <Text variant="headlineSmall" style={styles.stepperValue}>
          {state.reps}
        </Text>
        <IconButton
          icon="plus"
          mode="outlined"
          onPress={() => dispatch({ type: 'setReps', reps: state.reps + 1 })}
        />
      </View>

      <View style={styles.stepperRow}>
        <Text variant="labelLarge" style={styles.stepperLabel}>
          Weight (kg)
        </Text>
        <IconButton
          icon="minus"
          mode="outlined"
          onPress={() => dispatch({ type: 'setWeight', weight: state.weight - WEIGHT_STEP })}
        />
        <Text variant="headlineSmall" style={styles.stepperValue}>
          {state.weight}
        </Text>
        <IconButton
          icon="plus"
          mode="outlined"
          onPress={() => dispatch({ type: 'setWeight', weight: state.weight + WEIGHT_STEP })}
        />
      </View>

      <Button
        mode="contained"
        disabled={!canLogSet}
        onPress={() => dispatch({ type: 'completeSet', now: Date.now() })}
        style={styles.completeButton}
      >
        Complete set
      </Button>

      <ExercisePicker
        visible={pickerVisible}
        onDismiss={() => setPickerVisible(false)}
        onSelect={handleSelect}
        store={store}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.lg, gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  titleBlock: { flex: 1 },
  exerciseName: { fontWeight: '800' },
  setCounter: { opacity: 0.7, marginTop: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepperLabel: { flex: 1, opacity: 0.7 },
  stepperValue: { minWidth: 48, textAlign: 'center' },
  completeButton: { marginTop: Spacing.xs },
});
