import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { UsageMeter } from '@/components/ui/UsageMeter';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

export default function Membership() {
  const {
    plan,
    trialActive,
    trialDaysLeft,
    usedToday,
    dailyLimit,
    usageByDay,
    reviewBonusClaimed,
    activateTrial,
    claimReviewBonus,
  } = useSession();

  const [rating, setRating] = useState(0);

  const totalMessages = Object.values(usageByDay).reduce((a, b) => a + b, 0);
  const daysActive = Object.keys(usageByDay).length || 1;

  const planLabel = plan === 'pro' ? 'Pro' : trialActive ? 'Free trial' : 'Free';
  const planColor = plan === 'pro' || trialActive ? JournalColors.accent : JournalColors.inkFaint;

  const onClaim = async () => {
    await claimReviewBonus();
    Alert.alert('Thank you! 🎉', 'An extra week has been added to your access.');
  };

  return (
    <Screen scroll contentStyle={styles.container}>
      <Text style={styles.h1}>Membership</Text>

      <Card style={styles.planCard}>
        <View style={styles.planRow}>
          <Text style={styles.planName}>Your plan</Text>
          <Pill label={planLabel} color={planColor} filled={trialActive || plan === 'pro'} />
        </View>
        {trialActive ? (
          <Text style={styles.planNote}>{trialDaysLeft} days left in your free trial.</Text>
        ) : plan === 'pro' ? (
          <Text style={styles.planNote}>You have full access to every skill.</Text>
        ) : (
          <Text style={styles.planNote}>1 skill, {dailyLimit} messages a day.</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Usage</Text>
        <UsageMeter used={usedToday} limit={dailyLimit} />
        <View style={styles.statsRow}>
          <Stat label="Today" value={`${usedToday}`} />
          <Stat label="All-time" value={`${totalMessages}`} />
          <Stat label="Avg / day" value={`${Math.round(totalMessages / daysActive)}`} />
        </View>
      </Card>

      {!trialActive && plan !== 'pro' && (
        <Card muted style={styles.upsell}>
          <Text style={styles.cardTitle}>Unlock everything</Text>
          <Text style={styles.upsellText}>All 3 skills · 50 messages a day · free for 7 days.</Text>
          <Button label="Start 7-day free trial" full onPress={activateTrial} />
        </Card>
      )}

      {trialActive && (
        <Card style={styles.upsell}>
          <Text style={styles.cardTitle}>Keep your access</Text>
          <Text style={styles.upsellText}>
            Subscribe to keep all skills after your trial. One simple monthly plan.
          </Text>
          <Button
            label="Subscribe (mock)"
            full
            onPress={() => Alert.alert('Checkout', 'Billing is mocked in this prototype.')}
          />
        </Card>
      )}

      <Card style={styles.reviewCard}>
        <Text style={styles.cardTitle}>Get a free week ⭐</Text>
        <Text style={styles.upsellText}>Leave us a 5-star review and we’ll add an extra week.</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} disabled={reviewBonusClaimed} hitSlop={6}>
              <Text style={styles.star}>{n <= rating ? '★' : '☆'}</Text>
            </Pressable>
          ))}
        </View>
        {reviewBonusClaimed ? (
          <Text style={styles.claimed}>✓ Bonus week claimed — thank you!</Text>
        ) : (
          <Button label="Claim extra week" full disabled={rating < 5} onPress={onClaim} />
        )}
      </Card>

      <Pressable
        onPress={() => Alert.alert('Restore purchases', 'Mocked in this prototype.')}
        style={styles.restore}
      >
        <Text style={styles.restoreText}>Restore purchases</Text>
      </Pressable>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.lg, gap: Spacing.md },
  h1: { fontSize: 28, fontWeight: '800', color: JournalColors.inkBlack, fontFamily: Fonts?.serif },
  planCard: { gap: 8 },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: 17, fontWeight: '800', color: JournalColors.inkBlack },
  planNote: { fontSize: 14, color: JournalColors.inkBrown },
  cardTitle: { fontSize: 16, fontWeight: '800', color: JournalColors.inkBlack, marginBottom: Spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: JournalColors.inkBlack, fontFamily: Fonts?.serif },
  statLabel: { fontSize: 12, color: JournalColors.inkFaint, marginTop: 2 },
  upsell: { gap: Spacing.sm },
  upsellText: { fontSize: 14, color: JournalColors.inkBrown, lineHeight: 20, marginBottom: Spacing.sm },
  reviewCard: { gap: Spacing.sm },
  stars: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
  star: { fontSize: 32, color: JournalColors.accent },
  claimed: { color: JournalColors.selectedBorder, fontWeight: '700', fontSize: 15 },
  restore: { alignItems: 'center', paddingVertical: Spacing.md },
  restoreText: { color: JournalColors.inkFaint, fontWeight: '600' },
});
