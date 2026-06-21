import math
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from typing import Optional, Any
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


class SaveMLResultRequest(BaseModel):
    model_name: str
    category: str = ""
    target_col: str = ""
    feature_cols: list[str] = []
    params: dict = {}
    train_metrics: dict = {}
    test_metrics: dict = {}
    training_time: float = 0
    cv_scores: list[float] = []
    train_size: int = 0
    test_size: int = 0
    run_type: str = "ml_model"

    layer_config: Optional[list] = None
    layer_details: Optional[list] = None
    total_params: Optional[int] = None
    history: Optional[dict] = None


class DeleteResultRequest(BaseModel):
    result_id: str


@router.get("/results")
def list_results(response: Response):
    state._load_saved_results()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return _sanitize({"results": state.saved_results})


@router.get("/results/by-target")
def results_by_target(response: Response):
    state._load_saved_results()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    targets: dict[str, list] = {}
    for r in state.saved_results:
        t = r.get("target_col", "unknown")
        if t not in targets:
            targets[t] = []
        targets[t].append(_sanitize({
            "id": r.get("id"),
            "model_name": r.get("model_name"),
            "run_type": r.get("run_type"),
            "target_col": t,
            "dataset": r.get("dataset"),
            "test_metrics": r.get("test_metrics"),
            "train_metrics": r.get("train_metrics"),
            "training_time": r.get("training_time"),
            "train_size": r.get("train_size"),
            "test_size": r.get("test_size"),
            "feature_count": len(r.get("feature_cols", [])),
            "timestamp": r.get("timestamp"),
        }))
    return {"targets": targets}


def _result_detail(r: dict) -> dict:
    return {
        "id": r.get("id"),
        "model_name": r.get("model_name"),
        "run_type": r.get("run_type"),
        "target_col": r.get("target_col"),
        "dataset": r.get("dataset"),
        "test_metrics": r.get("test_metrics"),
        "train_metrics": r.get("train_metrics"),
        "training_time": r.get("training_time"),
        "train_size": r.get("train_size"),
        "test_size": r.get("test_size"),
        "feature_cols": r.get("feature_cols", []),
        "feature_count": len(r.get("feature_cols", [])),
        "params": r.get("params"),
        "feature_importance": r.get("feature_importance"),
        "actual_vs_predicted": r.get("actual_vs_predicted"),
        "history": r.get("history"),
        "timestamp": r.get("timestamp"),
    }


@router.get("/results/by-model")
def results_by_model(response: Response):
    state._load_saved_results()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    models: dict[str, dict[str, dict]] = {}
    for r in state.saved_results:
        m = r.get("model_name", "unknown")
        t = r.get("target_col", "unknown")
        if m not in models:
            models[m] = {}
        models[m][t] = _sanitize(_result_detail(r))
    return {"models": models}


@router.get("/results/{result_id}")
def get_result(result_id: str, response: Response):
    state._load_saved_results()
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    r = state.get_result(result_id)
    if r is None:
        raise HTTPException(404, "Result not found")
    return _sanitize(r)


@router.post("/results/save")
def save_result(req: SaveMLResultRequest):
    entry = state.save_result({
        "run_type": req.run_type,
        "model_name": req.model_name,
        "category": req.category,
        "target_col": req.target_col,
        "feature_cols": req.feature_cols,
        "params": req.params,
        "train_metrics": req.train_metrics,
        "test_metrics": req.test_metrics,
        "training_time": req.training_time,
        "cv_scores": req.cv_scores,
        "train_size": req.train_size,
        "test_size": req.test_size,
        "layer_config": req.layer_config,
        "layer_details": req.layer_details,
        "total_params": req.total_params,
        "history": req.history,
    })
    return _sanitize(entry)


@router.delete("/results/{result_id}")
def delete_result(result_id: str):
    state.delete_result(result_id)
    return {"status": "deleted"}


@router.get("/comparisons/available")
def available_comparisons():
    state._load_saved_results()
    results = state.saved_results
    if len(results) < 2:
        return {"can_compare": False, "message": "Need at least 2 saved results to compare"}
    metrics_keys = set()
    for r in results:
        for k in (r.get("test_metrics") or {}).keys():
            metrics_keys.add(k)
    return {
        "can_compare": True,
        "total_saved": len(results),
        "available_metrics": sorted(metrics_keys),
        "results_meta": [
            {
                "id": r["id"],
                "model_name": r.get("model_name", "Unknown"),
                "run_type": r.get("run_type", "ml_model"),
                "target_col": r.get("target_col", "?"),
                "timestamp": r.get("timestamp", ""),
                "dataset": r.get("dataset", ""),
                "train_size": r.get("train_size"),
                "test_size": r.get("test_size"),
            }
            for r in results
        ],
    }


class CompareRequest(BaseModel):
    result_ids: list[str]
    metrics: list[str]


@router.post("/comparisons/compare")
def compare_results(req: CompareRequest):
    if len(req.result_ids) < 2:
        raise HTTPException(400, "Need at least 2 result IDs to compare")
    selected = []
    for rid in req.result_ids:
        r = state.get_result(rid)
        if r is None:
            raise HTTPException(404, f"Result '{rid}' not found")
        tm = r.get("test_metrics", {})
        filtered_metrics = {k: tm.get(k) for k in req.metrics if k in tm}
        selected.append({
            "id": r["id"],
            "model_name": r.get("model_name"),
            "run_type": r.get("run_type"),
            "timestamp": r.get("timestamp"),
            "dataset": r.get("dataset"),
            "target_col": r.get("target_col"),
            "train_size": r.get("train_size"),
            "test_size": r.get("test_size"),
            "training_time": r.get("training_time"),
            "metrics": filtered_metrics,
            "feature_count": len(r.get("feature_cols", [])),
            "total_params": r.get("total_params"),
            "layer_details": r.get("layer_details"),
            "history": r.get("history"),
        })
    return _sanitize({"comparison": selected, "metrics_compared": req.metrics})
