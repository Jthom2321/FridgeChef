# FridgeChef

FridgeChef is a local web app with an Expo frontend and a Python API. Run both
parts while using the app.

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

## Noire's Checkpoint 2 evaluation
- `evaluation/practice_lists.csv` contains 10 practice inputs. The 10 hidden inputs are kept in a local-only `evaluation/hidden_lists.csv`; do not share that file with the ranking implementer.
- The lists cover ordinary pantry combinations, Korean/Japanese pantry ingredients absent from the current recipes, and edge cases including a single ingredient, a 30-plus-item list, misspellings, empty input, and random text.
- A result is good when no more than 3 non-basic recipe ingredients are missing. Salt, pepper, oil, water, and butter do not count as extra ingredients.
- `evaluate.py` evaluates the top 5 from Jaccard, TF-IDF, and an evaluation-only ingredient-coverage comparator (`matched ingredients / recipe ingredients`). It writes a per-result CSV with rubric decisions and a blank column for Seth's independent decisions.

Run the evaluation and save its review worksheet:

    python evaluate.py --lists evaluation/hidden_lists.csv --output evaluation/hidden_results.csv --summary evaluation/hidden_summary.csv

The summary reports good picks out of the 50 possible top-five slots, the fraction of all slots that are good, and the number of lists with at least 3 good picks. An empty list produces zero recommendations and counts as 0 of its five slots. Ingredient coverage is the fraction matched by the explicitly entered list; the assumed basics are excluded from the missing-ingredient good-pick rule, not added to the ranking inputs. The comparison table is also saved to the requested summary CSV. The coverage comparator is not wired into `fridgechef.py`; it does not stand in for Mikayla's implementation. Seth's independent review and sharing the hidden file with him must be completed separately.

### Initial hidden-set results (2026-11-12)

These are rule-based results from the 10 hidden lists, with 5 recommendation slots per list:

| Method | Good picks / 50 | Precision@5 | Lists with 3+ good / 10 | Mean ingredient coverage@5 |
|---|---:|---:|---:|---:|
| Jaccard | 3/50 | 0.060 | 0/10 | 0.139 |
| TF-IDF | 2/50 | 0.040 | 0/10 | 0.093 |
| Coverage (evaluation-only) | 5/50 | 0.100 | 1/10 | 0.150 |

The coverage row is an evaluator-only comparator, not an implementation in `fridgechef.py`. Seth's independent judgments have not been recorded, so these results are preliminary and not peer-reviewed.
