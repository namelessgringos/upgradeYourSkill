import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { Fonts, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  showBack?: boolean;
  /** Overrides the default `router.back()` — for screens reached via a route
   * that doesn't leave a normal back-stack entry (e.g. a Redirect target). */
  onBack?: () => void;
  right?: React.ReactNode;
}

/** In-flow header row (kept inside Screen's safe area, not a Paper Appbar). */
export function Header({ title, showBack = false, onBack, right }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {showBack && (
          <IconButton
            icon="chevron-left"
            size={28}
            onPress={onBack ?? (() => router.back())}
            style={styles.back}
          />
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
