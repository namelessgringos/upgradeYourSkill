import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { tierColor, tierLabel } from '@/constants/skillDisplay';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';
import * as api from '@/lib/api';
import type { GetSkillResponse } from '@/server-shared/api';

export default function SkillDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [skill, setSkill] = useState<GetSkillResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return;
    setFailed(false);
    api
      .getSkill({ skillId: id })
      .then((result) => {
        if (active) setSkill(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (failed) {
    return (
      <Screen>
        <Header title="Not found" showBack />
        <Text style={styles.empty}>That skill doesn’t exist.</Text>
      </Screen>
    );
  }

  if (!skill) {
    return (
      <Screen>
        <Header title="Loading" showBack />
        <ActivityIndicator style={styles.loader} color={JournalColors.inkFaint} />
      </Screen>
    );
  }

  const { meta, guide, entitled } = skill;

  return (
    <Screen scroll>
      <Header title={meta.title} showBack />

      <View style={styles.hero}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
        <Text style={styles.title}>{meta.title}</Text>
        <Pill label={tierLabel(meta.tier)} color={tierColor(meta.tier)} />
        <Text style={styles.coach}>
          {meta.coachName} · {meta.coachTagline}
        </Text>
      </View>

      <Text style={styles.summary}>{meta.summary}</Text>

      <Text style={styles.guideLabel}>The guide</Text>
      {guide ? (
        <View style={styles.guide}>
          {guide.map((section, i) => (
            <Card key={i}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </Card>
          ))}
        </View>
      ) : (
        // The server withholds the guide body entirely when the caller is not
        // entitled — there is nothing here to unlock client-side.
        <Card muted>
          <Text style={styles.lockedBody}>
            The full written guide unlocks with your trial.
          </Text>
        </Card>
      )}

      <View style={styles.footer}>
        {entitled ? (
          <Button
            label={`Start chatting with ${meta.coachName}`}
            full
            onPress={() => router.push(`/chat/${meta.id}`)}
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
  loader: { marginTop: 40 },
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
  lockedBody: { fontSize: 15, lineHeight: 23, color: JournalColors.inkBrown },
  footer: { marginTop: Spacing.xl, gap: Spacing.sm },
  lockedNote: { textAlign: 'center', color: JournalColors.inkFaint, fontSize: 14 },
});
