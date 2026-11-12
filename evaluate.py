import argparse
import csv
import re
from pathlib import Path

from fridgechef import load_recipes, normalize, rank_recipes


METHODS = ("jaccard", "tfidf", "coverage")
MAX_EXTRA_INGREDIENTS = 3
TOP_N = 5
BASIC_PATTERN = re.compile(r"\b(salt|pepper|oil|water|butter)\b")


def pantry_ingredients(text):
    return {
        normalize(item.strip())
        for item in text.split(",")
        if item.strip() and normalize(item.strip())
    }


def is_basic(ingredient):
    return bool(BASIC_PATTERN.search(ingredient))


def read_lists(path):
    with open(path, newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        required = {"list_id", "group", "ingredients"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("List CSV must contain list_id, group, and ingredients columns.")
        lists = []
        seen_ids = set()
        for row in reader:
            list_id = (row["list_id"] or "").strip()
            if not list_id:
                raise ValueError("Every ingredient list must have a list_id.")
            if list_id in seen_ids:
                raise ValueError(f"Duplicate list_id: {list_id}")
            seen_ids.add(list_id)
            lists.append({
                "list_id": list_id,
                "group": (row["group"] or "").strip(),
                "ingredients": row["ingredients"] or "",
            })
    if not lists:
        raise ValueError("The list CSV contains no ingredient lists.")
    return lists


def coverage_rank(pantry_text, recipes, limit):
    pantry = pantry_ingredients(pantry_text)
    if not pantry:
        raise ValueError("Enter at least one ingredient, separated by commas.")

    ranked = []
    for recipe in recipes:
        ingredients = set(recipe["ingredient_list"])
        matched = sorted(ingredients & pantry)
        score = len(matched) / len(ingredients) if ingredients else 0.0
        ranked.append((
            score,
            recipe,
            sorted(ingredients - pantry),
            matched,
        ))
    ranked.sort(key=lambda item: (-item[0], item[1]["title"].casefold()))
    return pantry, ranked[:limit]


def score_recipe(pantry, recipe):
    ingredients = set(recipe["ingredient_list"])
    matched = ingredients & pantry
    extras = sorted(
        ingredient
        for ingredient in ingredients - pantry
        if not is_basic(ingredient)
    )
    coverage = len(matched) / len(ingredients) if ingredients else 0.0
    return {
        "matched": sorted(matched),
        "extras": extras,
        "coverage": coverage,
        "good": len(extras) <= MAX_EXTRA_INGREDIENTS,
    }


def evaluate_lists(lists, recipes):
    result_rows = []
    summaries = {
        method: {
            "good": 0,
            "returned": 0,
            "successful_lists": 0,
            "coverage_total": 0.0,
            "empty_lists": 0,
        }
        for method in METHODS
    }

    for item in lists:
        pantry = pantry_ingredients(item["ingredients"])
        for method in METHODS:
            summary = summaries[method]
            if not pantry:
                summary["empty_lists"] += 1
                continue

            if method == "coverage":
                _, ranked = coverage_rank(item["ingredients"], recipes, TOP_N)
            else:
                _, ranked = rank_recipes(item["ingredients"], recipes, method, TOP_N)

            list_good = 0
            for position, (score, recipe, _missing, _matched) in enumerate(ranked, 1):
                assessment = score_recipe(pantry, recipe)
                list_good += assessment["good"]
                summary["returned"] += 1
                summary["good"] += assessment["good"]
                summary["coverage_total"] += assessment["coverage"]
                result_rows.append({
                    "list_id": item["list_id"],
                    "group": item["group"],
                    "method": method,
                    "rank": position,
                    "title": recipe["title"],
                    "score": f"{score:.6f}",
                    "matched_ingredients": "; ".join(assessment["matched"]),
                    "extra_nonbasic_ingredients": "; ".join(assessment["extras"]),
                    "extra_count": len(assessment["extras"]),
                    "good_by_rule": assessment["good"],
                    "seth_good": "",
                    "reviewer_notes": "",
                })
            summary["successful_lists"] += list_good >= 3

    for summary in summaries.values():
        summary["precision_at_5"] = summary["good"] / (len(lists) * TOP_N)
        summary["mean_coverage_at_5"] = (
            summary["coverage_total"] / summary["returned"]
            if summary["returned"] else 0.0
        )
    return result_rows, summaries


def write_results(path, rows):
    fieldnames = [
        "list_id", "group", "method", "rank", "title", "score",
        "matched_ingredients", "extra_nonbasic_ingredients", "extra_count",
        "good_by_rule", "seth_good", "reviewer_notes",
    ]
    output = Path(path).expanduser()
    if not output.is_absolute():
        output = Path(__file__).resolve().parent / output
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return output.resolve()


def write_summary(path, summaries, list_count):
    output = Path(path).expanduser()
    if not output.is_absolute():
        output = Path(__file__).resolve().parent / output
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=[
            "method", "good_picks", "possible_top5_slots", "precision_at_5",
            "lists_with_3_or_more_good", "list_count", "mean_ingredient_coverage_at_5",
            "empty_inputs",
        ])
        writer.writeheader()
        for method in METHODS:
            summary = summaries[method]
            writer.writerow({
                "method": method,
                "good_picks": summary["good"],
                "possible_top5_slots": list_count * TOP_N,
                "precision_at_5": f"{summary['precision_at_5']:.3f}",
                "lists_with_3_or_more_good": summary["successful_lists"],
                "list_count": list_count,
                "mean_ingredient_coverage_at_5": f"{summary['mean_coverage_at_5']:.3f}",
                "empty_inputs": summary["empty_lists"],
            })
    return output.resolve()


def print_summary(summaries, list_count):
    print("| Method | Good picks / 50 | Precision@5 | Lists with 3+ good / 10 | Mean ingredient coverage@5 |")
    print("|---|---:|---:|---:|---:|")
    for method in METHODS:
        summary = summaries[method]
        print(
            f"| {method} | {summary['good']}/{list_count * TOP_N} "
            f"| {summary['precision_at_5']:.3f} "
            f"| {summary['successful_lists']}/{list_count} "
            f"| {summary['mean_coverage_at_5']:.3f} |"
        )
    empty_count = summaries[METHODS[0]]["empty_lists"]
    if empty_count:
        print(
            f"\n{empty_count} empty list(s) returned no recommendations for each method "
            "and count as zero good picks."
        )


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate the top-five recipe recommendations for ingredient lists."
    )
    parser.add_argument("--lists", required=True, help="CSV with list_id, group, ingredients.")
    parser.add_argument("--data", default=str(Path(__file__).resolve().parent / "recipes.csv"))
    parser.add_argument("--output", required=True, help="Path for per-recommendation review CSV.")
    parser.add_argument("--summary", help="Optional path for the comparison table as CSV.")
    args = parser.parse_args()

    recipes = load_recipes(args.data)
    lists = read_lists(args.lists)
    rows, summaries = evaluate_lists(lists, recipes)
    output_path = write_results(args.output, rows)
    summary_path = (
        write_summary(args.summary, summaries, len(lists))
        if args.summary else None
    )
    print_summary(summaries, len(lists))
    print(f"\nReview worksheet: {output_path}")
    if summary_path:
        print(f"Comparison table: {summary_path}")
    print(
        f"Good-pick rule: no more than {MAX_EXTRA_INGREDIENTS} recipe ingredients "
        "missing from the list, excluding salt, pepper, oil, water, and butter."
    )
    print("Coverage is matched list ingredients / total recipe ingredients; implicit basics do not count as matches.")
    print("The coverage ranking is an evaluation-only comparator, not an app implementation.")
    print("Seth's independent judgments are blank in the worksheet and still need to be completed.")


if __name__ == "__main__":
    main()
