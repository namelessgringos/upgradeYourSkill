import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Surface, Text } from 'react-native-paper';
import { JournalColors, Spacing } from '@/constants/theme';
import { formatGroupSets, groupSetsByExercise } from '@/lib/session/selectors';
import { useSession } from '@/lib/session/SessionProvider';

interface Props {
  /** Reopen the sheet on an exercise already in the log, to add another set. */
  onOpenExercise: (exerciseId: string, exerciseName: string) => void;
  /** Open the sheet on the picker, to start something new. */
  onAddExercise: () => void;
}

/**
 * What has been done in this session so far — one row per exercise, sets
 * collapsed into it. This is the screen's centre of gravity: the coach's
 * running record, and the only thing worth reading at a glance mid-session.
 *
 * Rows are tappable because adding a second set to an exercise is the single
 * most repeated action in a gym session, and making it cost a trip through
 * the picker is how logging stops happening.
 */
export function SessionLog({ onOpenExercise, onAddExercise }: Props) {
  const { state } = useSession();
  const groups = groupSetsByExercise(state.sets);

  return (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>This session</Text>
        <IconButton
          icon="plus"
          mode="contained"
          size={20}
          onPress={onAddExercise}
          accessibilityLabel="Add an exercise"
        />
      </View>

      {groups.length === 0 ? (
        <Text style={styles.empty}>Nothing logged yet. Tap + to start an exercise.</Text>
      ) : (
        groups.map((group) => (
          <Pressable
            key={group.exerciseId}
            onPress={() => onOpenExercise(group.exerciseId, group.exerciseName)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${group.exerciseName}, ${group.sets.length} sets. Add another set.`}
          >
            <View style={styles.rowText}>
              <Text style={styles.exerciseName}>{group.exerciseName}</Text>
              <Text style={styles.setLine}>{formatGroupSets(group)}</Text>
            </View>
            <Text style={styles.setCount}>
              {group.sets.length} {group.sets.length === 1 ? 'set' : 'sets'}
            </Text>
          </Pressable>
        ))
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontWeight: '800', fontSize: 15, color: JournalColors.inkBrown },
  empty: { color: JournalColors.inkFaint, paddingVertical: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: JournalColors.gridLine,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  exerciseName: { fontSize: 17, fontWeight: '700', color: JournalColors.inkBlack },
  setLine: { fontSize: 13, color: JournalColors.inkFaint, marginTop: 2 },
  setCount: { fontSize: 13, fontWeight: '700', color: JournalColors.inkFaint },
});
