import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeCard } from '@/components/recipe-card';
import { Colors, Fonts } from '@/constants/theme';
import { RECIPES } from '@/data/recipes';
import { useFridge } from '@/hooks/use-fridge';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { saved } = useFridge();
  const recipes = RECIPES.filter((r) => saved.includes(r.id));

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title} accessibilityRole="header">
        Saved recipes
      </Text>
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
      {recipes.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={28} color={Colors.muted} />
          <Text style={styles.emptyText}>Tap the heart on any recipe to keep it here.</Text>
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
});
