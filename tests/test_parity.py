"""One FridgeChef: the website (API), command line, and evaluation must agree.

These tests use the real 120-recipe dataset (no mocks) and check that the same
ingredients produce the identical top 5 through every entry point.
"""
import inspect
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import api
import evaluate
import fridgechef
from api import RecommendationRequest, _cached_recommendations, get_recommendations
from database import DEFAULT_DB, create_database
from recommend import DEFAULT_HAVE_BASICS, DEFAULT_METHOD, METHODS, recommend

ROOT = Path(__file__).resolve().parents[1]
LISTS = [
    "eggs, spinach, garlic, pasta",
    "chicken breast, rice, onion, bell pepper",
    "kimchi, tofu",
]


def cli_titles(ingredients, method):
    """Run the real command line and read the ranked titles it prints."""
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / "out.txt"
        subprocess.run(
            [sys.executable, str(ROOT / "fridgechef.py"), "--ingredients", ingredients,
             "--method", method, "--top", "5", "--output", str(output)],
            check=True, capture_output=True, text=True, cwd=ROOT,
        )
        text = output.read_text(encoding="utf-8")
    return re.findall(r"^\d+\. (.+?) \| score=", text, flags=re.MULTILINE)


class SharedDefaultsTests(unittest.TestCase):
    def test_every_entry_point_uses_the_same_methods(self):
        self.assertEqual(list(METHODS), ["jaccard", "tfidf", "coverage", "weighted", "random"])
        self.assertEqual(api.get_methods(), list(METHODS))
        self.assertEqual(evaluate.METHODS, METHODS)
        self.assertEqual(list(fridgechef.METHODS), list(METHODS))

    def test_have_basics_default_is_shared(self):
        self.assertEqual(
            inspect.signature(recommend).parameters["have_basics"].default,
            DEFAULT_HAVE_BASICS,
        )
        self.assertEqual(RecommendationRequest(ingredients="egg").have_basics, DEFAULT_HAVE_BASICS)
        self.assertEqual(RecommendationRequest(ingredients="egg").method, DEFAULT_METHOD)


class SameResultsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        create_database(db_path=DEFAULT_DB)
        _cached_recommendations.cache_clear()

    def test_website_and_recommend_return_identical_results(self):
        for ingredients in LISTS:
            for method in METHODS:
                with self.subTest(ingredients=ingredients, method=method):
                    website = get_recommendations(RecommendationRequest(
                        ingredients=ingredients, method=method, top_n=5))
                    direct = recommend(ingredients, method=method, top_n=5)
                    self.assertEqual(website, direct)

    def test_website_and_evaluation_return_identical_top_five(self):
        lists = [{"list_id": str(i), "group": "parity", "ingredients": text}
                 for i, text in enumerate(LISTS)]
        rows, _ = evaluate.evaluate_lists(lists, DEFAULT_DB)
        for i, ingredients in enumerate(LISTS):
            for method in METHODS:
                with self.subTest(ingredients=ingredients, method=method):
                    evaluated = [r["title"] for r in rows
                                 if r["list_id"] == str(i) and r["method"] == method]
                    website = [r["title"] for r in get_recommendations(RecommendationRequest(
                        ingredients=ingredients, method=method, top_n=5))]
                    self.assertEqual(evaluated, website)

    def test_command_line_and_website_return_identical_top_five(self):
        for ingredients in LISTS:
            for method in ("jaccard", "coverage", "weighted", "random"):
                with self.subTest(ingredients=ingredients, method=method):
                    website = [r["title"] for r in get_recommendations(RecommendationRequest(
                        ingredients=ingredients, method=method, top_n=5))]
                    self.assertEqual(cli_titles(ingredients, method), website)

    def test_random_baseline_is_repeatable_and_api_safe(self):
        first = recommend("eggs, spinach", method="random", top_n=5)
        second = recommend("eggs, spinach", method="random", top_n=5)
        self.assertEqual(first, second)
        self.assertTrue(all(r["score"] == 0.0 for r in first))

    def test_no_zero_score_results_for_unsupported_cuisine(self):
        for method in ("jaccard", "tfidf", "coverage", "weighted"):
            for r in recommend("kimchi, tofu", method=method, top_n=5):
                self.assertGreater(r["score"], 0)
                self.assertNotEqual(r["title"], "Apple Dumplings")


class AllergenAndSwapTests(unittest.TestCase):
    def test_each_result_carries_allergens_and_sourced_swaps(self):
        results = recommend("eggs, spinach, garlic, pasta", top_n=5)
        self.assertTrue(results)
        for r in results:
            self.assertIsInstance(r["allergens"], list)
            for item in r["allergen_ingredients"]:
                self.assertIn(item["ingredient"], r["missing_ingredients"] + r["matched_ingredients"])
                self.assertTrue(item["basis"])
            for swap in r["substitutions"]:
                self.assertIn(swap["for_ingredient"], r["missing_ingredients"])
                self.assertTrue(swap["source_url"].startswith("https://"))

    def test_frittata_flags_egg_milk_and_wheat(self):
        frittata = next(r for r in recommend("eggs, spinach, garlic, pasta", top_n=5)
                        if r["title"] == "Spaghetti Frittata")
        self.assertEqual(set(frittata["allergens"]), {"milk", "egg", "wheat/gluten"})

    def test_website_response_keeps_allergen_and_swap_fields(self):
        result = get_recommendations(RecommendationRequest(
            ingredients="eggs, spinach, garlic, pasta", top_n=1))[0]
        validated = api.Recommendation.model_validate(result).model_dump()
        self.assertIn("allergens", validated)
        self.assertIn("substitutions", validated)


if __name__ == "__main__":
    unittest.main()
