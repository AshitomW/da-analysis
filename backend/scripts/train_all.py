"""
Domain-specific analyses:
  1. Time-Series — AI technique adoption rate over a decade
  2. Regression  — Predict funding / impact from sector & technique
  3. NLP         — Topic modeling on title + abstract
  4. SDG         — Correlation between techniques and SDG alignment

Usage:
    python backend/scripts/train_all.py
"""

import sys
import os
import json
import time as time_module
from collections import Counter

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from scipy.stats import chi2_contingency

from state import state


# ── helpers ──────────────────────────────────────────────────────────

def _load_cleaning_config():
    path = os.path.join(backend_dir, "cleaning_config.yaml")
    if os.path.exists(path):
        import yaml
        with open(path) as f:
            return yaml.safe_load(f)
    return None


def _apply_clean_pipeline(df, cleaning_config):
    from scripts.clean import apply_cleaning
    return apply_cleaning(df, cleaning_config)


def _prepare_df():
    cleaning_config = _load_cleaning_config()
    if cleaning_config:
        print("Applying cleaning pipeline from cleaning_config.yaml...")
        source_dataset = cleaning_config.get("dataset", "original")
        df = state.get_dataset(source_dataset)
        df = _apply_clean_pipeline(df, cleaning_config)
        state._cleaned_df = df
        state.cleaning_pipeline = cleaning_config.get("cleaning", [])
        state.set_active_dataset("cleaned")
        print(f"  Cleaned: {len(df)} rows, {len(df.columns)} columns\n")
    else:
        df = state.get_dataset("original")
    return df


def _save(run_type, data):
    entry = {
        "run_type": run_type,
        "timestamp": time_module.strftime("%Y-%m-%dT%H:%M:%S"),
        **data,
    }
    saved = state.save_result(entry)
    return saved["id"]


# ── 1. Time-Series: AI technique adoption rate ──────────────────────

