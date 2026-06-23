from abc import ABC, abstractmethod
import numpy as np
import time


class BaseModel(ABC):
    name: str = ""
    description: str = ""
    category: str = "regression"

    @abstractmethod
    def train(self, X: np.ndarray, y: np.ndarray, params: dict) -> dict:
        pass

    @abstractmethod
    def predict(self, model, X: np.ndarray) -> np.ndarray:
        pass

    def get_default_params(self) -> dict:
        return {}

    @property
    def supported_targets(self) -> list[str]:
        return ["regression"]
