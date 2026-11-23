import argparse
import csv
from pathlib import Path
import tempfile

from database import create_database
from fridgechef import default_data_path, ingredients_match, is_basic, normalize
from recommend import DEFAULT_HAVE_BASICS, METHODS, recommend


MAX_EXTRA_INGREDIENTS = 3
MIN_MATCHED_INGREDIENTS = 2
TOP_N = 5
GOOD_RESULT_RULE = (
    "A recipe is good only when it matches at least two of the user's ingredients "
    "and has no more than three missing non-basic ingredients."
)


def pantry_ingredients(text):
    return {
        normalize(item.strip())
        for item in text.replace(";", ",").replace("\n", ",").split(",")
        if item.strip() and normalize(item.strip())
    }


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


def _matched_pantry_count(pantry, matched_recipe_ingredients):
    """Count distinct pantry items matched, with each item used at most once."""
    pantry_items = sorted(pantry)
    requirements = sorted(matched_recipe_ingredients)
    requirement_to_pantry = {}

    def assign(pantry_item, seen):
        for index, requirement in enumerate(requirements):
            if index in seen or not ingredients_match(pantry_item, requirement):
                continue
            seen.add(index)
            if index not in requirement_to_pantry or assign(
                requirement_to_pantry[index], seen
            ):
                requirement_to_pantry[index] = pantry_item
                return True
        return False

    return sum(assign(item, set()) for item in pantry_items)


def score_recipe(pantry, recipe):
    matched = set(recipe.get("matched_ingredients", ()))
    if not matched and recipe.get("ingredient_list"):
        ingredients = set(recipe["ingredient_list"])
        matched = {
            ingredient for ingredient in ingredients
            if any(ingredients_match(item, ingredient) for item in pantry)
        }
    if "missing_ingredients" in recipe:
        missing = set(recipe["missing_ingredients"])
    else:
        missing = set(recipe.get("ingredient_list", ())) - matched
    extras = sorted(ingredient for ingredient in missing if not is_basic(ingredient))
    matched_count = _matched_pantry_count(pantry, matched)
    return {
        "matched": sorted(matched),
        "matched_count": matched_count,
        "extras": extras,
        "coverage": recipe.get("ingredient_coverage", 0.0),
        "good": (
            matched_count >= MIN_MATCHED_INGREDIENTS
            and len(extras) <= MAX_EXTRA_INGREDIENTS
        ),
    }


def evaluate_lists(lists, db_path, data_path=None):
    result_rows = []
    group_counts = {}
    for item in lists:
        group_counts[item["group"]] = group_counts.get(item["group"], 0) + 1

    summaries = {
        method: {
            "good": 0,
            "returned": 0,
            "successful_lists": 0,
            "coverage_total": 0.0,
            "empty_lists": 0,
            "groups": {
                group: {"good": 0, "returned": 0, "coverage_total": 0.0}
                for group in group_counts
            },
        }
        for method in METHODS
    }

    for item in lists:
        pantry = pantry_ingredients(item["ingredients"])
        for method in METHODS:
            summary = summaries[method]
            group_summary = summary["groups"][item["group"]]
            if not pantry:
                summary["empty_lists"] += 1
                continue

            recommendations = recommend(
                item["ingredients"],
                method=method,
                top_n=TOP_N,
                have_basics=DEFAULT_HAVE_BASICS,
                db_path=db_path,
                data_path=data_path,
            )

            list_good = 0
            for position, result in enumerate(recommendations, 1):
                assessment = score_recipe(pantry, result)
                list_good += assessment["good"]
                summary["returned"] += 1
                summary["good"] += assessment["good"]
                summary["coverage_total"] += assessment["coverage"]
                group_summary["returned"] += 1
                group_summary["good"] += assessment["good"]
                group_summary["coverage_total"] += assessment["coverage"]
                result_rows.append({
                    "list_id": item["list_id"],
                    "group": item["group"],
                    "method": method,
                    "rank": position,
                    "title": result["title"],
                    "score": f"{result['score']:.6f}",
                    "matched_ingredients": "; ".join(assessment["matched"]),
                    "matched_pantry_count": assessment["matched_count"],
                    "extra_nonbasic_ingredients": "; ".join(assessment["extras"]),
                    "extra_count": len(assessment["extras"]),
                    "good_by_rule": assessment["good"],
                    "seth_good": "",
                    "reviewer_notes": "",
                })
            summary["successful_lists"] += list_good >= 3

    list_count = len(lists)
    for method, summary in summaries.items():
        summary["list_count"] = list_count
        summary["precision_at_5"] = summary["good"] / (list_count * TOP_N)
        summary["mean_coverage_at_5"] = (
            summary["coverage_total"] / summary["returned"]
            if summary["returned"] else 0.0
        )
        for group, group_summary in summary["groups"].items():
            group_summary["list_count"] = group_counts[group]
            group_summary["slots"] = group_counts[group] * TOP_N
            group_summary["precision_at_5"] = (
                group_summary["good"] / group_summary["slots"]
            )
    return result_rows, summaries


