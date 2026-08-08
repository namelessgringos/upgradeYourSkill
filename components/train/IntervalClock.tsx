import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JournalColors, Spacing } from '@/constants/theme';
import { intervalAt } from '@/lib/session/intervals';
import { useSession } from '@/lib/session/SessionProvider';
import { elapsedMs, formatElapsed } from '@/lib/session/timer';
import type { IntervalPhase } from '@/lib/session/types';

const PHASE_LABELS: Record<IntervalPhase, string> = {
  work: 'Work',
  rest: 'Rest',
  done: 'Done',
};

// No bell asset ships in the repo yet — none was available to add, and the
// brief is explicit that inventing a binary file is worse than leaving this
// wired-but-silent. Swap `BELL_SOURCE` for `require('@/assets/sounds/bell.mp3')`
// (or similar) once a real asset lands; `playBell` will start firing as-is.
const BELL_SOURCE = null;

function useBell() {
  const player = useAudioPlayer(BELL_SOURCE);
  return useCallback(() => {
    if (BELL_SOURCE === null) return; // no-op until a bell asset exists
    player.seekTo(0);
    player.play();
  }, [player]);
}

/** For boxing and HIIT: round, phase and remaining time, all derived from the clock. */
export function IntervalClock({ now }: { now: number }) {
  const { state } = useSession();
  const config = state.intervals;
  const [fullScreen, setFullScreen] = useState(false);
  const playBell = useBell();
  const previousRef = useRef<{ round: number; phase: IntervalPhase } | null>(null);

  const elapsed = elapsedMs(state.timer, now);
  const interval = config === null ? null : intervalAt(config, elapsed);

  // Trigger off the derived phase/round changing — never off remainingMs
  // hitting zero — so a session resumed after being backgrounded through
  // several rounds fires at most one bell, not one per skipped round.
  useEffect(() => {
    if (interval === null) return;
    const previous = previousRef.current;
    if (previous !== null && (previous.phase !== interval.phase || previous.round !== interval.round)) {
      playBell();
    }
    previousRef.current = { round: interval.round, phase: interval.phase };
  }, [interval, playBell]);

  if (config === null || interval === null) return null;

  const body = (
    <>
      <Text variant="titleMedium" style={styles.round}>
        Round {interval.round} / {config.rounds}
      </Text>
      <Text variant="displaySmall" style={styles.phase}>
        {PHASE_LABELS[interval.phase]}
      </Text>
      <Text variant="displayLarge" style={styles.remaining}>
        {formatElapsed(interval.remainingMs)}
      </Text>
    </>
  );

  return (
    <Surface style={styles.card} elevation={1}>
      {body}
      <Button mode="outlined" onPress={() => setFullScreen(true)}>
        Full screen
      </Button>

      <Modal visible={fullScreen} animationType="fade" onRequestClose={() => setFullScreen(false)}>
        <SafeAreaView style={styles.fullScreen}>
          <View style={styles.fullScreenBody}>{body}</View>
          <Button mode="outlined" onPress={() => setFullScreen(false)} style={styles.exitButton}>
            Exit full screen
          </Button>
        </SafeAreaView>
      </Modal>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.lg, gap: Spacing.sm, alignItems: 'center' },
  round: { opacity: 0.7 },
  phase: { fontWeight: '800' },
  remaining: { fontWeight: '800' },
  fullScreen: { flex: 1, backgroundColor: JournalColors.paperBg, justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl },
  fullScreenBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  exitButton: { marginBottom: Spacing.lg },
});
