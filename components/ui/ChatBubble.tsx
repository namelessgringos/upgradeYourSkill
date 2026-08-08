import { StyleSheet, View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import type { Artifact } from '@/constants/skillDisplay';
import { Spacing } from '@/constants/theme';
import { ArtifactCard } from './ArtifactCard';

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  artifact?: Artifact;
  pending?: boolean;
}

export function ChatBubble({ message, coachName }: { message: ChatMessage; coachName: string }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      <Surface
        elevation={isUser ? 0 : 1}
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: theme.colors.secondaryContainer }
            : { backgroundColor: theme.colors.surface },
        ]}
      >
        {!isUser && (
          <Text variant="labelSmall" style={[styles.coachName, { color: theme.colors.onSurfaceVariant }]}>
            {coachName}
          </Text>
        )}
        <Text variant="bodyMedium" style={styles.text}>
          {message.pending ? 'Typing…' : message.text}
        </Text>
        {message.artifact && <ArtifactCard artifact={message.artifact} />}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: Spacing.md, flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '86%', borderRadius: 14, padding: Spacing.md },
  coachName: { fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
  text: { lineHeight: 22 },
});
