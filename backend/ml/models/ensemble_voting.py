from sklearn.ensemble import VotingRegressor, RandomForestRegressor, GradientBoostingRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import numpy as np
import time
from ml.base import BaseModel
from ml.registry import register


@register
class EnsembleVotingModel(BaseModel):
    name = "Ensemble (Voting)"
    description = "Voting ensemble of Random Forest, Gradient Boosting, and MLP Neural Network"
    category = "regression"

    def get_default_params(self):
        return {}

    def train(self, X, y, params):
        t0 = time.time()
        estimators = [
            ("rf", RandomForestRegressor(n_estimators=100, max_depth=10, min_samples_leaf=4, random_state=42, n_jobs=-1)),
            ("gb", GradientBoostingRegressor(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)),
            ("mlp", MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=100, early_stopping=True, random_state=42))
        ]
        model = VotingRegressor(estimators)
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
