from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import numpy as np
import time
from ml.base import BaseModel
from ml.registry import register


@register
class RidgeRegressionModel(BaseModel):
    name = "Ridge Regression"
    description = "Regularized linear regression baseline for wide one-hot encoded project data"
    category = "regression"

    def get_default_params(self):
        return {"alpha": 2.0}

    def train(self, X, y, params):
        t0 = time.time()
        model = Ridge(**params)
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
            "coefficients": model.coef_.tolist() if hasattr(model, "coef_") else [],
        }

    def predict(self, model, X):
        return model.predict(X)
