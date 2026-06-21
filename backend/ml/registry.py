from typing import Type
from ml.base import BaseModel

_registry: dict[str, Type[BaseModel]] = {}


def register(cls):
    _registry[cls.name] = cls
    return cls


def get(name: str) -> Type[BaseModel]:
    if name not in _registry:
        raise KeyError(f"Model '{name}' not found. Available: {list(_registry.keys())}")
    return _registry[name]


def list_all() -> list[dict]:
    return [
        {
            "name": cls.name,
            "description": cls.description,
            "category": cls.category,
            "default_params": cls().get_default_params(),
        }
        for cls in _registry.values()
    ]


def count() -> int:
    return len(_registry)
