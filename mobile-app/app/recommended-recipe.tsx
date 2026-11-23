import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useFridge } from '@/hooks/use-fridge';
import {
  fetchRecipeAvailability,
  fetchRecipeAllergens,
  fetchRecipeDetails,
  type RecipeDetails,
  type RecipeAllergen,
} from '@/services/recommendations';

export default function RecommendedRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, saved, toggleSaved, allergies } = useFridge();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const recipeId = Number(id);
  const validRecipeId = Number.isSafeInteger(recipeId) && recipeId > 0;
  const [recipe, setRecipe] = useState<RecipeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableIngredients, setAvailableIngredients] = useState<Set<string>>(new Set());
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [allergenMatches, setAllergenMatches] = useState<RecipeAllergen[]>([]);
  const [allergenLoading, setAllergenLoading] = useState(false);
  const [allergenError, setAllergenError] = useState<string | null>(null);

  useEffect(() => {
    if (!validRecipeId) {
      setError('This recipe link is invalid.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchRecipeDetails(recipeId, controller.signal)
      .then(setRecipe)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load recipe details.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [recipeId, validRecipeId]);

  useEffect(() => {
    if (!validRecipeId) return;

    const controller = new AbortController();
    setAllergenMatches([]);
    setAllergenLoading(true);
    setAllergenError(null);
    fetchRecipeAllergens(recipeId, controller.signal)
      .then((matches) => {
        if (!controller.signal.aborted) setAllergenMatches(matches);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setAllergenError(cause instanceof Error ? cause.message : 'Could not load potential allergen matches.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAllergenLoading(false);
      });
    return () => controller.abort();
  }, [recipeId, validRecipeId]);

  const selectedAllergenMatches = allergenMatches
    .map((entry) => ({
      ...entry,
      selectedAllergens: entry.allergens.filter((allergen) => allergies.includes(allergen)),
    }))
    .filter((entry) => entry.selectedAllergens.length > 0);

  useEffect(() => {
    if (!validRecipeId) return;

    const controller = new AbortController();
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    setAvailableIngredients(new Set());
    fetchRecipeAvailability(recipeId, items.map((item) => item.name), controller.signal)
      .then(({ available_ingredients }) => {
        if (!controller.signal.aborted) setAvailableIngredients(new Set(available_ingredients));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setAvailabilityError(cause instanceof Error ? cause.message : 'Could not check your fridge.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false);
      });
    return () => controller.abort();
  }, [items, recipeId, validRecipeId]);

  const openCookMode = () => {
    if (recipe) {
      router.push({
        pathname: '/recommendation-cook-mode',
        params: { id: String(recipe.recipe_id) },
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to recommendations"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/matches'))}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={Colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Recipe details</Text>
        {recipe && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved.includes(String(recipe.recipe_id)) ? 'Remove from saved' : 'Save recipe'}
            accessibilityState={{ selected: saved.includes(String(recipe.recipe_id)) }}
            onPress={() => toggleSaved(String(recipe.recipe_id))}
            style={styles.saveButton}>
            <Ionicons
              name={saved.includes(String(recipe.recipe_id)) ? 'heart' : 'heart-outline'}
              size={20}
              color={Colors.accent}
            />
          </Pressable>
        )}
      </View>

      {loading && <Text style={styles.message}>Loading recipe…</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {recipe && !error && (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title} accessibilityRole="header">{recipe.title}</Text>
            <Text style={styles.metadata}>
              {[recipe.category, recipe.cuisine, recipe.main_protein].filter(Boolean).join(' · ')}
            </Text>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              {recipe.ingredients.map((ingredient) => {
                const isAvailable = availableIngredients.has(ingredient);
                const availabilityLabel = availabilityLoading
                  ? 'checking fridge availability'
                  : isAvailable
                    ? 'in your fridge'
                    : 'not in your fridge';
                return (
                  <View
                    key={ingredient}
                    accessible
                    accessibilityLabel={`${ingredient}, ${availabilityLabel}`}
                    style={styles.ingredientRow}>
                    <Ionicons
                      name={isAvailable ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={isAvailable ? Colors.success : Colors.muted}
                    />
                    <Text style={styles.ingredient}>{ingredient}</Text>
                  </View>
                );
              })}
            </View>

            {allergies.length > 0 && (
              <View style={styles.allergenCard} accessibilityLiveRegion="polite">
                <Text style={styles.sectionTitle}>Potential allergen matches</Text>
                {allergenLoading && <Text style={styles.allergenText}>Checking recipe ingredients…</Text>}
                {allergenError && <Text style={styles.allergenError}>{allergenError}</Text>}
                {!allergenLoading && !allergenError && selectedAllergenMatches.length === 0 && (
                  <Text style={styles.allergenText}>No selected allergens were found in the map for this recipe.</Text>
                )}
                {!allergenError && selectedAllergenMatches.map((entry) => (
                  <View key={entry.ingredient} style={styles.allergenEntry}>
                    <Text style={styles.allergenText}>
                      {entry.ingredient}: {entry.selectedAllergens.join(', ')}
                    </Text>
                    <Text style={styles.allergenBasis}>{entry.basis}</Text>
                  </View>
                ))}
                <Text style={styles.allergenCaveat}>
                  These are potential matches, not a safety guarantee. Some entries are inferred or product-dependent;
                  check product labels and the original recipe.
                </Text>
              </View>
            )}

            {availabilityLoading && <Text style={styles.message}>Checking your fridge…</Text>}
            {availabilityError && <Text style={styles.error}>{availabilityError}</Text>}

            <Text style={styles.disclaimer}>
              Verified cooking directions are not included in the app data. Enter Cook Mode to open
              the original recipe. Results are not allergy, nutrition, or food-safety advice.
            </Text>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
            <Pressable
              accessibilityRole="button"
              onPress={openCookMode}
              style={({ pressed }) => [styles.cookButton, pressed && styles.pressed]}>
              <Ionicons name="play" size={18} color="#FFFFFF" />
              <Text style={styles.cookButtonText}>Enter Cook Mode</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: Fonts.semibold,
    fontSize: 15,
    color: Colors.ink,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 14,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: Colors.ink,
  },
  metadata: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.muted,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.ink,
    marginBottom: 2,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ingredient: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.ink,
  },
  allergenCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  allergenEntry: {
    gap: 3,
  },
  allergenText: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
  },
  allergenBasis: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.muted,
  },
  allergenCaveat: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.muted,
  },
  allergenError: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: Colors.accent,
  },
  disclaimer: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.muted,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  cookButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: {
    backgroundColor: Colors.accentPressed,
  },
  cookButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  message: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 32,
  },
  error: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    textAlign: 'center',
    marginHorizontal: 22,
    marginTop: 20,
  },
});