def run_time_series(df):
    """Count projects/publications per AI technique per year."""
    print("─" * 50)
    print("[1] Time-Series: AI technique adoption rate (2016–2026)\n")

    technique_year = df.groupby(["year", "ai_technique"]).size().reset_index(name="count")
    technique_year = technique_year.sort_values(["year", "count"], ascending=[True, False])

    # Per-year totals for share calculation
    yearly_totals = technique_year.groupby("year")["count"].sum()

    results = []
    for _, row in technique_year.iterrows():
        yr = int(row["year"])
        share = row["count"] / yearly_totals[yr]
        results.append({
            "year": yr,
            "ai_technique": row["ai_technique"],
            "count": int(row["count"]),
            "share": round(float(share), 4),
        })

    # Top techniques overall
    top5 = (
        technique_year.groupby("ai_technique")["count"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
        .index.tolist()
    )

    summary = {
        "total_rows": len(results),
        "years_covered": sorted(technique_year["year"].unique().tolist()),
        "unique_techniques": int(technique_year["ai_technique"].nunique()),
        "top_5_techniques": top5,
        "data": results,
    }

    rid = _save("time_series", summary)
    print(f"  {len(results)} year–technique pairs recorded")
    print(f"  Top techniques: {', '.join(top5)}")
    print(f"  Saved → {rid}\n")
    return summary


# ── 2. Regression: predict funding / impact ─────────────────────────

REGRESSION_TARGETS = {
    "funding_usd": "Predict project funding (USD) based on sector and AI technique",
    "impact_score": "Predict impact score based on sector and AI technique",
}

from sklearn.linear_model import LinearRegression, Ridge
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, VotingRegressor
from sklearn.neural_network import MLPRegressor
from xgboost import XGBRegressor
from sklearn.model_selection import GridSearchCV

SKLEARN_ESTIMATORS = {
    "Linear Regression": LinearRegression,
    "Ridge Regression": Ridge,
    "Decision Tree": DecisionTreeRegressor,
    "Random Forest": RandomForestRegressor,
    "Gradient Boosting": GradientBoostingRegressor,
    "XGBoost": XGBRegressor,
    "Neural Network": MLPRegressor,
}

def _load_models_config():
    path = os.path.join(backend_dir, "ml", "models_config.yaml")
    if os.path.exists(path):
        import yaml
        with open(path) as f:
            return yaml.safe_load(f)
    return None

def run_regression(df):
    """Train multiple models per target with scaled y and hyperparameter tuning."""
    print("─" * 50)
    print("[2] Regression: Predict funding & impact from sector / technique\n")

    models_config = _load_models_config()
    enabled_models = {}
    exclude_cols = set()

    if models_config:
        enabled_models = models_config.get("models", {})
        if "targets" in models_config and "exclude" in models_config["targets"]:
            exclude_cols = set(models_config["targets"]["exclude"])
    
    all_results = []

    for target_col, description in REGRESSION_TARGETS.items():
        print(f"  Target: {target_col} — {description}")

        if target_col not in df.columns:
            print(f"    Skipping — column not found\n")
            continue

        # Exclude targets and configuration-specified noise columns
        exclude = set(exclude_cols)
        exclude.add(target_col)
        if target_col == "funding_usd":
            exclude.add("impact_score")
        elif target_col == "impact_score":
            exclude.discard("funding_usd")

        feature_cols = [c for c in df.columns if c not in exclude]

        data = df[feature_cols + [target_col]].dropna().copy()
        if len(data) < 100:
            print(f"    Skipping — only {len(data)} rows after dropna\n")
            continue

        X = data[feature_cols].copy()
        y = data[target_col].values.astype(float)
        if target_col == "funding_usd":
            y = y / 1e6  # Scale target to Millions of USD
        y_mean, y_std = float(y.mean()), float(y.std())

        # Classify features dynamically
        num_cols = []
        cat_cols = []
        for c in feature_cols:
            if pd.api.types.is_numeric_dtype(X[c]):
                num_cols.append(c)
            else:
                cat_cols.append(c)

        for c in num_cols:
            X[c] = X[c].fillna(X[c].median())
        for c in cat_cols:
            X[c] = X[c].fillna("unknown").astype(str)

        enc = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        encoded = enc.fit_transform(X[cat_cols])
        enc_cols = [f"{c}_{v}" for c, vs in zip(cat_cols, enc.categories_) for v in vs]
        X_enc = pd.DataFrame(encoded, columns=enc_cols, index=X.index)
        X_feat = pd.concat([X[num_cols], X_enc], axis=1)

        if num_cols:
            scaler = StandardScaler()
            X_feat[num_cols] = scaler.fit_transform(X_feat[num_cols])

        X_train, X_test, y_train, y_test = train_test_split(
            X_feat.values, y, test_size=0.2, random_state=42
        )

        best_estimators = {}

        for mname, mconfig in enabled_models.items():
            if not mconfig.get("enabled", True):
                continue
            if mname == "Ensemble (Voting)" or mname == "K-Means Clustering":
                continue

            est_class = SKLEARN_ESTIMATORS.get(mname)
            if not est_class:
                print(f"    Skipping {mname} — estimator class not found")
                continue

            try:
                t0 = time_module.time()
                params = mconfig.get("params", {})
                tuning_grid = mconfig.get("tuning_grid", None)

                # Ensure parameters have the correct types
                if "max_depth" in params and params["max_depth"] is not None:
                    params["max_depth"] = int(params["max_depth"])
                if "n_estimators" in params:
                    params["n_estimators"] = int(params["n_estimators"])
                if "learning_rate" in params:
                    params["learning_rate"] = float(params["learning_rate"])
                if "random_state" in params:
                    params["random_state"] = int(params["random_state"])

                if tuning_grid:
                    print(f"    Tuning {mname} using GridSearchCV...")
                    grid_search = GridSearchCV(
                        estimator=est_class(random_state=params.get("random_state", 42)) if "random_state" in est_class().get_params() else est_class(),
                        param_grid=tuning_grid,
                        cv=3,
                        scoring="r2",
                        n_jobs=-1
                    )
                    grid_search.fit(X_train, y_train)
                    model = grid_search.best_estimator_
                    best_params = grid_search.best_params_
                    print(f"      Best Parameters: {best_params}")
                else:
                    model = est_class(**params)
                    model.fit(X_train, y_train)
                    best_params = params

                elapsed = time_module.time() - t0
                best_estimators[mname] = model

                y_pred = model.predict(X_test)
                y_train_pred = model.predict(X_train)

                test_metrics = {
                    "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
                    "mse": float(mean_squared_error(y_test, y_pred)),
                    "mae": float(mean_absolute_error(y_test, y_pred)),
                    "r2": float(r2_score(y_test, y_pred)),
                    "rmse_pct": float(np.sqrt(mean_squared_error(y_test, y_pred)) / y_mean * 100) if y_mean != 0 else 0,
                    "mae_pct": float(mean_absolute_error(y_test, y_pred)) / y_mean * 100 if y_mean != 0 else 0,
                }
                train_metrics = {
                    "rmse": float(np.sqrt(mean_squared_error(y_train, y_train_pred))),
                    "mse": float(mean_squared_error(y_train, y_train_pred)),
                    "mae": float(mean_absolute_error(y_train, y_train_pred)),
                    "r2": float(r2_score(y_train, y_train_pred)),
                }

                entry = {
                    "model_name": mname,
                    "target_col": target_col,
                    "description": description,
                    "feature_cols": list(X_feat.columns),
                    "num_features": X_feat.shape[1],
                    "train_size": len(X_train),
                    "test_size": len(X_test),
                    "params": best_params,
                    "train_metrics": train_metrics,
                    "test_metrics": test_metrics,
                    "target_stats": {"mean": y_mean, "std": y_std},
                    "training_time": round(elapsed, 3),
                    "actual_vs_predicted": {
                        "actual": y_test.tolist(),
                        "predicted": y_pred.tolist(),
                    },
                }

                if hasattr(model, "feature_importances_"):
                    fi = list(zip(X_feat.columns, model.feature_importances_))
                    fi.sort(key=lambda x: -x[1])
                    entry["feature_importance"] = {
                        "names": [f[0] for f in fi[:30]],
                        "values": [float(f[1]) for f in fi[:30]],
                    }
                elif hasattr(model, "coef_"):
                    coefs = model.coef_.flatten() if len(model.coef_.shape) > 1 else model.coef_
                    ci = list(zip(X_feat.columns, np.abs(coefs)))
                    ci.sort(key=lambda x: -x[1])
                    entry["feature_importance"] = {
                        "names": [f[0] for f in ci[:30]],
                        "values": [float(f[1]) for f in ci[:30]],
                    }

                rid = _save("ml_model", entry)
                all_results.append(entry)

                r2 = test_metrics["r2"]
                rmse_pct = test_metrics.get("rmse_pct", 0)
                print(f"    {mname:20s}  R²={r2:.4f}  "
                      f"RMSE={test_metrics['rmse']:.1f} ({rmse_pct:.1f}% of mean)  "
                      f"({elapsed:.1f}s)")

            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"    ✗ {mname:20s}  failed — {e}")
                all_results.append({
                    "model_name": mname,
                    "target_col": target_col,
                    "error": str(e),
                })

        # Train Ensemble (Voting) if enabled
        voting_config = enabled_models.get("Ensemble (Voting)", {})
        if voting_config.get("enabled", True) and len(best_estimators) >= 2:
            print("  Training Ensemble (Voting) using tuned base estimators...")
            t0 = time_module.time()
            estimators_list = [(name, est) for name, est in best_estimators.items() 
                               if name in ["Random Forest", "Gradient Boosting", "XGBoost", "Neural Network"]]
            if len(estimators_list) >= 2:
                try:
                    voting_model = VotingRegressor(estimators_list)
                    voting_model.fit(X_train, y_train)
                    elapsed = time_module.time() - t0
                    
                    y_pred = voting_model.predict(X_test)
                    y_train_pred = voting_model.predict(X_train)

                    test_metrics = {
                        "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
                        "mse": float(mean_squared_error(y_test, y_pred)),
                        "mae": float(mean_absolute_error(y_test, y_pred)),
                        "r2": float(r2_score(y_test, y_pred)),
                        "rmse_pct": float(np.sqrt(mean_squared_error(y_test, y_pred)) / y_mean * 100) if y_mean != 0 else 0,
                        "mae_pct": float(mean_absolute_error(y_test, y_pred)) / y_mean * 100 if y_mean != 0 else 0,
                    }
                    train_metrics = {
                        "rmse": float(np.sqrt(mean_squared_error(y_train, y_train_pred))),
                        "mse": float(mean_squared_error(y_train, y_train_pred)),
                        "mae": float(mean_absolute_error(y_train, y_train_pred)),
                        "r2": float(r2_score(y_train, y_train_pred)),
                    }

                    entry = {
                        "model_name": "Ensemble (Voting)",
                        "target_col": target_col,
                        "description": description,
                        "feature_cols": list(X_feat.columns),
                        "num_features": X_feat.shape[1],
                        "train_size": len(X_train),
                        "test_size": len(X_test),
                        "params": {"estimators": [name for name, _ in estimators_list]},
                        "train_metrics": train_metrics,
                        "test_metrics": test_metrics,
                        "target_stats": {"mean": y_mean, "std": y_std},
                        "training_time": round(elapsed, 3),
                        "actual_vs_predicted": {
                            "actual": y_test.tolist(),
                            "predicted": y_pred.tolist(),
                        },
                    }
                    
                    # Estimate feature importances by averaging base estimators importances
                    importances = np.zeros(X_feat.shape[1])
                    count_fi = 0
                    for _, est in estimators_list:
                        if hasattr(est, "feature_importances_"):
                            importances += est.feature_importances_
                            count_fi += 1
                    if count_fi > 0:
                        importances /= count_fi
                        fi = list(zip(X_feat.columns, importances))
                        fi.sort(key=lambda x: -x[1])
                        entry["feature_importance"] = {
                            "names": [f[0] for f in fi[:30]],
                            "values": [float(f[1]) for f in fi[:30]],
                        }
                    
                    rid = _save("ml_model", entry)
                    all_results.append(entry)
                    r2 = test_metrics["r2"]
                    print(f"    Ensemble (Voting)    R²={r2:.4f}  RMSE={test_metrics['rmse']:.1f}  ({elapsed:.1f}s)")
                except Exception as e:
                    print(f"    ✗ Ensemble (Voting)  failed — {e}")

        # Train K-Means Clustering Regressor if enabled
        kmeans_config = enabled_models.get("K-Means Clustering", {})
        if kmeans_config.get("enabled", False):
            from ml.models.kmeans import KMeansRegressor
            print("  Training K-Means Clustering Regressor...")
            try:
                t0 = time_module.time()
                params = kmeans_config.get("params", {"n_clusters": 5})
                model = KMeansRegressor(
                    n_clusters=int(params.get("n_clusters", 5)),
                    random_state=int(params.get("random_state", 42)),
                    n_init=int(params.get("n_init", 10))
                )
                model.fit(X_train, y_train)
                elapsed = time_module.time() - t0
                
                y_pred = model.predict(X_test)
                y_train_pred = model.predict(X_train)

                test_metrics = {
                    "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
                    "mse": float(mean_squared_error(y_test, y_pred)),
                    "mae": float(mean_absolute_error(y_test, y_pred)),
                    "r2": float(r2_score(y_test, y_pred)),
                    "rmse_pct": float(np.sqrt(mean_squared_error(y_test, y_pred)) / y_mean * 100) if y_mean != 0 else 0,
                    "mae_pct": float(mean_absolute_error(y_test, y_pred)) / y_mean * 100 if y_mean != 0 else 0,
                }
                train_metrics = {
                    "rmse": float(np.sqrt(mean_squared_error(y_train, y_train_pred))),
                    "mse": float(mean_squared_error(y_train, y_train_pred)),
                    "mae": float(mean_absolute_error(y_train, y_train_pred)),
                    "r2": float(r2_score(y_train, y_train_pred)),
                }

                entry = {
                    "model_name": "K-Means Clustering",
                    "target_col": target_col,
                    "description": description,
                    "feature_cols": list(X_feat.columns),
                    "num_features": X_feat.shape[1],
                    "train_size": len(X_train),
                    "test_size": len(X_test),
                    "params": params,
                    "train_metrics": train_metrics,
                    "test_metrics": test_metrics,
                    "target_stats": {"mean": y_mean, "std": y_std},
                    "training_time": round(elapsed, 3),
                    "actual_vs_predicted": {
                        "actual": y_test.tolist(),
                        "predicted": y_pred.tolist(),
                    },
                }
                rid = _save("ml_model", entry)
                all_results.append(entry)
                r2 = test_metrics["r2"]
                print(f"    K-Means Clustering   R²={r2:.4f}  RMSE={test_metrics['rmse']:.1f}  ({elapsed:.1f}s)")
            except Exception as e:
                print(f"    ✗ K-Means Clustering failed — {e}")

        print()

    return all_results


