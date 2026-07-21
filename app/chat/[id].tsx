import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { ChatBubble, type ChatMessage } from '@/components/ui/ChatBubble';
import { Header } from '@/components/ui/Header';
import { getSkill } from '@/constants/mockData';
import { JournalColors, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const skill = getSkill(id);
  const { messagesLeftToday, recordMessage } = useSession();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const counter = useRef(0);

  if (!skill) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.padded}>
          <Header title="Not found" showBack />
        </View>
      </SafeAreaView>
    );
  }

  const nextId = () => `m${counter.current++}`;
  const atLimit = messagesLeftToday <= 0;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || atLimit) return;

    const userMsg: ChatMessage = { id: nextId(), role: 'user', text: trimmed };
    const pendingId = nextId();
    const pending: ChatMessage = { id: pendingId, role: 'coach', text: '', pending: true };

    setMessages((prev) => [...prev, userMsg, pending]);
    setInput('');
    recordMessage();
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    const canned = skill.reply(trimmed);
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, pending: false, text: canned.text, artifact: canned.artifact }
            : m
        )
      );
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }, 650);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.padded}>
        <Header
          title={skill.coachName}
          showBack
          right={<Text style={styles.left}>{messagesLeftToday} left</Text>}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{skill.emoji}</Text>
              <Text style={styles.emptyTitle}>Chat with {skill.coachName}</Text>
              <Text style={styles.emptySub}>{skill.coachTagline}</Text>
              <View style={styles.starters}>
                {skill.starters.map((s, i) => (
                  <Pressable key={i} onPress={() => send(s)} style={styles.chip}>
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} coachName={skill.coachName} />
          ))}
        </ScrollView>

        {atLimit ? (
          <View style={styles.limit}>
            <Text style={styles.limitText}>You’ve hit today’s message limit.</Text>
            <Button
              label="Get more with a free trial"
              full
              onPress={() => router.push('/(tabs)/membership')}
            />
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder={`Message ${skill.coachName}…`}
              placeholderTextColor={JournalColors.inkFaint}
              value={input}
              onChangeText={setInput}
              multiline
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => send(input)}
              disabled={!input.trim()}
              style={[styles.sendBtn, !input.trim() && styles.sendDisabled]}
            >
              <Text style={styles.sendText}>↑</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: JournalColors.paperBg },
  flex: { flex: 1 },
  padded: { paddingHorizontal: Spacing.lg },
  left: { fontSize: 12, fontWeight: '700', color: JournalColors.inkFaint },
  messages: { padding: Spacing.lg, flexGrow: 1 },
  empty: { alignItems: 'center', paddingTop: Spacing.xl, gap: 6 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: JournalColors.inkBlack },
  emptySub: { fontSize: 13, color: JournalColors.inkFaint, textAlign: 'center' },
  starters: { gap: Spacing.sm, marginTop: Spacing.lg, width: '100%' },
  chip: {
    backgroundColor: JournalColors.white,
    borderColor: JournalColors.gridLineBold,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  chipText: { color: JournalColors.inkBrown, fontSize: 15, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: JournalColors.gridLine,
    backgroundColor: JournalColors.white,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: JournalColors.paperBg,
    borderColor: JournalColors.gridLine,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: JournalColors.inkBlack,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.card,
    backgroundColor: JournalColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: JournalColors.white, fontSize: 22, fontWeight: '800' },
  limit: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: JournalColors.gridLine,
    backgroundColor: JournalColors.white,
  },
  limitText: { textAlign: 'center', color: JournalColors.inkBrown, fontSize: 14 },
});
