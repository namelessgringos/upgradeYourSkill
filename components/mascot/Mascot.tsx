/**
 * The app mascot: one small character that lives above the tab bar, breathes
 * and blinks while you use the app, and opens a help sheet when tapped.
 *
 * It is deliberately a single brand character, not a per-skill persona — that
 * distinction is what keeps it inside MVP scope (persona switching is E10,
 * post-MVP). Its answers come from a swappable `MascotBrain`; today that is a
 * hand-written help set, later it can be something smarter without changing
 * anything you see here.
 *
 * Motion respects the OS "reduce motion" setting: when that is on, the
 * creature holds still and only reacts to a tap.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { List, Modal, Portal, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { haptics } from '@/lib/haptics';
import {
  deviceMascotLocale,
  staticBrain,
  type MascotBrain,
  type MascotLocale,
} from './brain';
import { mascotHidden, subscribeScroll } from './scrollSignal';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const SIZE = 56;
const EYE_RY = 4.2;

export function Mascot({ brain = staticBrain }: { brain?: MascotBrain }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // The device language, if the mascot speaks it and it is not English.
  // When there is one, the sheet offers a two-way English/device toggle and
  // opens in the device language; otherwise English is the only choice.
  const otherLocale = deviceMascotLocale();
  const [lang, setLang] = useState<MascotLocale>(otherLocale ?? 'en');

  // Drop the touch target while the mascot is faded out for scrolling, so a
  // quick tap lands on the content underneath it instead of on the creature.
  const [hidden, setHidden] = useState(false);
  useEffect(() => subscribeScroll(setHidden), []);

  const bob = useSharedValue(0);
  const breathe = useSharedValue(1);
  const blink = useSharedValue(1);
  const press = useSharedValue(1);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      bob.value = 0;
      breathe.value = 1;
      blink.value = 1;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
    // Hold the eyes open, then a quick close-open, on a long loop.
    blink.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(1, { duration: 0 })),
        withTiming(0.08, { duration: 70 }),
        withTiming(1, { duration: 90 })
      ),
      -1
    );
  }, [reduceMotion, bob, breathe, blink]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: 1 - mascotHidden.value,
    transform: [
      { translateY: bob.value + mascotHidden.value * 28 },
      { scale: breathe.value * press.value * (1 - mascotHidden.value * 0.3) },
    ],
  }));
  const eyeProps = useAnimatedProps(() => ({ ry: EYE_RY * blink.value }));

  const onPress = () => {
    haptics.pulse();
    press.value = withSequence(
      withTiming(0.86, { duration: 90 }),
      withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) })
    );
    setOpen(true);
  };

  const content = brain.content(lang);
  const enLabel = brain.content('en').label;
  const otherLabel = otherLocale ? brain.content(otherLocale).label : null;

  return (
    <>
      <Animated.View
        style={[styles.dock, containerStyle]}
        pointerEvents={hidden ? 'none' : 'box-none'}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Open help"
          hitSlop={10}
        >
          <Svg width={SIZE} height={SIZE} viewBox="0 0 56 56">
            <Ellipse cx={28} cy={50} rx={16} ry={3} fill={theme.colors.outline} opacity={0.35} />
            <Path
              d="M12 30a16 16 0 0 1 32 0v6a16 16 0 0 1-32 0z"
              fill={theme.colors.primary}
            />
            <Circle cx={28} cy={30} r={16} fill={theme.colors.primary} />
            {/* little antenna, so it reads as a creature not a coin */}
            <Path d="M28 14V8" stroke={theme.colors.primary} strokeWidth={2.5} strokeLinecap="round" />
            <Circle cx={28} cy={7} r={2.4} fill={theme.colors.tertiary} />
            <AnimatedEllipse cx={22} cy={30} rx={4.2} animatedProps={eyeProps} fill={theme.colors.onPrimary} />
            <AnimatedEllipse cx={34} cy={30} rx={4.2} animatedProps={eyeProps} fill={theme.colors.onPrimary} />
            <Circle cx={22.8} cy={30.6} r={1.8} fill={theme.colors.primary} />
            <Circle cx={34.8} cy={30.6} r={1.8} fill={theme.colors.primary} />
            <Path
              d="M24 38q4 3 8 0"
              stroke={theme.colors.onPrimary}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Pressable>
      </Animated.View>

      <Portal>
        <Modal
          visible={open}
          onDismiss={() => setOpen(false)}
          contentContainerStyle={[styles.sheet, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text variant="titleMedium" style={styles.sheetTitle}>
              {lang === 'uk' ? 'Потрібна допомога?' : 'Need a hand?'}
            </Text>
            {otherLocale && otherLabel && (
              <SegmentedButtons
                value={lang}
                onValueChange={(v) => {
                  haptics.tap();
                  setLang(v as MascotLocale);
                  setExpanded(null);
                }}
                density="small"
                buttons={[
                  { value: 'en', label: enLabel },
                  { value: otherLocale, label: otherLabel },
                ]}
              />
            )}
          </View>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {content.greeting}
          </Text>
          <View style={styles.list}>
            {content.suggestions.map((item, i) => (
              <List.Accordion
                key={item.question}
                title={item.question}
                titleNumberOfLines={2}
                expanded={expanded === i}
                onPress={() => setExpanded(expanded === i ? null : i)}
                left={(props) => <List.Icon {...props} icon="chat-question-outline" />}
              >
                <Text variant="bodyMedium" style={styles.answer}>
                  {item.answer}
                </Text>
              </List.Accordion>
            ))}
          </View>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', right: 16, bottom: 96, zIndex: 20 },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 'auto',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 8,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  sheetTitle: { fontWeight: '800' },
  list: { marginTop: 8 },
  answer: { paddingHorizontal: 16, paddingBottom: 14, lineHeight: 20 },
});
