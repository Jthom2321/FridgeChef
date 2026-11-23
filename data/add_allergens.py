"""Add the allergens column to recipes_v2.csv from data/allergen_map.csv.

Each ingredient in the map was checked by hand. Recipes get the union of their
ingredients' allergens. "none" means no tracked allergen was found in the
ingredient list; it is NOT a guarantee (packaged items vary by brand).
Run from the repo root:  python data/add_allergens.py
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORDER = ["milk", "egg", "wheat/gluten", "peanut", "tree nut", "soy", "fish", "shellfish"]

amap = {}
with open(ROOT / "data" / "allergen_map.csv", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        amap[row["ingredient"]] = [a.strip() for a in row["allergens"].split(";") if a.strip()]
assert all(a in ORDER for v in amap.values() for a in v), "unknown allergen label"

path = ROOT / "recipes_v2.csv"
with open(path, encoding="utf-8", newline="") as f:
    rows = list(csv.DictReader(f))

out_cols = ["title", "url", "category", "cuisine", "main_protein", "allergens", "ingredients"]
for r in rows:
    found = set()
    for ing in (i.strip() for i in r["ingredients"].split(";")):
        found.update(amap.get(ing, []))
    r["allergens"] = "; ".join(a for a in ORDER if a in found) or "none"

with open(path, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=out_cols, extrasaction="ignore", lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
print(f"wrote allergens for {len(rows)} recipes")
