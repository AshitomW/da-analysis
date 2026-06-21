import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer


def prepare_data(
    df: pd.DataFrame,
    target_col: str,
    feature_cols: list[str],
    scale_method: str = "standard",
    encode_categories: bool = True,
    test_size: float = 0.2,
    random_state: int = 42,
):
    data = df[feature_cols + [target_col]].dropna().copy()
    if len(data) < 10:
        raise ValueError(f"Only {len(data)} rows after dropping NaN — need at least 10")

    X = data[feature_cols].copy()
    y = data[target_col].copy()

    cat_cols = X.select_dtypes(exclude="number").columns.tolist()
    num_cols = X.select_dtypes(include="number").columns.tolist()

    for c in cat_cols:
        X[c] = X[c].fillna("unknown").astype(str)
    for c in num_cols:
        X[c] = X[c].fillna(X[c].median())

    if encode_categories and cat_cols:
        enc = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        encoded = enc.fit_transform(X[cat_cols])
        enc_cols = [f"{c}_{v}" for c, vs in zip(cat_cols, enc.categories_) for v in vs]
        X_encoded = pd.DataFrame(encoded, columns=enc_cols, index=X.index)
        X = pd.concat([X[num_cols], X_encoded], axis=1)
    elif cat_cols:
        for c in cat_cols:
            le = LabelEncoder()
            X[c] = le.fit_transform(X[c])

    if scale_method == "standard":
        scaler = StandardScaler()
    elif scale_method == "minmax":
        scaler = MinMaxScaler()
    elif scale_method == "robust":
        scaler = RobustScaler()
    else:
        scaler = None

    if scaler and len(num_cols) > 0:
        X[num_cols] = scaler.fit_transform(X[num_cols])

    X_train, X_test, y_train, y_test = train_test_split(
        X.values, y.values, test_size=test_size, random_state=random_state
    )

    return {
        "X_train": X_train,
        "X_test": X_test,
        "y_train": y_train,
        "y_test": y_test,
        "feature_names": list(X.columns),
        "num_features": X.shape[1],
        "train_size": len(X_train),
        "test_size": len(X_test),
    }
