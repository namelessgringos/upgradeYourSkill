import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Fonts, JournalColors } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

export default function Index() {
  const { loading, user, onboarded } = useSession();

  if (loading) return <Splash />;
  if (!user) return <Redirect href="/login" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

function Splash() {
  return (
    <View style={styles.splash}>
      <Text style={styles.mark}>📚</Text>
      <Text style={styles.name}>Upgrade Your Skill</Text>
      <Text style={styles.tagline}>Expert guides. A coach in your pocket.</Text>
      <ActivityIndicator color={JournalColors.inkBrown} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: JournalColors.paperBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mark: { fontSize: 64, marginBottom: 16 },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
    textAlign: 'center',
  },
  tagline: { marginTop: 8, color: JournalColors.inkFaint, fontSize: 15 },
  spinner: { marginTop: 32 },
});
