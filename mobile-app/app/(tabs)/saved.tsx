import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useFridge } from '@/hooks/use-fridge';
import { fetchRecipeDetails, type RecipeDetails } from '@/services/recommendations';

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { saved, toggleSaved } = useFridge();
  const [recipes, setRecipes] = useState<RecipeDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadSavedRecipes = async () => {
      setLoading(true);
      setError(null);
      try {
        const ids = saved.map(Number);
        if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
          throw new Error('A saved recipe ID is invalid.');
        }
        const details = await Promise.all(
          ids.map((id) => fetchRecipeDetails(id, controller.signal))
        );
        if (!controller.signal.aborted) setRecipes(details);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load saved recipes.');
          setRecipes([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadSavedRecipes();
    return () => controller.abort();
  }, [saved]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title} accessibilityRole="header">Saved recipes</Text>
      {loading && <Text style={styles.message}>Loading saved recipes…</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && recipes.map((recipe) => (
        <View key={recipe.recipe_id} style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View recipe details for ${recipe.title}`}
            onPress={() =>
              router.push({ pathname: '/recommended-recipe', params: { id: String(recipe.recipe_id) } })
            }
            style={styles.recipe}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <Text style={styles.metadata}>
              {[recipe.category, recipe.cuisine, recipe.main_protein].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.ingredients} numberOfLines={2}>
              {recipe.ingredients.join(', ')}
            </Text>
            <Text style={styles.link}>View recipe details</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${recipe.title} from saved`}
            onPress={() => toggleSaved(String(recipe.recipe_id))}
            style={styles.removeButton}>
            <Ionicons name="heart" size={20} color={Colors.accent} />
          </Pressable>
        </View>
      ))}
      {!loading && !error && recipes.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={28} color={Colors.muted} />
          <Text style={styles.emptyText}>Save a backend recipe to keep it here.</Text>
        </View>
      )}
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
    gap: 12,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    letterSpacing: -0.5,
    color: Colors.ink,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  recipe: {
    flex: 1,
    gap: 5,
  },
  recipeTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.ink,
  },
  metadata: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
  },
  ingredients: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.ink,
  },
  link: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.successDeep,
    textDecorationLine: 'underline',
  },
  removeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
  },
  message: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 24,
  },
  error: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.accent,
    textAlign: 'center',
  },
});
