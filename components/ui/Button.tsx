import { StyleSheet, type ViewStyle } from 'react-native';
import { Button as PaperButton, useTheme } from 'react-native-paper';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  full?: boolean;
  style?: ViewStyle;
}

/**
 * Thin wrapper over Paper's Button, keeping the prop shape the screens already
 * use so the design-system swap did not need every call site rewritten.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  full = false,
  style,
}: Props) {
  const theme = useTheme();
  const mode = variant === 'secondary' ? 'outlined' : 'contained';
  const buttonColor = variant === 'danger' ? theme.colors.error : undefined;

  return (
    <PaperButton
      mode={mode}
      onPress={onPress}
      disabled={disabled}
      buttonColor={buttonColor}
      style={[full && styles.full, style]}
      contentStyle={styles.content}
      labelStyle={styles.label}
    >
      {label}
    </PaperButton>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%' },
  content: { paddingVertical: 6 },
  label: { fontSize: 16, fontWeight: '700' },
});
