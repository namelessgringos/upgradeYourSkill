import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { Screen } from '@/components/ui/Screen';
import { ExerciseSheet, type SheetMode } from '@/components/train/ExerciseSheet';
import { IntervalClock } from '@/components/train/IntervalClock';
import { RestStopwatch } from '@/components/train/RestStopwatch';
import { SessionHeader } from '@/components/train/SessionHeader';
import { SessionLog } from '@/components/train/SessionLog';
import { JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session/SessionProvider';
import { useSessionClock } from '@/lib/session/useSessionClock';

export default function TrainLive() {
  useKeepAwake();
  const { state, dispatch } = useSession();
  // The single clock for this whole screen — every derived value below reads
  // from this `now`, never from its own timer.
  const now = useSessionClock(state.timer.status === 'running');
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);

  /**
   * "Stop resting" offers the next exercise. Dismissing that offer means the
   * rest was not actually over, so it keeps running — but the offer is not
   * made again for THIS rest. Nagging someone who already said no is worse
   * than making them tap twice.
   *
   * Scoped to the current rest, not the session: a permanent opt-out would
   * silently remove the feature for the rest of the workout.
   */
  const [offerDeclined, setOfferDeclined] = useState(false);
  const previousRestRef = useRef(state.restStartedAt);
  useEffect(() => {
    if (state.restStartedAt !== previousRestRef.current) {
      previousRestRef.current = state.restStartedAt;
      if (state.restStartedAt !== null) setOfferDeclined(false);
    }
  }, [state.restStartedAt]);

  const onFinish = () => {
    dispatch({ type: 'finish', now: Date.now() });
    router.replace('/train/summary');
  };

  const onStopRest = () => {
    if (offerDeclined) {
      dispatch({ type: 'stopRest' });
      return;
    }
    // Rest deliberately keeps running until an exercise is actually chosen.
    setSheetMode('picker');
  };

  const onSheetModeChange = (next: SheetMode) => {
    // Closing the picker while a rest is still running is the decline.
    if (next === null && sheetMode === 'picker' && state.restStartedAt !== null) {
      setOfferDeclined(true);
    }
    setSheetMode(next);
  };

  /**
   * Reopening an exercise already in the log prefills from the last set of it
   * *in this session*, which is what the coach just did — not from the
   * cross-session history the picker consults for a first pick.
   */
  const onOpenExercise = (exerciseId: string, exerciseName: string) => {
    const previous = [...state.sets].reverse().find((set) => set.exerciseId === exerciseId);
    dispatch({ type: 'stopRest' });
    dispatch({
      type: 'selectExercise',
      exerciseId,
      exerciseName,
      ...(previous === undefined
        ? {}
        : { lastReps: previous.reps, lastWeight: previous.weight }),
    });
    setSheetMode('active');
  };

  return (
    <View style={styles.root}>
      <Screen scroll contentStyle={styles.container}>
        <SessionHeader now={now} />

        {state.style === 'gym' ? (
          <>
            <SessionLog
              onOpenExercise={onOpenExercise}
              onAddExercise={() => setSheetMode('picker')}
            />
            <RestStopwatch now={now} onStopRest={onStopRest} />
          </>
        ) : (
          <IntervalClock now={now} />
        )}

        <Button mode="contained" onPress={onFinish} style={styles.finish}>
          Finish
        </Button>
      </Screen>

      {state.style === 'gym' && (
        <ExerciseSheet
          mode={sheetMode}
          onModeChange={onSheetModeChange}
          onExerciseChosen={() => dispatch({ type: 'stopRest' })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalColors.paperBg },
  container: { paddingTop: Spacing.md, gap: Spacing.md, paddingBottom: 120 },
  finish: { marginTop: Spacing.xs },
});
