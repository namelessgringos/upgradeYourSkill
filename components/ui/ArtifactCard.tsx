import { StyleSheet, Text, View } from 'react-native';
import type { Artifact } from '@/constants/mockData';
import { Fonts, JournalColors, Radius, Spacing } from '@/constants/theme';

/** Renders a coach "artifact" (schema / checklist / image) inline in the chat,
 *  demonstrating the chat + output experience. Mock rendering only. */
export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.kind}>{labelFor(artifact.kind)}</Text>
        <Text style={styles.title}>{artifact.title}</Text>
      </View>
      {artifact.kind === 'checklist' && (
        <View>
          {artifact.items.map((item, i) => (
            <View key={i} style={styles.checkRow}>
              <Text style={styles.check}>☐</Text>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
      {artifact.kind === 'table' && (
        <View style={styles.table}>
          <View style={[styles.tr, styles.trHead]}>
            {artifact.columns.map((c, i) => (
              <Text key={i} style={[styles.cell, styles.cellHead]}>
                {c}
              </Text>
            ))}
          </View>
          {artifact.rows.map((row, ri) => (
            <View key={ri} style={styles.tr}>
              {row.map((cell, ci) => (
                <Text key={ci} style={styles.cell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
      {artifact.kind === 'image' && (
        <View style={[styles.imageBlock, { backgroundColor: artifact.swatch }]}>
          <Text style={styles.imageCaption}>{artifact.caption}</Text>
        </View>
      )}
    </View>
  );
}

function labelFor(kind: Artifact['kind']): string {
  if (kind === 'checklist') return 'CHECKLIST';
  if (kind === 'table') return 'SCHEMA';
  return 'IMAGE';
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.sm,
    backgroundColor: JournalColors.paperBg,
    borderColor: JournalColors.gridLine,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    padding: Spacing.md,
  },
  header: { marginBottom: Spacing.sm },
  kind: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: JournalColors.inkFaint },
  title: { fontSize: 15, fontWeight: '700', color: JournalColors.inkBlack, fontFamily: Fonts?.serif },
  checkRow: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  check: { color: JournalColors.accent, fontSize: 15 },
  checkText: { flex: 1, color: JournalColors.inkBrown, fontSize: 14, lineHeight: 20 },
  table: { borderTopWidth: 1, borderColor: JournalColors.gridLine },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: JournalColors.gridLine },
  trHead: { backgroundColor: JournalColors.paperDark },
  cell: { flex: 1, padding: 6, fontSize: 12, color: JournalColors.inkBrown },
  cellHead: { fontWeight: '800', color: JournalColors.inkBlack },
  imageBlock: {
    height: 120,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  imageCaption: {
    color: JournalColors.white,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 4,
  },
});
