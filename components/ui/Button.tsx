import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Elevation, JournalColors, Radius } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  full?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  full = false,
  style,
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withTiming(0.96, { duration: 60 }), withTiming(1, { duration: 90 }));
    onPress();
  };

  return (
    <Animated.View style={[animatedStyle, full && styles.full]}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={[
          styles.base,
          variant === 'primary' && styles.primary,
          variant === 'secondary' && styles.secondary,
          variant === 'danger' && styles.danger,
          full && styles.full,
          disabled && styles.disabled,
          style,
        ]}
      >
        <Text
          style={[
            styles.label,
            (variant === 'primary' || variant === 'danger') && styles.labelLight,
            variant === 'secondary' && styles.labelDark,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: Radius.card,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.card,
  },
  full: { width: '100%' },
  primary: { backgroundColor: JournalColors.buttonPrimary, borderColor: JournalColors.inkBlack },
  secondary: { backgroundColor: JournalColors.white, borderColor: JournalColors.gridLineBold },
  danger: { backgroundColor: JournalColors.buttonDanger, borderColor: JournalColors.invalidBorder },
  disabled: { opacity: 0.4 },
  label: { fontSize: 16, fontWeight: '700' },
  labelLight: { color: JournalColors.white },
  labelDark: { color: JournalColors.inkBrown },
});
