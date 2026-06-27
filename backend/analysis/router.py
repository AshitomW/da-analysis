import math
from typing import Optional
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


@router.get("/boxplot")
def boxplot(
    column: str = Query(...),
    group: str = Query(...),
    top_k: int = Query(12),
):
    df = get_df()
    if column not in df.columns:
        raise HTTPException(400, f"Column '{column}' not found")
    if group not in df.columns:
        raise HTTPException(400, f"Group column '{group}' not found")
    d = df[[column, group]].dropna()
    if not pd.api.types.is_numeric_dtype(d[column]):
        raise HTTPException(400, f"Column '{column}' is not numeric")
    top_groups = d[group].value_counts().head(top_k).index
    d = d[d[group].isin(top_groups)]
    groups_data = []
    for g in top_groups:
        vals = d.loc[d[group] == g, column].values
        if len(vals) < 2:
            continue
        q1, q2, q3 = np.percentile(vals, [25, 50, 75])
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        filtered = vals[(vals >= lower) & (vals <= upper)]
        whisker_low = filtered.min() if len(filtered) > 0 else lower
        whisker_high = filtered.max() if len(filtered) > 0 else upper
        outliers = vals[(vals < lower) | (vals > upper)].tolist()
        groups_data.append({
            "group": str(g),
            "q1": float(q1),
            "q2": float(q2),
            "q3": float(q3),
            "whisker_low": float(whisker_low),
            "whisker_high": float(whisker_high),
            "outliers": [float(o) for o in outliers],
            "count": int(len(vals)),
        })
    return _sanitize({
        "column": column,
        "group": group,
        "groups": groups_data,
    })


@router.get("/scatter")
def scatter(
    x: str = Query(...),
    y: str = Query(...),
    color: Optional[str] = Query(None),
    limit: int = Query(2000),
):
    df = get_df()
    if x not in df.columns:
        raise HTTPException(400, f"Column '{x}' not found")
    if y not in df.columns:
        raise HTTPException(400, f"Column '{y}' not found")
    cols = [x, y]
    if color and color in df.columns:
        cols.append(color)
    d = df[cols].dropna().head(limit)
    points = []
    for _, row in d.iterrows():
        pt = {"x": float(row[x]), "y": float(row[y])}
        if color and color in df.columns:
            pt["color"] = str(row[color])
        points.append(pt)
    return _sanitize({
        "x": x,
        "y": y,
        "color": color,
        "points": points,
    })


def _gaussian_kde(xs, vals, bw=None):
    """Simple Gaussian KDE using numpy (no scipy dependency)."""
    vals = np.asarray(vals)
    n = len(vals)
    if n < 2:
        return np.zeros_like(xs)
    if bw is None:
        iqr = np.percentile(vals, 75) - np.percentile(vals, 25)
        bw = 0.9 * min(np.std(vals), iqr / 1.34) * n ** (-0.2)
    if bw == 0:
        bw = 0.1 * (vals.max() - vals.min()) if vals.max() > vals.min() else 1.0
    xs = np.asarray(xs)[:, None]
    vals = np.asarray(vals)[None, :]
    density = np.sum(np.exp(-0.5 * ((xs - vals) / bw) ** 2), axis=1)
    density = density / (np.sqrt(2 * np.pi) * bw * n)
    return density


@router.get("/density")
def density(
    column: str = Query(...),
    group: str = Query(...),
    top_k: int = Query(6),
    grid_size: int = Query(100),
):
    df = get_df()
    if column not in df.columns:
        raise HTTPException(400, f"Column '{column}' not found")
    if group not in df.columns:
        raise HTTPException(400, f"Group column '{group}' not found")
    d = df[[column, group]].dropna()
    if not pd.api.types.is_numeric_dtype(d[column]):
        raise HTTPException(400, f"Column '{column}' is not numeric")
    top_groups = d[group].value_counts().head(top_k).index
    d = d[d[group].isin(top_groups)]
    groups_data = []
    for g in top_groups:
        vals = d.loc[d[group] == g, column].values
        if len(vals) < 3:
            continue
        x_min, x_max = float(vals.min()), float(vals.max())
        pad = (x_max - x_min) * 0.1 if x_max > x_min else 1.0
        xs = np.linspace(x_min - pad, x_max + pad, grid_size)
        density = _gaussian_kde(xs, vals)
        density_sum = density.sum()
        normalized = (density / density_sum) if density_sum > 0 else density
        groups_data.append({
            "group": str(g),
            "x": xs.tolist(),
            "density": normalized.tolist(),
            "count": int(len(vals)),
        })
    return _sanitize({
        "column": column,
        "group": group,
        "groups": groups_data,
    })


@router.get("/parallel-coords")
def parallel_coords(
    dimensions: str = Query(..., description="Comma-separated numeric column names"),
    color: Optional[str] = Query(None),
    limit: int = Query(500),
):
    df = get_df()
    cols = [c.strip() for c in dimensions.split(",")]
    for c in cols:
        if c not in df.columns:
            raise HTTPException(400, f"Column '{c}' not found")
    cols_to_use = cols[:]
    if color and color in df.columns:
        cols_to_use.append(color)
    d = df[cols_to_use].dropna().head(limit)
    result = {"dimensions": cols, "data": []}
    for _, row in d.iterrows():
        pt = {c: float(row[c]) for c in cols}
        if color and color in df.columns:
            pt["color"] = str(row[color])
        result["data"].append(pt)
    return _sanitize(result)


@router.get("/radar")
def radar(
    group: str = Query(...),
    metrics: str = Query(..., description="Comma-separated numeric column names"),
    top_k: int = Query(8),
):
    df = get_df()
    if group not in df.columns:
        raise HTTPException(400, f"Group column '{group}' not found")
    metric_cols = [c.strip() for c in metrics.split(",")]
    for c in metric_cols:
        if c not in df.columns:
            raise HTTPException(400, f"Metric column '{c}' not found")
    cols = [group] + metric_cols
    d = df[cols].dropna()
    top_groups = d[group].value_counts().head(top_k).index
    d = d[d[group].isin(top_groups)]
    result = {"group": group, "metrics": metric_cols, "groups": []}
    for g in top_groups:
        subset = d[d[group] == g]
        row_data = {"group": str(g)}
        for m in metric_cols:
            row_data[m] = float(subset[m].mean())
        result["groups"].append(row_data)
    return _sanitize(result)
