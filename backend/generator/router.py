import math
import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
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


@router.get("/schema")
def get_schema():
    df = state.get_dataset("original")
    if df is None:
        raise HTTPException(400, "No data loaded")
    schema = []
    for c in df.columns:
        col_info = {"name": c, "dtype": str(df[c].dtype), "type": "unknown"}
        if pd.api.types.is_numeric_dtype(df[c]):
            col_info["type"] = "numeric"
            col_info["min"] = float(df[c].min()) if df[c].notna().any() else 0
            col_info["max"] = float(df[c].max()) if df[c].notna().any() else 0
            col_info["mean"] = float(df[c].mean()) if df[c].notna().any() else 0
            col_info["std"] = float(df[c].std()) if df[c].notna().any() else 0
        else:
            val_counts = df[c].value_counts(normalize=True)
            col_info["type"] = "categorical"
            col_info["categories"] = list(val_counts.index[:50])
            col_info["probs"] = list(val_counts.values[:50])
            col_info["unique_count"] = int(df[c].nunique())
        schema.append(col_info)
    return {"schema": schema, "total_rows": len(df), "columns": len(df.columns)}


class GenerateRequest(BaseModel):
    num_rows: int = 100
    noise: float = 0.05
    seed: Optional[int] = None
    preserve_patterns: bool = True


@router.post("/generate")
def generate_synthetic(req: GenerateRequest):
    df = state.get_dataset("original")
    if df is None:
        raise HTTPException(400, "No data loaded")

    num_rows = min(max(req.num_rows, 1), 100000)
    noise = max(0, min(req.noise, 1.0))

    if req.seed is not None:
        random.seed(req.seed)
        np.random.seed(req.seed)

    new_rows = []
    for _ in range(num_rows):
        row = {}
        for c in df.columns:
            if pd.api.types.is_numeric_dtype(df[c]):
                valid = df[c].dropna()
                if len(valid) == 0:
                    row[c] = 0
                    continue
                mu = float(valid.mean())
                sigma = max(float(valid.std()), 0.01)
                val = np.random.normal(mu, sigma * (1 + noise))
                if pd.api.types.is_integer_dtype(df[c]):
                    val = int(round(val))
                    min_v = int(valid.min())
                    max_v = int(valid.max())
                    val = max(min_v, min(max_v, val))
                else:
                    min_v = float(valid.min())
                    max_v = float(valid.max())
                    val = float(max(min_v, min(max_v, val)))
                row[c] = val
            else:
                val_counts = df[c].value_counts(normalize=True)
                top_cats = val_counts.head(50)
                if len(top_cats) == 0:
                    row[c] = ""
                    continue
                cats = list(top_cats.index)
                probs = list(top_cats.values)
                probs = [p / sum(probs) for p in probs]
                row[c] = str(np.random.choice(cats, p=probs))
        new_rows.append(row)

    return _sanitize({
        "generated": num_rows,
        "rows": new_rows,
        "noise": noise,
        "seed": req.seed,
    })
