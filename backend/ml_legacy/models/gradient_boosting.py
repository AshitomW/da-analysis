from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import numpy as np
import time
from ml.base import BaseModel
from ml.registry import register


@register
class GradientBoostingModel(BaseModel):
    name = "Gradient Boosting"
    description = "Gradient boosted regression trees (sklearn)"
    category = "regression"

    def get_default_params(self):
        return {"n_estimators": 100, "max_depth": 5, "learning_rate": 0.1, "random_state": 42}

    def train(self, X, y, params):
        t0 = time.time()
        model = GradientBoostingRegressor(**params)
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
