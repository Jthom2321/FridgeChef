import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Tints } from '@/constants/theme';
import { QUICK_SWAPS, SYNONYMS } from '@/data/recipes';

export default function SwapsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const synonyms = SYNONYMS.filter((s) => !q || s.a.toLowerCase().includes(q) || s.b.toLowerCase().includes(q));
  const swaps = QUICK_SWAPS.filter((s) => !q || s.outOf.toLowerCase().includes(q) || s.use.toLowerCase().includes(q));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      keyboardShouldPersistTaps="handled">
      <View>
        <Text style={styles.eyebrow}>Ingredient Translator</Text>
        <Text style={styles.title} accessibilityRole="header">
          Same food, different name.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label} nativeID="swap-q-label">
          Look up a swap or a name
        </Text>
        <View style={styles.inputRow}>
          <Ionicons name="search" size={18} color={Colors.muted} />
          <TextInput
            accessibilityLabelledBy="swap-q-label"
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. buttermilk"
            placeholderTextColor={Colors.muted}
            returnKeyType="search"
            style={styles.input}
          />
        </View>
      </View>

      {synonyms.length > 0 && (
        <View style={styles.card} accessibilityLabel="Names we treat as the same">
          <Text style={styles.sectionTitle}>We read these as one ingredient</Text>
          {synonyms.map((s) => (
            <View key={s.a} style={styles.synonymRow}>
              <Text style={[styles.synonym, { backgroundColor: Tints[s.tint].bg }]}>{s.a}</Text>
              <Ionicons name="swap-horizontal" size={20} color={Colors.muted} />
              <Text style={[styles.synonym, { backgroundColor: Tints[s.tint].bg }]}>{s.b}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section} accessibilityLabel="Quick swaps">
        <Text style={styles.sectionTitle}>Quick swaps</Text>
        {swaps.map((s) => (
          <View key={s.outOf} style={styles.swapCard}>
            <Text style={styles.swapOutOf}>OUT OF {s.outOf.toUpperCase()}</Text>
            <Text style={styles.swapUse}>{s.use}</Text>
          </View>
        ))}
        {swaps.length === 0 && <Text style={styles.empty}>No swaps for “{query.trim()}” yet.</Text>}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => Alert.alert('Flag a name', 'Reporting wrong matches is coming soon.')}
        style={styles.flagButton}>
        <Ionicons name="flag-outline" size={18} color={Colors.ink} />
        <Text style={styles.flagText}>Flag a name we got wrong</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 14,
  },
  eyebrow: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.muted,
  },
  title: {
    marginTop: 2,
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: Colors.ink,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.muted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.ink,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.ink,
  },
  synonymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  synonym: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    overflow: 'hidden',
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
  section: {
    gap: 8,
  },
  swapCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 3,
  },
  swapOutOf: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.accent,
  },
  swapUse: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.muted,
  },
  flagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.dashed,
  },
  flagText: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
});