# ── 3. NLP: Topic modeling ──────────────────────────────────────────

def _generate_cluster_description(top_terms, top_regions):
    terms_set = set(t.lower() for t in top_terms)
    primary_regions = ", ".join(list(top_regions.keys())[:2]) if top_regions else "international territories"
    
    if any(t in terms_set for t in ["benchmarking", "methods", "research", "limitations", "dataset", "directions"]):
        theme = "methodological frameworks, dataset benchmarking, and future research directions for nexus systems"
        title = "Methodology & Benchmarking"
    elif any(t in terms_set for t in ["pilot", "feasibility", "project", "solution", "demonstrates"]):
        theme = "practical feasibility studies, pilot project implementations, and field validation of AI solutions"
        title = "Pilot Deployments & Feasibility"
    elif any(t in terms_set for t in ["sensors", "monitoring", "realtime", "alerts", "quality", "control"]):
        theme = "IoT sensor networks, real-time environmental monitoring, and predictive water-energy quality alert systems"
        title = "Real-Time IoT Monitoring"
    elif any(t in terms_set for t in ["optimization", "battery", "grid", "solar", "wind", "renewable", "offshore"]):
        theme = "renewable energy grid integration, solar/wind power forecasting, and battery storage optimization"
        title = "Renewable Energy Optimization"
    elif any(t in terms_set for t in ["governance", "standards", "policy", "regulatory", "investment"]):
        theme = "regulatory standards, cross-border water-energy governance policies, and strategic clean tech investment frameworks"
        title = "Policy & Regulatory Frameworks"
    elif any(t in terms_set for t in ["savings", "scale", "conservation", "efficiency", "decarbonization"]):
        theme = "large-scale resource conservation, water-energy savings maximization, and decarbonization strategies"
        title = "Scale-Up & Resource Conservation"
    else:
        theme = "collaborative water-energy nexus modeling and technological deployment strategies"
        title = f"Nexus Innovation ({top_terms[0].title()})"
        
    description = (
        f"This cluster represents a core research and development hub focused on {theme}. "
        f"Key innovation patterns emphasize {', '.join(top_terms[:3])}. Projects in this group "
        f"see heavy deployment and academic-industry collaboration within {primary_regions}."
    )
    return title, description


