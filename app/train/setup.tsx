import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { Screen } from '@/components/ui/Screen';
import { Spacing } from '@/constants/theme';
import { BOXING_PRESET, HIIT_PRESET } from '@/lib/session/intervals';
import { MUSCLE_GROUPS } from '@/lib/session/exercises.seed';
import { useSession } from '@/lib/session/SessionProvider';
import type { Client, IntervalConfig, TrainingStyle } from '@/lib/session/types';

const STYLE_OPTIONS = [
  { value: 'gym', label: 'Gym' },
  { value: 'boxing', label: 'Boxing' },
  { value: 'hiit', label: 'HIIT' },
];

function presetFor(style: TrainingStyle): IntervalConfig | null {
  switch (style) {
    case 'boxing':
      return BOXING_PRESET;
    case 'hiit':
      return HIIT_PRESET;
    case 'gym':
      return null;
  }
}

export default function SessionSetup() {
  const { dispatch, store } = useSession();

  const [style, setStyle] = useState<TrainingStyle>('gym');
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [fatiguedGroups, setFatiguedGroups] = useState<string[]>([]);
  const [intervals, setIntervals] = useState<IntervalConfig | null>(presetFor('gym'));

  useEffect(() => {
    let cancelled = false;
    store.listClients().then((list) => {
      if (!cancelled) setClients(list);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const onStyleChange = (value: string) => {
    const next = value as TrainingStyle;
    setStyle(next);
    setIntervals(presetFor(next));
  };

  const toggleGroup = (list: string[], setList: (next: string[]) => void, group: string) => {
    setList(list.includes(group) ? list.filter((g) => g !== group) : [...list, group]);
  };

  const setWorkSeconds = (text: string) => {
    const seconds = Number(text);
    if (!Number.isFinite(seconds)) return;
    setIntervals((current) => (current ? { ...current, workMs: Math.max(0, Math.round(seconds * 1000)) } : current));
  };

  const setRestSeconds = (text: string) => {
    const seconds = Number(text);
    if (!Number.isFinite(seconds)) return;
    setIntervals((current) => (current ? { ...current, restMs: Math.max(0, Math.round(seconds * 1000)) } : current));
  };

  const setRounds = (text: string) => {
    const rounds = Number(text);
    if (!Number.isFinite(rounds)) return;
    setIntervals((current) => (current ? { ...current, rounds: Math.max(1, Math.round(rounds)) } : current));
  };

  const onStart = () => {
    dispatch({
      type: 'configure',
      style,
      options: { clientId, muscleGroups, fatiguedGroups, intervals },
    });
    dispatch({ type: 'start', now: Date.now() });
    router.replace('/train/live');
  };

  return (
    <Screen scroll contentStyle={styles.container}>
      <Text variant="headlineMedium" style={styles.h1}>
        New session
      </Text>

      <SegmentedButtons value={style} onValueChange={onStyleChange} buttons={STYLE_OPTIONS} />

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          Client
        </Text>
        <Button
          mode={clientId === null ? 'contained' : 'outlined'}
          onPress={() => setClientId(null)}
          style={styles.skipButton}
        >
          Skip — start without a client
        </Button>
        {clients.length > 0 && (
          <View style={styles.chipRow}>
            {clients.map((client) => (
              <Chip
                key={client.id}
                selected={clientId === client.id}
                onPress={() => setClientId(client.id)}
                style={styles.chip}
              >
                {client.name}
              </Chip>
            ))}
          </View>
        )}
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          Muscle groups
        </Text>
        <View style={styles.chipRow}>
          {MUSCLE_GROUPS.map((group) => (
            <Chip
              key={group}
              selected={muscleGroups.includes(group)}
              onPress={() => toggleGroup(muscleGroups, setMuscleGroups, group)}
              style={styles.chip}
            >
              {group}
            </Chip>
          ))}
        </View>
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          Already tired
        </Text>
        <View style={styles.chipRow}>
          {MUSCLE_GROUPS.map((group) => (
            <Chip
              key={group}
              selected={fatiguedGroups.includes(group)}
              onPress={() => toggleGroup(fatiguedGroups, setFatiguedGroups, group)}
              style={styles.chip}
            >
              {group}
            </Chip>
          ))}
        </View>
      </Surface>

      {intervals && (
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>
            Intervals
          </Text>
          <View style={styles.intervalRow}>
            <TextInput
              label="Work (s)"
              mode="outlined"
              keyboardType="numeric"
              value={String(Math.round(intervals.workMs / 1000))}
              onChangeText={setWorkSeconds}
              style={styles.intervalInput}
            />
            <TextInput
              label="Rest (s)"
              mode="outlined"
              keyboardType="numeric"
              value={String(Math.round(intervals.restMs / 1000))}
              onChangeText={setRestSeconds}
              style={styles.intervalInput}
            />
            <TextInput
              label="Rounds"
              mode="outlined"
              keyboardType="numeric"
              value={String(intervals.rounds)}
              onChangeText={setRounds}
              style={styles.intervalInput}
            />
          </View>
        </Surface>
      )}

      <Button mode="contained" onPress={onStart} style={styles.start}>
        Start
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  h1: { fontWeight: '800' },
  card: { borderRadius: 12, padding: Spacing.lg, gap: Spacing.sm },
  cardTitle: { fontWeight: '800', opacity: 0.7 },
  skipButton: { alignSelf: 'stretch' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { marginBottom: 4 },
  intervalRow: { flexDirection: 'row', gap: Spacing.sm },
  intervalInput: { flex: 1 },
  start: { marginTop: Spacing.xs },
});
