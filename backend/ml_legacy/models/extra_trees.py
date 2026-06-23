from sklearn.ensemble import ExtraTreesRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import numpy as np
import time
from ml.base import BaseModel
from ml.registry import register


@register
class ExtraTreesModel(BaseModel):
    name = "Extra Trees"
    description = "Fast randomized tree ensemble that handles nonlinear feature interactions"
    category = "regression"

    def get_default_params(self):
        return {
            "n_estimators": 260,
            "max_depth": 18,
            "min_samples_leaf": 2,
            "random_state": 42,
            "n_jobs": -1,
        }

    def train(self, X, y, params):
        t0 = time.time()
        model = ExtraTreesRegressor(**params)
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
            "feature_importance": model.feature_importances_.tolist(),
        }

    def predict(self, model, X):
        return model.predict(X)
