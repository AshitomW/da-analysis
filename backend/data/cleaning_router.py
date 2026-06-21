from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from state import state

router = APIRouter()


class CleaningStep(BaseModel):
    operation: str
    column: Optional[str] = None
    value: Optional[Any] = None


class ApplyCleaningRequest(BaseModel):
    steps: list[CleaningStep]


CLEANING_OPERATIONS = [
    {"id": "drop_na_rows", "label": "Drop rows with missing values", "needs_column": True, "needs_value": False},
    {"id": "drop_na_cols", "label": "Drop columns that are all NaN", "needs_column": False, "needs_value": False},
    {"id": "fill_na_mean", "label": "Fill NaN with mean", "needs_column": True, "needs_value": False},
    {"id": "fill_na_median", "label": "Fill NaN with median", "needs_column": True, "needs_value": False},
    {"id": "fill_na_mode", "label": "Fill NaN with mode", "needs_column": True, "needs_value": False},
    {"id": "fill_na_constant", "label": "Fill NaN with constant", "needs_column": True, "needs_value": True},
    {"id": "fill_na_ffill", "label": "Forward fill NaN", "needs_column": True, "needs_value": False},
    {"id": "fill_na_bfill", "label": "Backward fill NaN", "needs_column": True, "needs_value": False},
    {"id": "interpolate", "label": "Interpolate missing values", "needs_column": True, "needs_value": False},
    {"id": "remove_outliers_zscore", "label": "Remove outliers (Z-score)", "needs_column": True, "needs_value": True},
    {"id": "remove_outliers_iqr", "label": "Remove outliers (IQR)", "needs_column": True, "needs_value": True},
    {"id": "remove_duplicates", "label": "Remove duplicates", "needs_column": False, "needs_value": False},
    {"id": "strip_whitespace", "label": "Strip whitespace", "needs_column": True, "needs_value": False},
    {"id": "lowercase", "label": "Convert to lowercase", "needs_column": True, "needs_value": False},
    {"id": "to_numeric", "label": "Convert to numeric", "needs_column": True, "needs_value": False},
    {"id": "to_datetime", "label": "Convert to datetime", "needs_column": True, "needs_value": False},
    {"id": "drop_column", "label": "Drop column", "needs_column": True, "needs_value": False},
    {"id": "rename_column", "label": "Rename column", "needs_column": True, "needs_value": True},
    {"id": "filter_rows", "label": "Filter rows (query)", "needs_column": False, "needs_value": True},
]


@router.get("/config")
def get_cleaning_config():
    import os, yaml
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cleaning_config.yaml")
    if os.path.exists(path):
        with open(path) as f:
            config = yaml.safe_load(f)
        return {"config": config}
    return {"config": None}


@router.get("/operations")
def get_operations():
    return {"operations": CLEANING_OPERATIONS}


@router.post("/apply")
def apply_cleaning(req: ApplyCleaningRequest):
    df = state.raw_df
    if df is None:
        raise HTTPException(400, "No data loaded")
    try:
        steps = [s.model_dump() for s in req.steps]
        result_df = state.apply_cleaning(steps)
        return {
            "status": "applied",
            "rows_before": len(df),
            "rows_after": len(result_df),
            "cols_before": len(df.columns),
            "cols_after": len(result_df.columns),
            "nulls_before": int(df.isnull().sum().sum()),
            "nulls_after": int(result_df.isnull().sum().sum()),
            "steps": steps,
        }
    except Exception as e:
        raise HTTPException(400, f"Cleaning failed: {e}")


@router.get("/preview")
def preview_cleaning():
    return {
        "current_steps": state.cleaning_pipeline,
        "rows": len(state.clean_df) if state.clean_df is not None else 0,
    }
