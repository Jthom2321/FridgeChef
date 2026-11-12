import argparse
import csv
import re
from datetime import datetime
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


ALIASES = {
    "scallions": "green onion",
    "green onions": "green onion",
    "spring onions": "green onion",
    "parm": "parmesan",
    "parmesan cheese": "parmesan",
    "chickpeas": "chickpea",
    "eggs": "egg",
    "tomatoes": "tomato",
    "carrots": "carrot",
    "onions": "onion",
    "garlic cloves": "garlic",
    "spinach leaves": "spinach",
    "pastas": "pasta",
}


def normalize(value):
    words = re.sub(r"[^a-z0-9 ]", " ", value.lower()).split()
    phrase = " ".join(words)
    phrase = ALIASES.get(phrase, phrase)
    normalized_words = []
    for word in phrase.split():
        if len(word) > 4 and word.endswith("oes"):
            word = word[:-2]
        elif len(word) > 4 and word.endswith("ies"):
            word = word[:-3] + "y"
        elif len(word) > 3 and word.endswith("s") and not word.endswith(("ss", "us", "is")):
            word = word[:-1]
        normalized_words.append(word)
    return " ".join(normalized_words)


def split_ingredients(raw):
    raw = raw.strip().strip('"').replace('"', "").strip()
    if not raw:
        return []
    # Most records use semicolons; support older comma-separated records too.
    pieces = raw.split(";") if ";" in raw else raw.split(",")
    return [piece.strip() for piece in pieces if piece.strip()]


def load_recipes(path):
    recipes = []
    with open(path, newline="", encoding="utf-8-sig") as file:
        reader = csv.reader(file)
        header = next(reader, None)
        if not header:
            raise ValueError("The recipe CSV is empty.")
        header = [column.strip().lower() for column in header]
        required = {"title", "url", "category", "ingredients"}
        if not required.issubset(set(header)):
            raise ValueError(
                "CSV must contain these columns: title, url, category, ingredients."
            )
        title_index = header.index("title")
        url_index = header.index("url")
        category_index = header.index("category")
        ingredients_index = header.index("ingredients")

        for row in reader:
            if len(row) <= ingredients_index:
                continue
            title = row[title_index].strip().strip('"') if len(row) > title_index else ""
            url = row[url_index].strip().strip('"') if len(row) > url_index else ""
            category = row[category_index].strip().strip('"') if len(row) > category_index else ""
            if not title or not url or not category:
                # Ignore incomplete/orphan rows that do not identify a recipe.
                continue

            # Rejoin extra columns caused by unquoted commas in an ingredient field.
            raw_ingredients = ",".join(row[ingredients_index:])
            original_ingredients = split_ingredients(raw_ingredients)
            ingredient_list = sorted(
                {normalize(item) for item in original_ingredients if normalize(item)}
            )
            if not ingredient_list:
                continue

            recipes.append({
                "title": title,
                "url": url,
                "category": category,
                "ingredient_list": ingredient_list,
            })

    # If a recipe appears more than once, keep the record with the fullest ingredient list.
    unique = {}
    for recipe in recipes:
        key = (recipe["title"].casefold(), recipe["url"].casefold())
        if key not in unique or len(recipe["ingredient_list"]) > len(unique[key]["ingredient_list"]):
            unique[key] = recipe

    result = list(unique.values())
    if not result:
        raise ValueError("No complete recipes were found in the CSV.")
    return result


def rank_recipes(pantry_text, recipes, method, limit):
    pantry = sorted({
        normalize(item.strip())
        for item in pantry_text.split(",")
        if item.strip() and normalize(item.strip())
    })
    if not pantry:
        raise ValueError("Enter at least one ingredient, separated by commas.")

    pantry_set = set(pantry)
    ranked = []

    if method == "jaccard":
        for recipe in recipes:
            ingredients = set(recipe["ingredient_list"])
            union = pantry_set | ingredients
            score = len(pantry_set & ingredients) / len(union) if union else 0.0
            ranked.append((
                score, recipe,
                sorted(ingredients - pantry_set),
                sorted(ingredients & pantry_set),
            ))
    elif method == "coverage":
        # Ingredient coverage is the fraction of each recipe already in the pantry.
        for recipe in recipes:
            ingredients = set(recipe["ingredient_list"])
            score = len(pantry_set & ingredients) / len(ingredients) if ingredients else 0.0
            ranked.append((
                score, recipe,
                sorted(ingredients - pantry_set),
                sorted(ingredients & pantry_set),
            ))
    elif method == "tfidf":
        documents = [" ".join(recipe["ingredient_list"]) for recipe in recipes]
        vectorizer = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b")
        matrix = vectorizer.fit_transform(documents + [" ".join(pantry)])
        scores = cosine_similarity(matrix[-1], matrix[:-1]).ravel()
        for score, recipe in zip(scores, recipes):
            ingredients = set(recipe["ingredient_list"])
            ranked.append((
                float(score), recipe,
                sorted(ingredients - pantry_set),
                sorted(ingredients & pantry_set),
            ))

    if method not in ("jaccard", "tfidf", "coverage"):
        raise ValueError(f"Unknown method: {method}")
    ranked.sort(key=lambda item: (-item[0], item[1]["title"].casefold()))
    return pantry, ranked[:limit]


