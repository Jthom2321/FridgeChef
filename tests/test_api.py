from io import StringIO
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from api import (
    _classify_ingredient,
    IngredientAvailabilityRequest,
    IngredientCheckRequest,
    RecommendationRequest,
    _allowed_origins,
    _cached_recommendations,
    _cached_allergen_records,
    _cached_swap_records,
    check_ingredient,
    get_allergens,
    get_methods,
    get_recipe_availability,
    get_recipe_allergens,
    get_recipe_details,
    get_recommendations,
    get_swaps,
    IngredientSwap,
    RecipeDetails,
)
from recommend import METHODS


class RecommendationApiTests(unittest.TestCase):
    def setUp(self):
        _cached_recommendations.cache_clear()

    def tearDown(self):
        _cached_recommendations.cache_clear()
        _cached_allergen_records.cache_clear()
        _cached_swap_records.cache_clear()

    def test_default_cors_allowlist_includes_expo_web_port(self):
        with patch("api.os.environ", {}):
            origins = _allowed_origins()

        self.assertIn("http://localhost:8088", origins)
        self.assertIn("http://127.0.0.1:8088", origins)

    def test_ingredient_check_suggests_a_correction_for_a_likely_typo(self):
        result = _classify_ingredient("spinoch", {"spinach"})

        self.assertFalse(result.recognized)
        self.assertEqual(result.suggestion, "spinach")

    def test_ingredient_check_allows_confirmation_for_unlisted_foods(self):
        result = _classify_ingredient("gochujang", {"spinach"})

        self.assertFalse(result.recognized)
        self.assertIsNone(result.suggestion)

    def test_ingredient_check_recognizes_exact_catalog_entries(self):
        result = _classify_ingredient("spinach", {"spinach"})

        self.assertTrue(result.recognized)
        self.assertIsNone(result.suggestion)

    def test_ingredient_check_endpoint_returns_a_typo_suggestion(self):
        with patch("api.DEFAULT_DB") as database:
            database.is_file.return_value = True
            database.stat.return_value.st_mtime_ns = 1
            with patch("api._cached_ingredient_vocabulary", return_value=("spinach",)):
                result = check_ingredient(IngredientCheckRequest(ingredient="spinoch"))

        self.assertFalse(result.recognized)
        self.assertEqual(result.suggestion, "spinach")

    def test_methods_endpoint_uses_recommendation_methods(self):
        self.assertEqual(get_methods(), list(METHODS))

    def test_recommendation_endpoint_passes_request_to_shared_function(self):
        request = RecommendationRequest(
            ingredients=["eggs", "spinach"],
            method="coverage",
            top_n=8,
            have_basics=True,
        )
        expected = [{"recipe_id": 1, "title": "Example recipe"}]

        with patch("api._cached_recommendations", return_value=tuple(expected)) as cache_mock:
            result = get_recommendations(request)

        self.assertEqual(
            cache_mock.call_args.args[:3],
            (("eggs", "spinach"), "coverage", True),
        )
        self.assertEqual(result, expected)

    def test_recommendation_input_errors_become_client_errors(self):
        request = RecommendationRequest(ingredients="eggs", method="unknown")
        with patch("api._cached_recommendations", side_effect=ValueError("Unknown method.")):
            with self.assertRaises(HTTPException) as raised:
                get_recommendations(request)

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail, "Unknown method.")

    def test_result_count_must_fit_recommendation_limit(self):
        with self.assertRaises(ValidationError):
            RecommendationRequest(ingredients="eggs", top_n=26)

    def test_api_slices_cached_results_to_requested_count(self):
        request = RecommendationRequest(ingredients="eggs", top_n=2)
        expected = tuple({"recipe_id": index} for index in range(5))

        with patch("api._cached_recommendations", return_value=expected):
            result = get_recommendations(request)

        self.assertEqual(len(result), 2)

    def test_full_ranked_results_are_cached(self):
        expected = [{"title": "Example recipe"}]

        with patch("api.recommend", return_value=expected) as recommend_mock:
            first = _cached_recommendations(("eggs",), "jaccard", True, 123)
            second = _cached_recommendations(("eggs",), "jaccard", True, 123)

        recommend_mock.assert_called_once_with(
            ("eggs",),
            method="jaccard",
            top_n=25,
            have_basics=True,
        )
        self.assertEqual(first, second)

    def test_recipe_details_are_loaded_from_the_recipe_database(self):
        stored_recipe = {
            "id": 17,
            "title": "Database recipe",
            "url": "https://example.test/recipe",
            "category": "dinner",
            "cuisine": "Italian",
            "main_protein": "egg",
            "ingredient_list": ["egg", "spinach"],
        }
        with patch("api.load_db_recipes", return_value=[stored_recipe]):
            result = get_recipe_details(17)

        self.assertEqual(result.recipe_id, 17)
        self.assertEqual(result.ingredients, ["egg", "spinach"])

    def test_unknown_recipe_details_return_not_found(self):
        with patch("api.load_db_recipes", return_value=[]):
            with self.assertRaises(HTTPException) as raised:
                get_recipe_details(999)

        self.assertEqual(raised.exception.status_code, 404)

    def test_recipe_availability_uses_shared_ingredient_matching(self):
        recipe = RecipeDetails(
            recipe_id=17,
            title="Database recipe",
            url="https://example.test/recipe",
            category="dinner",
            cuisine="",
            main_protein="",
            ingredients=["garlic", "chicken stock", "egg"],
        )
        request = IngredientAvailabilityRequest(ingredients=["garlic", "chicken", "egg"])

        with patch("api.get_recipe_details", return_value=recipe):
            result = get_recipe_availability(17, request)

        self.assertEqual(result.available_ingredients, ["garlic", "egg"])

    def test_allergen_list_returns_categories_from_the_csv(self):
        with patch("api._get_allergen_records", return_value=(
            ("egg", ("egg", "milk"), "dairy"),
            ("flour", ("wheat/gluten",), "wheat flour"),
        )):
            result = get_allergens()

        self.assertEqual(result.allergens, ["egg", "milk", "wheat/gluten"])

    def test_recipe_allergens_match_normalized_recipe_ingredients(self):
        recipe = RecipeDetails(
            recipe_id=17,
            title="Database recipe",
            url="https://example.test/recipe",
            category="dinner",
            cuisine="",
            main_protein="",
            ingredients=["eggs", "fresh mozzarella", "spinach"],
        )
        records = (
            ("egg", ("egg",), "egg"),
            ("mozzarella", ("milk",), "cheese"),
        )
        with patch("api.get_recipe_details", return_value=recipe):
            with patch("api._get_allergen_records", return_value=records):
                result = get_recipe_allergens(17)

        self.assertEqual(
            [(item.ingredient, item.allergens, item.basis) for item in result.ingredients],
            [("eggs", ["egg"], "egg"), ("fresh mozzarella", ["milk"], "cheese")],
        )

    def test_allergen_csv_normalizes_ingredients_and_merges_duplicate_rows(self):
        with patch("api.ALLERGEN_MAP") as allergen_map:
            allergen_map.open.return_value = StringIO(
                "ingredient,allergens,basis\n"
                "egg,egg,egg\n"
                "eggs,milk,dairy\n"
            )
            result = _cached_allergen_records(987654321)

        self.assertEqual(result, (("egg", ("egg", "milk"), "dairy; egg"),))

    def test_swaps_can_be_filtered_by_a_normalized_alias(self):
        swap = IngredientSwap(
            ingredient="eggs",
            applies_to=["eggs", "egg", "whole egg"],
            substitute="3 Tbsp aquafaba per egg",
            use_when="baking",
            substitute_contains="none",
            source_name="Example source",
            source_url="https://example.test/swaps",
        )
        with patch("api._get_swap_records", return_value=(swap,)):
            result = get_swaps("whole eggs")

        self.assertEqual(result, [swap])

    def test_swaps_do_not_match_partial_ingredient_names(self):
        swap = IngredientSwap(
            ingredient="chicken broth",
            applies_to=["chicken broth", "chicken stock"],
            substitute="water",
            use_when="any",
            substitute_contains="none",
            source_name="Example source",
            source_url="https://example.test/swaps",
        )
        with patch("api._get_swap_records", return_value=(swap,)):
            result = get_swaps("chicken")

        self.assertEqual(result, [])

    def test_swap_csv_splits_aliases_and_preserves_source_notes(self):
        with patch("api.SWAPS_CSV") as swap_file:
            swap_file.open.return_value = StringIO(
                "ingredient,applies_to,substitute,use_when,substitute_contains,source_name,source_url\n"
                'buttermilk,"buttermilk; cultured buttermilk","milk + lemon juice",baking,milk,'
                "Example source,https://example.test/swaps\n"
            )
            result = _cached_swap_records(987654322)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].applies_to, ["buttermilk", "cultured buttermilk"])
        self.assertEqual(result[0].substitute_contains, "milk")
        self.assertEqual(result[0].source_url, "https://example.test/swaps")


if __name__ == "__main__":
    unittest.main()
