"""
Apply the cleaning pipeline defined in cleaning_config.yaml.

Usage:
    python -m backend.scripts.clean
    python backend/scripts/clean.py
    python -m scripts.clean            (from backend/)
"""

import sys
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import yaml
import pandas as pd
from state import state


def _categorical_placeholder(column_name: str) -> str:
    lower = column_name.lower()
    if "policy" in lower:
        return "not_policy"
    if "patent" in lower:
        return "no_patent"
    if "publication" in lower or "venue" in lower:
        return "no_publication"
    if "organization" in lower or lower.endswith("org"):
        return "unknown_organization"
    if "dataset" in lower:
        return "unknown_dataset"
    if "country" in lower:
        return "unknown_country"
    if "region" in lower:
        return "unknown_region"
    return "unknown"


def load_config(path=None):
    if path is None:
        path = os.path.join(backend_dir, "cleaning_config.yaml")
    with open(path) as f:
        return yaml.safe_load(f)


def apply_cleaning(df: pd.DataFrame, config: dict) -> pd.DataFrame:
    steps = config.get("cleaning", [])
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = df.select_dtypes(exclude="number").columns.tolist()

    for step in steps:
        op = step.get("operation")
        cols = step.get("columns", [])

        if cols == "__numeric__":
            cols = numeric_cols
        elif cols == "__categorical__":
            cols = categorical_cols

        if op == "drop_columns":
            cols = [c for c in cols if c in df.columns]
            if cols:
                df = df.drop(columns=cols)
                for c in cols:
                    if c in numeric_cols:
                        numeric_cols.remove(c)
                    if c in categorical_cols:
                        categorical_cols.remove(c)

        elif op == "fill_na_median":
            for c in cols:
                if c in df.columns and c in numeric_cols:
                    df[c] = df[c].fillna(df[c].median())

        elif op == "fill_na_mode":
            for c in cols:
                if c in df.columns:
                    df[c] = df[c].replace(r"^\s*$", pd.NA, regex=True)
                    placeholder = _categorical_placeholder(c)
                    modes = df[c].mode()
                    if c in {"policy_type", "policy_level", "policy_stringency_score", "patent_class", "patent_family_size", "publication_venue", "open_access"}:
                        df[c] = df[c].fillna(placeholder)
                    else:
                        df[c] = df[c].fillna(modes.iloc[0] if not modes.empty else placeholder)

        elif op == "remove_outliers_iqr":
            factor = step.get("factor", 1.5)
            for c in cols:
                if c in df.columns and c in numeric_cols:
                    q1, q3 = df[c].quantile(0.25), df[c].quantile(0.75)
                    iqr = q3 - q1
                    df = df[(df[c] >= q1 - factor * iqr) & (df[c] <= q3 + factor * iqr)]

        elif op == "drop_na_rows":
            df = df.dropna()

        elif op == "drop_duplicates":
            df = df.drop_duplicates()

    return df


def main():
    config = load_config()
    dataset = config.get("dataset", "original")

    print(f"Loading {dataset} dataset...")
    df = state.get_dataset(dataset)
    print(f"  Rows: {len(df)}, Columns: {len(df.columns)}")

    cleaned = apply_cleaning(df.copy(), config)
    print(f"After cleaning: {len(cleaned)} rows, {len(cleaned.columns)} columns")

    state._cleaned_df = cleaned
    state.cleaning_pipeline = config.get("cleaning", [])
    state.set_active_dataset("cleaned")

    print("Cleaned dataset saved to state (active_dataset=cleaned).")
    print("You can now run the training script: python -m backend.scripts.train_all")


if __name__ == "__main__":
    main()
