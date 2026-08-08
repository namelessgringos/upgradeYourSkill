import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Divider,
  List,
  SegmentedButtons,
  Surface,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';
import { Screen } from '@/components/ui/Screen';
import { LEGAL_URLS } from '@/constants/legal';
import { Spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { billing } from '@/lib/billing';
import { usePreferences, type TextSize } from '@/hooks/usePreferences';
import { useSession } from '@/hooks/useSession';

const TEXT_SIZES = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

export default function Settings() {
  const theme = useTheme();
  const { user, plan, usedToday, dailyLimit, signOut, resetAll } = useSession();
  const { haptics: hapticsOn, textSize, set, tap } = usePreferences();

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
      <Text variant="headlineMedium" style={styles.h1}>
        Settings
      </Text>

      <Surface style={styles.card} elevation={1}>
        <View style={styles.profile}>
          <Avatar.Text size={52} label={user?.name.charAt(0) ?? '?'} />
          <View style={styles.profileMain}>
            <Text variant="titleMedium" style={styles.name}>
              {user?.name ?? 'Guest'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {user?.email ?? ''}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {user?.provider === 'apple' ? 'Apple' : 'Google'} · {planLabel}
            </Text>
          </View>
        </View>
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          Daily limit
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
          {usedToday} of {dailyLimit} coach messages used today.
        </Text>
        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          The limit resets every day at midnight. We never charge you for going over — the coach
          pauses and you choose what happens next.
        </Text>
        <List.Item
          title="Membership & usage"
          onPress={() => router.push('/(tabs)/membership')}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          style={styles.rowFlush}
        />
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          Reading
        </Text>
        <View style={styles.rowBetween}>
          <Text variant="bodyMedium">Guide text size</Text>
          <SegmentedButtons
            value={textSize}
            onValueChange={(v) => {
              tap();
              set('textSize', v as TextSize);
            }}
            density="small"
            buttons={TEXT_SIZES}
            style={styles.segmented}
          />
        </View>
        {Platform.OS !== 'web' && (
          <View style={styles.rowBetween}>
            <Text variant="bodyMedium">Haptic feedback</Text>
            <Switch
              value={hapticsOn}
              onValueChange={(value) => {
                set('haptics', value);
                if (value) haptics.tap();
              }}
            />
          </View>
        )}
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          Subscription
        </Text>
        <List.Item
          title="Manage subscription"
          onPress={onManageSubscription}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          style={styles.rowFlush}
        />
        <Divider />
        <List.Item
          title="How to use your coach"
          onPress={() => router.push('/how-to')}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          style={styles.rowFlush}
        />
      </Surface>

      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          Legal
        </Text>
        <List.Item
          title="Privacy policy"
          onPress={() => openLegal(LEGAL_URLS.privacy)}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          style={styles.rowFlush}
        />
        <Divider />
        <List.Item
          title="Terms of use"
          onPress={() => openLegal(LEGAL_URLS.terms)}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          style={styles.rowFlush}
        />
      </Surface>

      <Button mode="outlined" onPress={onLogout} style={styles.action}>
        Log out
      </Button>

      <Button
        mode="text"
        textColor={theme.colors.error}
        onPress={onDeleteAccount}
        style={styles.action}
      >
        Delete account
      </Button>

      {__DEV__ && (
        <Button
          mode="text"
          textColor={theme.colors.onSurfaceVariant}
          onPress={async () => {
            await resetAll();
            router.replace('/login');
          }}
        >
          Reset local data (dev)
        </Button>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  h1: { fontWeight: '800' },
  card: { borderRadius: 12, padding: Spacing.lg, gap: 4 },
  profile: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  profileMain: { flex: 1, gap: 1 },
  name: { fontWeight: '800' },
  cardTitle: { fontWeight: '800', marginBottom: Spacing.xs, opacity: 0.7 },
  note: { marginTop: 4, lineHeight: 18 },
  rowFlush: { paddingHorizontal: 0, marginHorizontal: -8 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  segmented: { minWidth: 150 },
  action: { marginTop: Spacing.xs },
});
