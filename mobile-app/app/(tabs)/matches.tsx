import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useFridge } from '@/hooks/use-fridge';
import { fetchMethods, fetchRecommendations, type RecipeRecommendation } from '@/services/recommendations';

const RESULT_COUNTS = [3, 5, 8, 10] as const;

export default function MatchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useFridge();
  const [methods, setMethods] = useState<string[]>([]);
  const [method, setMethod] = useState('');
  const [resultCount, setResultCount] = useState<number>(5);
  const [recommendations, setRecommendations] = useState<RecipeRecommendation[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayedRecommendations = recommendations.slice(0, resultCount);

  useEffect(() => {
    const controller = new AbortController();
    fetchMethods(controller.signal)
      .then((availableMethods) => {
        setMethods(availableMethods);
        setMethod((current) =>
          availableMethods.includes(current) ? current : availableMethods[0]
        );
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load recommendation methods.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingMethods(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!method || !methods.includes(method)) return;

    const controller = new AbortController();
    setLoadingResults(true);
    setError(null);
    setRecommendations([]);
    fetchRecommendations(
      items.map((item) => item.name),
      method,
      25,
      true,
      controller.signal
    )
      .then(setRecommendations)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load recommendations.');
          setRecommendations([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingResults(false);
      });
    return () => controller.abort();
  }, [items, method, methods]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 20 }]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to fridge"
          onPress={() => router.navigate('/')}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={Colors.ink} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {displayedRecommendations.length}{' '}
            {displayedRecommendations.length === 1 ? 'recipe' : 'recipes'} found
          </Text>
          <Text style={styles.subtitle}>
            Ranked from {items.length} fridge ingredients using the backend
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.optionGroup} accessibilityLabel="Ranking method">
          <Text style={styles.optionLabel}>Method</Text>
          <View style={styles.optionRow}>
            {methods.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: method === value }}
                onPress={() => setMethod(value)}
                style={[styles.optionChip, method === value ? styles.optionChipOn : styles.optionChipOff]}>
                <Text style={[styles.optionText, method === value && styles.optionTextOn]}>
                  {value.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.optionGroup} accessibilityLabel="Number of results">
          <Text style={styles.optionLabel}>Show</Text>
          <View style={styles.optionRow}>
            {RESULT_COUNTS.map((count) => (
              <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityState={{ selected: resultCount === count }}
                onPress={() => setResultCount(count)}
                style={[styles.optionChip, resultCount === count ? styles.optionChipOn : styles.optionChipOff]}>
                <Text style={[styles.optionText, resultCount === count && styles.optionTextOn]}>{count}</Text>
              </Pressable>
            ))}
          </View>
        </View>

      </View>

      <View style={styles.list}>
        {loadingMethods && <Text style={styles.message}>Loading recommendation methods…</Text>}
        {loadingResults && <Text style={styles.message}>Finding recipes…</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {displayedRecommendations.map((recipe) => (
          <RecommendationCard
            key={recipe.recipe_id}
            recipe={recipe}
            onOpenRecipe={(recipeId) =>
              router.push({ pathname: '/recommended-recipe', params: { id: String(recipeId) } })
            }
          />
        ))}
        {!loadingMethods && !loadingResults && !error && displayedRecommendations.length === 0 && (
          <Text style={styles.message}>No recommendations found. Try changing your ingredients or method.</Text>
        )}
        <Text style={styles.disclaimer}>
          Matching scores are not recipe-quality, allergy, nutrition, or food-safety advice.
        </Text>
      </View>
    </ScrollView>
  );
}

function RecommendationCard({
  recipe,
  onOpenRecipe,
}: {
  recipe: RecipeRecommendation;
  onOpenRecipe: (recipeId: number) => void;
}) {
  const metadata = [recipe.category, recipe.cuisine, recipe.main_protein].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View recipe details for ${recipe.title}`}
      onPress={() => onOpenRecipe(recipe.recipe_id)}
      style={({ pressed }) => [styles.recipeCard, pressed && styles.recipeCardPressed]}>
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        {recipe.method === 'coverage' && (
          <Text style={styles.coverageScore}>{Math.round(recipe.ingredient_coverage * 100)}%</Text>
        )}
      </View>
      {metadata ? <Text style={styles.subtitle}>{metadata}</Text> : null}
      <Text style={styles.score}>
        {recipe.method.toUpperCase()} score: {recipe.score.toFixed(3)} · ingredient coverage:{' '}
        {Math.round(recipe.ingredient_coverage * 100)}%
      </Text>
      <Text style={styles.ingredientList}>
        Matched: {recipe.matched_ingredients.length ? recipe.matched_ingredients.join(', ') : 'None'}
      </Text>
      <Text style={styles.ingredientList}>
        Missing: {recipe.missing_ingredients.length ? recipe.missing_ingredients.join(', ') : 'None'}
      </Text>
      <View style={styles.detailsButton}>
        <Text style={styles.sourceText}>View recipe and Cook Mode</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.successDeep} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  page: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingBottom: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 24,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
  },
  controls: {
    gap: 12,
    paddingTop: 12,
  },
  optionGroup: {
    gap: 6,
  },
  optionLabel: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.muted,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  optionChipOn: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  optionChipOff: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  optionText: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.ink,
  },
  optionTextOn: {
    color: '#FFFFFF',
  },
  list: {
    gap: 12,
  },
  recipeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  recipeCardPressed: {
    opacity: 0.85,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  recipeTitle: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.ink,
  },
  coverageScore: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: Colors.successDeep,
  },
  score: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.successDeep,
  },
  ingredientList: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingTop: 2,
  },
  sourceText: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: Colors.successDeep,
    textDecorationLine: 'underline',
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
    padding: 12,
    backgroundColor: '#FDE7DA',
    borderRadius: 12,
  },
  disclaimer: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
