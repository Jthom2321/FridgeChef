import type { TintName } from '@/constants/theme';

export type FoodArt = 'bowl' | 'quesadilla' | 'pan' | 'wrap';

export type Ingredient = {
  label: string;
  matchedAs?: string;
  missing?: boolean;
};

export type Step = {
  text: string;
  timerLabel: string;
  seconds?: number;
};

export type Recipe = {
  id: string;
  title: string;
  art: FoodArt;
  tint: TintName;
  minutes: number;
  meta: string;
  difficulty: string;
  serves: number;
  tags: ('no-oven' | 'budget' | 'vegetarian')[];
  allergens: string[];
  ingredients: Ingredient[];
  smartSwap?: string;
  steps: Step[];
};

export const RECIPES: Recipe[] = [
  {
    id: 'green-onion-egg-fried-rice',
    title: 'Green Onion Egg Fried Rice',
    art: 'bowl',
    tint: 'sky',
    minutes: 15,
    meta: '15 min · Dinner · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven', 'budget', 'vegetarian'],
    allergens: ['egg'],
    ingredients: [
      { label: 'cooked rice' },
      { label: 'eggs' },
      { label: 'green onions', matchedAs: 'scallions' },
      { label: 'garlic' },
      { label: 'olive oil' },
      { label: 'salt' },
      { label: 'black pepper' },
    ],
    steps: [
      { text: 'Warm a little olive oil in a skillet over medium heat. Add the chopped green onions and garlic and cook until fragrant.', timerLabel: 'Aromatics: 1 min', seconds: 60 },
      { text: 'Add the cooked rice and stir-fry until hot. Season with salt and black pepper.', timerLabel: 'Fry rice: 4 min', seconds: 240 },
      { text: 'Push the rice to one side, scramble the eggs in the pan, then stir them through the rice and serve.', timerLabel: 'Eggs: 2 min', seconds: 120 },
    ],
  },
  {
    id: 'spinach-cheddar-quesadilla',
    title: 'Spinach & Cheddar Quesadilla',
    art: 'quesadilla',
    tint: 'butter',
    minutes: 12,
    meta: '12 min · Lunch · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven', 'budget', 'vegetarian'],
    allergens: ['dairy', 'gluten'],
    ingredients: [
      { label: 'tortillas' },
      { label: 'spinach' },
      { label: 'cheddar' },
      { label: 'green onions', matchedAs: 'scallions' },
      { label: 'garlic' },
      { label: 'butter' },
    ],
    steps: [
      { text: 'Melt a little butter in a skillet. Add the garlic and spinach and cook until the spinach wilts.', timerLabel: 'Wilt spinach: 2 min', seconds: 120 },
      { text: 'Add a tortilla to the skillet, cover half with spinach, sliced green onion and cheddar, then fold it over.', timerLabel: 'Fill quesadilla', },
      { text: 'Cook until golden on both sides and the cheese melts. Repeat with the remaining tortilla and filling.', timerLabel: 'Cook: 3 min each side', seconds: 360 },
    ],
  },
  {
    id: 'spinach-cheddar-omelet',
    title: 'Spinach & Cheddar Omelet',
    art: 'pan',
    tint: 'mint',
    minutes: 10,
    meta: '10 min · Breakfast · Easy',
    difficulty: 'Easy',
    serves: 1,
    tags: ['no-oven', 'budget', 'vegetarian'],
    allergens: ['egg', 'dairy'],
    ingredients: [
      { label: 'eggs' },
      { label: 'spinach' },
      { label: 'cheddar' },
      { label: 'green onions', matchedAs: 'scallions' },
      { label: 'butter' },
      { label: 'salt' },
      { label: 'black pepper' },
    ],
    steps: [
      { text: 'Whisk the eggs with a pinch of salt and black pepper. Slice the green onions and grate the cheddar.', timerLabel: 'Prep ingredients' },
      { text: 'Melt butter in a nonstick skillet. Add spinach and green onions and cook until the spinach wilts.', timerLabel: 'Wilt spinach: 1 min', seconds: 60 },
      { text: 'Pour in the eggs. As they begin to set, add cheddar, fold the omelet, and cook until done.', timerLabel: 'Cook eggs: 3 min', seconds: 180 },
    ],
  },
  {
    id: 'chicken-pepper-rice-bowls',
    title: 'Chicken & Pepper Rice Bowls',
    art: 'bowl',
    tint: 'peach',
    minutes: 25,
    meta: '25 min · Dinner · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven'],
    allergens: [],
    ingredients: [
      { label: 'chicken' },
      { label: 'cooked rice' },
      { label: 'bell peppers' },
      { label: 'onions' },
      { label: 'garlic' },
      { label: 'olive oil' },
      { label: 'salt' },
      { label: 'black pepper' },
    ],
    steps: [
      { text: 'Slice the chicken, bell peppers and onion. Mince the garlic.', timerLabel: 'Prep ingredients' },
      { text: 'Heat olive oil in a skillet. Cook the chicken with salt and pepper until browned and cooked through.', timerLabel: 'Cook chicken: 8 min', seconds: 480 },
      { text: 'Add the onion, bell peppers and garlic. Cook until tender, then serve over warm rice.', timerLabel: 'Cook vegetables: 6 min', seconds: 360 },
    ],
  },
  {
    id: 'tomato-garlic-parmesan-pasta',
    title: 'Tomato, Garlic & Parmesan Pasta',
    art: 'pan',
    tint: 'peach',
    minutes: 20,
    meta: '20 min · Dinner · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven', 'budget', 'vegetarian'],
    allergens: ['dairy', 'gluten'],
    ingredients: [
      { label: 'pasta' },
      { label: 'tomatoes' },
      { label: 'garlic' },
      { label: 'olive oil' },
      { label: 'parmesan' },
      { label: 'salt' },
      { label: 'black pepper' },
    ],
    steps: [
      { text: 'Cook pasta in salted water according to the package directions. Reserve a small cup of pasta water before draining.', timerLabel: 'Cook pasta', },
      { text: 'Warm olive oil in a skillet. Add chopped garlic and tomatoes and cook until the tomatoes soften.', timerLabel: 'Tomato sauce: 8 min', seconds: 480 },
      { text: 'Toss in the pasta with a splash of pasta water. Season with pepper and finish with grated Parmesan.', timerLabel: 'Toss and serve' },
    ],
  },
  {
    id: 'cheesy-potato-carrot-skillet',
    title: 'Cheesy Potato & Carrot Skillet',
    art: 'pan',
    tint: 'butter',
    minutes: 25,
    meta: '25 min · Dinner · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven', 'budget', 'vegetarian'],
    allergens: ['dairy'],
    ingredients: [
      { label: 'potatoes' },
      { label: 'carrots' },
      { label: 'onions' },
      { label: 'butter' },
      { label: 'cheddar' },
      { label: 'salt' },
      { label: 'black pepper' },
    ],
    steps: [
      { text: 'Dice the potatoes, carrots and onion into small pieces so they cook evenly.', timerLabel: 'Prep vegetables' },
      { text: 'Melt butter in a covered skillet. Add the vegetables, salt and pepper, then cook, stirring occasionally, until tender.', timerLabel: 'Cook vegetables: 15 min', seconds: 900 },
      { text: 'Sprinkle cheddar over the vegetables, cover until melted, and serve.', timerLabel: 'Melt cheese: 2 min', seconds: 120 },
    ],
  },
  {
    id: 'chicken-fajita-wraps',
    title: 'Chicken Fajita Wraps',
    art: 'wrap',
    tint: 'peach',
    minutes: 20,
    meta: '20 min · Dinner · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven'],
    allergens: ['gluten', 'dairy'],
    ingredients: [
      { label: 'chicken' },
      { label: 'bell peppers' },
      { label: 'onions' },
      { label: 'tortillas' },
      { label: 'garlic' },
      { label: 'olive oil' },
      { label: 'ground cumin', missing: true },
      { label: 'salsa', missing: true },
    ],
    steps: [
      { text: 'Slice the chicken, bell peppers and onion. Mince the garlic.', timerLabel: 'Prep ingredients' },
      { text: 'Cook the chicken in olive oil with garlic and cumin until cooked through.', timerLabel: 'Cook chicken: 8 min', seconds: 480 },
      { text: 'Add peppers and onion and cook until tender. Spoon into warm tortillas and serve with salsa.', timerLabel: 'Cook vegetables: 5 min', seconds: 300 },
    ],
  },
  {
    id: 'creamy-spinach-mushroom-pasta',
    title: 'Creamy Spinach & Mushroom Pasta',
    art: 'pan',
    tint: 'mint',
    minutes: 20,
    meta: '20 min · Dinner · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven', 'vegetarian'],
    allergens: ['dairy', 'gluten'],
    ingredients: [
      { label: 'pasta' },
      { label: 'spinach' },
      { label: 'mushrooms' },
      { label: 'garlic' },
      { label: 'olive oil' },
      { label: 'parmesan' },
      { label: 'heavy cream', missing: true },
      { label: 'red pepper flakes', missing: true },
    ],
    steps: [
      { text: 'Cook pasta in salted water according to the package directions. Reserve a little pasta water, then drain.', timerLabel: 'Cook pasta' },
      { text: 'Sauté sliced mushrooms and garlic in olive oil until tender. Add spinach and stir until wilted.', timerLabel: 'Cook vegetables: 5 min', seconds: 300 },
      { text: 'Stir in cream and a splash of pasta water. Toss with pasta and finish with Parmesan and red pepper flakes.', timerLabel: 'Finish sauce: 3 min', seconds: 180 },
    ],
  },
  {
    id: 'loaded-cheesy-potatoes',
    title: 'Loaded Cheesy Potatoes',
    art: 'bowl',
    tint: 'butter',
    minutes: 20,
    meta: '20 min · Lunch · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven', 'budget', 'vegetarian'],
    allergens: ['dairy'],
    ingredients: [
      { label: 'potatoes' },
      { label: 'cheddar' },
      { label: 'butter' },
      { label: 'green onions' },
      { label: 'sour cream', missing: true },
    ],
    steps: [
      { text: 'Dice the potatoes into small cubes and place in a covered microwave-safe dish with a splash of water.', timerLabel: 'Soften potatoes: 8 min', seconds: 480 },
      { text: 'Drain carefully, then toss the hot potatoes with butter, salt and pepper.', timerLabel: 'Season potatoes' },
      { text: 'Top with cheddar and sliced green onions. Cover until the cheese melts and serve with sour cream.', timerLabel: 'Melt cheese: 1 min', seconds: 60 },
    ],
  },
  {
    id: 'tomato-beef-rice-skillet',
    title: 'Tomato Beef & Rice Skillet',
    art: 'pan',
    tint: 'sky',
    minutes: 20,
    meta: '20 min · Dinner · Easy',
    difficulty: 'Easy',
    serves: 2,
    tags: ['no-oven'],
    allergens: [],
    ingredients: [
      { label: 'ground beef' },
      { label: 'cooked rice' },
      { label: 'tomatoes' },
      { label: 'onions' },
      { label: 'garlic' },
      { label: 'olive oil' },
      { label: 'tomato paste', missing: true },
      { label: 'chili powder', missing: true },
    ],
    steps: [
      { text: 'Warm olive oil in a skillet. Add ground beef and chopped onion and cook until the beef is browned.', timerLabel: 'Brown beef: 7 min', seconds: 420 },
      { text: 'Stir in garlic, chopped tomatoes, tomato paste and chili powder. Simmer until the tomatoes soften.', timerLabel: 'Simmer: 5 min', seconds: 300 },
      { text: 'Fold in the cooked rice, season to taste and heat through before serving.', timerLabel: 'Heat through: 2 min', seconds: 120 },
    ],
  },
];

