import argparse
import csv
import random
import re
from datetime import datetime
from functools import lru_cache
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

# --- Weighted coverage -----------------------------------------------------
# Missing a main ingredient should cost more than missing a garnish. Weights are
# assigned from the ingredient's head word (its last word): "chicken stock" is
# a stock, not a chicken. Everything not listed gets the default weight of 1.
MAIN_WEIGHT, STAPLE_WEIGHT, DEFAULT_WEIGHT, MINOR_WEIGHT = 3.0, 2.0, 1.0, 0.5
MAIN_WORDS = set("""chicken beef pork turkey lamb veal duck sausage bacon ham steak
    salmon shrimp fish tuna cod tilapia halibut crab lobster scallop clam mussel
    tofu breast thigh brisket ribs""".split())
STAPLE_WORDS = set("""pasta spaghetti penne rotini noodle rice potato flour bread breadcrumb
    tortilla egg cheese mozzarella cheddar parmesan milk cream bean chickpea lentil
    tomato""".split())
MINOR_WORDS = set("""parsley basil thyme oregano dill chive mint rosemary sage coriander
    cumin paprika cinnamon nutmeg vanilla zest flake cayenne bay clove sprinkle
    garnish""".split())
NON_MAIN_HEADS = set("stock broth sauce juice zest powder extract vinegar oil paste seasoning dressing".split())


def ingredient_weight(ingredient):
    words = normalize(ingredient).split()
    if not words:
        return DEFAULT_WEIGHT
    head = words[-1]
    if head in MINOR_WORDS:
        return MINOR_WEIGHT
    if head in MAIN_WORDS:
        return MAIN_WEIGHT
    if head in STAPLE_WORDS:
        return STAPLE_WEIGHT
    if head not in NON_MAIN_HEADS and any(w in MAIN_WORDS for w in words):
        return MAIN_WEIGHT  # e.g. "salmon piece"
    return DEFAULT_WEIGHT


# --- Short-recipe guard ----------------------------------------------------
# A recipe with only 1-2 required ingredients (e.g. Baby Lima Beans) can reach
# 100% overlap trivially. Scores are scaled by min(1, required / MIN_RECIPE_SIZE)
# so such recipes cannot outrank fuller matches on size alone.
MIN_RECIPE_SIZE = 4

METHODS = ["jaccard", "tfidf", "coverage", "weighted", "random"]


@lru_cache(maxsize=8192)
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


def rank_recipes(pantry_text, recipes, method, limit, assume_basics=True, seed=0):
    """Return (normalized pantry, [(score, recipe, missing, matched), ...]).

    coverage  = matched nonbasic requirements / all nonbasic requirements
    weighted  = same, but each ingredient counts by ingredient_weight()
    random    = seeded random picks (chance baseline); score is None
    Overlap methods drop recipes that use none of the pantry (no score-0
    results) and scale scores down for recipes with fewer than
    MIN_RECIPE_SIZE required ingredients.
    """
    if method not in set(METHODS):
        raise ValueError("Method must be one of: " + ", ".join(METHODS) + ".")
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
        if method == "random":
            ranked.append((None, recipe, sorted(missing), sorted(matched)))
            continue
        if not matched_required:
            continue  # uses nothing the person has: never a recommendation
        size_factor = min(1.0, len(required) / MIN_RECIPE_SIZE)
        if method == "coverage":
            score = len(matched_required) / len(required) * size_factor
        elif method == "weighted":
            total = sum(ingredient_weight(i) for i in required)
            have = sum(ingredient_weight(i) for i in matched_required)
            score = have / total * size_factor
        elif method == "jaccard":
            # Align close matches to recipe terms before calculating the union.
            effective = {p for p in pantry_set if not (assume_basics and is_basic(p))}
            aligned = set()
            for p in effective:
                matches = {i for i in required if ingredients_match(p, i)}
                aligned.update(matches or {p})
            union = aligned | required
            score = len(matched_required) / len(union) * size_factor if union else 0.0
        else:
            score = float(tfidf_scores[index]) * size_factor
        if score <= 0:
            continue
        ranked.append((score, recipe, sorted(missing), sorted(matched)))
    if method == "random":
        random.Random(seed).shuffle(ranked)
        return pantry, ranked[:limit]
    ranked.sort(key=lambda item: (-item[0], item[1]["title"].casefold()))
    return pantry, ranked[:limit]


def render_method(pantry_text, recipes, method, limit, assume_basics=True, seed=0):
    pantry, results = rank_recipes(pantry_text, recipes, method, limit, assume_basics, seed)
    lines = [
        f"METHOD: {method.upper()}",
        f"Recipe records loaded: {len(recipes)}",
        "Pantry: " + ", ".join(pantry),
        "Assume pantry basics: " + ("yes" if assume_basics else "no"),
        "-" * 78,
    ]
    if not results:
        lines.append("No recipes use any of these ingredients.")
    for number, (score, recipe, missing, matched) in enumerate(results, 1):
        shown = "random pick" if score is None else f"{score:.3f}"
        lines.append(f"{number}. {recipe['title']} | score={shown} | category={recipe['category']}")
        lines.append("   Matched (pantry or assumed basics): " + (", ".join(matched) if matched else "none"))
        lines.append("   Missing from pantry: " + (", ".join(missing) if missing else "none"))
        lines.append("   Source: " + recipe["url"])
    lines.append("")
    return "\n".join(lines)


