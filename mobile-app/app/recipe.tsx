import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodArt } from '@/components/food-art';
import { Colors, Fonts, Tints } from '@/constants/theme';
import { allergyMessage, getMissingIngredients, getRecipe } from '@/data/recipes';
import { useFridge } from '@/hooks/use-fridge';

export default function RecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { saved, toggleSaved, allergies, items } = useFridge();
  const recipe = getRecipe(id);
  const tint = Tints[recipe.tint];
  const isSaved = saved.includes(recipe.id);
  const allergyWarning = allergyMessage(recipe, allergies);
  const missingIngredients = getMissingIngredients(
    recipe,
    items.map((item) => item.name)
  );
  const haveCount = recipe.ingredients.length - missingIngredients.length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: tint.bg, height: 210 + insets.top, paddingTop: insets.top }]}>
          <View accessible accessibilityRole="image" accessibilityLabel={`Illustration of ${recipe.title}`}>
            <FoodArt kind={recipe.art} color={tint.ink} size={150} strokeWidth={2} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/matches'))}
            style={[styles.heroButton, { left: 18, top: insets.top + 18 }]}>
            <Ionicons name="chevron-back" size={20} color={Colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save recipe'}
            accessibilityState={{ selected: isSaved }}
            onPress={() => toggleSaved(recipe.id)}
            style={[styles.heroButton, { right: 18, top: insets.top + 18 }]}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={Colors.accent} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View>
            <Text style={styles.title} accessibilityRole="header">
              {recipe.title}
            </Text>
            <View style={styles.pills}>
              <Text style={styles.pill}>{recipe.minutes} min</Text>
              <Text style={styles.pill}>Serves {recipe.serves}</Text>
              <Text style={styles.pill}>{recipe.difficulty}</Text>
            </View>
          </View>

          {allergyWarning && (
            <View style={styles.warningCard} accessibilityLiveRegion="polite">
              <Text style={styles.warningTitle}>Allergy warning</Text>
              <Text style={styles.warningText}>{allergyWarning}</Text>
            </View>
          )}

          <View style={styles.card} accessibilityLabel="Ingredients">
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <Text style={styles.haveCount}>
                You have {haveCount} of {recipe.ingredients.length}
              </Text>
            </View>
            {recipe.ingredients.map((ing) => {
              const isMissing = missingIngredients.includes(ing);
              return (
              <View key={ing.label} style={styles.ingredient}>
                {isMissing ? (
                  <Ionicons name="alert-circle-outline" size={18} color={Colors.accent} />
                ) : (
                  <Ionicons name="checkmark" size={18} color={Colors.success} />
                )}
                <Text style={[styles.ingredientText, isMissing && styles.ingredientMissing]}>
                  {ing.label}
                  {isMissing ? ' (missing)' : ''}
                </Text>
                {ing.matchedAs && <Text style={styles.matchBadge}>matched: your {ing.matchedAs}</Text>}
              </View>
              );
            })}
          </View>

          {recipe.smartSwap && (
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/swaps')} style={styles.swapCard}>
                <View style={styles.swapIcon}>
                  <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.swapText}>
                  <Text style={styles.swapEyebrow}>SMART SWAP</Text>
                  <Text style={styles.swapBody}>{recipe.smartSwap}</Text>
                </View>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/cook-mode', params: { id: recipe.id } })}
          style={({ pressed }) => [styles.cookButton, pressed && { backgroundColor: Colors.accentPressed }]}>
          <Ionicons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.cookButtonText}>Start Cook Mode</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 12,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 22,
    paddingTop: 18,
    gap: 14,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 26,
    lineHeight: 29,
    letterSpacing: -0.5,
    color: Colors.ink,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  pill: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.ink,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  warningCard: {
    backgroundColor: '#FDE7DA',
    borderWidth: 1,
    borderColor: '#F7C7A7',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  warningTitle: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  warningText: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: Colors.ink,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 9,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.ink,
  },
  haveCount: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.success,
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  ingredientText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.ink,
  },
  ingredientMissing: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
  },
  matchBadge: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
    backgroundColor: Tints.sky.bg,
    color: Tints.sky.ink,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  swapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.ink,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  swapIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapText: {
    flex: 1,
  },
  swapEyebrow: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.cookMuted,
  },
  swapBody: {
    marginTop: 2,
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: Colors.background,
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
  cookButtonText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
