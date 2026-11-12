import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { Colors, Fonts } from '@/constants/theme';
import { getRecipe } from '@/data/recipes';

const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function CookModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = getRecipe(id);
  const steps = recipe.steps;

  const [index, setIndex] = useState(0);
  const step = steps[index];
  const [remaining, setRemaining] = useState(step.seconds ?? 0);
  const [running, setRunning] = useState(false);
  const isLast = index === steps.length - 1;

  // Each step starts with a fresh, paused timer.
  useEffect(() => {
    setRemaining(steps[index].seconds ?? 0);
    setRunning(false);
  }, [index, steps]);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      setRemaining((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => clearInterval(tick);
  }, [running]);

  useEffect(() => {
    if (remaining === 0) setRunning(false);
  }, [remaining]);

  const exit = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const next = () => (isLast ? exit() : setIndex(index + 1));
  const prev = () => setIndex(Math.max(index - 1, 0));
  const progress = step.seconds ? remaining / step.seconds : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 26 }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit Cook Mode" onPress={exit} style={styles.exitButton}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.recipeName} numberOfLines={1}>
          {recipe.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {steps.map((s, k) => (
          <View key={s.text} style={[styles.segment, { backgroundColor: k <= index ? Colors.cookAccent : Colors.cookTrack }]} />
        ))}
      </View>

      <Text style={styles.stepCount}>
        STEP {index + 1} OF {steps.length}
      </Text>
      <Text style={styles.stepText} accessibilityRole="header">
        {step.text}
      </Text>

      <View style={styles.timerCard}>
        {step.seconds ? (
          <View accessible accessibilityRole="image" accessibilityLabel={`Timer, ${formatTime(remaining)} left`}>
            <Svg width={84} height={84} viewBox="0 0 84 84">
              <Circle cx="42" cy="42" r={RING_RADIUS} fill="none" stroke={Colors.cookTrack} strokeWidth={8} />
              <Circle
                cx="42"
                cy="42"
                r={RING_RADIUS}
                fill="none"
                stroke={Colors.cookAccent}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - progress)}
                transform="rotate(-90 42 42)"
              />
              <SvgText x="42" y="47" textAnchor="middle" fontFamily={Fonts.bold} fontSize={16} fill="#FFFFFF">
                {formatTime(remaining)}
              </SvgText>
            </Svg>
          </View>
        ) : (
          <View style={styles.noTimer}>
            <Ionicons name={isLast ? 'checkmark' : 'time-outline'} size={32} color={Colors.cookAccent} />
          </View>
        )}
        <View style={styles.timerText}>
          <Text style={styles.timerLabel}>{step.timerLabel}</Text>
          {step.seconds ? (
            <Text style={styles.timerHint}>{remaining === 0 ? "Time's up!" : "We'll ping you when it's time"}</Text>
          ) : null}
        </View>
        {step.seconds && remaining > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={running ? 'Pause timer' : 'Start timer'}
            onPress={() => setRunning(!running)}
            style={styles.timerButton}>
            <Ionicons name={running ? 'pause' : 'play'} size={18} color={Colors.cookBackground} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.voiceHint}>
        <Ionicons name="mic-outline" size={20} color={Colors.cookAccent} />
        <Text style={styles.voiceText}>
          Hands messy? Just say <Text style={styles.voiceStrong}>&quot;next&quot;</Text> or{' '}
          <Text style={styles.voiceStrong}>&quot;repeat&quot;</Text>
        </Text>
      </View>

      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: index === 0 }}
          disabled={index === 0}
          onPress={prev}
          style={[styles.backButton, index === 0 && { opacity: 0.5 }]}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={next} style={styles.nextButton}>
          <Text style={styles.nextText}>{isLast ? 'Finish' : 'Next step'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cookBackground,
    paddingHorizontal: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  exitButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.cookSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeName: {
    flexShrink: 1,
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: Colors.cookMuted,
  },
  headerSpacer: {
    width: 44,
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  stepCount: {
    marginTop: 26,
    fontFamily: Fonts.bold,
    fontSize: 13,
    letterSpacing: 1,
    color: Colors.cookAccent,
  },
  stepText: {
    marginTop: 10,
    fontFamily: Fonts.displayBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  timerCard: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: Colors.cookSurface,
    borderRadius: 24,
    padding: 16,
  },
  noTimer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 8,
    borderColor: Colors.cookTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    flex: 1,
  },
  timerLabel: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  timerHint: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.cookMuted,
  },
  timerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cookAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHint: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.cookTrack,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  voiceText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.cookText,
  },
  voiceStrong: {
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  nav: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    width: 110,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.cookTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  nextButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: Colors.cookAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.cookBackground,
  },
});