export function getRecipe(id: string | undefined) {
  return RECIPES.find((recipe) => recipe.id === id) ?? RECIPES[0];
}

export const ALLERGEN_OPTIONS = ['egg', 'dairy', 'soy', 'nuts', 'gluten', 'shellfish', 'sesame'] as const;

export const BASIC_INGREDIENTS = [
  'soy sauce',
  'salt',
  'pepper',
  'worcestershire',
  'butter',
  'oil',
  'olive oil',
  'vegetable oil',
  'vinegar',
  'lemon juice',
  'water',
  'flour',
  'sugar',
  'garlic powder',
  'onion powder',
  'paprika',
  'cinnamon',
];

export function getAllergyMatches(recipe: Recipe, allergies: string[]) {
  return recipe.allergens.filter((allergen) => allergies.includes(allergen));
}

export function allergyMessage(recipe: Recipe, allergies: string[]) {
  const matches = getAllergyMatches(recipe, allergies);
  if (matches.length === 0) return null;
  const labels = matches.map((item) => item.toUpperCase());
  return `Contains ${labels.join(', ')}, which is on your allergy list.`;
}

function normalizeIngredient(label: string) {
  return label
    .toLowerCase()
    .replace(/^[\d½¼¾\s.,-]+/, '')
    .replace(/\b(cups?|tbsp|tablespoons?|tsp|teaspoons?|cloves?|cans?|handfuls?|slices?|pieces?|ounces?|oz|pounds?|lbs?)\b/g, ' ')
    .replace(/\b(chopped|diced|minced|grated|shredded|sliced|freshly|fresh|ground|large|small|medium|whole|unsalted|salted|optional|melted|cooled|peeled|and|or)\b/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ingredientMatches(ingredient: string, fridgeIngredient: string) {
  if (!ingredient || !fridgeIngredient) return false;
  const singular = (value: string) => value.replace(/\b([a-z]+)s\b/g, '$1');
  const normalizedIngredient = singular(ingredient);
  const normalizedFridgeIngredient = singular(fridgeIngredient);
  return (
    normalizedIngredient === normalizedFridgeIngredient ||
    normalizedIngredient.startsWith(`${normalizedFridgeIngredient} `) ||
    normalizedIngredient.endsWith(` ${normalizedFridgeIngredient}`) ||
    normalizedFridgeIngredient.startsWith(`${normalizedIngredient} `) ||
    normalizedFridgeIngredient.endsWith(` ${normalizedIngredient}`)
  );
}

export function isBasicIngredient(label: string) {
  const normalized = normalizeIngredient(label);
  return BASIC_INGREDIENTS.some((basic) => ingredientMatches(normalized, normalizeIngredient(basic)));
}

export function getMissingIngredients(recipe: Recipe, fridgeItems: string[], assumeBasics = false) {
  return recipe.ingredients.filter((ingredient) => {
    const aliases = [
      normalizeIngredient(ingredient.label),
      ...(ingredient.matchedAs ? [normalizeIngredient(ingredient.matchedAs)] : []),
    ];
    return !aliases.some(
      (alias) =>
        fridgeItems.some((item) => ingredientMatches(alias, normalizeIngredient(item))) ||
        (assumeBasics && isBasicIngredient(alias))
    );
  });
}

export function missingLabel(recipe: Recipe, fridgeItems: string[], assumeBasics = false) {
  const missing = getMissingIngredients(recipe, fridgeItems, assumeBasics);
  if (missing.length === 0) return null;
  return `Missing: ${missing.map((ingredient) => ingredient.label).join(', ')}${recipe.smartSwap ? ' (swap available)' : ''}`;
}

export type FridgeItem = { name: string; tint: TintName };

export const STARTER_FRIDGE: FridgeItem[] = [
  { name: 'Eggs', tint: 'butter' },
  { name: 'Milk', tint: 'sky' },
  { name: 'Spinach', tint: 'mint' },
  { name: 'Cheddar', tint: 'peach' },
  { name: 'Tortillas', tint: 'butter' },
  { name: 'Green onions', tint: 'mint' },
  { name: 'Rice', tint: 'sky' },
  { name: 'Garlic', tint: 'peach' },
  { name: 'Onions', tint: 'butter' },
  { name: 'Tomatoes', tint: 'peach' },
  { name: 'Olive oil', tint: 'mint' },
  { name: 'Butter', tint: 'butter' },
  { name: 'Parmesan', tint: 'sky' },
  { name: 'Pasta', tint: 'peach' },
  { name: 'Bread', tint: 'butter' },
  { name: 'Flour', tint: 'mint' },
  { name: 'Sugar', tint: 'sky' },
  { name: 'Potatoes', tint: 'peach' },
  { name: 'Carrots', tint: 'butter' },
  { name: 'Lemons', tint: 'mint' },
  { name: 'Mushrooms', tint: 'sky' },
  { name: 'Bell peppers', tint: 'peach' },
  { name: 'Chicken', tint: 'butter' },
  { name: 'Ground beef', tint: 'mint' },
  { name: 'Beans', tint: 'sky' },
  { name: 'Shrimp', tint: 'peach' },
  { name: 'Salt', tint: 'butter' },
  { name: 'Black pepper', tint: 'sky' },
];

export const EXPIRING = [
  { name: 'Spinach', daysLeft: 2 },
  { name: 'Milk', daysLeft: 3 },
];

export const SYNONYMS: { a: string; b: string; tint: TintName }[] = [
  { a: 'Green onions', b: 'Scallions', tint: 'mint' },
  { a: 'Chickpeas', b: 'Garbanzo beans', tint: 'butter' },
  { a: 'Cilantro', b: 'Coriander leaves', tint: 'sky' },
];

export const QUICK_SWAPS = [
  { outOf: 'Buttermilk', use: '1 cup milk + 1 tbsp lemon juice, rest 5 min' },
  { outOf: 'Soy sauce', use: 'Pinch of salt + splash of Worcestershire' },
  { outOf: 'Butter (for cooking)', use: 'Same amount of olive or vegetable oil' },
];
