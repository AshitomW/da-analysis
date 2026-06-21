from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from state import state
from ml.registry import list_all, get, count
from ml.preprocessing import prepare_data
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, OneHotEncoder
import numpy as np
import pandas as pd

router = APIRouter()

import ml.models  # noqa


class TrainRequest(BaseModel):
    model_name: str
    target_col: str
    feature_cols: list[str]
    params: Optional[dict] = None
    scale_method: str = "standard"
    encode_categories: bool = True
    test_size: float = 0.2
    cv_folds: int = 0
    dataset: str = "original"


class PredictRequest(BaseModel):
    model_name: str
    target_col: str
    feature_cols: list[str]
    params: Optional[dict] = None
    scale_method: str = "standard"
    encode_categories: bool = True
    test_size: float = 0.2
    X_input: list[list[float]]
    dataset: str = "original"


@router.get("/models")
def get_models():
    return {"models": list_all(), "total": count()}


@router.get("/models/{name}")
def get_model_detail(name: str):
    try:
        cls = get(name)
        inst = cls()
        return {
            "name": cls.name,
            "description": cls.description,
            "category": cls.category,
            "default_params": inst.get_default_params(),
        }
    except KeyError:
        raise HTTPException(404, f"Model '{name}' not found")


@router.post("/models/{name}/train")
def train_model(name: str, req: TrainRequest):
    df = state.get_dataset(req.dataset)
    if df is None:
        raise HTTPException(400, "No data loaded")

    try:
        cls = get(name)
    except KeyError:
        raise HTTPException(404, f"Model '{name}' not found")

    try:
        prepared = prepare_data(
            df, req.target_col, req.feature_cols,
            scale_method=req.scale_method, encode_categories=req.encode_categories,
            test_size=req.test_size,
        )
    except Exception as e:
        raise HTTPException(400, f"Data preparation failed: {e}")

    params = req.params or cls().get_default_params()
    instance = cls()

    try:
        if req.cv_folds > 1:
            from sklearn.model_selection import cross_val_score, KFold
            from ml.preprocessing import prepare_data as prep
            p = prep(df, req.target_col, req.feature_cols, scale_method=req.scale_method,
                     encode_categories=req.encode_categories, test_size=0.1)
            kf = KFold(n_splits=req.cv_folds, shuffle=True, random_state=42)
            from sklearn.base import RegressorMixin
            if instance.name == "K-Means Clustering":
                cv_scores = []
            else:
                est = cls().train(p["X_train"], p["y_train"], params)["model"]
                if hasattr(est, "predict"):
                    cv_scores = cross_val_score(est, p["X_train"], p["y_train"], cv=kf,
                                                 scoring="r2").tolist()
                else:
                    cv_scores = []
        else:
            cv_scores = []
    except Exception:
        cv_scores = []

    result = instance.train(prepared["X_train"], prepared["y_train"], params)
    y_pred = instance.predict(result["model"], prepared["X_test"])
    y_train_pred = instance.predict(result["model"], prepared["X_train"])

    test_metrics = {}
    try:
        test_metrics = {
            "rmse": float(np.sqrt(mean_squared_error(prepared["y_test"], y_pred))),
            "mse": float(mean_squared_error(prepared["y_test"], y_pred)),
            "mae": float(mean_absolute_error(prepared["y_test"], y_pred)),
            "r2": float(r2_score(prepared["y_test"], y_pred)),
        }
    except Exception:
        pass

    train_metrics = {}
    try:
        train_metrics = {
            "rmse": float(np.sqrt(mean_squared_error(prepared["y_train"], y_train_pred))),
            "mse": float(mean_squared_error(prepared["y_train"], y_train_pred)),
            "mae": float(mean_absolute_error(prepared["y_train"], y_train_pred)),
            "r2": float(r2_score(prepared["y_train"], y_train_pred)),
        }
    except Exception:
        pass

    response = {
        "model_name": name,
        "category": instance.category,
        "feature_cols": prepared["feature_names"],
        "train_size": prepared["train_size"],
        "test_size": prepared["test_size"],
        "train_metrics": train_metrics,
        "test_metrics": test_metrics,
        "training_time": result.get("training_time", 0),
        "cv_scores": cv_scores,
        "actual_vs_predicted": {
            "actual": prepared["y_test"].tolist(),
            "predicted": y_pred.tolist(),
        },
        "dataset": req.dataset,
    }

    if "feature_importance" in result:
        importance = result["feature_importance"]
        names = prepared["feature_names"]
        paired = list(zip(names, importance))
        paired.sort(key=lambda x: abs(x[1]), reverse=True)
        response["feature_importance"] = {
            "names": [p[0] for p in paired],
            "values": [p[1] for p in paired],
        }

    if "history" in result:
        response["history"] = result["history"]

    if "labels" in result:
        response["labels"] = result["labels"]

    return response


