export type RecipeRecommendation = {
  recipe_id: number;
  title: string;
  url: string;
  category: string;
  cuisine: string;
  main_protein: string;
  method: string;
  score: number;
  ingredient_coverage: number;
  matched_ingredients: string[];
  missing_ingredients: string[];
  total_ingredients: number;
};

export type RecipeDetails = {
  recipe_id: number;
  title: string;
  url: string;
  category: string;
  cuisine: string;
  main_protein: string;
  ingredients: string[];
};

export type IngredientAvailability = {
  available_ingredients: string[];
};

export type IngredientCheck = {
  recognized: boolean;
  suggestion: string | null;
};

export type RecipeAllergen = {
  ingredient: string;
  allergens: string[];
  basis: string;
};

export type IngredientSwap = {
  ingredient: string;
  applies_to: string[];
  substitute: string;
  use_when: string;
  substitute_contains: string;
  source_name: string;
  source_url: string;
};

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const recipeDetailsCache = new Map<number, RecipeDetails>();

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const body: unknown = await response.json();
    const detail =
      typeof body === 'object' && body !== null && 'detail' in body ? body.detail : undefined;
    throw new Error(typeof detail === 'string' ? detail : `Request failed with status ${response.status}.`);
  }
  return response.json();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecommendation(value: unknown): value is RecipeRecommendation {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    Number.isInteger(item.recipe_id) &&
    typeof item.title === 'string' &&
    typeof item.url === 'string' &&
    typeof item.category === 'string' &&
    typeof item.cuisine === 'string' &&
    typeof item.main_protein === 'string' &&
    typeof item.method === 'string' &&
    typeof item.score === 'number' &&
    Number.isFinite(item.score) &&
    typeof item.ingredient_coverage === 'number' &&
    Number.isFinite(item.ingredient_coverage) &&
    isStringArray(item.matched_ingredients) &&
    isStringArray(item.missing_ingredients) &&
    Number.isInteger(item.total_ingredients)
  );
}

function isRecipeDetails(value: unknown): value is RecipeDetails {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    Number.isInteger(item.recipe_id) &&
    typeof item.title === 'string' &&
    typeof item.url === 'string' &&
    typeof item.category === 'string' &&
    typeof item.cuisine === 'string' &&
    typeof item.main_protein === 'string' &&
    isStringArray(item.ingredients)
  );
}

function isIngredientAvailability(value: unknown): value is IngredientAvailability {
  return (
    typeof value === 'object' &&
    value !== null &&
    'available_ingredients' in value &&
    isStringArray(value.available_ingredients)
  );
}

function isIngredientCheck(value: unknown): value is IngredientCheck {
  return (
    typeof value === 'object' &&
    value !== null &&
    'recognized' in value &&
    typeof value.recognized === 'boolean' &&
    'suggestion' in value &&
    (value.suggestion === null || typeof value.suggestion === 'string')
  );
}

function isRecipeAllergen(value: unknown): value is RecipeAllergen {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.ingredient === 'string' &&
    isStringArray(item.allergens) &&
    typeof item.basis === 'string'
  );
}

function isIngredientSwap(value: unknown): value is IngredientSwap {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.ingredient === 'string' &&
    isStringArray(item.applies_to) &&
    typeof item.substitute === 'string' &&
    typeof item.use_when === 'string' &&
    typeof item.substitute_contains === 'string' &&
    typeof item.source_name === 'string' &&
    typeof item.source_url === 'string'
  );
}

export async function fetchSwaps(
  ingredient?: string,
  signal?: AbortSignal
): Promise<IngredientSwap[]> {
  const normalizedIngredient = ingredient?.trim();
  const query = normalizedIngredient
    ? `?ingredient=${encodeURIComponent(normalizedIngredient)}`
    : '';
  const result = await requestJson(`/swaps${query}`, { signal });
  if (!Array.isArray(result) || !result.every(isIngredientSwap)) {
    throw new Error('The backend returned substitution data in an unexpected format.');
  }
  return result;
}

export async function fetchAllergens(signal?: AbortSignal): Promise<string[]> {
  const result = await requestJson('/allergens', { signal });
  if (
    typeof result !== 'object' ||
    result === null ||
    !('allergens' in result) ||
    !isStringArray(result.allergens) ||
    result.allergens.length === 0
  ) {
    throw new Error('The backend returned allergen categories in an unexpected format.');
  }
  return result.allergens;
}

export async function fetchRecipeAllergens(
  recipeId: number,
  signal?: AbortSignal
): Promise<RecipeAllergen[]> {
  const result = await requestJson(`/recipes/${recipeId}/allergens`, { signal });
  if (
    typeof result !== 'object' ||
    result === null ||
    !('ingredients' in result) ||
    !Array.isArray(result.ingredients) ||
    !result.ingredients.every(isRecipeAllergen)
  ) {
    throw new Error('The backend returned recipe allergen data in an unexpected format.');
  }
  return result.ingredients;
}

export async function fetchMethods(signal?: AbortSignal): Promise<string[]> {
  const result = await requestJson('/methods', { signal });
  if (!isStringArray(result) || result.length === 0) {
    throw new Error('The backend did not return any recommendation methods.');
  }
  return result;
}

export async function checkIngredient(
  ingredient: string,
  signal?: AbortSignal
): Promise<IngredientCheck> {
  const result = await requestJson('/ingredients/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredient }),
    signal,
  });
  if (!isIngredientCheck(result)) {
    throw new Error('The backend returned ingredient validation in an unexpected format.');
  }
  return result;
}

export async function fetchRecipeDetails(
  recipeId: number,
  signal?: AbortSignal
): Promise<RecipeDetails> {
  const cached = recipeDetailsCache.get(recipeId);
  if (cached) return cached;

  const result = await requestJson(`/recipes/${recipeId}`, { signal });
  if (!isRecipeDetails(result)) {
    throw new Error('The backend returned recipe details in an unexpected format.');
  }
  recipeDetailsCache.set(recipeId, result);
  return result;
}

export async function fetchRecipeAvailability(
  recipeId: number,
  ingredients: string[],
  signal?: AbortSignal
): Promise<IngredientAvailability> {
  const result = await requestJson(`/recipes/${recipeId}/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients }),
    signal,
  });
  if (!isIngredientAvailability(result)) {
    throw new Error('The backend returned ingredient availability in an unexpected format.');
  }
  return result;
}

export async function fetchRecommendations(
  ingredients: string[],
  method: string,
  topN: number,
  haveBasics: boolean,
  signal?: AbortSignal
): Promise<RecipeRecommendation[]> {
  const result = await requestJson('/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ingredients,
      method,
      top_n: topN,
      have_basics: haveBasics,
    }),
    signal,
  });
  if (!Array.isArray(result) || !result.every(isRecommendation)) {
    throw new Error('The backend returned recommendations in an unexpected format.');
  }
  return result;
}
