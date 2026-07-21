import { StyleSheet, Text, View } from 'react-native';
import type { Artifact } from '@/constants/skillDisplay';
import { JournalColors, Radius, Spacing } from '@/constants/theme';
import { ArtifactCard } from './ArtifactCard';

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  artifact?: Artifact;
  pending?: boolean;
}

export function ChatBubble({ message, coachName }: { message: ChatMessage; coachName: string }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, isUser ? styles.user : styles.coach]}>
        {!isUser && <Text style={styles.coachName}>{coachName}</Text>}
        <Text style={[styles.text, isUser && styles.userText]}>
          {message.pending ? 'Typing…' : message.text}
        </Text>
        {message.artifact && <ArtifactCard artifact={message.artifact} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: Spacing.md, flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '86%',
    borderRadius: Radius.card,
    borderWidth: 1.5,
    padding: Spacing.md,
  },
  coach: { backgroundColor: JournalColors.white, borderColor: JournalColors.gridLineBold },
  user: { backgroundColor: JournalColors.selected, borderColor: JournalColors.selectedBorder },
  coachName: {
    fontSize: 11,
    fontWeight: '800',
    color: JournalColors.inkFaint,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  text: { fontSize: 15, lineHeight: 22, color: JournalColors.inkBlack },
  userText: { color: JournalColors.inkBlack },
});
