import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, IconButton, Snackbar, Surface, Text, TextInput } from 'react-native-paper';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { Spacing } from '@/constants/theme';
import { formatSetReps } from '@/lib/session/selectors';
import { useSession } from '@/lib/session/SessionProvider';
import type { Client } from '@/lib/session/types';

const DIFFICULTIES = Array.from({ length: 10 }, (_, i) => i + 1);

export default function TrainSummary() {
  const { state, dispatch, store } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    store
      .listClients()
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

  const onSave = () => {
    setSaving(true);
    setSaveFailed(false);
    store
      .saveSession(state)
      .then(() => {
        router.replace('/(tabs)');
      })
      .catch(() => {
        setSaving(false);
        setSaveFailed(true);
      });
  };

  return (
    <>
      <Screen scroll contentStyle={styles.container}>
        <Header title="Session summary" showBack onBack={() => router.replace('/(tabs)')} />

        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>
            Sets ({state.sets.length})
          </Text>
          {state.sets.length === 0 ? (
            <Text style={styles.empty}>No sets logged.</Text>
          ) : (
            state.sets.map((set, index) => (
              <View key={`${set.exerciseId}-${set.completedAt}-${index}`} style={styles.setRow}>
                <View style={styles.setInfo}>
                  <Text variant="bodyLarge">{set.exerciseName}</Text>
                  <Text variant="bodySmall" style={styles.setMeta}>
                    {formatSetReps(set)}
                  </Text>
                </View>
                <IconButton
                  icon="trash-can-outline"
                  onPress={() => dispatch({ type: 'removeSet', index })}
                />
              </View>
            ))
          )}
        </Surface>

        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>
            Client
          </Text>
          <Button
            mode={state.clientId === null ? 'contained' : 'outlined'}
            onPress={() => dispatch({ type: 'setClient', clientId: null })}
            style={styles.skipButton}
          >
            No client
          </Button>
          {clients.length > 0 && (
            <View style={styles.chipRow}>
              {clients.map((client) => (
                <Chip
                  key={client.id}
                  selected={state.clientId === client.id}
                  onPress={() => dispatch({ type: 'setClient', clientId: client.id })}
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
            Difficulty
          </Text>
          <View style={styles.chipRow}>
            {DIFFICULTIES.map((value) => (
              <Chip
                key={value}
                selected={state.difficulty === value}
                onPress={() => dispatch({ type: 'setDifficulty', difficulty: value })}
                style={styles.chip}
              >
                {value}
              </Chip>
            ))}
          </View>
        </Surface>

        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>
            Notes
          </Text>
          <TextInput
            mode="outlined"
            multiline
            numberOfLines={4}
            value={state.notes}
            onChangeText={(notes) => dispatch({ type: 'setNotes', notes })}
          />
        </Surface>

        <Button mode="contained" onPress={onSave} loading={saving} disabled={saving} style={styles.save}>
          Save
        </Button>
      </Screen>
      <Snackbar
        visible={saveFailed}
        onDismiss={() => setSaveFailed(false)}
        action={{ label: 'Dismiss', onPress: () => setSaveFailed(false) }}
      >
        Could not save the session. Your data is still here — try again.
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  card: { borderRadius: 12, padding: Spacing.lg, gap: Spacing.sm },
  cardTitle: { fontWeight: '800', opacity: 0.7 },
  empty: { opacity: 0.6 },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setInfo: { flex: 1 },
  setMeta: { opacity: 0.7 },
  skipButton: { alignSelf: 'stretch' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { marginBottom: 4 },
  save: { marginTop: Spacing.xs },
});
