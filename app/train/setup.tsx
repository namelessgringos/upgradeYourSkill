import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  IconButton,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { JournalColors, Spacing } from '@/constants/theme';
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
  const [newClientName, setNewClientName] = useState('');
  // Collapsed by default: an anonymous session is the common case, and the
  // card only earns its space once someone is actually picking a client.
  const [clientOpen, setClientOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    store.listClients()
      .then((list) => {
        if (!cancelled) setClients(list);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
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

  /** A session with nobody attached is anonymous, not incomplete. */
  const clientName =
    clients.find((client) => client.id === clientId)?.name ?? 'Anonymous';

  const onAddClient = () => {
    const name = newClientName.trim();
    if (name === '') return;
    store
      .addClient(name)
      .then((client) => {
        setClients((current) => [...current, client]);
        setClientId(client.id);
        setNewClientName('');
      })
      .catch(() => {
        // Creation failed — leave the name in the field so the coach can retry.
      });
  };

  return (
    <Screen scroll contentStyle={styles.container}>
      <Header title="New session" showBack onBack={() => router.replace('/(tabs)')} />

      <SegmentedButtons value={style} onValueChange={onStyleChange} buttons={STYLE_OPTIONS} />

      <Surface style={styles.card} elevation={1}>
        <Pressable
          onPress={() => setClientOpen((open) => !open)}
          style={styles.clientHeader}
          accessibilityRole="button"
          accessibilityLabel={`Client: ${clientName}. ${clientOpen ? 'Collapse' : 'Expand'}.`}
        >
          <Text variant="titleSmall" style={styles.cardTitle}>
            Client: <Text style={styles.clientName}>{clientName}</Text>
          </Text>
          <IconButton
            icon={clientOpen ? 'chevron-up' : 'chevron-down'}
            size={22}
            onPress={() => setClientOpen((open) => !open)}
            style={styles.chevron}
          />
        </Pressable>

        {clientOpen && (
          <>
            {clients.length > 0 && (
              <View style={styles.chipRow}>
                {clients.map((client) => (
                  <Chip
                    key={client.id}
                    selected={clientId === client.id}
                    onPress={() => {
                      setClientId(client.id);
                      setClientOpen(false);
                    }}
                    style={styles.chip}
                  >
                    {client.name}
                  </Chip>
                ))}
              </View>
            )}
            <View style={styles.addClientRow}>
              <TextInput
                placeholder="Anonymous client"
                mode="outlined"
                dense
                value={newClientName}
                onChangeText={setNewClientName}
                style={styles.addClientInput}
              />
              <IconButton
                icon="plus"
                mode="contained"
                size={22}
                onPress={onAddClient}
                disabled={newClientName.trim() === ''}
                accessibilityLabel="Add client"
              />
            </View>
            {clientId !== null && (
              <Button
                mode="text"
                compact
                textColor={JournalColors.inkFaint}
                onPress={() => setClientId(null)}
                style={styles.skipButton}
              >
                Skip — no client
              </Button>
            )}
          </>
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
          {MUSCLE_GROUPS.map((group) => {
            // A group picked for today's session is dimmed here — you already
            // said you are training it, so it is not the interesting answer to
            // "what is already tired". Dimmed, never disabled: something you
            // planned to train can also have arrived tired, and that is
            // exactly the thing worth recording.
            const training = muscleGroups.includes(group);
            return (
              <Chip
                key={group}
                selected={fatiguedGroups.includes(group)}
                onPress={() => toggleGroup(fatiguedGroups, setFatiguedGroups, group)}
                style={[styles.chip, training && styles.chipDimmed]}
                textStyle={training ? styles.chipDimmedText : undefined}
              >
                {group}
              </Chip>
            );
          })}
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
  card: { borderRadius: 12, padding: Spacing.lg, gap: Spacing.sm },
  cardTitle: { fontWeight: '800', opacity: 0.7 },
  clientHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clientName: { fontWeight: '800', opacity: 1, color: JournalColors.inkBlack },
  chevron: { margin: 0 },
  skipButton: { alignSelf: 'flex-start' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { marginBottom: 4 },
  chipDimmed: { opacity: 0.45, backgroundColor: JournalColors.paperBg },
  chipDimmedText: { color: JournalColors.inkFaint },
  addClientRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  addClientInput: { flex: 1 },
  intervalRow: { flexDirection: 'row', gap: Spacing.sm },
  intervalInput: { flex: 1 },
  start: { marginTop: Spacing.xs },
});
