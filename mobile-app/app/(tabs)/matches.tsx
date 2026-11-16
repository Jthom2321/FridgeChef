import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipeCard } from '@/components/recipe-card';
import { Colors, Fonts } from '@/constants/theme';
import { getMissingIngredients, RECIPES, type Recipe } from '@/data/recipes';
import { useFridge } from '@/hooks/use-fridge';

const FILTERS: { label: string; test: (r: Recipe) => boolean }[] = [
  { label: 'Under 20 min', test: (r) => r.minutes <= 20 },
  { label: 'No oven', test: (r) => r.tags.includes('no-oven') },
  { label: 'Budget', test: (r) => r.tags.includes('budget') },
  { label: 'Vegetarian', test: (r) => r.tags.includes('vegetarian') },
];

const RANKING_OPTIONS = [
  { value: 'best', label: 'Best match' },
  { value: 'fastest', label: 'Fastest' },
  { value: 'fewestMissing', label: 'Fewest missing' },
] as const;

const RESULT_COUNTS = [3, 5, 8, 10] as const;

export default function MatchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useFridge();
  const [active, setActive] = useState<string[]>(['Under 20 min']);
  const [ranking, setRanking] = useState<(typeof RANKING_OPTIONS)[number]['value']>('best');
  const [resultCount, setResultCount] = useState<number>(5);
  const [haveBasics, setHaveBasics] = useState(true);

  const toggle = (label: string) =>
    setActive((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const matches = useMemo(() => {
    const filtered = RECIPES.filter((r) => FILTERS.every((f) => !active.includes(f.label) || f.test(r)));
    const fridgeItems = items.map((item) => item.name);

    const withScores = filtered.map((recipe) => {
      const missing = getMissingIngredients(recipe, fridgeItems, haveBasics);
      const total = recipe.ingredients.length;
      const score = total === 0 ? 0 : (total - missing.length) / total;
      return {
        recipe,
        score,
        missingCount: missing.length,
        minutes: recipe.minutes,
      };
    });

    const sorted = withScores.sort((a, b) => {
      if (ranking === 'fastest') return a.minutes - b.minutes || b.score - a.score;
      if (ranking === 'fewestMissing') return a.missingCount - b.missingCount || b.score - a.score;
      return b.score - a.score || a.missingCount - b.missingCount || a.minutes - b.minutes;
    });

    return sorted.map((item) => item.recipe).slice(0, resultCount);
  }, [active, haveBasics, items, ranking, resultCount]);

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
            {matches.length} {matches.length === 1 ? 'recipe' : 'recipes'} you can make
          </Text>
          <Text style={styles.subtitle}>From {items.length} ingredients on your fridge door</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.optionGroup} accessibilityLabel="Ranking method">
          <Text style={styles.optionLabel}>Sort by</Text>
          <View style={styles.optionRow}>
            {RANKING_OPTIONS.map(({ value, label }) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: ranking === value }}
                onPress={() => setRanking(value)}
                style={[styles.optionChip, ranking === value ? styles.optionChipOn : styles.optionChipOff]}>
                <Text style={[styles.optionText, ranking === value && styles.optionTextOn]}>{label}</Text>
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

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: haveBasics }}
          onPress={() => setHaveBasics((prev) => !prev)}
          style={styles.checkRow}>
          <View style={[styles.checkbox, haveBasics && styles.checkboxOn]}>
            {haveBasics && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkText}>I have the basics</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
        accessibilityLabel="Filters">
        {FILTERS.map(({ label }) => {
          const on = active.includes(label);
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => toggle(label)}
              style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
              <Text style={[styles.chipText, on && { color: '#FFFFFF' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.list}>
        {matches.map((recipe, i) => (
          <RecipeCard key={recipe.id} recipe={recipe} bestMatch={i === 0} ignoreBasics={haveBasics} />
        ))}
        {matches.length === 0 && (
          <Text style={styles.empty}>No recipes match these filters. Try turning one off or clearing the basics toggle.</Text>
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
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkText: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    color: Colors.ink,
  },
  filtersScroll: {
    flexGrow: 0,
    marginHorizontal: -22,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 4,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: Colors.ink,
    borderWidth: 1.5,
    borderColor: Colors.ink,
  },
  chipOff: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipText: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: Colors.ink,
  },
  list: {
    gap: 12,
  },
  empty: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 24,
  },
});