def write_results(path, rows):
    fieldnames = [
        "list_id", "group", "method", "rank", "title", "score",
        "matched_ingredients", "matched_pantry_count",
        "extra_nonbasic_ingredients", "extra_count",
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
    groups = list(next(iter(summaries.values()))["groups"])
    fieldnames = ["method"]
    for group in groups:
        fieldnames.extend([
            f"{group}_good", f"{group}_slots", f"{group}_precision_at_5",
        ])
    fieldnames.extend([
        "overall_good", "overall_slots", "overall_precision_at_5",
        "lists_with_3_or_more_good", "mean_ingredient_coverage_at_5",
        "empty_inputs",
    ])
    output = Path(path).expanduser()
    if not output.is_absolute():
        output = Path(__file__).resolve().parent / output
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for method in METHODS:
            summary = summaries[method]
            row = {"method": method}
            for group in groups:
                group_summary = summary["groups"][group]
                row.update({
                    f"{group}_good": group_summary["good"],
                    f"{group}_slots": group_summary["slots"],
                    f"{group}_precision_at_5": f"{group_summary['precision_at_5']:.3f}",
                })
            row.update({
                "overall_good": summary["good"],
                "overall_slots": list_count * TOP_N,
                "overall_precision_at_5": f"{summary['precision_at_5']:.3f}",
                "lists_with_3_or_more_good": summary["successful_lists"],
                "mean_ingredient_coverage_at_5": f"{summary['mean_coverage_at_5']:.3f}",
                "empty_inputs": summary["empty_lists"],
            })
            writer.writerow(row)
    return output.resolve()


def print_summary(summaries, list_count):
    groups = list(next(iter(summaries.values()))["groups"])
    header = "| Method | " + " | ".join(
        f"{group} good / slots" for group in groups
    ) + " | Overall good / slots | Precision@5 |"
    print(header)
    print("|" + "---|" * (len(groups) + 3))
    for method in METHODS:
        summary = summaries[method]
        group_values = " | ".join(
            f"{summary['groups'][group]['good']}/{summary['groups'][group]['slots']}"
            for group in groups
        )
        print(
            f"| {method} | {group_values} | {summary['good']}/{list_count * TOP_N} "
            f"| {summary['precision_at_5']:.3f} |"
        )
    empty_count = summaries[METHODS[0]]["empty_lists"]
    if empty_count:
        print(
            f"\n{empty_count} empty list(s) returned no recommendations and count "
            "as zero good picks."
        )


def _read_prior_reviews(path):
    review_path = Path(path).expanduser()
    if not review_path.is_file():
        return {}
    with review_path.open(newline="", encoding="utf-8-sig") as file:
        return {
            (row["list_id"], row["method"], row["rank"], row["title"]): (
                row.get("seth_good", ""), row.get("reviewer_notes", "")
            )
            for row in csv.DictReader(file)
        }


def _carry_reviews(rows, reviews):
    for row in rows:
        key = (row["list_id"], row["method"], str(row["rank"]), row["title"])
        if key in reviews:
            row["seth_good"], row["reviewer_notes"] = reviews[key]


def compare_reviews(rows):
    parse_mark = {
        "true": True, "yes": True, "1": True, "good": True,
        "false": False, "no": False, "0": False, "not good": False,
    }
    labeled = [
        (row, parse_mark.get(str(row["seth_good"]).strip().casefold()))
        for row in rows
    ]
    labeled = [(row, mark) for row, mark in labeled if mark is not None]
    return {
        "reviewed": len(labeled),
        "agreed": sum(mark == row["good_by_rule"] for row, mark in labeled),
        "disagreed": sum(mark != row["good_by_rule"] for row, mark in labeled),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate the top-five recipe recommendations for ingredient lists."
    )
    parser.add_argument("--lists", required=True, help="CSV with list_id, group, ingredients.")
    parser.add_argument("--data", default=str(default_data_path()),
                        help="Recipe CSV used to build the same database as recommend().")
    parser.add_argument("--output", required=True, help="Path for per-recommendation review CSV.")
    parser.add_argument("--summary", help="Optional path for the grouped comparison table as CSV.")
    args = parser.parse_args()

    lists = read_lists(args.lists)
    output_path = Path(args.output).expanduser()
    if not output_path.is_absolute():
        output_path = Path(__file__).resolve().parent / output_path
    prior_reviews = _read_prior_reviews(output_path)

    with tempfile.TemporaryDirectory(prefix="fridgechef-eval-") as directory:
        db_path = Path(directory) / "recipes.sqlite"
        create_database(args.data, db_path)
        rows, summaries = evaluate_lists(lists, db_path, args.data)

    _carry_reviews(rows, prior_reviews)
    review_comparison = compare_reviews(rows)
    output_path = write_results(output_path, rows)
    summary_path = (
        write_summary(args.summary, summaries, len(lists))
        if args.summary else None
    )
    print_summary(summaries, len(lists))
    print(f"\nReview worksheet: {output_path}")
    if summary_path:
        print(f"Grouped comparison table: {summary_path}")
    print(f"Good-result rule: {GOOD_RESULT_RULE}")
    if review_comparison["reviewed"]:
        print(
            f"Seth's marks: {review_comparison['agreed']} agreed, "
            f"{review_comparison['disagreed']} differed "
            f"out of {review_comparison['reviewed']} reviewed picks."
        )
    else:
        print("Seth's marks are not present; agreement and differences remain pending.")
    print(f"Methods evaluated: {', '.join(METHODS)} (have_basics={DEFAULT_HAVE_BASICS}).")


if __name__ == "__main__":
    main()
