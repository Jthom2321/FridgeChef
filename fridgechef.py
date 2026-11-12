import argparse
import csv
import re
from datetime import datetime
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# Conservative aliases: ingredient families are not interchangeable.
ALIASES = {
    "scallions": "green onion", "scallion": "green onion",
    "green onions": "green onion", "spring onions": "green onion",
    "spring onion": "green onion", "parm": "parmesan",
    "parmesan cheese": "parmesan", "garbanzo beans": "chickpea",
    "garbanzo bean": "chickpea", "chickpeas": "chickpea",
    "cilantro": "coriander leaf", "coriander leaves": "coriander leaf",
    "garlic cloves": "garlic", "cloves garlic": "garlic",
    "clove garlic": "garlic", "bell peppers": "bell pepper",
    "confectioners sugar": "powdered sugar", "icing sugar": "powdered sugar",
}
DESCRIPTORS = set("fresh freshly chopped minced large medium small kosher baby diced sliced grated peeled cracked ground rinsed washed trimmed thawed".split())
PLURALS = {
    "leaves": "leaf", "tomatoes": "tomato", "tomatos": "tomato",
    "potatoes": "potato", "eggs": "egg", "carrots": "carrot",
    "onions": "onion", "peppers": "pepper", "beans": "bean",
    "cloves": "clove", "breasts": "breast", "thighs": "thigh",
    "mushrooms": "mushroom", "berries": "berry", "apples": "apple",
    "lemons": "lemon", "limes": "lime", "seeds": "seed",
    "flakes": "flake", "breadcrumbs": "breadcrumb", "pastas": "pasta",
}
BASICS = {"salt", "pepper", "black pepper", "oil", "olive oil", "vegetable oil",
          "canola oil", "water", "butter", "unsalted butter", "salted butter"}
# Only these qualifiers may be omitted in a close match. Never match by
# substring: e.g. chicken must not satisfy chicken stock, or milk coconut milk.
CLOSE_QUALIFIERS = {"yellow", "white", "red", "italian", "flat", "leaf"}


