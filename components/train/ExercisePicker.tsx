import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, List, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { JournalColors, Spacing } from '@/constants/theme';
import { searchExercises, type SessionStore } from '@/lib/session/store';
import type { Exercise } from '@/lib/session/types';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSelect: (exercise: Exercise) => void;
  store: SessionStore;
}

/**
 * Favourites and Recent aren't fields on Exercise — the store has no such
 * flag — so both are derived here from saved-session history: Recent is the
 * most recently logged exercises, Favourites the most frequently logged
 * ones. Both sections are empty for a brand-new user, which is correct.
 */
function deriveSections(sessions: { sets: { exerciseId: string }[] }[]) {
  const recent: string[] = [];
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const set of session.sets) {
      counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
      if (!recent.includes(set.exerciseId)) recent.push(set.exerciseId);
    }
  }
  const favourites = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
  return { recentIds: recent.slice(0, 5), favouriteIds: favourites };
}

export function ExercisePicker({ visible, onDismiss, onSelect, store }: Props) {
  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    store
      .listExercises()
      .then((list) => {
        if (!cancelled) setExercises(list);
      })
      .catch(() => {
        if (!cancelled) setExercises([]);
      });

    store
      .listSessions()
      .then((sessions) => {
        if (cancelled) return;
        const { recentIds: recent, favouriteIds: favourites } = deriveSections(sessions);
        setRecentIds(recent);
        setFavouriteIds(favourites);
      })
      .catch(() => {
        if (!cancelled) {
          setRecentIds([]);
          setFavouriteIds([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, store]);

  const filtered = searchExercises(exercises, query);
  const byId = (id: string) => filtered.find((exercise) => exercise.id === id);
  const favourites = favouriteIds.map(byId).filter((e): e is Exercise => e !== undefined);
  const recents = recentIds
    .map(byId)
    .filter((e): e is Exercise => e !== undefined)
    .filter((e) => !favouriteIds.includes(e.id));
  const shownIds = new Set([...favourites, ...recents].map((e) => e.id));
  const rest = filtered.filter((e) => !shownIds.has(e.id));

  const select = (exercise: Exercise) => {
    setQuery('');
    onSelect(exercise);
  };

  const addCustom = () => {
    const name = customName.trim();
    if (name === '') return;
    store
      .addExercise(name, [])
      .then((exercise) => {
        setExercises((current) => [...current, exercise]);
        setCustomName('');
        select(exercise);
      })
      .catch(() => {
        // Adding failed — leave the input as-is so the trainer can retry.
      });
  };

  const renderSection = (title: string, items: Exercise[]) =>
    items.length === 0 ? null : (
      <List.Section key={title}>
        <List.Subheader>{title}</List.Subheader>
        {items.map((exercise) => (
          <List.Item
            key={exercise.id}
            title={exercise.name}
            description={exercise.muscleGroups.join(', ')}
            onPress={() => select(exercise)}
          />
        ))}
      </List.Section>
    );

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.sheet}>
        <Text variant="titleMedium" style={styles.title}>
          Choose an exercise
        </Text>
        <TextInput
          label="Search"
          mode="outlined"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <ScrollView style={styles.list}>
          {renderSection('Favourites', favourites)}
          {renderSection('Recent', recents)}
          {renderSection('All', rest)}
        </ScrollView>
        <View style={styles.addRow}>
          <TextInput
            label="Add custom exercise"
            mode="outlined"
            value={customName}
            onChangeText={setCustomName}
            style={styles.addInput}
          />
          <Button mode="contained" onPress={addCustom} disabled={customName.trim() === ''}>
            Add
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: JournalColors.white,
    margin: Spacing.lg,
    borderRadius: 12,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  title: { fontWeight: '800', marginBottom: Spacing.sm },
  search: { marginBottom: Spacing.sm },
  list: { maxHeight: 360 },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  addInput: { flex: 1 },
});
