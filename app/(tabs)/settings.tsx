import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { LEGAL_URLS } from '@/constants/legal';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';
import { billing } from '@/lib/billing';
import { usePreferences, type TextSize } from '@/hooks/usePreferences';
import { useSession } from '@/hooks/useSession';

const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

export default function Settings() {
  const { user, plan, usedToday, dailyLimit, signOut, resetAll } = useSession();
  const { haptics, textSize, set, tap } = usePreferences();

  const planLabel = plan === 'pro' ? 'Full access' : plan === 'trial' ? 'Free trial' : 'Free';

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const onManageSubscription = async () => {
    const url = billing.manageSubscriptionUrl();
    if (!url) {
      Alert.alert(
        'Not available yet',
        'Subscriptions are not live yet, so there is nothing to manage. Once billing is on, this opens your subscription in the App Store.'
      );
      return;
    }
    await Linking.openURL(url);
  };

  const openLegal = async (url: string) => {
    if (Platform.OS === 'web') {
      await Linking.openURL(url);
      return;
    }
    await WebBrowser.openBrowserAsync(url);
  };

  // Required by App Store review guideline 5.1.1(v): an account created in the
  // app must be deletable from inside the app.
  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, your subscription record and your chat history. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Not wired yet',
              'Account deletion needs a server endpoint that erases the user document, usage records and auth account. Tracked in docs/BUREAUCRACY.md — it blocks App Store submission, not this build.'
            ),
        },
      ]
    );
  };

  return (
    <Screen scroll contentStyle={styles.container}>
      <Text style={styles.h1}>Settings</Text>

      <Card>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name.charAt(0) ?? '?'}</Text>
          </View>
          <View style={styles.profileMain}>
            <Text style={styles.name}>{user?.name ?? 'Guest'}</Text>
            <Text style={styles.email}>{user?.email ?? ''}</Text>
            <Text style={styles.provider}>
              {user?.provider === 'apple' ? 'Apple' : 'Google'} · {planLabel}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Daily limit</Text>
        <Text style={styles.usage}>
          {usedToday} of {dailyLimit} coach messages used today.
        </Text>
        <Text style={styles.note}>
          The limit resets every day at midnight. We never charge you for going over — the coach
          pauses and you choose what happens next.
        </Text>
        <Row label="Membership & usage" onPress={() => router.push('/(tabs)/membership')} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Reading</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Guide text size</Text>
          <View style={styles.segmented}>
            {TEXT_SIZES.map((option) => {
              const active = option.value === textSize;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    tap();
                    set('textSize', option.value);
                  }}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {Platform.OS !== 'web' && (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Haptic feedback</Text>
            <Switch
              value={haptics}
              onValueChange={(value) => {
                set('haptics', value);
                if (value) tap();
              }}
              trackColor={{ true: JournalColors.selectedBorder, false: JournalColors.gridLine }}
              thumbColor={JournalColors.white}
              ios_backgroundColor={JournalColors.gridLine}
            />
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Subscription</Text>
        <Row label="Manage subscription" onPress={onManageSubscription} />
        <Row label="How to use your coach" onPress={() => router.push('/how-to')} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Legal</Text>
        <Row label="Privacy policy" onPress={() => openLegal(LEGAL_URLS.privacy)} />
        <Row label="Terms of use" onPress={() => openLegal(LEGAL_URLS.terms)} />
      </Card>

      <Button label="Log out" variant="secondary" full onPress={onLogout} />

      <Pressable onPress={onDeleteAccount} style={styles.danger}>
        <Text style={styles.dangerText}>Delete account</Text>
      </Pressable>

      {__DEV__ && (
        <Pressable
          onPress={async () => {
            await resetAll();
            router.replace('/login');
          }}
          style={styles.danger}
        >
          <Text style={styles.devText}>Reset local data (dev)</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.lg, gap: Spacing.md },
  h1: { fontSize: 28, fontWeight: '800', color: JournalColors.inkBlack, fontFamily: Fonts?.serif },
  profile: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: JournalColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: JournalColors.white, fontSize: 22, fontWeight: '800' },
  profileMain: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: JournalColors.inkBlack },
  email: { fontSize: 14, color: JournalColors.inkFaint },
  provider: { fontSize: 12, color: JournalColors.inkFaint, marginTop: 2 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    marginBottom: Spacing.sm,
  },
  usage: { fontSize: 14, color: JournalColors.inkBrown },
  note: { fontSize: 13, color: JournalColors.inkFaint, lineHeight: 18, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: JournalColors.gridLine,
    marginTop: 4,
  },
  rowLabel: { fontSize: 15, color: JournalColors.inkBrown, fontWeight: '600' },
  rowChevron: { fontSize: 22, color: JournalColors.inkFaint, lineHeight: 22 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 15, color: JournalColors.inkBrown },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: JournalColors.gridLine,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: { paddingHorizontal: 16, paddingVertical: 6 },
  segmentActive: { backgroundColor: JournalColors.buttonPrimary },
  segmentText: { fontSize: 14, fontWeight: '700', color: JournalColors.inkFaint },
  segmentTextActive: { color: JournalColors.white },
  danger: { alignItems: 'center', paddingVertical: Spacing.sm },
  dangerText: { color: JournalColors.buttonDanger, fontWeight: '600' },
  devText: { color: JournalColors.inkFaint, fontWeight: '600', fontSize: 13 },
});
