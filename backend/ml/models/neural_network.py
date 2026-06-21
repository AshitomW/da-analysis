from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import numpy as np
import time
from ml.base import BaseModel
from ml.registry import register


@register
class NeuralNetworkModel(BaseModel):
    name = "Neural Network"
    description = "Multi-layer Perceptron (MLP) Neural Network"
    category = "regression"

    def get_default_params(self):
        return {
            "hidden_layer_sizes": [64, 32],
            "max_iter": 200,
            "learning_rate_init": 0.01,
            "early_stopping": True,
            "random_state": 42
        }

    def train(self, X, y, params):
        t0 = time.time()
        p = params.copy()
        if "hidden_layer_sizes" in p and isinstance(p["hidden_layer_sizes"], list):
            p["hidden_layer_sizes"] = tuple(p["hidden_layer_sizes"])
        
        # Ensure correct types
        if "max_iter" in p:
            p["max_iter"] = int(p["max_iter"])
        if "learning_rate_init" in p:
            p["learning_rate_init"] = float(p["learning_rate_init"])
        if "early_stopping" in p:
            p["early_stopping"] = bool(p["early_stopping"])

        model = MLPRegressor(**p)
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
        }

    def predict(self, model, X):
        return model.predict(X)
