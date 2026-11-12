"""Profile a CSV or Parquet file and print a JSON summary.

Usage: python profile.py <path> [--key col1,col2] [--sample-rows N]
Requires pandas. Parquet also requires pyarrow.
"""

import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path")
    parser.add_argument("--key", help="Comma-separated key columns")
    parser.add_argument("--sample-rows", type=int, default=10_000_000)
    args = parser.parse_args()

    try:
        import pandas as pd
    except ImportError:
        print(json.dumps({"error": "pandas is not installed"}))
        return 2

    if args.path.lower().endswith((".parquet", ".pq")):
        df = pd.read_parquet(args.path)
    else:
        df = pd.read_csv(args.path, low_memory=False)

    sampled = False
    if len(df) > args.sample_rows:
        df = df.sample(n=args.sample_rows, random_state=0)
        sampled = True

    report = {
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "sampled": sampled,
        "full_row_duplicates": int(df.duplicated().sum()),
        "columns_detail": {},
    }

    if args.key:
        key_cols = [c.strip() for c in args.key.split(",")]
        missing = [c for c in key_cols if c not in df.columns]
        if missing:
            report["key_error"] = f"key columns not found: {missing}"
        else:
            report["key"] = key_cols
            report["key_duplicates"] = int(df.duplicated(subset=key_cols).sum())

    for col in df.columns:
        s = df[col]
        detail = {
            "dtype": str(s.dtype),
            "null_rate": round(float(s.isna().mean()), 4),
            "distinct": int(s.nunique(dropna=True)),
        }
        if pd.api.types.is_numeric_dtype(s) and s.notna().any():
            detail.update(
                min=float(s.min()),
                max=float(s.max()),
                mean=round(float(s.mean()), 4),
                std=round(float(s.std()), 4) if s.notna().sum() > 1 else 0.0,
            )
        elif s.dtype == object and s.notna().any():
            numeric_like = pd.to_numeric(s.dropna(), errors="coerce").notna().mean()
            detail["numeric_like_rate"] = round(float(numeric_like), 4)
        report["columns_detail"][str(col)] = detail

    json.dump(report, sys.stdout, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
