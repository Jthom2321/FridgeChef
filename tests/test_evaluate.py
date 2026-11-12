import unittest

from evaluate import coverage_rank, evaluate_lists, is_basic, score_recipe


class EvaluateTests(unittest.TestCase):
    def test_basics_are_excluded_from_extra_ingredient_count(self):
        recipe = {
            "ingredient_list": [
                "black pepper", "butter", "chicken", "kosher salt",
                "olive oil", "water",
            ]
        }

        result = score_recipe({"chicken"}, recipe)

        self.assertEqual(result["extras"], [])
        self.assertTrue(result["good"])
        self.assertTrue(is_basic("freshly ground black pepper"))

    def test_four_missing_nonbasic_ingredients_is_not_good(self):
        recipe = {"ingredient_list": ["carrot", "celery", "onion", "potato"]}

        result = score_recipe(set(), recipe)

        self.assertEqual(len(result["extras"]), 4)
        self.assertFalse(result["good"])

    def test_coverage_ranking_uses_fraction_of_recipe_ingredients(self):
        recipes = [
            {"title": "More matches, larger recipe", "ingredient_list": ["egg", "milk", "salt", "sugar"]},
            {"title": "Fewer matches, smaller recipe", "ingredient_list": ["egg", "milk"]},
        ]

        _, ranked = coverage_rank("egg, milk, salt", recipes, 2)

        self.assertEqual(ranked[0][1]["title"], "Fewer matches, smaller recipe")
        self.assertAlmostEqual(ranked[0][0], 1.0)

    def test_empty_list_is_counted_without_stopping_evaluation(self):
        rows, summaries = evaluate_lists(
            [{"list_id": "empty", "group": "edge_case", "ingredients": ""}],
            [{"title": "Simple recipe", "ingredient_list": ["egg"]}],
        )

        self.assertEqual(rows, [])
        self.assertEqual(summaries["jaccard"]["empty_lists"], 1)
        self.assertEqual(summaries["tfidf"]["empty_lists"], 1)
        self.assertEqual(summaries["coverage"]["empty_lists"], 1)
        self.assertEqual(summaries["coverage"]["precision_at_5"], 0)


if __name__ == "__main__":
    unittest.main()
