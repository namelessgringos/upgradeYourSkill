import { StyleSheet, Text, View } from 'react-native';
import { JournalColors, Radius } from '@/constants/theme';

interface Props {
  used: number;
  limit: number;
  label?: string;
  unit?: string;
}

export function UsageMeter({ used, limit, label = 'Daily usage', unit = 'messages' }: Props) {
  const pct = limit > 0 ? Math.min(1, used / limit) : 0;
  const nearCap = pct >= 0.8;
  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.count}>
          {used} / {limit} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: nearCap ? JournalColors.accent : JournalColors.selectedBorder },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { color: JournalColors.inkBrown, fontWeight: '600', fontSize: 14 },
  count: { color: JournalColors.inkFaint, fontSize: 14 },
  track: {
    height: 10,
    backgroundColor: JournalColors.paperDark,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: JournalColors.gridLine,
  },
  fill: { height: '100%', borderRadius: Radius.pill },
});
