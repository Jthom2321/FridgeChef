"""Before/after comparison on Noire's ten practice lists.
Input: evaluation/practice_lists.csv (list_id, group, ingredients) or a JSON
array of exactly 10 comma-separated ingredient strings.
No hidden lists should be supplied. Both versions use identical input and data.
"""
import argparse
import csv
import json
from pathlib import Path
import fridgechef as after
import fridgechef_before as before


def read_practice(path):
    path = Path(path)
    if path.suffix.lower() == '.csv':
        with path.open(newline='', encoding='utf-8-sig') as f:
            return [(row.get('ingredients') or '') for row in csv.DictReader(f)]
    return json.loads(path.read_text(encoding='utf-8'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--practice', default=str(Path(__file__).with_name('evaluation') / 'practice_lists.csv'),
                        help="Noire's 10 practice lists (CSV or JSON array)")
    parser.add_argument('--data', default=str(after.default_data_path()))
    parser.add_argument('--output', default='before_after_practice.txt')
    parser.add_argument('--top', type=int, default=5)
    args = parser.parse_args()
    try:
        lists = read_practice(args.practice)
        if not isinstance(lists, list) or len(lists) != 10 or not all(isinstance(x, str) for x in lists):
            raise ValueError('Supply exactly 10 practice-list strings from Noire; do not include hidden lists.')
        if args.top < 1:
            raise ValueError('--top must be at least 1.')
        old_recipes, new_recipes = before.load_recipes(args.data), after.load_recipes(args.data)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    lines = ['FRIDGECHEF: PRACTICE COMPARISON',
             'Identical raw inputs and CSV for both versions. Before: original code.',
             'After: improved matching, basics enabled. This is not hidden-set evaluation.',
             'For Jaccard/TF-IDF, an additional no-basics run isolates matching changes.', '']
    for number, pantry in enumerate(lists, 1):
        lines += [f'PRACTICE {number}: {pantry!r}']
        for label, module, recipes, methods, kwargs in [
            ('BEFORE', before, old_recipes, ['jaccard', 'tfidf'], {}),
            ('AFTER WITHOUT BASICS', after, new_recipes, ['jaccard', 'tfidf'], {'assume_basics': False}),
            ('AFTER WITH BASICS', after, new_recipes, ['jaccard', 'tfidf', 'coverage'], {})]:
            for method in methods:
                lines.append(f'{label}: {method}')
                try:
                    lines.append(module.render_method(pantry, recipes, method, args.top, **kwargs))
                except ValueError as exc:
                    lines.append(f'Input message: {exc}')
    Path(args.output).write_text('\n'.join(lines), encoding='utf-8')
    print(f'Saved comparison: {Path(args.output).resolve()}')


if __name__ == '__main__':
    main()
