# FridgeChef

FridgeChef recommends recipes from the ingredients you already have. You type what's in your fridge, and it ranks 120 Food Network recipes by how well they match, shows what you have and what you're missing, flags possible allergens, suggests sourced ingredient swaps, and links to the original recipe.

It is a local web app: an Expo frontend (`mobile-app/`) talks to a Python API (`api.py`), and every result comes from one shared recommendation function.

Team 6IXSTARS · COMP 365 · North Carolina A&T State University

## Features

- **Five ranking methods** you can switch between: Jaccard (baseline), TF-IDF, coverage, weighted coverage, and a random baseline.
- **Recipe cards** with the match score, the ingredients you have, the ingredients you're missing, and a link to the Food Network page.
- **Allergen alerts** for the eight major allergens, checked by hand for all 120 recipes.
- **Ingredient swaps:** 55 substitutions, each linked to a published cooking source.
- **"I have the basics"** option that treats salt, pepper, oil, water and butter as already owned.
- **Clear messages** for empty, oversized or unrecognized input instead of crashes.

## Project layout

| Path | What it is |
|---|---|
| `mobile-app/` | Expo (React Native) frontend |
| `api.py` | FastAPI service the app calls |
| `recommend.py` | `recommend()`, the one function the app, command line and evaluation all use |
| `fridgechef.py` | Ingredient cleanup, matching, the five ranking methods, and the command-line tool |
| `database.py`, `build_db.py` | Build the SQLite database (`recipes.db`) from the data files |
| `recipes_v2.csv` | The 120-recipe dataset, including the allergens column |
| `allergen_map.csv`, `substitutions.csv` | Allergen rules and sourced swaps |
| `data/` | Data notes, allergen script and the category/cuisine chart |
| `evaluate.py`, `evaluation/` | Evaluation script, practice lists, and hidden-set report and chart |
| `compare_practice.py`, `fridgechef_before.py` | Before/after comparison against the Checkpoint 1 code |
| `docs/` | Team task plans |
| `tests/` | Automated tests |

## Run the app on Windows

You need **Python 3.10+**, **Node.js LTS** (which includes npm), and access to this repository.

### 1. Download the project

If you do not already have the project on your computer, open PowerShell and run:

```powershell
git clone https://github.com/Jthom2321/FridgeChef.git
cd FridgeChef
```

If you already have the project, open its folder in PowerShell instead.

### 2. Install dependencies (first time only)

Run these commands from the project folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd mobile-app
npm ci
cd ..
```

Keep `recipes_v2.csv`, `allergen_map.csv`, and `substitutions.csv` in the project folder.

### 3. Start the backend

Open a terminal in the project folder and run:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Leave this terminal running.

### 4. Start the frontend

Open a second terminal in the project folder and run:

```powershell
cd mobile-app
npm run web
```

Open the local address printed in the terminal (usually `http://localhost:8081`). Leave both terminals running while you use FridgeChef.

If the app cannot reach the API, check that the backend terminal is still running. The API documentation is at `http://localhost:8000/docs`.

On macOS or Linux, use `.venv/bin/python` instead of `.venv\Scripts\python.exe` in the backend commands.

## Command line and tests

```powershell
python build_db.py                                        # build recipes.db from the data files
python fridgechef.py --ingredients "eggs, spinach, garlic, pasta"
python fridgechef.py --ingredients "eggs, spinach" --method coverage --top 10
python compare_practice.py                                # before/after on the 10 practice lists
python -m unittest tests.test_matching tests.test_evaluate tests.test_api tests.test_parity
```

`fridgechef.py` writes its latest run to `sample_output.txt`. Add `--no-basics` to stop treating the basics as owned.

## How recommendations work

1. Your ingredients are cleaned up: lowercased, size and preparation words such as "fresh" and "chopped" removed, plurals made singular, and nicknames mapped together (scallions = green onion).
2. `recommend()` scores all 120 recipes in `recipes.db` with the method you chose and returns the top results, each with its allergens and swaps for the missing ingredients.
3. The app (through `api.py`), the command line and `evaluate.py` all call `recommend()` with the same defaults (`DEFAULT_METHOD = "jaccard"`, `DEFAULT_HAVE_BASICS = True`), so the results we test are the results users see. `tests/test_parity.py` checks that all three return the same top 5.

`recommend()` rebuilds `recipes.db` automatically when any of the data files, `fridgechef.py` or `database.py` is newer than the database.

| Method | How it scores a recipe | Trade-off |
|---|---|---|
| `jaccard` (baseline) | Shared ingredients ÷ all ingredients in the pantry or recipe | Simple, but a big pantry lowers every score |
| `tfidf` | Cosine similarity of ingredient words, with rare words weighted more | Rewards distinctive words, not makeable recipes |
| `coverage` | Share of the recipe's ingredients you already have | Answers "can I make this?" but favors short recipes |
| `weighted` | Coverage where main ingredients count more than garnishes | Missing chicken costs more than missing parsley |
| `random` | Seeded random order (score 0.0) | Shows what chance looks like |

