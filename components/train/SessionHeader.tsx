import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Surface, Text } from 'react-native-paper';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session/SessionProvider';
import { elapsedMs, formatElapsed } from '@/lib/session/timer';
import type { TrainingStyle } from '@/lib/session/types';

const STYLE_LABELS: Record<TrainingStyle, string> = {
  gym: 'Gym',
  boxing: 'Boxing',
  hiit: 'HIIT',
};

/**
 * Shell shared by every training style: elapsed time, pause/resume, who and
 * what this session is. `now` comes from the single `useSessionClock` call in
 * `live.tsx` — this component never starts its own timer.
 */
export function SessionHeader({ now }: { now: number }) {
  const { state, dispatch, store } = useSession();
  const [clientName, setClientName] = useState<string | null>(null);

  useEffect(() => {
    if (state.clientId === null) {
      setClientName(null);
      return;
    }
    let cancelled = false;
    store
      .listClients()
      .then((clients) => {
        if (cancelled) return;
        setClientName(clients.find((client) => client.id === state.clientId)?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setClientName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [state.clientId, store]);

  const isPaused = state.timer.status === 'paused';
  const isFinished = state.timer.status === 'finished';

  const onPauseResume = () => {
    if (isPaused) dispatch({ type: 'resume', now: Date.now() });
    else dispatch({ type: 'pause', now: Date.now() });
  };

  return (
    <Surface style={styles.header} elevation={1}>
      <View style={styles.row}>
        <View>
          <Text variant="displaySmall" style={styles.elapsed}>
            {formatElapsed(elapsedMs(state.timer, now))}
          </Text>
          <Text variant="bodyMedium" style={styles.meta}>
            {STYLE_LABELS[state.style]} · {clientName ?? 'No client'}
          </Text>
        </View>
        <IconButton
          icon={isPaused ? 'play' : 'pause'}
          mode="contained"
          size={28}
          disabled={isFinished}
          onPress={onPauseResume}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: { borderRadius: 12, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  elapsed: { fontWeight: '800' },
  meta: { opacity: 0.7, marginTop: 2 },
});
