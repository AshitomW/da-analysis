import math
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from state import state

router = APIRouter()


def _sanitize(obj):
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


def _dataset_info(name: str, df):
    if df is None:
        return {"loaded": False, "rows": 0, "columns": 0}
    return {
        "loaded": True,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "dtypes": {c: str(d) for c, d in df.dtypes.items()},
        "null_pct": round((df.isnull().sum().sum() / (len(df) * len(df.columns)) * 100), 2),
    }


@router.get("/status")
def get_status():
    return {
        "active_dataset": state.active_dataset,
        "datasets": {
            "original": _dataset_info("original", state.original_df),
            "cleaned": _dataset_info("cleaned", state._cleaned_df),
            "extended": _dataset_info("extended", state._extended_df),
        },
    }


@router.get("/columns")
def get_columns():
    df = state.get_dataset()
    if df is None:
        raise HTTPException(400, "No data loaded")
    import pandas as pd
    cols = []
    for c in df.columns:
        col_data = {
            "name": c,
            "dtype": str(df[c].dtype),
            "nulls": int(df[c].isnull().sum()),
            "null_pct": round(float(df[c].isnull().mean() * 100), 2),
            "unique": int(df[c].nunique()),
        }
        if pd.api.types.is_numeric_dtype(df[c]):
            col_data.update({
                "min": float(df[c].min()) if df[c].notna().any() else None,
                "max": float(df[c].max()) if df[c].notna().any() else None,
                "mean": float(df[c].mean()) if df[c].notna().any() else None,
                "median": float(df[c].median()) if df[c].notna().any() else None,
                "std": float(df[c].std()) if df[c].notna().any() else None,
            })
        else:
            top = df[c].value_counts()
            col_data["top_values"] = top.head(10).to_dict()
        cols.append(col_data)
    return {"columns": cols}


@router.get("/rows")
def get_rows(offset: int = 0, limit: int = 100):
    df = state.get_dataset()
    if df is None:
        raise HTTPException(400, "No data loaded")
    page = df.iloc[offset: offset + limit]
    return _sanitize({
        "total": len(df),
        "offset": offset,
        "limit": limit,
        "rows": page.to_dict(orient="records"),
    })


class SetActiveRequest(BaseModel):
    dataset: str

@router.post("/set-active")
def set_active(req: SetActiveRequest):
    if state.set_active_dataset(req.dataset):
        df = state.get_dataset()
        return {
            "active_dataset": req.dataset,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": list(df.columns),
        }
    raise HTTPException(400, f"Invalid dataset '{req.dataset}'. Use 'original', 'cleaned', or 'extended'")


@router.post("/auto-clean")
def auto_clean():
    df = state.auto_clean()
    return {
        "status": "cleaned",
        "rows": len(df),
        "columns": len(df.columns),
    }


@router.post("/reset")
def reset_data():
    # Reset cleaned and extended to original
    state._cleaned_df = state._original_df.copy()
    state._extended_df = state._original_df.copy()
    state.cleaning_pipeline = []
    return {"message": "Reset cleaned and extended datasets to original"}


class ExtendRequest(BaseModel):
    rows: list[dict]
    label: str = ""


@router.post("/extend")
def extend_data(req: ExtendRequest):
    import pandas as pd
    if not req.rows:
        raise HTTPException(400, "No rows provided")
    new_df = pd.DataFrame(req.rows)
    result = state.extend_data(new_df)
    return {
        "message": "Data extended successfully",
        "total_rows": len(result),
        "added_rows": len(req.rows),
    }


@router.post("/snapshot")
def take_snapshot(dataset: str, label: str = ""):
    result = state.take_snapshot(dataset, label)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@router.get("/snapshots")
def list_snapshots(dataset: Optional[str] = None):
    snaps = state.list_snapshots(dataset)
    return {"snapshots": snaps}


@router.post("/restore")
def restore_snapshot(snapshot_id: str):
    ok = state.restore_snapshot(snapshot_id)
    if not ok:
        raise HTTPException(400, f"Snapshot '{snapshot_id}' not found")
    return {"message": "Restored successfully", "active_dataset": state.active_dataset}


@router.get("/history")
def upload_history():
    return {"history": []}


import pandas as pd  # noqa
