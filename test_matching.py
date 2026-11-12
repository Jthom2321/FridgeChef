"""Isolated implementation checks; not pantry-list evaluation or tuning."""
import unittest
from fridgechef import normalize, ingredients_match, rank_recipes


class MatchingChecks(unittest.TestCase):
    def test_descriptors_and_leaf_bug(self):
        self.assertEqual(normalize('fresh baby spinach leaves'), 'spinach')
        self.assertEqual(normalize('fresh parsley leaves'), 'parsley')
        self.assertEqual(normalize('leaves'), 'leaf')
        self.assertEqual(normalize('large eggs'), 'egg')
        self.assertEqual(normalize('kosher salt'), 'salt')
        self.assertEqual(normalize('freshly ground black pepper'), 'black pepper')

    def test_aliases(self):
        for a, b in [('chopped scallions', 'green onions'),
                     ('garbanzo beans', 'chickpeas'), ('parm', 'parmesan cheese'),
                     ('cilantro', 'coriander leaves')]:
            self.assertEqual(normalize(a), normalize(b))

    def test_close_match_boundaries(self):
        self.assertTrue(ingredients_match('spinach', 'fresh baby spinach leaves'))
        self.assertTrue(ingredients_match('onion', 'yellow onion'))
        for a, b in [('chicken', 'chicken stock'), ('milk', 'coconut milk'),
                     ('pepper', 'bell pepper'), ('rice', 'rice vinegar'),
                     ('butter', 'peanut butter')]:
            self.assertFalse(ingredients_match(a, b))

    def test_coverage_arithmetic_and_basics_switch(self):
        # Synthetic requirements check the formula, not dataset recommendations.
        recipe = {'title': 'Formula fixture', 'ingredient_list': ['egg', 'spinach', 'salt', 'butter']}
        _, results = rank_recipes('egg', [recipe], 'coverage', 1)
        self.assertEqual(results[0][0], 0.5)
        self.assertEqual(results[0][2], ['spinach'])
        _, results = rank_recipes('egg', [recipe], 'coverage', 1, assume_basics=False)
        self.assertEqual(results[0][0], 0.25)
        self.assertEqual(results[0][2], ['butter', 'salt', 'spinach'])

    def test_validation(self):
        for text in ['', ' , ', '!!!']:
            with self.assertRaises(ValueError):
                rank_recipes(text, [], 'coverage', 1)
        with self.assertRaises(ValueError):
            rank_recipes('egg', [], 'typo', 1)


if __name__ == '__main__':
    unittest.main()
