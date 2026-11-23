"""HTTP API for FridgeChef recommendations."""

from __future__ import annotations

import csv
import os
from difflib import get_close_matches
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import DEFAULT_DB, create_database, load_db_recipes
from fridgechef import ingredients_match, normalize
from recommend import BASICS, METHODS, recommend

ALLERGEN_MAP = Path(__file__).with_name("allergen_map.csv")
SWAPS_CSV = Path(__file__).with_name("substitutions.csv")


class RecommendationRequest(BaseModel):
    ingredients: str | list[str]
    method: str = "jaccard"
    top_n: int = Field(default=5, ge=1, le=25)
    have_basics: bool = False


class Recommendation(BaseModel):
    recipe_id: int
    title: str
    url: str
    category: str
    cuisine: str
    main_protein: str
    method: str
    score: float
    ingredient_coverage: float
    matched_ingredients: list[str]
    missing_ingredients: list[str]
    total_ingredients: int


class RecipeDetails(BaseModel):
    recipe_id: int
    title: str
    url: str
    category: str
    cuisine: str
    main_protein: str
    ingredients: list[str]


class IngredientAvailabilityRequest(BaseModel):
    ingredients: list[str]


class IngredientAvailability(BaseModel):
    available_ingredients: list[str]


class IngredientCheckRequest(BaseModel):
    ingredient: str = Field(min_length=1, max_length=120)


class IngredientCheckResponse(BaseModel):
    recognized: bool
    suggestion: str | None = None


class AllergenList(BaseModel):
    allergens: list[str]


class RecipeAllergen(BaseModel):
    ingredient: str
    allergens: list[str]
    basis: str


class RecipeAllergenList(BaseModel):
    ingredients: list[RecipeAllergen]


class IngredientSwap(BaseModel):
    ingredient: str
    applies_to: list[str]
    substitute: str
    use_when: str
    substitute_contains: str
    source_name: str
    source_url: str


def _allowed_origins() -> list[str]:
    configured = os.environ.get("FRIDGECHEF_ALLOWED_ORIGINS")
    if configured is None:
        return [
            "http://localhost:8081",
            "http://127.0.0.1:8081",
            "http://localhost:8088",
            "http://127.0.0.1:8088",
        ]
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


app = FastAPI(title="FridgeChef API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/methods", response_model=list[str])
def get_methods() -> list[str]:
    return list(METHODS)


@lru_cache(maxsize=1)
def _cached_ingredient_vocabulary(database_mtime_ns: int) -> tuple[str, ...]:
    return tuple(sorted({
        ingredient
        for recipe in load_db_recipes(DEFAULT_DB)
        for ingredient in recipe["ingredient_list"]
    }))


def _classify_ingredient(ingredient: str, vocabulary: set[str]) -> IngredientCheckResponse:
    normalized = normalize(ingredient.strip())
    if not normalized:
        raise HTTPException(status_code=422, detail="Enter an ingredient name.")
    if normalized in vocabulary:
        return IngredientCheckResponse(recognized=True)

    suggestions = get_close_matches(normalized, sorted(vocabulary), n=1, cutoff=0.8)
    return IngredientCheckResponse(
        recognized=False,
        suggestion=suggestions[0] if suggestions else None,
    )


@app.post("/ingredients/check", response_model=IngredientCheckResponse)
def check_ingredient(request: IngredientCheckRequest) -> IngredientCheckResponse:
    try:
        if not DEFAULT_DB.is_file():
            create_database()
        database_mtime_ns = DEFAULT_DB.stat().st_mtime_ns
        vocabulary = set(_cached_ingredient_vocabulary(database_mtime_ns))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Recipe database is not available.") from exc

    vocabulary.update(normalize(ingredient) for ingredient in BASICS)
    return _classify_ingredient(request.ingredient, vocabulary)


