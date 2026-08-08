import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { notifyScroll } from '@/components/mascot/scrollSignal';
import { JournalColors, Spacing } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'bottom'],
  contentStyle,
}: Props) {
  const inner = padded ? [styles.padded, contentStyle] : contentStyle;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, inner]}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={notifyScroll}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: JournalColors.paperBg },
  flex: { flex: 1 },
  padded: { paddingHorizontal: Spacing.lg },
  scrollContent: { paddingBottom: Spacing.xl, flexGrow: 1 },
});
