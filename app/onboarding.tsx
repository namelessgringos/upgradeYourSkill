import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { tierColor, tierLabel } from '@/constants/skillDisplay';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

const STEPS = ['Welcome', 'How it works', 'Pick a skill', 'Free trial'];

export default function Onboarding() {
  const { user, skills, completeOnboarding, activateTrial } = useSession();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = async (withTrial: boolean) => {
    const choice = picked ?? skills[0]?.id;
    if (!choice || busy) return;
    setBusy(true);
    try {
      await completeOnboarding(choice);
      if (withTrial) await activateTrial();
      router.replace('/(tabs)');
    } catch {
      setBusy(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.container}>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      {step === 0 && (
        <View style={styles.body}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.h1}>Welcome{user ? `, ${user.name.split(' ')[0]}` : ''}</Text>
          <Text style={styles.p}>
            Every skill is a curated written guide plus a coach that teaches it and helps you apply
            it to your own situation. Read, then chat. Let’s get you set up.
          </Text>
        </View>
      )}

      {step === 1 && (
        <View style={styles.body}>
          <Text style={styles.h1}>How it works</Text>
          <HowRow n="1" title="Read the guide" text="Each skill opens with a short, no-fluff guide — that's the real product." />
          <HowRow n="2" title="Chat with your coach" text="Ask anything in the skill's domain. The coach can hand you checklists, schemas and images." />
          <HowRow n="3" title="Track your usage" text="A meter always shows how much you've used today — no surprises." />
        </View>
      )}

      {step === 2 && (
        <View style={styles.body}>
          <Text style={styles.h1}>Pick your first skill</Text>
          <Text style={styles.p}>
            On the free plan you keep one skill with a few messages a day. Start a trial next to
            unlock all three.
          </Text>
          <View style={styles.skillList}>
            {skills.map((s) => {
              const active = picked === s.id;
              return (
                <Card key={s.id} onPress={() => setPicked(s.id)} style={active ? styles.skillActive : undefined}>
                  <View style={styles.skillRow}>
                    <Text style={styles.skillEmoji}>{s.emoji}</Text>
                    <View style={styles.skillMain}>
                      <Text style={styles.skillTitle}>{s.title}</Text>
                      <Text style={styles.skillPromise}>{s.promise}</Text>
                    </View>
                    <Pill label={tierLabel(s.tier)} color={tierColor(s.tier)} />
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.body}>
          <Text style={styles.emoji}>✨</Text>
          <Text style={styles.h1}>Try everything free for 7 days</Text>
          <Text style={styles.p}>
            Unlock all three skills with a generous daily allowance. No charge during the trial, and
            you can cancel anytime.
          </Text>
          <Card muted>
            <Text style={styles.trialLine}>✓ All 3 skills unlocked</Text>
            {/* Mirrors DAILY_MESSAGE_CAP.trial in functions/src/entitlement.ts,
                which is derived from measured cost — keep the two in step. */}
            <Text style={styles.trialLine}>✓ 30 messages a day</Text>
            <Text style={styles.trialLine}>✓ Guides, checklists, schemas & images</Text>
          </Card>
        </View>
      )}

      <View style={styles.footer}>
        {step < 2 && <Button label="Continue" full onPress={next} />}
        {step === 2 && (
          <Button label="Continue" full disabled={!picked} onPress={next} />
        )}
        {step === 3 && (
          <>
            <Button
              label={busy ? 'Setting up…' : 'Start 7-day free trial'}
              full
              disabled={busy}
              onPress={() => finish(true)}
            />
            <Pressable
              onPress={() => finish(false)}
              disabled={busy}
              style={styles.laterBtn}
            >
              <Text style={styles.later}>Maybe later — continue free</Text>
            </Pressable>
          </>
        )}
        {step > 0 && step < 3 && (
          <Pressable onPress={back} style={styles.laterBtn}>
            <Text style={styles.later}>Back</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

function HowRow({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <View style={styles.howRow}>
      <View style={styles.howNum}>
        <Text style={styles.howNumText}>{n}</Text>
      </View>
      <View style={styles.howMain}>
        <Text style={styles.howTitle}>{title}</Text>
        <Text style={styles.howText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: Spacing.lg },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: Spacing.xl },
  dot: { width: 28, height: 5, borderRadius: 3, backgroundColor: JournalColors.gridLine },
  dotActive: { backgroundColor: JournalColors.accent },
  body: { flex: 1, gap: Spacing.md },
  emoji: { fontSize: 52, textAlign: 'center' },
  h1: {
    fontSize: 26,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
    textAlign: 'center',
  },
  p: { fontSize: 15, lineHeight: 22, color: JournalColors.inkBrown, textAlign: 'center' },
  howRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  howNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: JournalColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumText: { color: JournalColors.white, fontWeight: '800' },
  howMain: { flex: 1 },
  howTitle: { fontSize: 16, fontWeight: '700', color: JournalColors.inkBlack },
  howText: { fontSize: 14, lineHeight: 20, color: JournalColors.inkBrown, marginTop: 2 },
  skillList: { gap: Spacing.md, marginTop: Spacing.sm },
  skillActive: { borderColor: JournalColors.selectedBorder, backgroundColor: JournalColors.selected },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  skillEmoji: { fontSize: 28 },
  skillMain: { flex: 1 },
  skillTitle: { fontSize: 16, fontWeight: '700', color: JournalColors.inkBlack },
  skillPromise: { fontSize: 13, color: JournalColors.inkFaint, marginTop: 2 },
  trialLine: { fontSize: 15, color: JournalColors.inkBrown, paddingVertical: 3 },
  footer: { gap: Spacing.sm, marginTop: Spacing.xl },
  laterBtn: { alignItems: 'center', paddingVertical: 10 },
  later: { color: JournalColors.inkFaint, fontSize: 15, fontWeight: '600' },
});