def default_data_path():
    """Use the expanded team dataset when present, else the Checkpoint 1 pilot."""
    here = Path(__file__).resolve().parent
    v2 = here / "recipes_v2.csv"
    return v2 if v2.is_file() else here / "recipes.csv"


def render_recommendations(results, method, pantry_text, record_count, have_basics):
    """Format recommend() output for the terminal and sample_output.txt."""
    lines = [
        f"METHOD: {method.upper()}",
        f"Recipe records loaded: {record_count}",
        "Pantry: " + pantry_text,
        "Assume pantry basics: " + ("yes" if have_basics else "no"),
        "-" * 78,
    ]
    if not results:
        lines.append("No recipes use any of these ingredients.")
    for number, r in enumerate(results, 1):
        shown = "random pick" if method == "random" else f"{r['score']:.3f}"
        lines.append(f"{number}. {r['title']} | score={shown} | category={r['category']}")
        lines.append("   Matched (pantry or assumed basics): " + (", ".join(r["matched_ingredients"]) or "none"))
        lines.append("   Missing from pantry: " + (", ".join(r["missing_ingredients"]) or "none"))
        lines.append("   May contain (check the recipe): " + (", ".join(r["allergens"]) or "none tracked"))
        lines.append("   Source: " + r["url"])
    lines.append("")
    return "\n".join(lines)


def main():
    # Imported here because recommend.py imports this module.
    import tempfile
    from database import create_database, preferred_csv
    from recommend import DEFAULT_HAVE_BASICS, METHODS as APP_METHODS, recommend

    script_dir = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(
        description="FridgeChef recipe matcher (same recommend() function the website and evaluation use)."
    )
    parser.add_argument(
        "--ingredients",
        default="eggs, spinach, garlic, pasta",
        help="Comma-separated ingredients available to the user.",
    )
    parser.add_argument(
        "--method",
        choices=["all", "both"] + list(APP_METHODS),
        default="all",
        help="Which method to run. Default: all five (Jaccard, TF-IDF, coverage, weighted coverage, random); both = Jaccard + TF-IDF.",
    )
    parser.add_argument(
        "--data",
        default=str(default_data_path()),
        help="Path to the recipe CSV. Defaults to recipes_v2.csv (falls back to recipes.csv).",
    )
    parser.add_argument("--top", type=int, default=5, help="Number of recommendations per method.")
    parser.add_argument(
        "--output",
        default=str(script_dir / "sample_output.txt"),
        help="File to overwrite with the latest results. Defaults to sample_output.txt beside this script.",
    )
    parser.add_argument("--seed", type=int, default=0, help="Seed for the random-picks baseline.")
    basics = parser.add_mutually_exclusive_group()
    basics.add_argument("--no-basics", dest="have_basics", action="store_false",
                        help="Require salt, pepper, oil, water, and butter to be explicitly supplied.")
    basics.add_argument("--basics", dest="have_basics", action="store_true",
                        help="Treat salt, pepper, oil, water, and butter as owned (default).")
    parser.set_defaults(have_basics=DEFAULT_HAVE_BASICS)
    args = parser.parse_args()

    if not 1 <= args.top <= 25:
        parser.error("--top must be between 1 and 25.")
    methods = list(APP_METHODS) if args.method == "all" else (
        ["jaccard", "tfidf"] if args.method == "both" else [args.method])

    data_path = Path(args.data).expanduser().resolve()
    with tempfile.TemporaryDirectory(prefix="fridgechef-cli-") as directory:
        # The default dataset uses the app's recipes.db; any other CSV gets its
        # own temporary database so the shared one is never overwritten.
        use_shared = data_path == preferred_csv().resolve()
        db_kwargs = {} if use_shared else {"db_path": Path(directory) / "recipes.sqlite",
                                           "data_path": data_path}
        try:
            if not use_shared:
                create_database(data_path, db_kwargs["db_path"])
            from database import DEFAULT_DB, load_db_recipes
            results = {m: recommend(args.ingredients, method=m, top_n=args.top,
                                    have_basics=args.have_basics, seed=args.seed, **db_kwargs)
                       for m in methods}
            record_count = len(load_db_recipes(db_kwargs.get("db_path", DEFAULT_DB)))
        except (ValueError, OSError) as exc:
            parser.error(str(exc))

    pantry_text = ", ".join(sorted({normalize(i) for i in args.ingredients.split(",") if normalize(i)}))
    sections = [
        "FRIDGECHEF — RECOMMENDATION RUN",
        f"Generated: {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}",
        f"Data file: {data_path}",
        f"Unique recipe records loaded: {record_count}",
        "",
    ]
    for method in methods:
        sections.append(render_recommendations(results[method], method, pantry_text,
                                               record_count, args.have_basics))
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