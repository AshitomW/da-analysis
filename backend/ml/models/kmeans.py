from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, mean_squared_error, mean_absolute_error, r2_score
import numpy as np
import time
from ml.base import BaseModel
from ml.registry import register


class KMeansRegressor:
    """
    A custom clustering-based regression model using KMeans.
    Segments the feature space into K clusters and predicts the average target value of each cluster.
    """
    def __init__(self, **kwargs):
        self.kmeans = KMeans(**kwargs)
        self.cluster_means_ = {}
        self.global_mean_ = 0.0

    def fit(self, X, y):
        self.kmeans.fit(X)
        self.global_mean_ = float(np.mean(y))
        labels = self.kmeans.labels_
        # Map each cluster label to the mean target value of training samples in that cluster
        self.cluster_means_ = {}
        for label in np.unique(labels):
            mask = (labels == label)
            self.cluster_means_[int(label)] = float(np.mean(y[mask]))
        return self

    def predict(self, X):
        labels = self.kmeans.predict(X)
        preds = np.array([self.cluster_means_.get(int(l), self.global_mean_) for l in labels])
        return preds


@register
class KMeansModel(BaseModel):
    name = "K-Means Clustering"
    description = "Clustering-based regression: segments data into K clusters and predicts the average target value of each cluster"
    category = "clustering"

    def get_default_params(self):
        return {"n_clusters": 5, "random_state": 42, "n_init": 10}

    def train(self, X, y, params):
        t0 = time.time()
        km_params = {
            "n_clusters": int(params.get("n_clusters", 5)),
            "random_state": int(params.get("random_state", 42)),
            "n_init": int(params.get("n_init", 10))
        }
        model = KMeansRegressor(**km_params)
        model.fit(X, y)
        t = time.time() - t0
        
        preds = model.predict(X)
        labels = model.kmeans.labels_
        
        metrics = {
            "inertia": float(model.kmeans.inertia_),
            "rmse": float(np.sqrt(mean_squared_error(y, preds))),
            "mse": float(mean_squared_error(y, preds)),
            "mae": float(mean_absolute_error(y, preds)),
            "r2": float(r2_score(y, preds)),
            "training_time": round(t, 3)
        }
        
        if len(np.unique(labels)) > 1 and X.shape[0] > 10:
            metrics["silhouette"] = float(silhouette_score(X, labels))
            
        return {
            "model": model,
            "metrics": metrics,
            "labels": labels.tolist(),
            "cluster_centers": model.kmeans.cluster_centers_.tolist(),
            "training_time": round(t, 3),
        }

    def predict(self, model, X):
        return model.predict(X)
