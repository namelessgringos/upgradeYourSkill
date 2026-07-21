import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Fonts, JournalColors, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

export default function Settings() {
  const { user, plan, usedToday, dailyLimit, signOut, resetAll } = useSession();

  // Mock preferences — local only in the prototype.
  const [notifications, setNotifications] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [haptics, setHaptics] = useState(true);

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const onReset = () => {
    Alert.alert('Reset prototype', 'Clears the mock account and restarts onboarding.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetAll();
          router.replace('/login');
        },
      },
    ]);
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
              Signed in with {user?.provider === 'apple' ? 'Apple' : 'Google'} · {plan} plan
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Usage</Text>
        <Text style={styles.usage}>
          {usedToday} of {dailyLimit} messages used today.
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/membership')}>
          <Text style={styles.link}>View membership & usage →</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Preferences</Text>
        <Toggle label="Push notifications" value={notifications} onChange={setNotifications} />
        <Toggle label="Sound effects" value={sounds} onChange={setSounds} />
        <Toggle label="Haptic feedback" value={haptics} onChange={setHaptics} />
      </Card>

      <Card>
        <Pressable onPress={() => router.push('/how-to')}>
          <Text style={styles.link}>How to use your coach →</Text>
        </Pressable>
      </Card>

      <Button label="Log out" variant="secondary" full onPress={onLogout} />
      <Pressable onPress={onReset} style={styles.reset}>
        <Text style={styles.resetText}>Reset prototype data</Text>
      </Pressable>
    </Screen>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: JournalColors.selectedBorder, false: JournalColors.gridLine }}
        thumbColor={JournalColors.white}
      />
    </View>
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
  provider: { fontSize: 12, color: JournalColors.inkFaint, marginTop: 2, textTransform: 'capitalize' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: JournalColors.inkBlack, marginBottom: Spacing.sm },
  usage: { fontSize: 14, color: JournalColors.inkBrown, marginBottom: Spacing.sm },
  link: { color: JournalColors.tabActive, fontWeight: '700', fontSize: 15 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 15, color: JournalColors.inkBrown },
  reset: { alignItems: 'center', paddingVertical: Spacing.md },
  resetText: { color: JournalColors.buttonDanger, fontWeight: '600' },
});
