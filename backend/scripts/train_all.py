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
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from scipy.stats import chi2_contingency

from state import state


# ── prediction targets calculations ──────────────────────────────────

def _percentile_component(df, col, log=False):
    if col not in df.columns:
        return pd.Series(0.5, index=df.index)
    values = pd.to_numeric(df[col], errors="coerce")
    if log:
        values = np.log1p(values.clip(lower=0))
    if values.notna().sum() < 2:
        return pd.Series(0.5, index=df.index)
    ranked = values.rank(pct=True)
    return ranked.fillna(ranked.median()).clip(0, 1)


def _mapped_component(df, col, mapping, default=0.5):
    if col not in df.columns:
        return pd.Series(default, index=df.index)
    values = df[col].fillna("").astype(str).str.strip().str.lower()
    return values.map(mapping).fillna(default).clip(0, 1)


def add_prediction_targets(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    status_score = _mapped_component(df, "status", {
        "completed": 1.0,
        "granted": 0.95,
        "published": 0.85,
        "active": 0.82,
        "ongoing": 0.76,
        "under evaluation": 0.62,
        "proposed": 0.45,
        "preprint / arxiv": 0.38,
        "draft stage": 0.30,
        "amended": 0.70,
        "repealed": 0.18,
        "terminated early": 0.12,
        "abandoned": 0.08,
    })
    scale_score = _mapped_component(df, "deployment_scale", {
        "local / community": 0.25,
        "pilot / proof of concept": 0.38,
        "city-level": 0.52,
        "regional": 0.68,
        "national": 0.84,
        "global": 1.0,
    })
    collaboration_score = _mapped_component(df, "collaboration_type", {
        "multi-stakeholder consortium": 1.0,
        "public-private partnership (ppp)": 0.92,
        "academic-industry": 0.86,
        "academic-government": 0.82,
        "international bilateral": 0.78,
        "government": 0.74,
        "industry": 0.70,
        "academic": 0.64,
        "ngo / civil society": 0.58,
    })

    df["project_value_score"] = (
        100 * (
            0.35 * _percentile_component(df, "impact_score")
            + 0.25 * _percentile_component(df, "investment_roi")
            + 0.20 * _percentile_component(df, "innovation_index")
            + 0.20 * _percentile_component(df, "population_served", log=True)
        )
    ).round(2)

    df["resource_efficiency_score"] = (
        100 * (
            0.35 * _percentile_component(df, "co2_reduction_tons", log=True)
            + 0.30 * _percentile_component(df, "water_savings_liters", log=True)
            + 0.25 * _percentile_component(df, "energy_savings_kwh", log=True)
            + 0.10 * _percentile_component(df, "renewable_energy_share_pct")
        )
    ).round(2)

    df["deployment_readiness_score"] = (
        100 * (
            0.35 * status_score
            + 0.30 * scale_score
            + 0.20 * collaboration_score
            + 0.15 * _percentile_component(df, "policy_stringency_score")
        )
    ).round(2)

    return df


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
        df = add_prediction_targets(df)
        state._cleaned_df = df
        state.cleaning_pipeline = cleaning_config.get("cleaning", [])
        state.set_active_dataset("cleaned")
        print(f"  Cleaned: {len(df)} rows, {len(df.columns)} columns\n")
    else:
        df = state.get_dataset("original")
        df = add_prediction_targets(df)
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

# ── 2. Nexus Insights: Collaboration, Climate, Entry-type evolution ──

def run_nexus_insights(df):
    """Aggregate stats for Collaboration Type, Climate/Water stress, Entry Types, and Regional policies."""
    print("─" * 50)
    print("[2] Nexus Insights: Collaboration, Climate-smart, Entry-type evolution\n")
    
    col_perf = []
    if "collaboration_type" in df.columns:
        impact = pd.to_numeric(df["impact_score"], errors="coerce").fillna(df["impact_score"].median() if "impact_score" in df.columns else 5.0)
        roi = pd.to_numeric(df["investment_roi"], errors="coerce").fillna(df["investment_roi"].median() if "investment_roi" in df.columns else 1.0)
        temp_df = df.copy()
        temp_df["impact_score"] = impact
        temp_df["investment_roi"] = roi
        
        grouped = temp_df.groupby("collaboration_type")
        for name, group in grouped:
            col_perf.append({
                "type": str(name),
                "avg_impact": round(float(group["impact_score"].mean()), 2),
                "avg_roi": round(float(group["investment_roi"].mean()), 2),
                "count": int(len(group))
            })
            
    climate_deploy = []
    if "water_stress_level" in df.columns and "ai_technique" in df.columns:
        top_techs = df["ai_technique"].value_counts().head(6).index.tolist()
        stress_levels = ["Low", "Low-Medium", "Medium-High", "High", "Extremely High"]
        valid_stress = [l for l in stress_levels if l in df["water_stress_level"].unique()]
        
        for lvl in valid_stress:
            lvl_df = df[df["water_stress_level"] == lvl]
            counts = {"stress_level": lvl}
            for tech in top_techs:
                cnt = int(sum(lvl_df["ai_technique"] == tech))
                counts[tech] = cnt
            climate_deploy.append(counts)
            
    entry_evo = []
    if "year" in df.columns and "entry_type" in df.columns:
        years = sorted(df["year"].dropna().unique().tolist())
        entry_types = ["Publication", "Project", "Patent", "Policy"]
        for yr in years:
            yr_df = df[df["year"] == yr]
            counts = {"year": int(yr)}
            for et in entry_types:
                cnt = int(sum(yr_df["entry_type"] == et))
                counts[et] = cnt
            entry_evo.append(counts)
            
    regional_insights = []
    if "region" in df.columns:
        temp_df = df.copy()
        if "policy_stringency_score" in temp_df.columns:
            temp_df["policy_stringency_score"] = pd.to_numeric(temp_df["policy_stringency_score"], errors="coerce").fillna(0.0)
        else:
            temp_df["policy_stringency_score"] = 0.0
            
        if "open_access" in temp_df.columns:
            temp_df["is_open_access"] = temp_df["open_access"].fillna("No").astype(str).str.strip().str.lower().isin(["yes", "green oa", "gold oa"])
        else:
            temp_df["is_open_access"] = False
            
        grouped = temp_df.groupby("region")
        for name, group in grouped:
            oa_rate = float(group["is_open_access"].mean()) if len(group) > 0 else 0.0
            regional_insights.append({
                "region": str(name),
                "avg_policy_stringency": round(float(group["policy_stringency_score"].mean()), 2),
                "open_access_rate": round(oa_rate * 100, 2),
                "count": int(len(group))
            })
            
    resource_savings = []
    if "ai_technique" in df.columns:
        temp_df = df.copy()
        if "co2_reduction_tons" in temp_df.columns:
            temp_df["co2_reduction_tons"] = pd.to_numeric(temp_df["co2_reduction_tons"], errors="coerce").fillna(0.0)
        else:
            temp_df["co2_reduction_tons"] = 0.0
            
        if "water_savings_liters" in temp_df.columns:
            temp_df["water_savings_liters"] = pd.to_numeric(temp_df["water_savings_liters"], errors="coerce").fillna(0.0)
        else:
            temp_df["water_savings_liters"] = 0.0
            
        if "energy_savings_kwh" in temp_df.columns:
            temp_df["energy_savings_kwh"] = pd.to_numeric(temp_df["energy_savings_kwh"], errors="coerce").fillna(0.0)
        else:
            temp_df["energy_savings_kwh"] = 0.0
            
        grouped = temp_df.groupby("ai_technique")
        for name, group in grouped:
            resource_savings.append({
                "technique": str(name),
                "avg_co2_reduction": round(float(group["co2_reduction_tons"].mean()), 2),
                "avg_water_savings": round(float(group["water_savings_liters"].mean()), 2),
                "avg_energy_savings": round(float(group["energy_savings_kwh"].mean()), 2),
                "count": int(len(group))
            })
        resource_savings.sort(key=lambda x: x["count"], reverse=True)
            
    summary = {
        "collaboration_impact": col_perf,
        "climate_deployments": climate_deploy,
        "entry_type_evolution": entry_evo,
        "regional_policy_openness": regional_insights,
        "resource_savings_by_tech": resource_savings
    }
    
    rid = _save("nexus_insights", summary)
    print(f"  Saved Nexus Insights → {rid}\n")
    return summary


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


# ── 4. SDG Alignment Analysis ────────────────────────────────────────

def run_sdg_analysis(df):
    """Analyze SDG alignment distribution, co-occurrences, intersect coordinates, and synergy scores."""
    print("─" * 50)
    print("[4] SDG Alignment & Portfolio Focus Analysis\n")

    if "sdg_alignment" not in df.columns:
        print("  No sdg_alignment column — skipping\n")
        return None

    # Clean SDG labels
    df = df.copy()
    df["sdg_alignment"] = df["sdg_alignment"].fillna("Unknown").astype(str).str.strip()

    import re as _re
    # Extract primary SDG
    df["primary_sdg"] = df["sdg_alignment"].apply(lambda v: _re.search(r"SDG\s*\d+", v).group(0) if _re.search(r"SDG\s*\d+", v) else "Other")
    
    # SDG co-occurrence Jaccard matrix
    sdg_lists = df["sdg_alignment"].apply(lambda val: _re.findall(r"SDG\s*\d+", val))
    unique_sdgs = sorted(list(set([sdg for lst in sdg_lists for sdg in lst if sdg != "Unknown"])))
    
    sdg_cooccurrence = []
    for sdg1 in unique_sdgs:
        for sdg2 in unique_sdgs:
            if sdg1 >= sdg2:
                continue
            entries_with_sdg1 = set(df.index[sdg_lists.apply(lambda x: sdg1 in x)])
            entries_with_sdg2 = set(df.index[sdg_lists.apply(lambda x: sdg2 in x)])
            overlap = len(entries_with_sdg1 & entries_with_sdg2)
            if overlap > 0:
                total = len(entries_with_sdg1 | entries_with_sdg2)
                sdg_cooccurrence.append({
                    "pair": f"{sdg1} + {sdg2}",
                    "sdg1": sdg1,
                    "sdg2": sdg2,
                    "count": overlap,
                    "jaccard": round(overlap / total, 4) if total > 0 else 0.0
                })
                
    # Technique Intersect Coordinates
    coords = []
    if "ai_technique" in df.columns:
        top_techs = df["ai_technique"].value_counts().head(15).index.tolist()
        for tech in top_techs:
            tech_df = df[df["ai_technique"] == tech]
            total_tech = len(tech_df)
            if total_tech > 0:
                sdg6_cnt = sum(tech_df["sdg_alignment"].str.contains("SDG 6", regex=False))
                sdg7_cnt = sum(tech_df["sdg_alignment"].str.contains("SDG 7", regex=False))
                coords.append({
                    "technique": str(tech),
                    "sdg6_share": round(sdg6_cnt / total_tech, 4),
                    "sdg7_share": round(sdg7_cnt / total_tech, 4)
                })
                
    # SDG Outcomes averages
    sdg_outcomes = []
    exploded = df.assign(
        sdg=sdg_lists.apply(lambda values: values if values else ["Other"])
    ).explode("sdg").reset_index(drop=True)
    exploded = exploded[exploded["sdg"] != "Unknown"].copy()
    
    numeric_metrics = {
        "project_value_score": "avg_project_value_score",
        "resource_efficiency_score": "avg_resource_efficiency_score",
        "funding_usd": "avg_funding",
        "co2_reduction_tons": "avg_co2_reduction",
        "impact_score": "avg_impact",
    }
    
    for sdg, group in exploded.groupby("sdg"):
        outcome = {
            "sdg": str(sdg),
            "entries": int(len(group)),
        }
        for col, key in numeric_metrics.items():
            if col in group.columns:
                vals = pd.to_numeric(group[col], errors="coerce")
                if col == "funding_usd":
                    outcome[key] = round(float(vals.mean() / 1e6), 2) if vals.notna().any() else 0.0
                else:
                    outcome[key] = round(float(vals.mean()), 2) if vals.notna().any() else 0.0
            else:
                outcome[key] = 0.0
        sdg_outcomes.append(outcome)
    sdg_outcomes.sort(key=lambda r: r["entries"], reverse=True)
    
    # SDG Synergy statistics
    synergy_data = []
    df["num_sdgs"] = sdg_lists.apply(len)
    single_sdg = df[df["num_sdgs"] == 1]
    multi_sdg = df[df["num_sdgs"] > 1]
    
    for label, group in [("Single Goal", single_sdg), ("Multi-Goal (Synergy)", multi_sdg)]:
        if len(group) > 0:
            avg_impact = float(group["impact_score"].mean()) if "impact_score" in group.columns else 0.0
            avg_eff = float(group["resource_efficiency_score"].mean()) if "resource_efficiency_score" in group.columns else 0.0
            synergy_data.append({
                "group": label,
                "avg_impact": round(avg_impact, 2),
                "avg_resource_efficiency": round(avg_eff, 2),
                "count": int(len(group))
            })
            
    technique_sdg_heatmap = []
    if "ai_technique" in exploded.columns:
        ct_raw = pd.crosstab(exploded["ai_technique"], exploded["sdg"])
        ct_norm = ct_raw.div(ct_raw.sum(axis=1), axis=0).round(4)
        for tech in ct_norm.index:
            for sdg in ct_norm.columns:
                val = float(ct_norm.loc[tech, sdg])
                if val > 0.01:
                    technique_sdg_heatmap.append({
                        "technique": str(tech),
                        "sdg": str(sdg),
                        "share": val,
                        "count": int(ct_raw.loc[tech, sdg]),
                    })

    entry = {
        "method": "Jaccard Co-occurrence + Technique Intersect Mapping",
        "cooccurrences": sdg_cooccurrence,
        "intersect_coordinates": coords,
        "sdg_outcomes": sdg_outcomes,
        "synergy": synergy_data,
        "technique_sdg_heatmap": technique_sdg_heatmap,
        "unique_sdgs": unique_sdgs
    }

    rid = _save("sdg_analysis", entry)
    print(f"  Saved SDG Analysis → {rid}\n")
    return entry


# ── main ─────────────────────────────────────────────────────────────

def main():
    total_start = time_module.time()

    df = _prepare_df()
    print(f"Dataset: {len(df)} rows × {len(df.columns)} columns\n")

    run_time_series(df)
    run_nexus_insights(df)
    # NLP needs text columns that cleaning drops — use original
    run_nlp(state.get_dataset("original"))
    run_sdg_analysis(df)

    elapsed = time_module.time() - total_start
    print(f"Done in {elapsed:.1f}s — results saved to backend/data/results/saved_results.json")


if __name__ == "__main__":
    main()
