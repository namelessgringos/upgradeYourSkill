import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Surface, Text } from 'react-native-paper';
import { JournalColors, Spacing } from '@/constants/theme';
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
        <View style={styles.titleBlock}>
          <Text style={styles.elapsed}>{formatElapsed(elapsedMs(state.timer, now))}</Text>
          <Text style={styles.meta}>
            {STYLE_LABELS[state.style]} · {clientName ?? 'No client'}
          </Text>
        </View>
        <IconButton
          icon={isPaused ? 'play' : 'pause'}
          size={18}
          iconColor={JournalColors.inkFaint}
          disabled={isFinished}
          onPress={onPauseResume}
          style={styles.pauseButton}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: { borderRadius: 12, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleBlock: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.md, flex: 1 },
  // Deliberately quiet. The elapsed clock is reference, not the thing being
  // read — a coach glances at it between sets and otherwise wants it gone.
  // Tabular figures stop the row from jittering as the digits change.
  elapsed: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: JournalColors.inkFaint,
    fontVariant: ['tabular-nums'],
  },
  meta: { fontSize: 13, color: JournalColors.inkFaint, opacity: 0.8 },
  pauseButton: { margin: 0 },
});
