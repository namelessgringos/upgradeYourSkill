import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { UsageMeter } from '@/components/ui/UsageMeter';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';
import { usePreferences } from '@/hooks/usePreferences';
import { useSession } from '@/hooks/useSession';
import { billing, MONTHLY, type Offering } from '@/lib/billing';

export default function Membership() {
  const {
    plan,
    trialActive,
    trialDaysLeft,
    usedToday,
    dailyLimit,
    lifetimeMessages,
    activeDays,
    reviewBonusClaimed,
    activateTrial,
    claimReviewBonus,
    refresh,
  } = useSession();
  const { tap } = usePreferences();

  const [offering, setOffering] = useState<Offering>(MONTHLY);
  const [busy, setBusy] = useState<null | 'purchase' | 'restore' | 'trial'>(null);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    let cancelled = false;
    billing
      .getOfferings()
      .then(([first]) => {
        if (!cancelled && first) setOffering(first);
      })
      .catch(() => {
        // Falls back to the compiled-in offering; the price still renders.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const daysActive = Math.max(1, activeDays);
  const planLabel = plan === 'pro' ? 'Full access' : trialActive ? 'Free trial' : 'Free';
  const planColor = plan === 'pro' || trialActive ? JournalColors.accent : JournalColors.inkFaint;

  const onPurchase = async () => {
    setBusy('purchase');
    tap();
    try {
      const result = await billing.purchase(offering.id);
      if (result.status === 'purchased' || result.status === 'restored') {
        await refresh();
        Alert.alert('You’re in 🎉', 'Every skill is unlocked. Thanks for subscribing.');
      } else if (result.status === 'unavailable') {
        Alert.alert('Not available', result.reason);
      }
      // 'cancelled' is not an error and does not deserve an alert.
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    setBusy('restore');
    try {
      const result = await billing.restore();
      if (result.status === 'restored') {
        await refresh();
        Alert.alert('Restored', 'Your subscription is active on this device again.');
      } else {
        Alert.alert('Nothing to restore', 'No previous purchase was found for this account.');
      }
    } finally {
      setBusy(null);
    }
  };

  const onTrial = async () => {
    setBusy('trial');
    try {
      await activateTrial();
    } finally {
      setBusy(null);
    }
  };

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
          <Text style={styles.planNote}>
            {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left, then it goes back to Free
            unless you subscribe.
          </Text>
        ) : plan === 'pro' ? (
          <Text style={styles.planNote}>
            Every skill unlocked, {dailyLimit} coach messages a day. Renews monthly.
          </Text>
        ) : (
          <Text style={styles.planNote}>
            One skill, {dailyLimit} coach messages a day. The written guide for your skill stays
            yours to read.
          </Text>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Usage</Text>
        <UsageMeter used={usedToday} limit={dailyLimit} />
        <View style={styles.statsRow}>
          <Stat label="Today" value={`${usedToday}`} />
          <Stat label="All-time" value={`${lifetimeMessages}`} />
          <Stat label="Avg / day" value={`${Math.round(lifetimeMessages / daysActive)}`} />
        </View>
      </Card>

      {plan !== 'pro' && (
        <Card muted style={styles.offer}>
          <View style={styles.offerHead}>
            <Text style={styles.offerTitle}>{offering.title}</Text>
            <Text style={styles.price}>
              {offering.priceLabel}
              <Text style={styles.per}> / {offering.period}</Text>
            </Text>
          </View>
          <Text style={styles.offerDescription}>{offering.description}</Text>

          <View style={styles.perks}>
            {offering.perks.map((perk) => (
              <View key={perk} style={styles.perkRow}>
                <Text style={styles.tick}>✓</Text>
                <Text style={styles.perkText}>{perk}</Text>
              </View>
            ))}
          </View>

          {busy === 'purchase' ? (
            <ActivityIndicator color={JournalColors.inkBrown} style={styles.spinner} />
          ) : (
            <Button label={`Subscribe · ${offering.priceLabel}/mo`} full onPress={onPurchase} />
          )}

          {!trialActive && (
            <Button
              label="Try 7 days free first"
              variant="secondary"
              full
              disabled={busy === 'trial'}
              onPress={onTrial}
            />
          )}

          <Text style={styles.finePrint}>
            Renews every month until you cancel. Cancel any time from Settings — you keep access
            until the month you paid for runs out.
          </Text>
        </Card>
      )}

      <Card style={styles.reviewCard}>
        <Text style={styles.cardTitle}>Get a free week ⭐</Text>
        <Text style={styles.offerDescription}>
          Leave us a 5-star review and we’ll add an extra week.
        </Text>
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

      <Pressable onPress={onRestore} disabled={busy === 'restore'} style={styles.restore}>
        <Text style={styles.restoreText}>
          {busy === 'restore' ? 'Checking…' : 'Restore purchases'}
        </Text>
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
  planNote: { fontSize: 14, color: JournalColors.inkBrown, lineHeight: 20 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    marginBottom: Spacing.sm,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  stat: { alignItems: 'center', flex: 1 },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
  },
  statLabel: { fontSize: 12, color: JournalColors.inkFaint, marginTop: 2 },
  offer: { gap: Spacing.sm },
  offerHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  offerTitle: { fontSize: 18, fontWeight: '800', color: JournalColors.inkBlack },
  price: {
    fontSize: 24,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
  },
  per: { fontSize: 14, fontWeight: '600', color: JournalColors.inkFaint },
  offerDescription: { fontSize: 14, color: JournalColors.inkBrown, lineHeight: 20 },
  perks: { gap: 6, marginVertical: Spacing.sm },
  perkRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  tick: { color: JournalColors.selectedBorder, fontWeight: '800', fontSize: 15 },
  perkText: { flex: 1, fontSize: 14, color: JournalColors.inkBrown, lineHeight: 20 },
  spinner: { paddingVertical: 14 },
  finePrint: { fontSize: 12, color: JournalColors.inkFaint, lineHeight: 17, marginTop: 4 },
  reviewCard: { gap: Spacing.sm },
  stars: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
  star: { fontSize: 32, color: JournalColors.accent },
  claimed: { color: JournalColors.selectedBorder, fontWeight: '700', fontSize: 15 },
  restore: { alignItems: 'center', paddingVertical: Spacing.md },
  restoreText: { color: JournalColors.inkFaint, fontWeight: '600' },
});
