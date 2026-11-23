import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Tints } from '@/constants/theme';
import { checkIngredient, fetchAllergens, fetchRecommendations } from '@/services/recommendations';
import { useFridge } from '@/hooks/use-fridge';

// Small hand-placed tilts so the magnets look stuck on, not laid out.
const TILTS = ['-2deg', '1.5deg', '-1deg', '2deg', '1deg', '-2.5deg', '1.5deg', '-1deg'];

export default function FridgeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, addItem, removeItem, allergies, toggleAllergy } = useFridge();
  const [draft, setDraft] = useState('');
  const [checkingIngredient, setCheckingIngredient] = useState(false);
  const [ingredientError, setIngredientError] = useState<string | null>(null);
  const [suggestedIngredient, setSuggestedIngredient] = useState<string | null>(null);
  const [unrecognizedIngredient, setUnrecognizedIngredient] = useState<string | null>(null);
  const [rouletteLoading, setRouletteLoading] = useState(false);
  const [rouletteError, setRouletteError] = useState<string | null>(null);
  const [allergenOptions, setAllergenOptions] = useState<string[]>([]);
  const [allergenLoading, setAllergenLoading] = useState(true);
  const [allergenError, setAllergenError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAllergens(controller.signal)
      .then(setAllergenOptions)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setAllergenError(cause instanceof Error ? cause.message : 'Could not load allergen categories.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAllergenLoading(false);
      });
    return () => controller.abort();
  }, []);

  const clearIngredientFeedback = () => {
    setIngredientError(null);
    setSuggestedIngredient(null);
    setUnrecognizedIngredient(null);
  };

  const addFridgeIngredient = (name: string) => {
    addItem(name);
    setDraft('');
    clearIngredientFeedback();
  };

  const submit = async () => {
    const name = draft.trim();
    if (!name || checkingIngredient) return;

    setCheckingIngredient(true);
    clearIngredientFeedback();
    try {
      const result = await checkIngredient(name);
      if (result.suggestion) {
        setIngredientError(`“${name}” may be misspelled. Did you mean “${result.suggestion}”?`);
        setSuggestedIngredient(result.suggestion);
      } else if (!result.recognized) {
        setIngredientError(`“${name}” isn’t in the recipe catalog. Add it anyway?`);
        setUnrecognizedIngredient(name);
      } else {
        addFridgeIngredient(name);
      }
    } catch (cause) {
      setIngredientError(
        cause instanceof Error
          ? `Couldn’t check this ingredient. It wasn’t added. ${cause.message}`
          : 'Couldn’t check this ingredient. It wasn’t added.'
      );
    } finally {
      setCheckingIngredient(false);
    }
  };

  const fridgeRoulette = async () => {
    setRouletteLoading(true);
    setRouletteError(null);
    try {
      const recipes = await fetchRecommendations(items.map((item) => item.name), 'jaccard', 25, true);
      if (recipes.length === 0) {
        setRouletteError('No recommendations for these ingredients yet.');
        return;
      }
      const pick = recipes[Math.floor(Math.random() * recipes.length)];
      router.push({ pathname: '/recommended-recipe', params: { id: String(pick.recipe_id) } });
    } catch (cause) {
      setRouletteError(cause instanceof Error ? cause.message : 'Could not find a surprise recipe.');
    } finally {
      setRouletteLoading(false);
    }
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
            onChangeText={(value) => {
              setDraft(value);
              clearIngredientFeedback();
            }}
            onSubmitEditing={() => {
              void submit();
            }}
            placeholder="e.g. chicken, tortillas…"
            placeholderTextColor={Colors.muted}
            returnKeyType="done"
            editable={!checkingIngredient}
            style={styles.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Add by voice" style={[styles.inputButton, styles.voiceButton]}>
            <Ionicons name="mic-outline" size={20} color={Colors.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Scan with camera" style={[styles.inputButton, styles.cameraButton]}>
            <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        {checkingIngredient && <Text style={styles.ingredientStatus}>Checking ingredient…</Text>}
        {ingredientError && (
          <View style={styles.ingredientValidation} accessibilityLiveRegion="polite">
            <Text style={styles.ingredientError}>{ingredientError}</Text>
            {suggestedIngredient && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${suggestedIngredient} instead`}
                onPress={() => addFridgeIngredient(suggestedIngredient)}
                style={styles.ingredientAction}>
                <Text style={styles.ingredientActionText}>Add {suggestedIngredient}</Text>
              </Pressable>
            )}
            {unrecognizedIngredient && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${unrecognizedIngredient} anyway`}
                onPress={() => addFridgeIngredient(unrecognizedIngredient)}
                style={styles.ingredientAction}>
                <Text style={styles.ingredientActionText}>Add anyway</Text>
              </Pressable>
            )}
          </View>
        )}
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
              <View
                key={item.name}
                style={[
                  styles.magnet,
                  { backgroundColor: tint.bg, boxShadow: `0 2px 0 ${tint.edge}`, transform: [{ rotate: TILTS[i % TILTS.length] }] },
                ]}>
                <Text style={styles.magnetText}>{item.name}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name} from your fridge`}
                  onPress={() => removeItem(item.name)}
                  hitSlop={6}
                  style={styles.removeIngredientButton}>
                  <Ionicons name="close" size={14} color={tint.ink} />
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allergy preferences</Text>
        {allergenLoading && <Text style={styles.notice}>Loading allergen categories…</Text>}
        {allergenError && <Text style={styles.allergenError}>{allergenError}</Text>}
        {!allergenLoading && !allergenError && (
          <View style={styles.allergenOptions}>
            {allergenOptions.map((allergen) => {
              const selected = allergies.includes(allergen);
              return (
                <Pressable
                  key={allergen}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleAllergy(allergen)}
                  style={[styles.allergenOption, selected && styles.allergenOptionSelected]}>
                  <Text style={[styles.allergenOptionText, selected && styles.allergenOptionTextSelected]}>
                    {allergen}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <Text style={styles.notice}>
          Recipe warnings show potential matches from this map, which may be inferred or product-dependent.
          Always check the original recipe and product labels. This is not allergy-safety advice.
        </Text>
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
            accessibilityState={{ disabled: rouletteLoading }}
            disabled={rouletteLoading}
            onPress={fridgeRoulette}
            style={styles.rouletteButton}>
            {rouletteLoading ? (
              <Text style={styles.rouletteLoading}>…</Text>
            ) : (
              <Ionicons name="dice-outline" size={24} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
        {rouletteError ? (
          <Text style={styles.rouletteError}>{rouletteError}</Text>
        ) : (
          <Text style={styles.rouletteHint}>Dice = Fridge Roulette, a surprise recipe</Text>
        )}
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
  ingredientStatus: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
  },
  ingredientValidation: {
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
  },
  ingredientError: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.accent,
  },
  ingredientAction: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: Colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ingredientActionText: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.successDeep,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  magnetText: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
  removeIngredientButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  section: {
    gap: 8,
  },
  notice: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 18,
  },
  allergenOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenOption: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  allergenOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.successSoft,
  },
  allergenOptionText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.ink,
  },
  allergenOptionTextSelected: {
    fontFamily: Fonts.bold,
    color: Colors.successDeep,
  },
  allergenError: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.accent,
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
  rouletteLoading: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  rouletteError: {
    marginTop: 8,
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.accent,
    textAlign: 'right',
  },
  rouletteHint: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'right',
  },
});
