import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Tints } from '@/constants/theme';
import { ALLERGEN_OPTIONS, EXPIRING, RECIPES } from '@/data/recipes';
import { useFridge } from '@/hooks/use-fridge';

// Small hand-placed tilts so the magnets look stuck on, not laid out.
const TILTS = ['-2deg', '1.5deg', '-1deg', '2deg', '1deg', '-2.5deg', '1.5deg', '-1deg'];

export default function FridgeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, addItem, removeItem, allergies, toggleAllergy } = useFridge();
  const [draft, setDraft] = useState('');

  const submit = () => {
    addItem(draft);
    setDraft('');
  };

  const fridgeRoulette = () => {
    const pick = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    router.push({ pathname: '/recipe', params: { id: pick.id } });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="fridge-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.brandName}>FridgeChef</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" style={styles.avatar}>
          <Text style={styles.avatarText}>AC</Text>
        </Pressable>
      </View>

      <View>
        <Text style={styles.eyebrow}>Dinner, sorted in seconds</Text>
        <Text style={styles.title} accessibilityRole="header">
          What&apos;s in your fridge?
        </Text>
      </View>

      {/* Add ingredient */}
      <View style={styles.field}>
        <Text style={styles.label} nativeID="add-ing-label">
          Add an ingredient
        </Text>
        <View style={styles.inputRow}>
          <Ionicons name="add" size={20} color={Colors.muted} />
          <TextInput
            accessibilityLabelledBy="add-ing-label"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder="e.g. chicken, tortillas…"
            placeholderTextColor={Colors.muted}
            returnKeyType="done"
            style={styles.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Add by voice" style={[styles.inputButton, styles.voiceButton]}>
            <Ionicons name="mic-outline" size={20} color={Colors.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Scan with camera" style={[styles.inputButton, styles.cameraButton]}>
            <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Fridge door */}
      <View style={styles.door} accessibilityLabel="Fridge door">
        <View style={styles.handle} />
        <View style={styles.doorHeader}>
          <Text style={styles.sectionTitle}>Fridge door</Text>
          <Text style={styles.small}>
            {items.length} {items.length === 1 ? 'magnet' : 'magnets'}
          </Text>
        </View>
        <View style={styles.magnets}>
          {items.map((item, i) => {
            const tint = Tints[item.tint];
            return (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                accessibilityHint="Removes it from your fridge"
                onLongPress={() => removeItem(item.name)}
                style={[
                  styles.magnet,
                  { backgroundColor: tint.bg, boxShadow: `0 2px 0 ${tint.edge}`, transform: [{ rotate: TILTS[i % TILTS.length] }] },
                ]}>
                <Text style={styles.magnetText}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allergies</Text>
        <View style={styles.allergyRow}>
          {ALLERGEN_OPTIONS.map((allergy) => {
            const active = allergies.includes(allergy);
            return (
              <Pressable
                key={allergy}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => toggleAllergy(allergy)}
                style={[styles.allergyChip, active ? styles.allergyChipOn : styles.allergyChipOff]}>
                <Text style={[styles.allergyChipText, active && styles.allergyChipTextOn]}>{allergy}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.allergyDisclaimer}>Results aren’t allergy or nutrition advice — check labels and ingredients before eating.</Text>
      </View>

      {/* Use it up first */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Use it up first</Text>
        <View style={styles.expiringRow}>
          {EXPIRING.map((e, i) => (
            <View key={e.name} style={styles.expiringCard}>
              <Text style={styles.expiringName}>{e.name}</Text>
              <Text style={[styles.expiringDays, { color: i === 0 ? Colors.accent : Colors.muted }]}>
                {e.daysLeft} days left
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/matches')}
            style={({ pressed }) => [styles.primaryButton, pressed && { backgroundColor: Colors.accentPressed }]}>
            <Text style={styles.primaryButtonText}>Find recipes</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fridge Roulette: surprise me"
            onPress={fridgeRoulette}
            style={styles.rouletteButton}>
            <Ionicons name="dice-outline" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text style={styles.rouletteHint}>Dice = Fridge Roulette, a surprise recipe</Text>
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: Fonts.display,
    fontSize: 20,
    letterSpacing: -0.3,
    color: Colors.ink,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.ink,
  },
  eyebrow: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.muted,
  },
  title: {
    marginTop: 2,
    fontFamily: Fonts.display,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.6,
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
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 4,
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 40,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.ink,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  inputButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    backgroundColor: Colors.background,
  },
  cameraButton: {
    backgroundColor: Colors.ink,
  },
  door: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: 26,
    padding: 16,
    paddingBottom: 18,
  },
  handle: {
    position: 'absolute',
    right: 12,
    top: 22,
    width: 6,
    height: 56,
    borderRadius: 3,
    backgroundColor: Colors.ink,
  },
  doorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingRight: 18,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.ink,
  },
  small: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
  },
  magnets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingRight: 18,
  },
  magnet: {
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  magnetText: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
  section: {
    gap: 8,
  },
  allergyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergyChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  allergyChipOn: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  allergyChipOff: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  allergyChipText: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.ink,
    textTransform: 'capitalize',
  },
  allergyChipTextOn: {
    color: '#FFFFFF',
  },
  allergyDisclaimer: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.muted,
    lineHeight: 16,
  },
  expiringRow: {
    flexDirection: 'row',
    gap: 8,
  },
  expiringCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  expiringName: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
  expiringDays: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: Colors.accent,
  },
  primaryButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  rouletteButton: {
    width: 52,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rouletteHint: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'right',
  },
});
