import { StyleSheet, View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session/SessionProvider';
import { formatElapsed } from '@/lib/session/timer';

/**
 * Counts up from `state.restStartedAt` using the shared clock — never its
 * own interval. It clears itself the moment `completeSet` fires, because the
 * reducer resets `restStartedAt` to null on that action.
 */
export function RestStopwatch({ now }: { now: number }) {
  const { state, dispatch } = useSession();

  const restStartedAt = state.restStartedAt;
  const resting = restStartedAt !== null;
  const canStart = state.timer.status === 'running' && !resting;

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.row}>
        <Text variant="labelLarge" style={styles.label}>
          Rest
        </Text>
        <Text variant="headlineSmall" style={styles.value}>
          {restStartedAt === null ? '—' : formatElapsed(Math.max(0, now - restStartedAt))}
        </Text>
        <Button
          mode={resting ? 'outlined' : 'contained'}
          disabled={!canStart}
          onPress={() => dispatch({ type: 'startRest', now: Date.now() })}
        >
          {resting ? 'Resting…' : 'Start rest'}
        </Button>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { opacity: 0.7 },
  value: { flex: 1 },
});
