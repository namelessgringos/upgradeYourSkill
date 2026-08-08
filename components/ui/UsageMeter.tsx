import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import { JournalColors } from '@/constants/theme';

interface Props {
  used: number;
  limit: number;
  label?: string;
  unit?: string;
}

export function UsageMeter({ used, limit, label = 'Daily usage', unit = 'messages' }: Props) {
  const theme = useTheme();
  const pct = limit > 0 ? Math.min(1, used / limit) : 0;
  const nearCap = pct >= 0.8;
  return (
    <View>
      <View style={styles.row}>
        <Text variant="bodyMedium" style={styles.label}>
          {label}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {used} / {limit} {unit}
        </Text>
      </View>
      <ProgressBar
        progress={pct}
        color={nearCap ? theme.colors.error : JournalColors.selectedBorder}
        style={styles.track}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontWeight: '600' },
  track: { height: 10, borderRadius: 999 },
});
