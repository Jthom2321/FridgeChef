# FridgeChef — Updated Checkpoint 1 Artifact

## What it does
- Loads recipe records from `recipes.csv`.
- Accepts a comma-separated pantry ingredient list.
- Ranks recipes with the Jaccard ingredient-overlap baseline and TF-IDF cosine similarity.
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