def normalize(value):
    phrase = " ".join(re.sub(r"[^a-z0-9 ]", " ", value.lower()).split())
    # Drop only explicitly listed preparation/size descriptors.
    phrase = " ".join(w for w in phrase.split() if w not in DESCRIPTORS)
    for alias in sorted(ALIASES, key=len, reverse=True):
        phrase = re.sub(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", ALIASES[alias], phrase)
    words = [PLURALS.get(w, w) for w in phrase.split()]
    if words and words[-1] == "leaf" and any(w in words for w in ("spinach", "basil", "parsley", "mint")):
        words.pop()
    return " ".join(words)


def ingredients_match(available, required):
    a, b = set(normalize(available).split()), set(normalize(required).split())
    if not a or not b:
        return False
    if a == b:
        return True
    return (a < b and b - a <= CLOSE_QUALIFIERS) or (b < a and a - b <= CLOSE_QUALIFIERS)


def is_basic(ingredient):
    return normalize(ingredient) in BASICS


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
            raw_ingredients = (",".join(row[ingredients_index:])
                               if ingredients_index == len(header) - 1
                               else row[ingredients_index])
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


def rank_recipes(pantry_text, recipes, method, limit, assume_basics=True):
    """Return (normalized pantry, [(score, recipe, missing, matched), ...]).

    coverage = matched nonbasic requirements / all nonbasic requirements
    when basics are enabled; otherwise every requirement counts. TF-IDF and
    Jaccard use the same normalized ingredient representation and assumptions.
    """
    if method not in {"jaccard", "tfidf", "coverage"}:
        raise ValueError("Method must be jaccard, tfidf, or coverage.")
    if not isinstance(pantry_text, str):
        raise ValueError("Ingredients must be comma-separated text.")
    if limit < 1:
        raise ValueError("Number of results must be at least 1.")
    pantry = sorted({normalize(item) for item in pantry_text.split(",") if normalize(item)})
    if not pantry:
        raise ValueError("Enter at least one ingredient, separated by commas.")
    pantry_set = set(pantry)
    ranked = []
    tfidf_scores = None
    if method == "tfidf":
        documents = [" ".join(i for i in r["ingredient_list"]
                               if not (assume_basics and is_basic(i))) for r in recipes]
        query = " ".join(i for i in pantry if not (assume_basics and is_basic(i)))
        if any((documents + [query])):
            vectorizer = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b")
            matrix = vectorizer.fit_transform(documents + [query])
            tfidf_scores = cosine_similarity(matrix[-1], matrix[:-1]).ravel()
        else:
            tfidf_scores = [0.0] * len(recipes)
    for index, recipe in enumerate(recipes):
        ingredients = set(recipe["ingredient_list"])
        required = {i for i in ingredients if not (assume_basics and is_basic(i))}
        matched_required = {i for i in required if any(ingredients_match(p, i) for p in pantry)}
        assumed = ingredients - required
        matched = matched_required | assumed
        missing = required - matched_required
        if method == "coverage":
            score = len(matched_required) / len(required) if required else 1.0
        elif method == "jaccard":
            # Align close matches to recipe terms before calculating the union.
            effective = {p for p in pantry_set if not (assume_basics and is_basic(p))}
            aligned = set()
            for p in effective:
                matches = {i for i in required if ingredients_match(p, i)}
                aligned.update(matches or {p})
            union = aligned | required
            score = len(matched_required) / len(union) if union else 1.0
        else:
            score = float(tfidf_scores[index])
        ranked.append((score, recipe, sorted(missing), sorted(matched)))
    ranked.sort(key=lambda item: (-item[0], item[1]["title"].casefold()))
    return pantry, ranked[:limit]


def render_method(pantry_text, recipes, method, limit, assume_basics=True):
    pantry, results = rank_recipes(pantry_text, recipes, method, limit, assume_basics)
    lines = [
        f"METHOD: {method.upper()}",
        f"Recipe records loaded: {len(recipes)}",
        "Pantry: " + ", ".join(pantry),
        "Assume pantry basics: " + ("yes" if assume_basics else "no"),
        "-" * 78,
    ]
    for number, (score, recipe, missing, matched) in enumerate(results, 1):
        lines.append(f"{number}. {recipe['title']} | score={score:.3f} | category={recipe['category']}")
        lines.append("   Matched (pantry or assumed basics): " + (", ".join(matched) if matched else "none"))
        lines.append("   Missing from pantry: " + (", ".join(missing) if missing else "none"))
        lines.append("   Source: " + recipe["url"])
    lines.append("")
    return "\n".join(lines)


def main():
    from database import DEFAULT_DB, create_database, load_db_recipes, preferred_csv

    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="FridgeChef recipe matcher: Jaccard baseline and TF-IDF cosine similarity."
    )
    parser.add_argument(
        "--ingredients",
        default="eggs, spinach, garlic, pasta",
        help="Comma-separated ingredients available to the user.",
    )
    parser.add_argument(
        "--method",
        choices=["all", "both", "jaccard", "tfidf", "coverage"],
        default="all",
        help="Which recommendation method to run. Default: all three; both retains the two original methods.",
    )
    parser.add_argument(
        "--data",
        default=str(script_dir / "recipes.csv"),
        help="Path to the recipe CSV. Defaults to recipes.csv beside this script.",
    )
    parser.add_argument("--top", type=int, default=5, help="Number of recommendations per method.")
    parser.add_argument(
        "--output",
        default=str(script_dir / "sample_output.txt"),
        help="File to overwrite with the latest results. Defaults to sample_output.txt beside this script.",
    )
    parser.add_argument("--no-basics", action="store_true", help="Require salt, pepper, oil, water, and butter to be explicitly supplied.")
    args = parser.parse_args()

    if args.top < 1:
        parser.error("--top must be at least 1.")

    try:
        recipes = load_recipes(args.data)
        if not any(normalize(i) for i in args.ingredients.split(",")):
            raise ValueError("Enter at least one ingredient, separated by commas.")
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    methods = ["jaccard", "tfidf", "coverage"] if args.method == "all" else (["jaccard", "tfidf"] if args.method == "both" else [args.method])
    sections = [
        "FRIDGECHEF — RECOMMENDATION RUN",
        f"Generated: {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}",
        f"Data file: {Path(args.data).resolve()}",
        f"Unique recipe records loaded: {len(recipes)}",
        "",
    ]
    for method in methods:
        sections.append(render_method(args.ingredients, recipes, method, args.top, not args.no_basics))
        sections.append(
            "Interpretation note: scores measure ingredient-text similarity/overlap, "
            "not recipe quality, nutrition, allergies, or food safety."
        )
        sections.append("")
    output_text = "\n".join(sections).rstrip() + "\n"

    output_path = Path(args.output).expanduser()
    if not output_path.is_absolute():
        output_path = script_dir / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output_text, encoding="utf-8")

    print(output_text, end="")
    print(f"\nUpdated sample output: {output_path.resolve()}")


if __name__ == "__main__":
    main()
