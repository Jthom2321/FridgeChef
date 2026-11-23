"""The single public recommendation API for CLI, website, and evaluation.

Example:
    from recommend import recommend
    recipes = recommend("eggs, spinach, garlic, pasta", method="jaccard", top_n=5)

Use the same function everywhere to avoid inconsistent results. Normalization and
ranking still delegate to fridgechef.py, which Mikayla can improve independently.

The command line (fridgechef.py), the website (api.py) and the hidden-list
evaluation (evaluate.py) all call recommend() and all take their defaults from
DEFAULT_METHOD / DEFAULT_HAVE_BASICS below, so there is only one FridgeChef.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Sequence

from database import (DEFAULT_DB, create_database, database_is_stale, load_allergen_map,
                      load_db_recipes, load_substitutions)
from fridgechef import BASICS, METHODS as RANKING_METHODS, is_basic, normalize, rank_recipes

# Single source of truth for every caller (CLI, website, evaluation).
METHODS = tuple(RANKING_METHODS)  # jaccard, tfidf, coverage, weighted, random
DEFAULT_METHOD = "jaccard"
DEFAULT_HAVE_BASICS = True  # the website always sent True; the CLI defaulted to True
DEFAULT_SEED = 0            # makes the random baseline repeatable
__all__ = ["BASICS", "METHODS", "DEFAULT_METHOD", "DEFAULT_HAVE_BASICS", "recommend"]
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


def recommend(ingredients: str | Sequence[str], method: str = DEFAULT_METHOD,
              top_n: int = 5, *, have_basics: bool = DEFAULT_HAVE_BASICS,
              db_path: str | Path = DEFAULT_DB,
              data_path: str | Path | None = None,
              seed: int = DEFAULT_SEED) -> list[dict]:
    """Return ranked recipe dictionaries with scores and ingredient breakdowns.

    Args:
        ingredients: comma-separated pantry text or a list of ingredient names.
        method: 'jaccard' (baseline), 'tfidf', 'coverage', 'weighted'
            (weighted coverage), or 'random' (chance baseline, score 0.0).
        top_n: number of results, from 1 through 25.
        have_basics: treat salt, pepper, oil, water, and butter as already owned,
            so they are neither required nor listed as missing.
        db_path: SQLite file; (re)built from recipes_v2.csv / recipes.csv when it
            is missing or older than the CSV or fridgechef.py.
        data_path: optional recipe CSV to use instead of the default dataset.
        seed: seed for the random baseline so its picks are repeatable.

    Returns:
        [] when none of the recipes matches the user's ingredients. Each
        result also carries `allergens` (Enioluwa's hand-checked recipe-level
        list), `allergen_ingredients` (which ingredient triggers each one) and
        `substitutions` (sourced swaps for the missing ingredients).

    Raises:
        ValueError for malformed/empty/excessive input or unknown methods.
    """
    if method not in METHODS:
        raise ValueError(f"Unknown method '{method}'. Choose: {', '.join(METHODS)}.")
    if type(top_n) is not int or not 1 <= top_n <= 25:
        raise ValueError("Top N must be a whole number between 1 and 25.")
    pantry = _parse_ingredients(ingredients)
    db = Path(db_path)
    if database_is_stale(db, csv_path=data_path):
        create_database(csv_path=data_path, db_path=db)
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

    _, ranked = rank_recipes(", ".join(pantry), recipes, method, top_n,
                             assume_basics=have_basics, seed=seed)
    allergen_map = load_allergen_map(db)
    swaps = load_substitutions(db)
    result = []
    for score, recipe, missing, matched in ranked:
        if method == "random":
            score = 0.0  # chance baseline: picks are unranked, not scored
        elif score <= 0:
            continue
        # Coverage counts only ingredients the user actually entered, not
        # basics that were assumed.
        from_pantry = [i for i in matched if not (have_basics and is_basic(i))]
        result.append({
            "recipe_id": recipe["id"],
            "title": recipe["title"],
            "url": recipe["url"],
            "category": recipe["category"],
            "cuisine": recipe["cuisine"],
            "main_protein": recipe["main_protein"],
            "method": method,
            "score": float(score),
            "ingredient_coverage": len(from_pantry) / len(recipe["ingredient_list"]),
            "matched_ingredients": matched,
            "missing_ingredients": missing,
            "total_ingredients": len(recipe["ingredient_list"]),
            "allergens": list(recipe.get("allergens", [])),
            "allergen_ingredients": [
                {"ingredient": i, **allergen_map[i]}
                for i in recipe["ingredient_list"] if i in allergen_map
            ],
            "substitutions": [
                {"for_ingredient": i, **swap}
                for i in missing for swap in swaps.get(i, [])
            ],
        })
    return result
