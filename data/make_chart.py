"""Chart recipes_v2.csv by category and by cuisine (one image for the slides).
Run from the repo root:  python data/make_chart.py
"""
import csv
from collections import Counter
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
rows = list(csv.DictReader(open(ROOT / "recipes_v2.csv", encoding="utf-8")))
cat = Counter(r["category"] for r in rows).most_common()
cui = Counter(r["cuisine"] for r in rows).most_common()

fig, (a, b) = plt.subplots(1, 2, figsize=(13, 6.5), gridspec_kw={"width_ratios": [1, 1.4]})
for ax, data, color, title in ((a, cat, "#c2410c", "By category"), (b, cui, "#15803d", "By cuisine")):
    labels, vals = zip(*reversed(data))
    bars = ax.barh(labels, vals, color=color)
    ax.bar_label(bars, padding=3, fontsize=10)
    ax.set_title(title, fontsize=14, loc="left", fontweight="bold")
    ax.spines[["top", "right"]].set_visible(False)
    ax.set_xlabel("Number of recipes")
    ax.set_xlim(0, max(vals) * 1.15)
fig.suptitle(f"FridgeChef final dataset: {len(rows)} Food Network recipes", fontsize=16, fontweight="bold", x=0.01, ha="left")
fig.tight_layout()
out = ROOT / "data" / "recipes_by_category_and_cuisine.png"
fig.savefig(out, dpi=200)
print(out)
