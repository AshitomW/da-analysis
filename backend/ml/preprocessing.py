import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, OneHotEncoder, LabelEncoder


def _numeric_like_ratio(series: pd.Series) -> float:
    values = series.dropna().astype(str).str.replace(",", "", regex=False).str.strip()
    if values.empty:
        return 0.0
    coerced = pd.to_numeric(values, errors="coerce")
    return float(coerced.notna().mean())


def _categorical_placeholder(column_name: str) -> str:
    lower = column_name.lower()
    if "policy" in lower:
        return "not_policy"
    if "patent" in lower:
        return "no_patent"
    if "publication" in lower or "venue" in lower:
        return "no_publication"
    if "organization" in lower or lower.endswith("org"):
        return "unknown_organization"
    if "dataset" in lower:
        return "unknown_dataset"
    if "country" in lower:
        return "unknown_country"
    if "region" in lower:
        return "unknown_region"
    return "unknown"


def prepare_data(
    df: pd.DataFrame,
    target_col: str,
    feature_cols: list[str],
    scale_method: str = "standard",
    encode_categories: bool = True,
    test_size: float = 0.2,
    random_state: int = 42,
):
    data = df[feature_cols + [target_col]].copy()

    if target_col not in data.columns:
        raise ValueError(f"Target column '{target_col}' not found")

    data[target_col] = pd.to_numeric(
        data[target_col].astype(str).str.replace(",", "", regex=False).str.strip(),
        errors="coerce",
    )
    data = data[data[target_col].notna()].copy()
    if len(data) < 10:
        raise ValueError(f"Only {len(data)} rows remain after target cleanup — need at least 10")

    X = data[feature_cols].copy()
    y = data[target_col].copy()

    cat_cols = []
    num_cols = []
    for c in feature_cols:
        if c not in X.columns:
            continue
        ratio = _numeric_like_ratio(X[c])
        if ratio >= 0.85:
            X[c] = pd.to_numeric(
                X[c].astype(str).str.replace(",", "", regex=False).str.strip(),
                errors="coerce",
            )
            num_cols.append(c)
        else:
            X[c] = X[c].replace(r"^\s*$", np.nan, regex=True)
            X[c] = X[c].fillna(_categorical_placeholder(c)).astype(str)
            cat_cols.append(c)

    for c in num_cols:
        if X[c].notna().any():
            X[c] = X[c].fillna(X[c].median())
        else:
            X[c] = X[c].fillna(0)

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
