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
ALLERGEN_CSV = ROOT / "allergen_map.csv"
SUBSTITUTIONS_CSV = ROOT / "substitutions.csv"


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
                "allergens": field("allergens"),
                "ingredients": ingredients,
            }


def _read_allergen_map(path: Path):
    """Yield (normalized ingredient, allergen, basis) from Enioluwa's allergen map."""
    if not path.is_file():
        return
    with path.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            ingredient = normalize((row.get("ingredient") or "").strip())
            basis = (row.get("basis") or "").strip()
            for allergen in (row.get("allergens") or "").split(";"):
                allergen = allergen.strip().lower()
                if ingredient and allergen:
                    yield ingredient, allergen, basis


def _read_substitutions(path: Path):
    """Yield sourced swaps; each one lists the normalized ingredients it covers."""
    if not path.is_file():
        return
    with path.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            values = {k: (row.get(k) or "").strip() for k in (
                "ingredient", "applies_to", "substitute", "use_when",
                "substitute_contains", "source_name", "source_url")}
            if not (values["ingredient"] and values["substitute"]
                    and values["source_url"].startswith("https://")):
                continue  # never store an unsourced swap
            covers = {normalize(x) for x in values["applies_to"].split(";") if normalize(x)}
            covers.add(normalize(values["ingredient"]))
            yield values, sorted(c for c in covers if c)


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
                    allergens TEXT NOT NULL DEFAULT '',
                    UNIQUE(title, url)
                );
                CREATE TABLE ingredient_allergens (
                    ingredient TEXT NOT NULL,
                    allergen TEXT NOT NULL,
                    basis TEXT NOT NULL,
                    PRIMARY KEY(ingredient, allergen)
                );
                CREATE TABLE substitutions (
                    id INTEGER PRIMARY KEY,
                    ingredient TEXT NOT NULL,
                    applies_to TEXT NOT NULL,
                    substitute TEXT NOT NULL,
                    use_when TEXT NOT NULL,
                    substitute_contains TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    source_url TEXT NOT NULL
                );
                CREATE TABLE substitution_targets (
                    substitution_id INTEGER NOT NULL REFERENCES substitutions(id) ON DELETE CASCADE,
                    ingredient TEXT NOT NULL,
                    PRIMARY KEY(substitution_id, ingredient)
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
                    (title, url, category, cuisine, main_protein, allergens)
                    VALUES (?, ?, ?, ?, ?, ?)""", (
                    record["title"], record["url"], record["category"],
                    record["cuisine"], record["main_protein"], record["allergens"],
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
            for ingredient, allergen, basis in _read_allergen_map(ALLERGEN_CSV):
                con.execute("""INSERT INTO ingredient_allergens(ingredient, allergen, basis)
                    VALUES (?, ?, ?)
                    ON CONFLICT(ingredient, allergen) DO UPDATE SET
                    basis = CASE WHEN instr(basis, excluded.basis) THEN basis
                                 ELSE basis || '; ' || excluded.basis END""",
                    (ingredient, allergen, basis))
            for swap, covers in _read_substitutions(SUBSTITUTIONS_CSV):
                cursor = con.execute("""INSERT INTO substitutions
                    (ingredient, applies_to, substitute, use_when, substitute_contains,
                     source_name, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)""", (
                    swap["ingredient"], swap["applies_to"], swap["substitute"],
                    swap["use_when"], swap["substitute_contains"],
                    swap["source_name"], swap["source_url"]))
                con.executemany(
                    "INSERT OR IGNORE INTO substitution_targets VALUES (?, ?)",
                    [(cursor.lastrowid, c) for c in covers])
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
    sources = [Path(csv_path) if csv_path else preferred_csv(), ROOT / "fridgechef.py",
               ROOT / "database.py", ALLERGEN_CSV, SUBSTITUTIONS_CSV]
    db_time = db.stat().st_mtime
    return any(s.is_file() and s.stat().st_mtime > db_time for s in sources)


def load_db_recipes(db_path: str | Path = DEFAULT_DB) -> list[dict]:
    """Return recipes in the legacy ranker's expected format, plus metadata."""
    if not Path(db_path).exists():
        raise FileNotFoundError(f"Database not found: {db_path}. Run python build_db.py.")
    with closing(connect(db_path)) as con:
        rows = con.execute("""
            SELECT r.id, r.title, r.url, r.category, r.cuisine, r.main_protein,
                   r.allergens, i.name AS ingredient
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
                "allergens": [a.strip() for a in (row["allergens"] or "").split(";")
                              if a.strip() and a.strip().lower() != "none"],
                "ingredient_list": [],
            }
        recipes[rid]["ingredient_list"].append(row["ingredient"])
    return list(recipes.values())


def load_allergen_map(db_path: str | Path = DEFAULT_DB) -> dict[str, dict]:
    """{normalized ingredient: {"allergens": [...], "basis": str}} from the database."""
    with closing(connect(db_path)) as con:
        rows = con.execute("""SELECT ingredient, allergen, basis
            FROM ingredient_allergens ORDER BY ingredient, allergen""").fetchall()
    result: dict[str, dict] = {}
    for row in rows:
        entry = result.setdefault(row["ingredient"], {"allergens": [], "basis": set()})
        entry["allergens"].append(row["allergen"])
        entry["basis"].update(b.strip() for b in row["basis"].split(";") if b.strip())
    return {k: {"allergens": v["allergens"], "basis": "; ".join(sorted(v["basis"]))}
            for k, v in result.items()}


def load_substitutions(db_path: str | Path = DEFAULT_DB) -> dict[str, list[dict]]:
    """{normalized ingredient: [sourced swap, ...]} from the database."""
    with closing(connect(db_path)) as con:
        rows = con.execute("""SELECT t.ingredient AS target, s.*
            FROM substitution_targets AS t JOIN substitutions AS s ON s.id = t.substitution_id
            ORDER BY s.id""").fetchall()
    result: dict[str, list[dict]] = {}
    for row in rows:
        result.setdefault(row["target"], []).append({
            "ingredient": row["ingredient"],
            "applies_to": [x.strip() for x in row["applies_to"].split(";") if x.strip()],
            "substitute": row["substitute"],
            "use_when": row["use_when"],
            "substitute_contains": row["substitute_contains"],
            "source_name": row["source_name"],
            "source_url": row["source_url"],
        })
    return result
