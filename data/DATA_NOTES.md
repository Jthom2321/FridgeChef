# FridgeChef data — Checkpoint 3 (Enioluwa)

## recipes_v2.csv is FROZEN
Final version: 120 recipes, columns `title, url, category, cuisine, main_protein, allergens, ingredients`.
SHA-256 (first 16 chars): `acacf1d433a3321f` — run `shasum -a 256 recipes_v2.csv` to check nobody changed it.
Please don't edit this file after this commit; the hidden-test numbers depend on it.

## 20-recipe re-check against Food Network (Nov 22, 2026)
Picked with `random.seed(365); random.sample(range(120), 20)`, then compared each ingredient list to its Food Network page.

| # | Recipe | Result |
|---|---|---|
| 1 | Instant Pot Magic Apple Cake | matches |
| 3 | White Bean-Pomegranate Crostini | matches |
| 12 | Roasted Root Vegetables | matches |
| 19 | Triple Grilled Cheese With Tomato Soup | matches |
| 22 | Chicken Tetrazzini | matches |
| 24 | Beef Bourguignon | matches |
| 25 | White Bean and Chicken Chili | matches |
| 36 | Apple Meringue Cupcakes | matches |
| 49 | Sausage Gravy | matches |
| 56 | Basic Waffle | matches |
| 65 | Chicken Tostadas | **fixed: added cilantro** (in the chicken mixture on the page) |
| 70 | Lentil Soup | matches |
| 73 | Kung Pao Chicken | **fixed: added water** (in the sauce on the page) |
| 77 | The Best Red Chicken Enchiladas | matches |
| 84 | Mussels in White Wine | matches |
| 86 | Southern Cornbread | matches |
| 90 | Elote | matches |
| 97 | Potato Salad | matches |
| 111 | Banana Pudding | matches |
| 118 | Southern Red Velvet Cake | matches |

18/20 matched exactly; 2 had one missing ingredient each, both fixed.

## allergens column
- Tracks 8 allergens: milk, egg, wheat/gluten, peanut, tree nut, soy, fish, shellfish.
- `allergen_map.csv` maps every ingredient that contains one of them, with the reason. I went through all 470 distinct ingredients by hand; `data/add_allergens.py` applies the map.
- Rules I used: Worcestershire = fish (anchovies). Mayonnaise = egg. Beer = wheat/gluten (barley). Peanut oil is listed as peanut to be safe. Shellfish includes mollusks (mussels, clams, oyster sauce). Coconut is **not** counted as a tree nut (the FDA took it off the list in 2025). Sesame is not tracked.
- Packaged items (cake mix, crescent dough, vanilla wafers, gravy mix, etc.) change by brand. The map marks these "check label".
- `none` means no tracked allergen was found in the ingredient list. It is **not** a guarantee. The app should say "may contain — check the recipe."
- Counts: milk 84, wheat/gluten 72, egg 55, soy 14, shellfish 11, fish 9, tree nut 7, peanut 6, none 10.

## substitutions.csv
- 55 swaps covering 50 of our ingredients. Each row has a `source_url`. The sources are Food Network's Ingredient Substitution Guide, Food Network's baking substitutions list, Food Network's "20 substitutions" list, and UNL Extension's substitution chart. No swaps were made up.
- `applies_to` lists the exact ingredient names from recipes_v2.csv that each swap covers. Every name was checked to exist in the dataset.
- `use_when` gives the limits, e.g. aquafaba can't replace eggs in a frittata.
- `substitute_contains` lists the allergens the swap brings in, so the app never suggests one allergen to replace another.
- Any ingredient not in the file → the app should show "no verified swap".

## Chart
`data/recipes_by_category_and_cuisine.png` (made by `data/make_chart.py`).

## Known limits
- Only Food Network, and only 120 recipes.
- Skews toward American, Southern and Mexican food (81 of 120).
- Only 1 Korean recipe (Wanjajeon) plus 1 Korean-inspired dish, and almost no Japanese, Thai or African food.
- No quantities, so the app can't know whether you have *enough* of an ingredient.
