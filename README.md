# FridgeChef — Checkpoint 2 Artifact

## Checkpoint 2 quick start

    python -m pip install -r requirements.txt
    python build_db.py                      # load recipes_v2.csv (120 recipes) into recipes.db
    python fridgechef.py --ingredients "eggs, spinach, garlic, pasta"
    python compare_practice.py              # before/after on the 10 practice lists
    python -m unittest test_matching tests.test_evaluate

All scripts default to `recipes_v2.csv` and fall back to `recipes.csv` if it is missing. The website should call `recommend()` from `recommend.py`; it rebuilds `recipes.db` automatically when the CSV or `fridgechef.py` is newer than the database. `have_basics=True` treats salt, pepper, oil, water, and butter as already owned.


## What it does
- Loads recipe records from `recipes_v2.csv` (or `recipes.csv`).
- Accepts a comma-separated pantry ingredient list.
- Ranks recipes with the Jaccard ingredient-overlap baseline, TF-IDF cosine similarity, and the coverage method.
- Displays matched ingredients, missing ingredients, scores, and source URLs.
- **Automatically overwrites `sample_output.txt` every time the program runs.** By default, both methods are run and saved.

## Dataset
The provided team CSV was cleaned into 50 unique, complete recipe records. Some ingredient fields used commas instead of semicolons, so they were standardized to semicolon-separated lists. The loader also supports a comma-separated ingredient field when no semicolons are present.

Keep these headers unchanged: `title`, `url`, `category`, `ingredients`. Prefer semicolons between ingredients, and quote CSV fields automatically when exporting from Google Sheets.

## Run
Install dependencies:

    python -m pip install -r requirements.txt

Run both methods and refresh `sample_output.txt`:

    python fridgechef.py --ingredients "eggs, spinach, garlic, pasta"

Run just the Jaccard baseline:

    python fridgechef.py --ingredients "eggs, spinach, garlic, pasta" --method jaccard

Run just TF-IDF:

    python fridgechef.py --ingredients "eggs, spinach, garlic, pasta" --method tfidf

Use a different CSV:

    python fridgechef.py --data "path/to/recipes.csv" --ingredients "eggs, spinach, garlic, pasta"

Choose the number of recommendations:

    python fridgechef.py --top 10

## Important limitations
- Jaccard and TF-IDF scores are ranking signals, not validated measures of recipe quality or usefulness.
- Ingredient normalization is a starter implementation and may miss synonyms or interpret ingredient phrases imperfectly.
- This prototype does not evaluate allergies, nutrition, or food safety.
- This dataset is not evenly distributed among categories of recipies.

## Noire's Checkpoint 2 evaluation
- `evaluation/practice_lists.csv` contains 10 practice inputs. The 10 hidden inputs are kept in a local-only `evaluation/hidden_lists.csv`; do not share that file with the ranking implementer.
- The lists cover ordinary pantry combinations, Korean/Japanese pantry ingredients absent from the current recipes, and edge cases including a single ingredient, a 30-plus-item list, misspellings, empty input, and random text.
- A result is good when no more than 3 non-basic recipe ingredients are missing. Salt, pepper, oil, water, and butter do not count as extra ingredients.
- `evaluate.py` evaluates the top 5 from Jaccard, TF-IDF, and the app's coverage method in `fridgechef.py`. Good-pick judgments use the app's ingredient matcher (so "onion" counts for "yellow onion") and its basics list (salt, pepper, oil, water, butter and their plain variants; not bell pepper, peanut butter, or sesame oil). It writes a per-result CSV with rubric decisions and a blank column for Seth's independent decisions.

Run the evaluation and save its review worksheet:

    python evaluate.py --lists evaluation/hidden_lists.csv --output evaluation/hidden_results.csv --summary evaluation/hidden_summary.csv

The summary reports good picks out of the 50 possible top-five slots, the fraction of all slots that are good, and the number of lists with at least 3 good picks. An empty list produces zero recommendations and counts as 0 of its five slots. Ingredient coverage is the fraction matched by the explicitly entered list; the assumed basics are excluded from the missing-ingredient good-pick rule, not added to the ranking inputs. The comparison table is also saved to the requested summary CSV. Seth's independent review and sharing the hidden file with him must be completed separately.

### Initial hidden-set results (2026-11-12)

These are rule-based results from the 10 hidden lists, with 5 recommendation slots per list:

| Method | Good picks / 50 | Precision@5 | Lists with 3+ good / 10 | Mean ingredient coverage@5 |
|---|---:|---:|---:|---:|
| Jaccard | 3/50 | 0.060 | 0/10 | 0.139 |
| TF-IDF | 2/50 | 0.040 | 0/10 | 0.093 |
| Coverage (evaluation-only) | 5/50 | 0.100 | 1/10 | 0.150 |

**Out of date:** these numbers came from the 50-recipe `recipes.csv`, an evaluation-only coverage comparator, and an older good-pick rule. Rerun the command above on the hidden lists before quoting results. Seth's independent judgments have not been recorded, so these results are preliminary and not peer-reviewed.