@router.post("/train-all")
def train_all(target_col: str, dataset: str = "original"):
    df = state.get_dataset(dataset)
    if df is None:
        raise HTTPException(400, "No data loaded")

    exclude = {'entry_id', 'title', 'abstract_summary', 'keywords', 'language',
               'dataset_used', 'publication_venue', target_col}
    feature_cols = [c for c in df.columns if c not in exclude and not (
        df[c].dtype == 'object' and df[c].nunique() > 50
    )]
    if len(feature_cols) < 2:
        raise HTTPException(400, f"Not enough feature columns for target '{target_col}'")

    try:
        prepared = prepare_data(df, target_col, feature_cols,
                                scale_method="standard", encode_categories=True, test_size=0.2)
    except Exception as e:
        raise HTTPException(400, f"Data preparation failed: {e}")

    results = []
    for m in list_all():
        try:
            cls = get(m["name"])
            instance = cls()
            params = instance.get_default_params()

            t0 = __import__('time').time()
            result = instance.train(prepared["X_train"], prepared["y_train"], params)
            training_time = __import__('time').time() - t0

            y_pred = instance.predict(result["model"], prepared["X_test"])
            y_train_pred = instance.predict(result["model"], prepared["X_train"])

            test_metrics = {
                "rmse": float(np.sqrt(mean_squared_error(prepared["y_test"], y_pred))),
                "mse": float(mean_squared_error(prepared["y_test"], y_pred)),
                "mae": float(mean_absolute_error(prepared["y_test"], y_pred)),
                "r2": float(r2_score(prepared["y_test"], y_pred)),
            }
            train_metrics = {
                "rmse": float(np.sqrt(mean_squared_error(prepared["y_train"], y_train_pred))),
                "mse": float(mean_squared_error(prepared["y_train"], y_train_pred)),
                "mae": float(mean_absolute_error(prepared["y_train"], y_train_pred)),
                "r2": float(r2_score(prepared["y_train"], y_train_pred)),
            }

            entry = {
                "run_type": "ml_model",
                "model_name": m["name"],
                "category": instance.category,
                "target_col": target_col,
                "feature_cols": prepared["feature_names"],
                "params": params,
                "train_metrics": train_metrics,
                "test_metrics": test_metrics,
                "training_time": round(training_time, 3),
                "cv_scores": [],
                "train_size": prepared["train_size"],
                "test_size": prepared["test_size"],
                "dataset": dataset,
            }

            if "feature_importance" in result:
                importance = result["feature_importance"]
                names = prepared["feature_names"]
                paired = list(zip(names, importance))
                paired.sort(key=lambda x: abs(x[1]), reverse=True)
                entry["feature_importance"] = {
                    "names": [p[0] for p in paired],
                    "values": [p[1] for p in paired],
                }

            if "history" in result:
                entry["history"] = result["history"]

            entry["actual_vs_predicted"] = {
                "actual": prepared["y_test"].tolist(),
                "predicted": y_pred.tolist(),
            }

            entry["residuals"] = (prepared["y_test"] - y_pred).tolist()

            saved = state.save_result(entry)
            entry["id"] = saved["id"]
            results.append(entry)

        except Exception as e:
            results.append({
                "model_name": m["name"],
                "target_col": target_col,
                "error": str(e),
            })

    return {"target_col": target_col, "dataset": dataset, "results": results}


