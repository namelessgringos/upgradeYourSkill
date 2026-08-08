import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';
import { Spacing } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  muted?: boolean;
}

/** Paper Surface with the app's padding, keeping the old Card prop shape. */
export function Card({ children, onPress, style, muted = false }: Props) {
  const theme = useTheme();
  const content = (
    <Surface
      elevation={1}
      style={[styles.card, muted && { backgroundColor: theme.colors.surfaceVariant }, style]}
    >
      {children}
    </Surface>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: Spacing.lg },
  pressed: { opacity: 0.85 },
});