def run_nlp(df):
    """Topic modeling on title + abstract_summary."""
    print("─" * 50)
    print("[3] NLP: Topic modeling on title & abstract\n")

    text_cols = ["title", "abstract_summary"]
    available = [c for c in text_cols if c in df.columns]
    if not available:
        print("  No text columns found — skipping\n")
        return None

    docs = df[available].fillna("").astype(str).agg(" ".join, axis=1)
    docs = docs.str.lower().str.replace(r"[^a-z0-9\s]", "", regex=True)
    # Remove very short / very long docs
    doc_lengths = docs.str.split().str.len()
    docs = docs[(doc_lengths >= 5) & (doc_lengths <= 500)]
    print(f"  {len(docs)} documents (after length filter)\n")

    if len(docs) < 50:
        print("  Too few documents — skipping\n")
        return None

    # TF-IDF
    t0 = time_module.time()
    vec = TfidfVectorizer(
        max_features=2000,
        min_df=5,
        max_df=0.85,
        stop_words="english",
        ngram_range=(1, 2),
    )
    X = vec.fit_transform(docs)
    print(f"  TF-IDF: {X.shape[0]} docs × {X.shape[1]} terms  ({time_module.time() - t0:.1f}s)")

    # LDA topic model
    n_topics = 8
    lda = LatentDirichletAllocation(n_components=n_topics, random_state=42, n_jobs=-1)
    lda.fit(X)
    terms = vec.get_feature_names_out()
    topic_terms = []
    for topic_idx, topic in enumerate(lda.components_):
        top_indices = topic.argsort()[:-11:-1]
        topic_words = [terms[i] for i in top_indices]
        topic_terms.append({
            "topic": topic_idx + 1,
            "top_10_terms": topic_words,
        })

    # Assign dominant topic per doc
    doc_topics = lda.transform(X).argmax(axis=1)
    topic_counts = Counter(doc_topics)
    topic_distribution = [
        {"topic": t + 1, "doc_count": int(topic_counts[t]),
         "share": round(float(topic_counts[t] / len(doc_topics)), 4)}
        for t in range(n_topics)
    ]

    # Also cluster with KMeans for geography-based clustering
    n_clusters = min(6, len(docs) // 50)
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    clusters = km.fit_predict(X.toarray())

    # Map clusters to regions
    cluster_regions = []
    X_dense = X.toarray()
    for c in range(n_clusters):
        mask = clusters == c
        cluster_docs = docs.iloc[mask]
        
        # Calculate mean TF-IDF vector for this cluster to find representative terms
        cluster_centroid = X_dense[mask].mean(axis=0)
        top_term_indices = cluster_centroid.argsort()[:-6:-1]
        top_cluster_terms = [terms[i] for i in top_term_indices]

        region_labels = df.loc[cluster_docs.index, "region"] if "region" in df.columns else None
        top_regions = (
            region_labels.value_counts().head(3).to_dict()
            if region_labels is not None
            else {}
        )

        title, description = _generate_cluster_description(top_cluster_terms, top_regions)

        cluster_regions.append({
            "cluster": int(c + 1),
            "cluster_name": title,
            "size": int(mask.sum()),
            "top_regions": top_regions,
            "top_terms": top_cluster_terms,
            "description": description,
        })

    entry = {
        "model_name": "LDA + KMeans",
        "n_topics": n_topics,
        "n_clusters": n_clusters,
        "n_documents": len(docs),
        "vocabulary_size": X.shape[1],
        "topics": topic_terms,
        "topic_distribution": topic_distribution,
        "cluster_geo_profile": cluster_regions,
    }

    rid = _save("nlp", entry)
    print(f"  {n_topics} topics extracted")
    for t in topic_terms:
        print(f"    Topic {t['topic']}: {', '.join(t['top_10_terms'][:5])}")
    print(f"  {n_clusters} regional clusters identified")
    print(f"  Saved → {rid}\n")
    return entry


# ── 4. SDG Alignment analysis ───────────────────────────────────────

def run_sdg_analysis(df):
    """Cross-tabulation between AI techniques / sectors and SDG alignment."""
    print("─" * 50)
    print("[4] SDG Alignment: technique ↔ SDG correlation\n")

    if "sdg_alignment" not in df.columns:
        print("  No sdg_alignment column — skipping\n")
        return None

    # Clean SDG labels
    df = df.copy()
    df["sdg_alignment"] = df["sdg_alignment"].fillna("Unknown").astype(str).str.strip()

    # Cross-tab: ai_technique x sdg_alignment
    results = {}
    for col, label in [("ai_technique", "AI Technique"), ("sector", "Sector")]:
        if col not in df.columns:
            continue

        ct = pd.crosstab(df[col], df["sdg_alignment"])
        chi2, p, dof, expected = chi2_contingency(ct.values)

        # Normalize to row percentages
        ct_pct = ct.div(ct.sum(axis=1), axis=0).round(4)

        # Top association per category
        top_per_category = {}
        for idx in ct_pct.index:
            vals = ct_pct.loc[idx].sort_values(ascending=False)
            top_per_category[str(idx)] = {
                "primary_sdg": vals.index[0],
                "primary_share": float(vals.iloc[0]),
                "top_3": [(str(k), float(v)) for k, v in vals.head(3).items()],
            }

        results[label] = {
            "chi2_statistic": round(float(chi2), 2),
            "p_value": float(p),
            "degrees_of_freedom": int(dof),
            "significant": bool(p < 0.05),
            "categories": top_per_category,
        }

        n_sig = sum(1 for v in top_per_category.values() if v["primary_share"] > 0.3)
        print(f"  {label} × SDG: χ²={results[label]['chi2_statistic']}, "
              f"p={results[label]['p_value']:.4f} "
              f"({'significant' if p < 0.05 else 'not significant'})")
        print(f"    {n_sig}/{len(top_per_category)} categories have a dominant SDG (>30%)\n")

    entry = {
        "method": "chi-square test of independence + row percentages",
        "results": results,
    }

    rid = _save("sdg_analysis", entry)
    print(f"  Saved → {rid}\n")
    return entry


# ── main ─────────────────────────────────────────────────────────────

def main():
    total_start = time_module.time()

    df = _prepare_df()
    print(f"Dataset: {len(df)} rows × {len(df.columns)} columns\n")

    run_time_series(df)
    run_regression(df)
    # NLP needs text columns that cleaning drops — use original
    run_nlp(state.get_dataset("original"))
    run_sdg_analysis(df)

    elapsed = time_module.time() - total_start
    print(f"Done in {elapsed:.1f}s — results saved to backend/data/results/saved_results.json")


if __name__ == "__main__":
    main()