@router.post("/models/{name}/predict")
def run_prediction(name: str, req: PredictRequest):
    df = state.get_dataset(req.dataset)
    if df is None:
        raise HTTPException(400, "No data loaded")
    try:
        cls = get(name)
    except KeyError:
        raise HTTPException(404, f"Model '{name}' not found")

    prepared = prepare_data(
        df, req.target_col, req.feature_cols,
        scale_method=req.scale_method, encode_categories=req.encode_categories,
        test_size=req.test_size,
    )
    params = req.params or cls().get_default_params()
    instance = cls()
    result = instance.train(prepared["X_train"], prepared["y_train"], params)
    X_input = np.array(req.X_input)
    if X_input.shape[1] != prepared["num_features"]:
        X_input = X_input[:, :prepared["num_features"]]
    preds = instance.predict(result["model"], X_input)
    return {"predictions": preds.tolist()}


class RawPredictRequest(BaseModel):
    target_col: str
    feature_cols: list[str]
    values: dict[str, Any]
    params: Optional[dict] = None
    scale_method: str = "standard"
    encode_categories: bool = True
    dataset: str = "original"


@router.post("/models/{name}/predict-raw")
def predict_raw(name: str, req: RawPredictRequest):
    df = state.get_dataset(req.dataset)
    if df is None:
        raise HTTPException(400, "No data loaded")
    try:
        cls = get(name)
    except KeyError:
        raise HTTPException(404, f"Model '{name}' not found")

    feature_cols = req.feature_cols
    target_col = req.target_col

    # Prepare training data
    train_df = df[feature_cols + [target_col]].dropna()
    y_train = train_df[target_col].values

    cat_cols = train_df[feature_cols].select_dtypes(exclude="number").columns.tolist()
    num_cols = train_df[feature_cols].select_dtypes(include="number").columns.tolist()

    X = train_df[feature_cols].copy()
    for c in cat_cols:
        X[c] = X[c].fillna("unknown").astype(str)
    for c in num_cols:
        X[c] = X[c].fillna(X[c].median())

    enc = None
    if req.encode_categories and cat_cols:
        enc = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        encoded = enc.fit_transform(X[cat_cols])
        enc_cols = [f"{c}_{v}" for c, vs in zip(cat_cols, enc.categories_) for v in vs]
        X_enc = pd.DataFrame(encoded, columns=enc_cols, index=X.index)
        X = pd.concat([X[num_cols], X_enc], axis=1)
    else:
        X = X[num_cols]

    scaler = None
    if req.scale_method == "standard":
        scaler = StandardScaler()
    elif req.scale_method == "minmax":
        scaler = MinMaxScaler()
    elif req.scale_method == "robust":
        scaler = RobustScaler()

    if scaler is not None and len(num_cols) > 0:
        X[num_cols] = scaler.fit_transform(X[num_cols])

    feature_names = list(X.columns)

    # Build prediction row from raw values
    pred_row = {}
    for c in num_cols:
        pred_row[c] = float(req.values.get(c, 0))

    if enc:
        cat_df = pd.DataFrame([{c: str(req.values.get(c, "unknown")) for c in cat_cols}])
        cat_enc = enc.transform(cat_df)
        idx = 0
        for ci, c in enumerate(cat_cols):
            for vi, val in enumerate(enc.categories_[ci]):
                col_name = f"{c}_{val}"
                pred_row[col_name] = float(cat_enc[0, idx + vi])
            idx += len(enc.categories_[ci])

    X_pred = np.array([[pred_row.get(c, 0) for c in feature_names]])

    if scaler is not None and len(num_cols) > 0:
        X_pred[:, :len(num_cols)] = scaler.transform(X_pred[:, :len(num_cols)])

    X_train = X.values
    params = req.params or cls().get_default_params()
    instance = cls()
    result = instance.train(X_train, y_train, params)
    pred = instance.predict(result["model"], X_pred)

    return {"prediction": float(pred[0])}
