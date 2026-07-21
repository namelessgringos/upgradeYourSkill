import { StyleSheet, Text, View } from 'react-native';
import { JournalColors, Radius } from '@/constants/theme';

interface Props {
  label: string;
  color?: string;
  filled?: boolean;
}

export function Pill({ label, color = JournalColors.selectedBorder, filled = false }: Props) {
  return (
    <View
      style={[
        styles.pill,
        { borderColor: color },
        filled && { backgroundColor: color },
      ]}
    >
      <Text style={[styles.text, { color: filled ? JournalColors.white : color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '700' },
});
