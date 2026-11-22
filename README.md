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

## Hidden-list evaluation
- The 10 hidden inputs are kept in `evaluation/hidden_lists.csv`. The lists cover ordinary pantry combinations, unsupported cuisines, and edge cases.
- **Good-result rule:** A recipe is good only when it matches at least two of the user's ingredients and has no more than three missing non-basic ingredients.
- `evaluate.py` calls `recommend()` from `recommend.py`, so it evaluates the same rankings the app returns. It currently evaluates Jaccard, TF-IDF, and coverage; random and weighted coverage are not yet exposed by the shared recommender.
- The per-recommendation worksheet records the matching pantry count, missing non-basic ingredients, and rule-based good/not-good mark. It preserves Seth's existing marks if results still match, but does not create independent judgments.

Run the evaluation:

    python evaluate.py --lists evaluation/hidden_lists.csv --output evaluation/hidden_results.csv --summary evaluation/hidden_summary.csv

The summary CSV breaks good picks out by list group as well as overall. Current results, the slide chart, and an approximately 1:20 video script are in `evaluation/hidden_report.md`, `evaluation/hidden_chart.svg`, and `evaluation/hidden_video_script.md`. The available-method results are provisional until ranking is final; random and weighted coverage and Seth's independent review are still pending.
