import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';

const TIPS = [
  {
    emoji: '📖',
    title: 'Start with the guide',
    text: 'Open a skill and read its guide first. It’s short, and it’s the part you’re actually paying for. The coach builds on it.',
  },
  {
    emoji: '💬',
    title: 'Ask like you’d ask a person',
    text: 'Be specific about your situation. “Build me a 3-day plan, I have dumbbells only” beats “how do I get strong”.',
  },
  {
    emoji: '📎',
    title: 'Watch for outputs',
    text: 'The coach can hand you checklists, schemas and images right in the chat. Tap to read them in full.',
  },
  {
    emoji: '🎯',
    title: 'Stay in the skill’s lane',
    text: 'Each coach is an expert in one domain and will keep you there. It won’t give medical, legal or financial advice.',
  },
  {
    emoji: '📊',
    title: 'Keep an eye on the meter',
    text: 'Your daily usage is always visible on the Home and Membership tabs. Start a trial for a bigger allowance.',
  },
];

export default function HowTo() {
  return (
    <Screen scroll>
      <Text style={styles.h1}>How to use your coach</Text>
      <View style={styles.list}>
        {TIPS.map((t, i) => (
          <Card key={i}>
            <View style={styles.row}>
              <Text style={styles.emoji}>{t.emoji}</Text>
              <View style={styles.main}>
                <Text style={styles.title}>{t.title}</Text>
                <Text style={styles.text}>{t.text}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
      <Button label="Got it" full style={styles.done} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 26,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  list: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  emoji: { fontSize: 26 },
  main: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: JournalColors.inkBlack, marginBottom: 4 },
  text: { fontSize: 14, lineHeight: 21, color: JournalColors.inkBrown },
  done: { marginTop: Spacing.xl },
});
