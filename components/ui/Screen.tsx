import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
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
          // The keyboard used to sit on top of whatever you were typing into.
          // iOS insets the scroll content by the keyboard's height and scrolls
          // the focused field into view; on Android the same job is done by
          // the window's resize soft-input mode.
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          // A numeric pad has no return key, so dragging the keyboard away is
          // the only dismissal that does not require hitting empty background.
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          scrollEventThrottle={16}
          onScroll={notifyScroll}
        >
          {children}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={[styles.flex, inner]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {children}
        </KeyboardAvoidingView>
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
