import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodArt } from '@/components/food-art';
import { Colors, Fonts, Tints } from '@/constants/theme';
import { allergyMessage, getMissingIngredients, missingLabel, type Recipe } from '@/data/recipes';
import { useFridge } from '@/hooks/use-fridge';

export function RecipeCard({ recipe, bestMatch = false, ignoreBasics = false }: { recipe: Recipe; bestMatch?: boolean; ignoreBasics?: boolean }) {
  const router = useRouter();
  const tint = Tints[recipe.tint];
  const { allergies, items } = useFridge();
  const fridgeItems = items.map((item) => item.name);
  const missingIngredients = getMissingIngredients(recipe, fridgeItems, ignoreBasics);
  const missing = missingLabel(recipe, fridgeItems, ignoreBasics);
  const allergyWarning = allergyMessage(recipe, allergies);
  const missingCount = missingIngredients.length;
  const total = recipe.ingredients.length;
  const haveCount = total - missingCount;
  const status = missing ?? (missingCount > 0 ? `Missing ${missingCount} ingredients` : 'You have everything');
  const strongMatch = missingCount <= 1;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/recipe', params: { id: recipe.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.art, { backgroundColor: tint.bg }]}>
        <FoodArt kind={recipe.art} color={tint.ink} />
      </View>
      <View style={styles.body}>
        <View style={[styles.topRow, !bestMatch && { justifyContent: 'flex-end' }]}>
          {bestMatch && <Text style={styles.bestMatch}>BEST MATCH</Text>}
          <Text style={[styles.matchPill, !strongMatch && styles.matchPillWeak]}>
            {haveCount} of {total}
          </Text>
        </View>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.meta}>{recipe.meta}</Text>
        <Text style={[styles.status, { color: missingCount > 0 || missing ? Colors.accent : Colors.success }]}>{status}</Text>
        {allergyWarning && <Text style={styles.allergyStatus}>{allergyWarning}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 10,
  },
  pressed: {
    opacity: 0.85,
  },
  art: {
    width: 96,
    height: 96,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  bestMatch: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.success,
  },
  matchPill: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    backgroundColor: Colors.successSoft,
    color: Colors.successDeep,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  matchPillWeak: {
    backgroundColor: Colors.background,
    color: Colors.muted,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 19,
    color: Colors.ink,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
  },
  status: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
  },
  allergyStatus: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
    color: Colors.accent,
  },
});
