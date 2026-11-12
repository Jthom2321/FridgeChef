"""Build or refresh the FridgeChef SQLite database from a CSV export."""

import argparse
from database import DEFAULT_DB, create_database, preferred_csv


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default=str(preferred_csv()),
                        help="Source CSV; defaults to recipes_v2.csv if present, else recipes.csv")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite output file")
    args = parser.parse_args()
    try:
        count = create_database(args.csv, args.db)
    except (ValueError, FileNotFoundError, OSError) as e:
        parser.exit(2, f"Could not build database: {e}\n")
    print(f"Imported {count} unique recipes into {args.db}")


if __name__ == "__main__":
    main()
