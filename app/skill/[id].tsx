import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { getSkill, tierColor } from '@/constants/mockData';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

export default function SkillDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const skill = getSkill(id);
  const { isSkillUnlocked } = useSession();

  if (!skill) {
    return (
      <Screen>
        <Header title="Not found" showBack />
        <Text style={styles.empty}>That skill doesn’t exist.</Text>
      </Screen>
    );
  }

  const unlocked = isSkillUnlocked(skill.id);

  return (
    <Screen scroll>
      <Header title={skill.title} showBack />

      <View style={styles.hero}>
        <Text style={styles.emoji}>{skill.emoji}</Text>
        <Text style={styles.title}>{skill.title}</Text>
        <Pill label={skill.tier === 'pro' ? 'Pro' : 'Core'} color={tierColor(skill.tier)} />
        <Text style={styles.coach}>
          {skill.coachName} · {skill.coachTagline}
        </Text>
      </View>

      <Text style={styles.summary}>{skill.summary}</Text>

      <Text style={styles.guideLabel}>The guide</Text>
      <View style={styles.guide}>
        {skill.guide.map((section, i) => (
          <Card key={i}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </Card>
        ))}
      </View>

      <View style={styles.footer}>
        {unlocked ? (
          <Button
            label={`Start chatting with ${skill.coachName}`}
            full
            onPress={() => router.push(`/chat/${skill.id}`)}
          />
        ) : (
          <>
            <Text style={styles.lockedNote}>🔒 This skill is locked on your plan.</Text>
            <Button
              label="Unlock with a free trial"
              full
              onPress={() => router.push('/(tabs)/membership')}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: JournalColors.inkFaint, textAlign: 'center', marginTop: 40 },
  hero: { alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  emoji: { fontSize: 52 },
  title: { fontSize: 26, fontWeight: '800', color: JournalColors.inkBlack, fontFamily: Fonts?.serif },
  coach: { fontSize: 13, color: JournalColors.inkFaint, textAlign: 'center' },
  summary: { fontSize: 16, lineHeight: 24, color: JournalColors.inkBrown, marginBottom: Spacing.lg },
  guideLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
    marginBottom: Spacing.md,
  },
  guide: { gap: Spacing.md },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: JournalColors.inkBlack, marginBottom: 6 },
  sectionBody: { fontSize: 15, lineHeight: 23, color: JournalColors.inkBrown },
  footer: { marginTop: Spacing.xl, gap: Spacing.sm },
  lockedNote: { textAlign: 'center', color: JournalColors.inkFaint, fontSize: 14 },
});
