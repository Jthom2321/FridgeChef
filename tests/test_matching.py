"""Isolated implementation checks; not pantry-list evaluation or tuning."""
import unittest
from fridgechef import normalize, ingredients_match, rank_recipes, ingredient_weight


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
        recipe = {'title': 'Formula fixture',
                  'ingredient_list': ['egg', 'spinach', 'garlic', 'onion', 'salt', 'butter']}
        _, results = rank_recipes('egg', [recipe], 'coverage', 1)
        self.assertEqual(results[0][0], 0.25)          # 1 of 4 nonbasic
        self.assertEqual(results[0][2], ['garlic', 'onion', 'spinach'])
        _, results = rank_recipes('egg', [recipe], 'coverage', 1, assume_basics=False)
        self.assertAlmostEqual(results[0][0], 1 / 6)   # 1 of 6 when basics count
        self.assertEqual(results[0][2], ['butter', 'garlic', 'onion', 'salt', 'spinach'])

    def test_weights(self):
        self.assertEqual(ingredient_weight('chicken breast'), 3.0)
        self.assertEqual(ingredient_weight('chicken stock'), 1.0)
        self.assertEqual(ingredient_weight('fresh parsley'), 0.5)
        self.assertEqual(ingredient_weight('spaghetti'), 2.0)

    def test_weighted_missing_main_costs_more(self):
        a = {'title': 'A', 'ingredient_list': ['chicken', 'parsley', 'lemon', 'garlic']}
        # Same pantry size, but missing the chicken must score lower than missing parsley.
        _, r1 = rank_recipes('parsley, lemon, garlic', [a], 'weighted', 1)
        _, r2 = rank_recipes('chicken, lemon, garlic', [a], 'weighted', 1)
        self.assertLess(r1[0][0], r2[0][0])

    def test_no_zero_score_and_short_recipe_guard(self):
        short = {'title': 'Baby Lima Beans', 'ingredient_list': ['lima bean']}
        full = {'title': 'Full', 'ingredient_list': ['lima bean', 'onion', 'garlic', 'carrot']}
        other = {'title': 'Other', 'ingredient_list': ['rice', 'tofu', 'soy sauce', 'ginger']}
        for method in ['jaccard', 'tfidf', 'coverage', 'weighted']:
            _, res = rank_recipes('lima beans, onion', [short, full, other], method, 5)
            titles = [r[1]['title'] for r in res]
            self.assertNotIn('Other', titles)             # nothing matched -> excluded
            self.assertEqual(titles[0], 'Full')           # short recipe cannot win on size
            self.assertTrue(all(r[0] > 0 for r in res))

    def test_random_is_seeded_and_unfiltered(self):
        recs = [{'title': f'R{i}', 'ingredient_list': ['x%d' % i]} for i in range(20)]
        _, a = rank_recipes('egg', recs, 'random', 5, seed=1)
        _, b = rank_recipes('egg', recs, 'random', 5, seed=1)
        _, c = rank_recipes('egg', recs, 'random', 5, seed=2)
        self.assertEqual([r[1]['title'] for r in a], [r[1]['title'] for r in b])
        self.assertNotEqual([r[1]['title'] for r in a], [r[1]['title'] for r in c])

    def test_validation(self):
        for text in ['', ' , ', '!!!']:
            with self.assertRaises(ValueError):
                rank_recipes(text, [], 'coverage', 1)
        with self.assertRaises(ValueError):
            rank_recipes('egg', [], 'typo', 1)


if __name__ == '__main__':
    unittest.main()