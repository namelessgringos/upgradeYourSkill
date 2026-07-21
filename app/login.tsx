import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Elevation, Fonts, JournalColors, Radius } from '@/constants/theme';
import { useSession, type AuthProvider } from '@/hooks/useSession';

export default function Login() {
  const { signIn } = useSession();

  const handle = async (provider: AuthProvider) => {
    await signIn(provider);
    router.replace('/onboarding');
  };

  return (
    <Screen contentStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.mark}>📚</Text>
        <Text style={styles.name}>Upgrade Your Skill</Text>
        <Text style={styles.sub}>
          Curated expert guides, plus an AI coach that teaches and applies them — one skill at a
          time.
        </Text>
      </View>

      <View style={styles.actions}>
        <SocialButton
          label="Continue with Google"
          glyph="G"
          onPress={() => handle('google')}
        />
        <SocialButton
          label="Continue with Apple"
          glyph="apple"
          onPress={() => handle('apple')}
        />
        <Text style={styles.legal}>
          By continuing you agree to the Terms and Privacy Policy. (Mock sign-in — no real account
          is created.)
        </Text>
      </View>
    </Screen>
  );
}

function SocialButton({
  label,
  glyph,
  onPress,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.social, pressed && styles.pressed]}>
      <Text style={styles.glyph}>{glyph === 'apple' ? '' : glyph}</Text>
      <Text style={styles.socialLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingVertical: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { fontSize: 60, marginBottom: 16 },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: JournalColors.inkBlack,
    fontFamily: Fonts?.serif,
    textAlign: 'center',
  },
  sub: {
    marginTop: 12,
    color: JournalColors.inkBrown,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  actions: { gap: 12 },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: JournalColors.white,
    borderColor: JournalColors.gridLineBold,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    paddingVertical: 15,
    ...Elevation.card,
  },
  pressed: { opacity: 0.85 },
  glyph: { fontSize: 18, fontWeight: '800', color: JournalColors.inkBlack },
  socialLabel: { fontSize: 16, fontWeight: '700', color: JournalColors.inkBrown },
  legal: { color: JournalColors.inkFaint, fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
