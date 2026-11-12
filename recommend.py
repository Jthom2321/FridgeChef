"""The single public recommendation API for CLI, website, and evaluation.

Example:
    from recommend import recommend
    recipes = recommend("eggs, spinach, garlic, pasta", method="jaccard", top_n=5)

Use the same function everywhere to avoid inconsistent results. Normalization and
ranking still delegate to fridgechef.py, which Mikayla can improve independently.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Sequence

from database import DEFAULT_DB, create_database, load_db_recipes
from fridgechef import normalize, rank_recipes

METHODS = ("jaccard", "tfidf", "coverage")
BASICS = ("salt", "pepper", "oil", "olive oil", "water", "butter")
MAX_INGREDIENTS = 40
MAX_INPUT_CHARS = 2000


def _parse_ingredients(ingredients: str | Sequence[str]) -> list[str]:
    if isinstance(ingredients, str):
        raw = re.split(r"[,;\n]+", ingredients)
    elif isinstance(ingredients, (list, tuple, set)) and all(
        isinstance(x, str) for x in ingredients
    ):
        raw = list(ingredients)
    else:
        raise ValueError("Ingredients must be comma-separated text or a list of ingredient names.")

    if sum(len(x) for x in raw) > MAX_INPUT_CHARS or len(raw) > MAX_INGREDIENTS:
        raise ValueError(f"Too much input. Enter at most {MAX_INGREDIENTS} ingredients (up to {MAX_INPUT_CHARS} characters).")
    pantry = []
    for item in raw:
        if len(item) > 120:
            raise ValueError("An ingredient name is too long. Please enter shorter ingredient names.")
        cleaned = normalize(item.strip())
        if cleaned and cleaned not in pantry:
            pantry.append(cleaned)
    if not pantry:
        raise ValueError("Please enter at least one ingredient, separated by commas.")
    if len(pantry) > MAX_INGREDIENTS:
        raise ValueError(f"Please enter no more than {MAX_INGREDIENTS} ingredients.")
    return pantry


def recommend(ingredients: str | Sequence[str], method: str = "jaccard",
              top_n: int = 5, *, have_basics: bool = False,
              db_path: str | Path = DEFAULT_DB) -> list[dict]:
    """Return ranked recipe dictionaries with scores and ingredient breakdowns.

    Args:
        ingredients: comma-separated pantry text or a list of ingredient names.
        method: 'jaccard', 'tfidf', or 'coverage'.
        top_n: number of results, from 1 through 25.
        have_basics: add common staples for matching; disabled for baseline parity.
        db_path: SQLite file; created from recipes_v2.csv / recipes.csv if missing.

    Returns:
        [] when none of the recipes matches the user's ingredients.

    Raises:
        ValueError for malformed/empty/excessive input or unknown methods.
    """
    if method not in METHODS:
        raise ValueError(f"Unknown method '{method}'. Choose: {', '.join(METHODS)}.")
    if type(top_n) is not int or not 1 <= top_n <= 25:
        raise ValueError("Top N must be a whole number between 1 and 25.")
    pantry = _parse_ingredients(ingredients)
    db = Path(db_path)
    if not db.is_file():
        create_database(db_path=db)
    recipes = load_db_recipes(db)
    if not recipes:
        return []

    # Don't pretend random input produced matches just because basics were added.
    vocabulary = {token for r in recipes for term in r["ingredient_list"]
                  for token in term.split()}
    # Bare generic adjectives aren't enough to count as a recognized ingredient.
    meaningful_tokens = set(" ".join(pantry).split()) - {
        "fresh", "large", "small", "chopped", "minced", "diced", "organic",
        "some", "random", "ingredient", "food", "please", "make", "with",
    }
    if not meaningful_tokens.intersection(vocabulary):
        return []

    available = list(pantry)
    if have_basics:
        available.extend(x for x in BASICS if normalize(x) not in available)
    _, ranked = rank_recipes(", ".join(available), recipes, method, top_n)
    result = []
    for score, recipe, missing, matched in ranked:
        if score <= 0:
            continue
        result.append({
            "recipe_id": recipe["id"],
            "title": recipe["title"],
            "url": recipe["url"],
            "category": recipe["category"],
            "cuisine": recipe["cuisine"],
            "main_protein": recipe["main_protein"],
            "method": method,
            "score": float(score),
            "ingredient_coverage": len(matched) / len(recipe["ingredient_list"]),
            "matched_ingredients": matched,
            "missing_ingredients": missing,
            "total_ingredients": len(recipe["ingredient_list"]),
        })
    return result
