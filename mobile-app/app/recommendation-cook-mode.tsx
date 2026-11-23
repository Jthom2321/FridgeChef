import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export default function RecommendationCookModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, allergies } = useFridge();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const recipeId = Number(id);
  const validRecipeId = Number.isSafeInteger(recipeId) && recipeId > 0;
  const [recipe, setRecipe] = useState<RecipeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [availableIngredients, setAvailableIngredients] = useState<Set<string>>(new Set());
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [allergenMatches, setAllergenMatches] = useState<RecipeAllergen[]>([]);
  const [allergenLoading, setAllergenLoading] = useState(false);
  const [allergenError, setAllergenError] = useState<string | null>(null);

  useEffect(() => {
    if (!validRecipeId) {
      setError('This recipe link is invalid.');
      return;
    }
    const controller = new AbortController();
    fetchRecipeDetails(recipeId, controller.signal)
      .then(setRecipe)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load recipe details.');
        }
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

  const exit = () => (router.canGoBack() ? router.back() : router.replace('/matches'));
  const openSource = async () => {
    if (!recipe || !/^https?:\/\//i.test(recipe.url)) {
      setSourceError('This recipe does not have a valid source URL.');
      return;
    }
    try {
      await Linking.openURL(recipe.url);
      setSourceError(null);
    } catch {
      setSourceError('Could not open the recipe source.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit Cook Mode" onPress={exit} style={styles.exitButton}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.modeTitle}>Cook Mode</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : recipe ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.recipeTitle} accessibilityRole="header">{recipe.title}</Text>
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
                    color={isAvailable ? Colors.cookAccent : Colors.cookMuted}
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

          {availabilityLoading && <Text style={styles.loading}>Checking your fridge…</Text>}
          {availabilityError && <Text style={styles.error}>{availabilityError}</Text>}
          {sourceError && <Text style={styles.error}>{sourceError}</Text>}

          <Pressable accessibilityRole="link" onPress={openSource} style={styles.sourceButton}>
            <Ionicons name="open-outline" size={18} color={Colors.cookBackground} />
            <Text style={styles.sourceText}>Open original recipe</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <Text style={styles.loading}>Loading Cook Mode…</Text>
      )}
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
  modeTitle: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.cookMuted,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flexGrow: 1,
    paddingTop: 30,
    paddingBottom: 20,
    gap: 18,
  },
  recipeTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 30,
    lineHeight: 35,
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: Colors.cookSurface,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ingredient: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.cookText,
  },
  allergenCard: {
    backgroundColor: Colors.cookSurface,
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
    color: Colors.cookText,
  },
  allergenBasis: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.cookMuted,
  },
  allergenCaveat: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.cookMuted,
  },
  allergenError: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: Colors.cookAccent,
  },
  sourceButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.cookAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  sourceText: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.cookBackground,
  },
  loading: {
    marginTop: 32,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    color: Colors.cookMuted,
  },
  error: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: Fonts.semibold,
    color: Colors.cookAccent,
  },
});
