import math
from fastapi import APIRouter, Query, HTTPException
from state import state
import pandas as pd
import numpy as np

router = APIRouter()


def _sanitize(obj):
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


def get_df():
    df = state.get_dataset()
    if df is None:
        raise HTTPException(400, "No data loaded")
    return df


@router.get("/summary")
def summary():
    df = get_df()
    num_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = df.select_dtypes(exclude="number").columns.tolist()
    return {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "column_names": list(df.columns),
        "numeric_columns": len(num_cols),
        "categorical_columns": len(cat_cols),
        "numeric_cols": num_cols,
        "categorical_cols": cat_cols,
        "total_nulls": int(df.isnull().sum().sum()),
        "null_pct": round(float(df.isnull().sum().sum() / (len(df) * len(df.columns)) * 100), 2),
        "memory_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
    }


@router.get("/distribution")
def distribution(column: str = Query(...)):
    df = get_df()
    if column not in df.columns:
        raise HTTPException(400, f"Column '{column}' not found")
    vc = df[column].value_counts(dropna=False).head(50).reset_index()
    vc.columns = ["value", "count"]
    # convert NaN values to string "NaN" for JSON
    vc["value"] = vc["value"].apply(lambda x: str(x) if pd.isna(x) else x)
    return _sanitize({"column": column, "distribution": vc.to_dict(orient="records")})


@router.get("/temporal")
def temporal(group: str = "year"):
    df = get_df()
    if group not in df.columns:
        raise HTTPException(400, f"Column '{group}' not found")
    col = df[group]
    if col.dtype == "object":
        try:
            col = pd.to_numeric(col, errors="coerce")
        except Exception:
            pass
    vc = df.groupby(group).size().reset_index(name="count")
    vc = vc.sort_values(group)
    return _sanitize({"group": group, "data": vc.to_dict(orient="records")})


@router.get("/funding-by-year")
def funding_by_year():
    df = get_df()
    if "year" not in df.columns or "funding_usd" not in df.columns:
        raise HTTPException(400, "Year or funding_usd column not found")
    
    # Convert year to numeric and drop NaN
    df_clean = df.dropna(subset=["year", "funding_usd"]).copy()
    df_clean["year"] = pd.to_numeric(df_clean["year"], errors="coerce")
    df_clean = df_clean.dropna(subset=["year"])
    df_clean["year"] = df_clean["year"].astype(int)
    
    # Group by year and calculate sum & mean funding
    grouped = df_clean.groupby("year")["funding_usd"].agg(["sum", "mean", "count"]).reset_index()
    grouped.columns = ["year", "total_funding", "average_funding", "count"]
    grouped = grouped.sort_values("year")
    
    # Format in Millions of USD
    grouped["total_funding_m"] = (grouped["total_funding"] / 1e6).round(2)
    grouped["average_funding_m"] = (grouped["average_funding"] / 1e6).round(2)
    
    return _sanitize({"data": grouped.to_dict(orient="records")})


@router.get("/geographic")
def geographic():
    df = get_df()
    # Auto-discover categorical columns with reasonable cardinality
    cat_cols = df.select_dtypes(exclude="number").columns.tolist()
    result = {}
    for col in cat_cols[:8]:  # Show up to 8 categorical columns
        nunique = df[col].nunique()
        if 2 <= nunique <= 80:  # Skip high-cardinality columns
            vc = df[col].value_counts().head(20).reset_index()
            vc.columns = ["value", "count"]
            result[col] = vc.to_dict(orient="records")
    return _sanitize(result)


@router.get("/techniques")
def techniques():
    df = get_df()
    cat_cols = df.select_dtypes(exclude="number").columns.tolist()
    result = {}
    for col in cat_cols[:6]:  # Show top 6 categorical columns
        nunique = df[col].nunique()
        if 3 <= nunique <= 60:
            vc = df[col].value_counts().reset_index()
            vc.columns = ["value", "count"]
            result[col] = vc.to_dict(orient="records")
    return _sanitize(result)


@router.get("/numeric-overview")
def numeric_overview():
    df = get_df()
    num_cols = df.select_dtypes(include="number").columns.tolist()
    result = {}
    for col in num_cols[:12]:  # Show up to 12 numeric columns
        d = df[col].dropna()
        if len(d) == 0:
            continue
        result[col] = {
            "total": float(d.sum()),
            "mean": float(d.mean()),
            "median": float(d.median()),
            "min": float(d.min()),
            "max": float(d.max()),
            "std": float(d.std()),
            "nulls": int(df[col].isnull().sum()),
            "null_pct": round(float(df[col].isnull().mean() * 100), 2),
        }
    return _sanitize({"columns": result})


@router.get("/correlation")
def correlation():
    df = get_df()
    num = df.select_dtypes(include="number").dropna(axis=1, how="all")
    if num.shape[1] < 2:
        return {"correlation": [], "columns": []}
    corr = num.corr().round(3)
    matrix = []
    for i, r in enumerate(corr.index):
        for j, c in enumerate(corr.columns):
            if i < j:
                matrix.append({"x": r, "y": c, "value": corr.iloc[i, j]})
    return _sanitize({"correlation": matrix, "columns": list(corr.index)})


@router.get("/numeric-histogram")
def numeric_histogram(column: str = Query(...), bins: int = 20):
    df = get_df()
    if column not in df.columns:
        raise HTTPException(400, f"Column '{column}' not found")
    d = df[column].dropna()
    if not pd.api.types.is_numeric_dtype(d):
        raise HTTPException(400, f"Column '{column}' is not numeric")
    hist, edges = np.histogram(d, bins=bins)
    return _sanitize({
        "column": column,
        "histogram": hist.tolist(),
        "edges": edges.tolist(),
    })


@router.get("/filter")
def filter_data(
    column: str = Query(...),
    operator: str = Query("=="),
    value: str = Query(""),
    limit: int = Query(100),
):
    df = get_df()
    if column not in df.columns:
        raise HTTPException(400, f"Column '{column}' not found")
    try:
        if operator == "==":
            mask = df[column].astype(str).str.strip() == value.strip()
        elif operator == "!=":
            mask = df[column].astype(str).str.strip() != value.strip()
        elif operator == ">":
            mask = pd.to_numeric(df[column], errors="coerce") > float(value)
        elif operator == "<":
            mask = pd.to_numeric(df[column], errors="coerce") < float(value)
        elif operator == ">=":
            mask = pd.to_numeric(df[column], errors="coerce") >= float(value)
        elif operator == "<=":
            mask = pd.to_numeric(df[column], errors="coerce") <= float(value)
        elif operator == "contains":
            mask = df[column].astype(str).str.contains(value, case=False, na=False)
        else:
            raise HTTPException(400, f"Unknown operator '{operator}'")
    except Exception as e:
        raise HTTPException(400, f"Filter error: {e}")
    filtered = df[mask]
    return _sanitize({
        "total_before": len(df),
        "total_after": len(filtered),
        "rows": filtered.head(limit).to_dict(orient="records"),
    })
