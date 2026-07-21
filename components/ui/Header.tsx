import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function Header({ title, showBack = false, right }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {showBack && (
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  side: { width: 44, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 34, lineHeight: 34, color: JournalColors.inkBrown },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
  },
});
