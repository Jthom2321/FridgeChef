# FridgeChef

FridgeChef is a local web app with an Expo frontend and a Python API. Run both
parts while using the app.
# FridgeChef — Checkpoint 2 Artifact

## Checkpoint 2 quick start

    python -m pip install -r requirements.txt
    python build_db.py                      # load recipes_v2.csv (120 recipes) into recipes.db
    python fridgechef.py --ingredients "eggs, spinach, garlic, pasta"
    python compare_practice.py              # before/after on the 10 practice lists
    python -m unittest test_matching tests.test_evaluate tests.test_api tests.test_parity

All scripts default to `recipes_v2.csv` and fall back to `recipes.csv` if it is missing. The command line, the website (`api.py`) and `evaluate.py` all call `recommend()` from `recommend.py`, and all take their defaults from it (`DEFAULT_METHOD = "jaccard"`, `DEFAULT_HAVE_BASICS = True`). `recommend()` rebuilds `recipes.db` automatically when the recipe CSV, `allergen_map.csv`, `substitutions.csv`, `fridgechef.py` or `database.py` is newer than the database. `have_basics=True` treats salt, pepper, oil, water, and butter as already owned; pass `--no-basics` on the command line to turn it off.

Methods: `jaccard` (baseline), `tfidf`, `coverage`, `weighted` (weighted coverage), and `random` (seeded chance baseline; its score is always 0.0). Every result also includes `allergens` (the recipe's hand-checked allergen list), `allergen_ingredients` (which ingredient triggers each allergen), and `substitutions` (sourced swaps for the missing ingredients), all loaded into `recipes.db` by `build_db.py`. `tests/test_parity.py` checks that the website, command line, and evaluation return the identical top 5 for the same ingredients.


## What it does
- Loads recipe records from `recipes_v2.csv` (or `recipes.csv`).
- Accepts a comma-separated pantry ingredient list.
- Ranks recipes with the Jaccard ingredient-overlap baseline, TF-IDF cosine similarity, and the coverage method.
- Displays matched ingredients, missing ingredients, scores, and source URLs.
- **Automatically overwrites `sample_output.txt` every time the program runs.** By default, both methods are run and saved.

## Run the app on Windows

You need **Python 3.10+**, **Node.js LTS** (which includes npm), and access to
this repository.

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

Keep `recipes.csv`, `allergen_map.csv`, and `substitutions.csv` in the project
folder.

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

Open the local address printed in the terminal (usually
`http://localhost:8081`). Leave both terminals running while you use FridgeChef.

If the app cannot reach the API, check that the backend terminal is still
running. The API documentation is at `http://localhost:8000/docs`.

On macOS or Linux, use `.venv/bin/python` instead of
`.venv\Scripts\python.exe` in the backend commands.

## Data and limitations

The app loads recipes from the API. Allergen matches are potential warnings,
not a determination that a recipe is safe for someone with an allergy; check
the original recipe and product labels. Substitution ideas include their
sources and use notes, but may not work for every recipe. Cooking directions
and expiration estimates are not included in the app data.

## API reference

- `GET /methods` lists recommendation methods.
- `POST /recommend` returns recipe recommendations.
- `GET /recipes/{recipe_id}` returns recipe details.
- `POST /recipes/{recipe_id}/availability` checks ingredients against the fridge.
- `POST /ingredients/check` checks ingredient spelling/catalog entries.
- `GET /allergens` lists available allergen categories.
- `GET /recipes/{recipe_id}/allergens` returns potential allergen matches.
- `GET /swaps` lists sourced substitutions; add `?ingredient=eggs` to search.

The API uses the same recommendation function as the command-line tool. Expo
web's default API address is `http://localhost:8000`. For a physical phone,
configure `EXPO_PUBLIC_API_URL` with your computer's LAN address and connect
both devices to the same network.

## Important limitations

- Recommendation scores are ranking signals, not validated measures of recipe quality.
- Ingredient normalization may miss synonyms or interpret phrases imperfectly.
- Allergen matches and substitutions are informational and are not food-safety advice.
- The recipe dataset is not evenly distributed across categories.

## Hidden-list evaluation
- The 10 hidden inputs are kept in `evaluation/hidden_lists.csv`. The lists cover ordinary pantry combinations, unsupported cuisines, and edge cases.
- **Good-result rule:** A recipe is good only when it matches at least two of the user's ingredients and has no more than three missing non-basic ingredients.
- `evaluate.py` calls `recommend()` from `recommend.py` with the app's `have_basics=True` default, so it evaluates the same rankings the app returns. It evaluates all five methods: random, Jaccard, TF-IDF, coverage, and weighted coverage.
- The per-recommendation worksheet records the matching pantry count, missing non-basic ingredients, and rule-based good/not-good mark. It preserves Seth's existing marks if results still match, but does not create independent judgments.

Run the evaluation:

    python evaluate.py --lists evaluation/hidden_lists.csv --output evaluation/hidden_results.csv --summary evaluation/hidden_summary.csv

The summary CSV breaks good picks out by list group as well as overall. Current results, the slide chart, and an approximately 1:20 video script are in `evaluation/hidden_report.md`, `evaluation/hidden_chart.svg`, and `evaluation/hidden_video_script.md`. The available-method results are provisional until ranking is final; random and weighted coverage and Seth's independent review are still pending.
