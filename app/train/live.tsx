import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { Screen } from '@/components/ui/Screen';
import { ExerciseCard } from '@/components/train/ExerciseCard';
import { IntervalClock } from '@/components/train/IntervalClock';
import { RestStopwatch } from '@/components/train/RestStopwatch';
import { SessionHeader } from '@/components/train/SessionHeader';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session/SessionProvider';
import { useSessionClock } from '@/lib/session/useSessionClock';

export default function TrainLive() {
  useKeepAwake();
  const { state, dispatch } = useSession();
  // The single clock for this whole screen — every derived value below reads
  // from this `now`, never from its own timer.
  const now = useSessionClock(state.timer.status === 'running');

  const onFinish = () => {
    dispatch({ type: 'finish', now: Date.now() });
    router.replace('/train/summary');
  };

  return (
    <Screen scroll contentStyle={styles.container}>
      <SessionHeader now={now} />

      {state.style === 'gym' ? (
        <>
          <ExerciseCard />
          <RestStopwatch now={now} />
        </>
      ) : (
        <IntervalClock now={now} />
      )}

      <Button mode="contained" onPress={onFinish} style={styles.finish}>
        Finish
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  finish: { marginTop: Spacing.xs },
});
