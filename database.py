"""SQLite storage for FridgeChef recipes.

Tables:
    recipes              one row per recipe
    ingredients          one row per normalized ingredient
    recipe_ingredients   many-to-many recipe/ingredient relationships

The existing normalization function in fridgechef.py is deliberately reused so
Mikayla's normalization changes can be shared by the CLI and recommend API.
"""

from __future__ import annotations

import csv
from contextlib import closing
import os
import sqlite3
import tempfile
from pathlib import Path

from fridgechef import normalize, split_ingredients

ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "recipes.db"


def preferred_csv() -> Path:
    """Prefer the expanded team dataset when it becomes available."""
    v2 = ROOT / "recipes_v2.csv"
    return v2 if v2.is_file() else ROOT / "recipes.csv"


def connect(db_path: str | Path = DEFAULT_DB) -> sqlite3.Connection:
    """Open a connection with referential integrity enabled."""
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def _key(header: str) -> str:
    return "_".join(header.strip().lower().replace("-", " ").split())


def _read_csv(csv_path: Path):
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        headers = next(reader, None)
        if not headers:
            raise ValueError("The recipe CSV is empty.")
        positions = {_key(name): i for i, name in enumerate(headers)}
        required = {"title", "url", "category", "ingredients"}
        if not required.issubset(positions):
            raise ValueError("The CSV must contain title, url, category, ingredients columns.")

        for row in reader:
            if not row or not any(cell.strip() for cell in row):
                continue
            def field(name: str) -> str:
                idx = positions.get(name)
                return row[idx].strip().strip('"') if idx is not None and idx < len(row) else ""

            title = field("title")
            url = field("url")
            category = field("category")
            # Support legacy unquoted comma-separated ingredients if this is the
            # final column; newer multi-column exports must quote comma fields.
            i = positions["ingredients"]
            if i == len(headers) - 1 and len(row) > len(headers):
                raw = ",".join(row[i:])
            else:
                raw = field("ingredients")
            if not (title and url and category):
                continue
            ingredients = {}
            for item in split_ingredients(raw):
                normalized = normalize(item)
                if normalized:
                    ingredients.setdefault(normalized, item.strip())
            if not ingredients:
                continue
            yield {
                "title": title,
                "url": url,
                "category": category,
                "cuisine": field("cuisine"),
                "main_protein": field("main_protein") or field("protein"),
                "ingredients": ingredients,
            }


def create_database(csv_path: str | Path | None = None,
                    db_path: str | Path = DEFAULT_DB) -> int:
    """Atomically replace the SQLite database from a team recipe CSV.

    Returns the number of unique, complete recipes imported. Re-import to pick
    up recipes_v2.csv when Enioluwa provides it.
    """
    source = Path(csv_path) if csv_path else preferred_csv()
    if not source.is_file():
        raise FileNotFoundError(f"Recipe CSV not found: {source}")
    dest = Path(db_path).expanduser().resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Deduplicate by (title, URL), keeping the row with the most ingredients.
    records = {}
    for record in _read_csv(source):
        key = (record["title"].casefold(), record["url"].casefold())
        if key not in records or len(record["ingredients"]) > len(records[key]["ingredients"]):
            records[key] = record
    if not records:
        raise ValueError("No complete recipes were found in the CSV.")

    fd, temporary_name = tempfile.mkstemp(prefix=".fridgechef_", suffix=".db", dir=dest.parent)
    os.close(fd)
    try:
        with closing(connect(temporary_name)) as con, con:
            con.executescript("""
                CREATE TABLE recipes (
                    id INTEGER PRIMARY KEY,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    category TEXT NOT NULL,
                    cuisine TEXT,
                    main_protein TEXT,
                    UNIQUE(title, url)
                );
                CREATE TABLE ingredients (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE
                );
                CREATE TABLE recipe_ingredients (
                    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
                    original_text TEXT NOT NULL,
                    PRIMARY KEY(recipe_id, ingredient_id)
                );
                CREATE INDEX idx_recipes_category ON recipes(category);
                CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
            """)
            ingredient_ids = {}
            for record in records.values():
                cursor = con.execute("""INSERT INTO recipes
                    (title, url, category, cuisine, main_protein)
                    VALUES (?, ?, ?, ?, ?)""", (
                    record["title"], record["url"], record["category"],
                    record["cuisine"], record["main_protein"],
                ))
                recipe_id = cursor.lastrowid
                for ingredient, original in record["ingredients"].items():
                    if ingredient not in ingredient_ids:
                        con.execute("INSERT OR IGNORE INTO ingredients(name) VALUES(?)", (ingredient,))
                        ingredient_ids[ingredient] = con.execute(
                            "SELECT id FROM ingredients WHERE name=?", (ingredient,)
                        ).fetchone()[0]
                    con.execute("""INSERT INTO recipe_ingredients
                        (recipe_id, ingredient_id, original_text) VALUES (?, ?, ?)""",
                        (recipe_id, ingredient_ids[ingredient], original))
            count = con.execute("SELECT COUNT(*) FROM recipes").fetchone()[0]
        os.replace(temporary_name, dest)
        return count
    finally:
        if os.path.exists(temporary_name):
            os.remove(temporary_name)


def database_is_stale(db_path: str | Path = DEFAULT_DB,
                      csv_path: str | Path | None = None) -> bool:
    """True when the DB is missing or older than its CSV or the matching code."""
    db = Path(db_path)
    if not db.is_file():
        return True
    sources = [Path(csv_path) if csv_path else preferred_csv(), ROOT / "fridgechef.py"]
    db_time = db.stat().st_mtime
    return any(s.is_file() and s.stat().st_mtime > db_time for s in sources)


def load_db_recipes(db_path: str | Path = DEFAULT_DB) -> list[dict]:
    """Return recipes in the legacy ranker's expected format, plus metadata."""
    if not Path(db_path).exists():
        raise FileNotFoundError(f"Database not found: {db_path}. Run python build_db.py.")
    with closing(connect(db_path)) as con:
        rows = con.execute("""
            SELECT r.id, r.title, r.url, r.category, r.cuisine, r.main_protein,
                   i.name AS ingredient
            FROM recipes AS r
            JOIN recipe_ingredients AS ri ON ri.recipe_id = r.id
            JOIN ingredients AS i ON i.id = ri.ingredient_id
            ORDER BY r.id, i.name
        """).fetchall()
    recipes = {}
    for row in rows:
        rid = row["id"]
        if rid not in recipes:
            recipes[rid] = {
                "id": rid,
                "title": row["title"],
                "url": row["url"],
                "category": row["category"],
                "cuisine": row["cuisine"] or "",
                "main_protein": row["main_protein"] or "",
                "ingredient_list": [],
            }
        recipes[rid]["ingredient_list"].append(row["ingredient"])
    return list(recipes.values())