## Data

The dataset is 120 recipes collected from Food Network. Each has a title, link, meal category (breakfast, lunch, dinner, side, appetizer, dessert), cuisine, main protein, allergens, and an ingredient list. We grew it from the original 50 recipes to balance the categories and cut down on repeated ingredients like pasta and spinach.

To clean it, we standardized ingredient names, removed drinks and one recipe whose page listed the wrong ingredients, and re-checked 20 randomly chosen recipes against their Food Network pages; two were each missing one ingredient, which we fixed. The file is frozen so test results stay valid. The allergen column covers the eight major allergens and was checked ingredient by ingredient, and every substitution links to a published cooking source. See `data/DATA_NOTES.md` for details.

## Evaluation

The team wrote 20 ingredient lists: 10 **practice lists** used while building the ranking (`evaluation/practice_lists.csv`) and 10 **hidden lists** used once for scoring. Both sets mix normal pantries, cuisines we have no recipes for, and weird inputs (one ingredient, 25+ ingredients, typos, empty or random text). The hidden lists are kept private and are not in this repository.

**Good-result rule:** a recipe is good only when it uses at least two of the user's ingredients and is missing no more than three non-basic ingredients. **Precision@5** is the share of the top 5 results that are good.

```powershell
python evaluate.py --lists evaluation/practice_lists.csv --output evaluation/practice_results.csv --summary evaluation/practice_summary.csv
```

Hidden-set results (good picks out of 50 top-5 slots):

| Method | Normal (15) | Unsupported cuisines (15) | Weird inputs (20) | Overall |
|---|---:|---:|---:|---:|
| Jaccard (baseline) | 1 | 0 | 1 | 2 (4%) |
| TF-IDF | 0 | 0 | 0 | 0 (0%) |
| Coverage | 1 | 0 | 4 | 5 (10%) |

All five methods on the practice lists (same rule, final code):

| Method | Normal (15) | Unsupported cuisines (15) | Weird inputs (20) | Overall |
|---|---:|---:|---:|---:|
| Jaccard (baseline) | 2 | 0 | 1 | 3 (6%) |
| TF-IDF | 1 | 0 | 0 | 1 (2%) |
| Coverage | 2 | 0 | 3 | 5 (10%) |
| Weighted coverage | 1 | 0 | 3 | 4 (8%) |
| Random | 0 | 0 | 1 | 1 (2%) |

Coverage is the strongest method. TF-IDF does no better than random, because matching words is not the same as having a recipe you can make. No method finds a good pick for cuisines we don't have recipes for, so the recipe catalog, not the ranking, is the main limit. The full hidden-set write-up and chart are in `evaluation/hidden_report.md` and `evaluation/hidden_chart.svg`.

## API reference

- `GET /methods` lists recommendation methods.
- `POST /recommend` returns recipe recommendations.
- `GET /recipes/{recipe_id}` returns recipe details.
- `POST /recipes/{recipe_id}/availability` checks ingredients against the fridge.
- `POST /ingredients/check` checks ingredient spelling/catalog entries.
- `GET /allergens` lists available allergen categories.
- `GET /recipes/{recipe_id}/allergens` returns potential allergen matches.
- `GET /swaps` lists sourced substitutions; add `?ingredient=eggs` to search.

Expo web's default API address is `http://localhost:8000`. For a physical phone, set `EXPO_PUBLIC_API_URL` to your computer's LAN address and connect both devices to the same network.

## Limitations

- **Small, single-source dataset:** 120 recipes from Food Network only. 81 of them are American, Southern or Mexican, with one Korean dish and almost no Japanese, Thai or African recipes, so those pantries get weak results.
- **No ingredient amounts:** FridgeChef can tell you have chicken, but not whether you have enough.
- **Low precision:** even the best method gets about 1 in 10 hidden top-5 picks right. Scores are ranking signals, not measures of recipe quality.
- **Rule-based relevance:** "good" is decided by a rule, not real user feedback.
- **Imperfect matching:** ingredient cleanup may miss some synonyms or misread some phrases.
- **Not safety advice:** allergen matches are possible warnings, not a guarantee that a recipe is safe; check the original recipe and product labels. Swaps may not work in every recipe. Cooking directions and expiration estimates are not included.

## AI use disclosure

The team used **Claude** (Anthropic) and **GitHub Copilot** during this project for planning, drafting documentation, code suggestions and debugging. Team members reviewed, tested and are responsible for all code and content in this repository.

## Team

| Member | Role |
|---|---|
| Joshua Thomas | Team lead: integration, bug fixes, documentation |
| Enioluwa Olabode | Data: recipe collection, cleaning, allergens and swaps |
| Mikayla Hollis | Ranking: ingredient matching and ranking methods |
| Noire Meyers | Testing: test lists and evaluation |
| Seth Williams | Backend: database and `recommend()` |
| Amarachi Abbah | App: Expo frontend and API |
