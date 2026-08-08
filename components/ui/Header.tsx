import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { Fonts, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

/** In-flow header row (kept inside Screen's safe area, not a Paper Appbar). */
export function Header({ title, showBack = false, right }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {showBack && (
          <IconButton icon="chevron-left" size={28} onPress={() => router.back()} style={styles.back} />
        )}
      </View>
      <Text variant="titleLarge" style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  side: { width: 44, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  back: { margin: 0 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    fontFamily: Fonts?.serif,
  },
});
