import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { JournalColors, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';
import * as api from '@/lib/api';
import type { SkillMeta } from '@/server-shared/api';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { messagesLeftToday, applyMeter } = useSession();

  const [meta, setMeta] = useState<SkillMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const counter = useRef(0);

  useEffect(() => {
    let active = true;
    if (!id) return;
    api
      .getSkill({ skillId: id })
      .then((result) => {
        if (active) setMeta(result.meta);
      })
      .catch(() => {
        if (active) setNotice('Could not load this coach.');
      });
    return () => {
      active = false;
    };
  }, [id]);

  const nextId = () => `m${counter.current++}`;
  const atLimit = messagesLeftToday <= 0;

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || atLimit || sending || !id) return;

      const userMsg: ChatMessage = { id: nextId(), role: 'user', text: trimmed };
      const pendingId = nextId();
      const pending: ChatMessage = { id: pendingId, role: 'coach', text: '', pending: true };

      // Snapshot the history the server needs before the optimistic render;
      // the placeholder bubble must not be sent as a turn.
      const history = [
        ...messages.map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        })),
        { role: 'user' as const, content: trimmed },
      ];

      setMessages((prev) => [...prev, userMsg, pending]);
      setInput('');
      setSending(true);
      setNotice(null);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

      try {
        const result = await api.sendChat(id, history);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, pending: false, text: result.reply } : m
          )
        );
        applyMeter(result.meter);
      } catch (error) {
        // Drop the placeholder rather than leaving a bubble spinning forever.
        setMessages((prev) => prev.filter((m) => m.id !== pendingId));
        if (error instanceof api.ApiError) {
          if (error.code === 'cap_reached') {
            setNotice("You've hit today's message limit.");
          } else if (error.status === 402) {
            setNotice('This skill is locked on your plan.');
          } else {
            setNotice(error.message);
          }
        } else {
          setNotice('Could not reach the coach. Try again.');
        }
      } finally {
        setSending(false);
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
      }
    },
    [atLimit, sending, id, messages, applyMeter]
  );

  if (!meta) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.padded}>
          <Header title="Loading" showBack />
          {notice ? (
            <Text style={styles.notice}>{notice}</Text>
          ) : (
            <ActivityIndicator style={styles.loader} color={JournalColors.inkFaint} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.padded}>
        <Header
          title={meta.coachName}
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
              <Text style={styles.emptyEmoji}>{meta.emoji}</Text>
              <Text style={styles.emptyTitle}>Chat with {meta.coachName}</Text>
              <Text style={styles.emptySub}>{meta.coachTagline}</Text>
              <View style={styles.starters}>
                {meta.starters.map((s, i) => (
                  <Pressable key={i} onPress={() => send(s)} style={styles.chip}>
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} coachName={meta.coachName} />
          ))}

          {notice && <Text style={styles.notice}>{notice}</Text>}
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
              placeholder={`Message ${meta.coachName}…`}
              placeholderTextColor={JournalColors.inkFaint}
              value={input}
              onChangeText={setInput}
              multiline
              editable={!sending}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => send(input)}
              disabled={!input.trim() || sending}
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]}
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
  loader: { marginTop: 40 },
  notice: {
    textAlign: 'center',
    color: JournalColors.inkFaint,
    fontSize: 13,
    marginTop: Spacing.md,
  },
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