def render_method(ingredients, method, limit, db_path, have_basics=False):
    """Render the same recommendations returned to the website and tests."""
    from recommend import recommend

    results = recommend(ingredients, method=method, top_n=limit,
                        have_basics=have_basics, db_path=db_path)
    lines = [f"METHOD: {method.upper()}", "-" * 78]
    if not results:
        lines.append("No matching recipes found. Try common ingredient names or add more ingredients.")
    for number, recipe in enumerate(results, 1):
        lines.append(f"{number}. {recipe['title']} | score={recipe['score']:.3f} | category={recipe['category']}")
        lines.append("   Matched: " + (", ".join(recipe["matched_ingredients"]) or "none"))
        lines.append("   Missing from pantry: " + (", ".join(recipe["missing_ingredients"]) or "none"))
        lines.append(f"   Ingredient coverage: {recipe['ingredient_coverage']:.0%}")
        lines.append("   Source: " + recipe["url"])
    lines.append("")
    return "\n".join(lines)


def main():
    from database import DEFAULT_DB, create_database, load_db_recipes, preferred_csv

    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="FridgeChef: database-backed recipe recommendations."
    )
    parser.add_argument("--ingredients", default="eggs, spinach, garlic, pasta",
                        help="Comma-separated ingredients available to the user")
    parser.add_argument("--method", choices=["both", "jaccard", "tfidf", "coverage"],
                        default="both", help="Which ranking method to use")
    parser.add_argument("--top", type=int, default=5,
                        help="Number of recommendations (1-25)")
    parser.add_argument("--db", default=str(DEFAULT_DB),
                        help="Path to the SQLite database")
    parser.add_argument("--data", default=None,
                        help="Import this CSV into the database before recommending")
    parser.add_argument("--rebuild", action="store_true",
                        help="Rebuild database using recipes_v2.csv if present, else recipes.csv")
    parser.add_argument("--basics", action="store_true",
                        help="Assume you have salt, pepper, oil, water, and butter")
    parser.add_argument("--output", default=str(script_dir / "sample_output.txt"),
                        help="Text file to save the latest command-line results")
    args = parser.parse_args()

    if not 1 <= args.top <= 25:
        parser.error("--top must be between 1 and 25")
    try:
        if args.rebuild or args.data:
            source = args.data or preferred_csv()
            count = create_database(source, args.db)
            print(f"Database refreshed with {count} recipes from {source}\n")
        elif not Path(args.db).is_file():
            create_database(db_path=args.db)

        count = len(load_db_recipes(args.db))
        methods = ["jaccard", "tfidf"] if args.method == "both" else [args.method]
        sections = [
            "FRIDGECHEF — RECOMMENDATION RUN",
            f"Generated: {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}",
            f"Database: {Path(args.db).resolve()}",
            f"Unique recipe records loaded: {count}",
            "Pantry: " + args.ingredients,
            f"Assume basics: {'yes' if args.basics else 'no'}",
            "",
        ]
        for method in methods:
            sections.append(render_method(args.ingredients, method, args.top,
                                          args.db, args.basics))
        sections.append("Scores are ingredient-ranking signals, not allergy, nutrition, or food-safety advice.")
        output_text = "\n".join(sections).rstrip() + "\n"
        output_path = Path(args.output).expanduser()
        if not output_path.is_absolute():
            output_path = script_dir / output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output_text, encoding="utf-8")
    except (ValueError, FileNotFoundError, OSError) as exc:
        parser.exit(2, f"FridgeChef: {exc}\n")

    print(output_text, end="")
    print(f"\nUpdated sample output: {output_path.resolve()}")


if __name__ == "__main__":
    main()