@app.get("/recipes/{recipe_id}", response_model=RecipeDetails)
def get_recipe_details(recipe_id: int) -> RecipeDetails:
    try:
        recipe = next(
            (item for item in load_db_recipes(DEFAULT_DB) if item["id"] == recipe_id),
            None,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Recipe database is not available.") from exc
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found.")
    return RecipeDetails(
        recipe_id=recipe["id"],
        title=recipe["title"],
        url=recipe["url"],
        category=recipe["category"],
        cuisine=recipe["cuisine"],
        main_protein=recipe["main_protein"],
        ingredients=recipe["ingredient_list"],
    )


@app.post("/recipes/{recipe_id}/availability", response_model=IngredientAvailability)
def get_recipe_availability(
    recipe_id: int,
    request: IngredientAvailabilityRequest,
) -> IngredientAvailability:
    recipe = get_recipe_details(recipe_id)
    available = [
        ingredient
        for ingredient in recipe.ingredients
        if any(ingredients_match(item, ingredient) for item in request.ingredients)
    ]
    return IngredientAvailability(available_ingredients=available)


@lru_cache(maxsize=1)
def _cached_allergen_records(
    allergen_map_mtime_ns: int,
) -> tuple[tuple[str, tuple[str, ...], str], ...]:
    records: dict[str, tuple[set[str], set[str]]] = {}
    with ALLERGEN_MAP.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        required = {"ingredient", "allergens", "basis"}
        if not reader.fieldnames or not required.issubset(
            {name.strip().lower() for name in reader.fieldnames if name}
        ):
            raise ValueError("Allergen CSV must contain ingredient, allergens, and basis columns.")

        for line_number, row in enumerate(reader, start=2):
            ingredient = (row.get("ingredient") or "").strip()
            normalized = normalize(ingredient)
            allergens = {
                tag.strip().lower()
                for tag in (row.get("allergens") or "").split(";")
                if tag.strip()
            }
            basis = (row.get("basis") or "").strip()
            if not normalized or not allergens or not basis:
                raise ValueError(f"Allergen CSV row {line_number} is missing required data.")

            known_allergens, known_basis = records.setdefault(normalized, (set(), set()))
            known_allergens.update(allergens)
            known_basis.add(basis)

    return tuple(
        (ingredient, tuple(sorted(allergens)), "; ".join(sorted(basis)))
        for ingredient, (allergens, basis) in sorted(records.items())
    )


def _get_allergen_records() -> tuple[tuple[str, tuple[str, ...], str], ...]:
    try:
        return _cached_allergen_records(ALLERGEN_MAP.stat().st_mtime_ns)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Allergen map is not available.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Allergen map is invalid.") from exc


@app.get("/allergens", response_model=AllergenList)
def get_allergens() -> AllergenList:
    allergens = sorted({
        allergen
        for _, record_allergens, _ in _get_allergen_records()
        for allergen in record_allergens
    })
    return AllergenList(allergens=allergens)


@app.get("/recipes/{recipe_id}/allergens", response_model=RecipeAllergenList)
def get_recipe_allergens(recipe_id: int) -> RecipeAllergenList:
    recipe = get_recipe_details(recipe_id)
    records = {
        ingredient: (allergens, basis)
        for ingredient, allergens, basis in _get_allergen_records()
    }
    matches = []
    for ingredient in recipe.ingredients:
        match = records.get(normalize(ingredient))
        if match is not None:
            allergens, basis = match
            matches.append(
                RecipeAllergen(ingredient=ingredient, allergens=list(allergens), basis=basis)
            )
    return RecipeAllergenList(ingredients=matches)


@lru_cache(maxsize=1)
def _cached_swap_records(file_mtime_ns: int) -> tuple[IngredientSwap, ...]:
    swaps = []
    with SWAPS_CSV.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        required = {
            "ingredient",
            "applies_to",
            "substitute",
            "use_when",
            "substitute_contains",
            "source_name",
            "source_url",
        }
        if not reader.fieldnames or not required.issubset(
            {name.strip().lower() for name in reader.fieldnames if name}
        ):
            raise ValueError(
                "Substitutions CSV must contain ingredient, applies_to, substitute, "
                "use_when, substitute_contains, source_name, and source_url columns."
            )

        for line_number, row in enumerate(reader, start=2):
            ingredient = (row.get("ingredient") or "").strip()
            applies_to = [
                item.strip()
                for item in (row.get("applies_to") or "").split(";")
                if item.strip()
            ]
            substitute = (row.get("substitute") or "").strip()
            use_when = (row.get("use_when") or "").strip()
            substitute_contains = (row.get("substitute_contains") or "").strip()
            source_name = (row.get("source_name") or "").strip()
            source_url = (row.get("source_url") or "").strip()
            parsed_url = urlparse(source_url)
            if (
                not normalize(ingredient)
                or not applies_to
                or not substitute
                or not use_when
                or not substitute_contains
                or not source_name
                or parsed_url.scheme != "https"
                or not parsed_url.netloc
            ):
                raise ValueError(f"Substitutions CSV row {line_number} is missing valid data.")

            swaps.append(
                IngredientSwap(
                    ingredient=ingredient,
                    applies_to=applies_to,
                    substitute=substitute,
                    use_when=use_when,
                    substitute_contains=substitute_contains,
                    source_name=source_name,
                    source_url=source_url,
                )
            )
    return tuple(swaps)


def _get_swap_records() -> tuple[IngredientSwap, ...]:
    try:
        return _cached_swap_records(SWAPS_CSV.stat().st_mtime_ns)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Substitution data is not available.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Substitution data is invalid.") from exc


@app.get("/swaps", response_model=list[IngredientSwap])
def get_swaps(ingredient: str | None = Query(default=None, max_length=120)) -> list[IngredientSwap]:
    swaps = _get_swap_records()
    normalized_query = normalize(ingredient.strip()) if ingredient else ""
    if not normalized_query:
        return list(swaps)
    return [
        swap
        for swap in swaps
        if normalized_query in {normalize(item) for item in [swap.ingredient, *swap.applies_to]}
    ]


@lru_cache(maxsize=64)
def _cached_recommendations(
    ingredients: str | tuple[str, ...],
    method: str,
    have_basics: bool,
    database_mtime_ns: int,
) -> tuple[dict[str, Any], ...]:
    return tuple(
        recommend(
            ingredients,
            method=method,
            top_n=25,
            have_basics=have_basics,
        )
    )


@app.post("/recommend", response_model=list[Recommendation])
def get_recommendations(request: RecommendationRequest) -> list[dict[str, Any]]:
    try:
        database_mtime_ns = DEFAULT_DB.stat().st_mtime_ns if DEFAULT_DB.is_file() else 0
        ingredients = (
            tuple(request.ingredients)
            if isinstance(request.ingredients, list)
            else request.ingredients
        )
        ranked = _cached_recommendations(
            ingredients,
            request.method,
            request.have_basics,
            database_mtime_ns,
        )
        return list(ranked[:request.top_n])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
