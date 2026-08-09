import { StyleSheet, View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import { JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session/SessionProvider';
import { formatElapsed, restElapsedMs } from '@/lib/session/timer';

/**
 * Rest counts up from `state.restStartedAt` using the shared clock — never its
 * own interval. `restStartedAt` is a session-elapsed offset, not an epoch
 * timestamp, so a pause mid-rest is excluded from what is shown and from what
 * is recorded.
 *
 * Rest starts on its own when a set is completed, so this component's job is to
 * show it and to offer the way out. Before, the only exit from a running rest
 * was completing another set — a dead end if you simply wanted to stop.
 *
 * "Stop resting" does not stop anything here. It reports the intent upwards,
 * because ending a rest and choosing what to do next are the same moment for
 * the person holding the phone — see `onStopRest` in `live.tsx`.
 */
export function RestStopwatch({ now, onStopRest }: { now: number; onStopRest: () => void }) {
  const { state, dispatch } = useSession();

  const restStartedAt = state.restStartedAt;
  const running = state.timer.status === 'running';

  if (restStartedAt === null) {
    return (
      <Surface style={styles.card} elevation={1}>
        <View style={styles.row}>
          <Text style={styles.idleLabel}>Rest</Text>
          <Button
            mode="outlined"
            disabled={!running}
            onPress={() => dispatch({ type: 'startRest', now: Date.now() })}
          >
            Start rest
          </Button>
        </View>
      </Surface>
    );
  }

  return (
    <Surface style={[styles.card, styles.resting]} elevation={1}>
      <Text style={styles.restingLabel}>RESTING</Text>
      <Text style={styles.value}>
        {formatElapsed(restElapsedMs(state.timer, restStartedAt, now))}
      </Text>
      <Button
        mode="contained"
        onPress={onStopRest}
        style={styles.stopButton}
        contentStyle={styles.stopButtonContent}
      >
        Stop resting
      </Button>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idleLabel: { fontSize: 15, fontWeight: '600', color: JournalColors.inkFaint },
  resting: { alignItems: 'center', gap: Spacing.sm },
  restingLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, color: JournalColors.accent },
  value: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontVariant: ['tabular-nums'],
  },
  stopButton: { alignSelf: 'stretch' },
  stopButtonContent: { paddingVertical: Spacing.md },
});
