import unittest
from pathlib import Path
import tempfile
from unittest.mock import patch

from evaluate import METHODS, evaluate_lists, is_basic, score_recipe
from recommend import recommend as app_recommend


class EvaluateTests(unittest.TestCase):
    def test_basics_are_excluded_from_extra_ingredient_count(self):
        recipe = {
            "ingredient_list": [
                "black pepper", "butter", "chicken", "kosher salt",
                "olive oil", "water",
            ]
        }

        result = score_recipe({"chicken", "butter"}, recipe)

        self.assertEqual(result["extras"], [])
        self.assertTrue(result["good"])
        self.assertTrue(is_basic("freshly ground black pepper"))

    def test_recipe_with_zero_pantry_matches_is_not_good(self):
        result = score_recipe(
            {"spinach"},
            {"ingredient_list": ["lima bean"]},
        )

        self.assertEqual(result["matched_count"], 0)
        self.assertFalse(result["good"])

    def test_two_matches_and_at_most_three_nonbasic_missing_is_good(self):
        result = score_recipe(
            {"egg", "spinach"},
            {
                "matched_ingredients": ["egg", "spinach"],
                "missing_ingredients": ["salt", "onion", "tomato"],
            },
        )

        self.assertEqual(result["matched_count"], 2)
        self.assertEqual(result["extras"], ["onion", "tomato"])
        self.assertTrue(result["good"])

    def test_four_missing_nonbasic_ingredients_is_not_good(self):
        recipe = {
            "matched_ingredients": ["egg", "spinach"],
            "missing_ingredients": ["carrot", "celery", "onion", "potato"],
        }

        result = score_recipe({"egg", "spinach"}, recipe)

        self.assertEqual(len(result["extras"]), 4)
        self.assertFalse(result["good"])

    def test_evaluation_uses_the_shared_recommendation_api(self):
        recommendation = {
            "title": "Egg and spinach",
            "score": 0.75,
            "matched_ingredients": ["egg", "spinach"],
            "missing_ingredients": [],
            "ingredient_coverage": 1.0,
        }
        lists = [{
            "list_id": "normal-1",
            "group": "normal",
            "ingredients": "egg, spinach",
        }]
        db_path = Path("recipes.sqlite")

        with patch("evaluate.recommend", return_value=[recommendation]) as app_recommend:
            rows, summaries = evaluate_lists(lists, db_path, "recipes.csv")

        self.assertEqual(app_recommend.call_count, len(METHODS))
        for method in METHODS:
            app_recommend.assert_any_call(
                "egg, spinach",
                method=method,
                top_n=5,
                db_path=db_path,
                data_path="recipes.csv",
            )
            self.assertEqual(summaries[method]["groups"]["normal"]["good"], 1)
        self.assertEqual(len(rows), len(METHODS))
        self.assertTrue(all(row["good_by_rule"] for row in rows))

    def test_recommend_uses_the_requested_recipe_csv(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "recipes.csv"
            db_path = Path(directory) / "recipes.sqlite"
            data_path.write_text(
                "title,url,category,ingredients\n"
                "Custom Egg Spinach,http://example.test/recipe,dinner,egg; spinach\n",
                encoding="utf-8",
            )

            results = app_recommend(
                "egg, spinach",
                top_n=5,
                db_path=db_path,
                data_path=data_path,
            )

        self.assertEqual([result["title"] for result in results], ["Custom Egg Spinach"])

    def test_empty_list_is_counted_without_stopping_evaluation(self):
        rows, summaries = evaluate_lists(
            [{"list_id": "empty", "group": "edge_case", "ingredients": ""}],
            Path("recipes.sqlite"),
        )

        self.assertEqual(rows, [])
        for method in METHODS:
            self.assertEqual(summaries[method]["empty_lists"], 1)
            self.assertEqual(summaries[method]["precision_at_5"], 0)


if __name__ == "__main__":
    unittest.main()
