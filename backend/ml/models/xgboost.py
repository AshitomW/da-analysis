from xgboost import XGBRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import numpy as np
import time
from ml.base import BaseModel
from ml.registry import register


@register
class XGBoostModel(BaseModel):
    name = "XGBoost"
    description = "Extreme Gradient Boosting tree regressor"
    category = "regression"

    def get_default_params(self):
        return {
            "n_estimators": 100,
            "max_depth": 4,
            "learning_rate": 0.1,
            "random_state": 42,
            "n_jobs": -1
        }

    def train(self, X, y, params):
        t0 = time.time()
        
        # Ensure correct types
        p = params.copy()
        if "max_depth" in p:
            p["max_depth"] = int(p["max_depth"])
        if "n_estimators" in p:
            p["n_estimators"] = int(p["n_estimators"])
        if "learning_rate" in p:
            p["learning_rate"] = float(p["learning_rate"])
        if "random_state" in p:
            p["random_state"] = int(p["random_state"])

        model = XGBRegressor(**p)
        model.fit(X, y)
        t = time.time() - t0
        preds = model.predict(X)
        return {
            "model": model,
            "metrics": {
                "rmse": float(np.sqrt(mean_squared_error(y, preds))),
                "mse": float(mean_squared_error(y, preds)),
                "mae": float(mean_absolute_error(y, preds)),
                "r2": float(r2_score(y, preds)),
            },
            "training_time": round(t, 3),
            "feature_importance": model.feature_importances_.tolist() if hasattr(model, "feature_importances_") else [],
        }

    def predict(self, model, X):
        return model.predict(X)
