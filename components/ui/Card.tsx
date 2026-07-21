import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Elevation, JournalColors, Radius, Spacing } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  muted?: boolean;
}

export function Card({ children, onPress, style, muted = false }: Props) {
  const content = (
    <View style={[styles.card, muted && styles.muted, style]}>{children}</View>
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
  card: {
    backgroundColor: JournalColors.white,
    borderColor: JournalColors.gridLineBold,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    ...Elevation.card,
  },
  muted: { backgroundColor: JournalColors.paperDark },
  pressed: { opacity: 0.85 },
});
