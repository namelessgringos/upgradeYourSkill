import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { UsageMeter } from '@/components/ui/UsageMeter';
import { tierColor, tierLabel } from '@/constants/skillDisplay';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

export default function Dashboard() {
  const {
    user,
    plan,
    skills,
    trialActive,
    trialDaysLeft,
    usedToday,
    dailyLimit,
    isSkillUnlocked,
  } = useSession();
  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <Screen scroll contentStyle={styles.container}>
      <Text style={styles.hi}>Hi, {firstName} 👋</Text>
      <Text style={styles.sub}>Pick a skill and start a session.</Text>

      {plan !== 'pro' && (
        <Card style={styles.banner} muted>
          {trialActive ? (
            <>
              <Text style={styles.bannerTitle}>Trial active — {trialDaysLeft} days left</Text>
              <Text style={styles.bannerText}>All skills unlocked. Enjoy the full experience.</Text>
            </>
          ) : (
            <>
              <Text style={styles.bannerTitle}>Unlock all skills</Text>
              <Text style={styles.bannerText}>
                Start a free 7-day trial to open every skill with a bigger daily allowance.
              </Text>
              <Button
                label="Activate free trial"
                full
                style={styles.bannerBtn}
                onPress={() => router.push('/(tabs)/membership')}
              />
            </>
          )}
        </Card>
      )}

      <Card style={styles.meterCard}>
        <UsageMeter used={usedToday} limit={dailyLimit} />
      </Card>

      <Text style={styles.section}>Your skills</Text>
      <View style={styles.list}>
        {skills.map((s) => {
          const unlocked = isSkillUnlocked(s.id);
          return (
            <Card
              key={s.id}
              onPress={() =>
                unlocked ? router.push(`/skill/${s.id}`) : router.push('/(tabs)/membership')
              }
            >
              <View style={styles.row}>
                <Text style={styles.emoji}>{s.emoji}</Text>
                <View style={styles.main}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>{s.title}</Text>
                    {!unlocked && <Text style={styles.lock}>🔒</Text>}
                  </View>
                  <Text style={styles.promise}>{s.promise}</Text>
                </View>
                <Pill label={tierLabel(s.tier)} color={tierColor(s.tier)} />
              </View>
            </Card>
          );
        })}
      </View>

      <Pressable onPress={() => router.push('/how-to')} style={styles.helpLink}>
        <Text style={styles.helpText}>New here? How to use your coach →</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.lg, gap: Spacing.md },
  hi: { fontSize: 28, fontWeight: '800', color: JournalColors.inkBlack, fontFamily: Fonts?.serif },
  sub: { fontSize: 15, color: JournalColors.inkFaint, marginTop: -4 },
  banner: { gap: 6 },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: JournalColors.inkBlack },
  bannerText: { fontSize: 14, color: JournalColors.inkBrown, lineHeight: 20 },
  bannerBtn: { marginTop: Spacing.sm },
  meterCard: {},
  section: {
    fontSize: 18,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
    marginTop: Spacing.sm,
  },
  list: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emoji: { fontSize: 28 },
  main: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, fontWeight: '700', color: JournalColors.inkBlack },
  lock: { fontSize: 13 },
  promise: { fontSize: 13, color: JournalColors.inkFaint, marginTop: 2 },
  helpLink: { alignItems: 'center', paddingVertical: Spacing.lg },
  helpText: { color: JournalColors.tabActive, fontWeight: '700', fontSize: 15 },
});
