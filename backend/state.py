import os
import json
from pathlib import Path
from typing import Optional
from datetime import datetime
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
RESULTS_DIR = BASE_DIR / "data" / "results"
SNAPSHOTS_DIR = BASE_DIR / "data" / "snapshots"
DEFAULT_CANDIDATES = [
    BASE_DIR / "AI_Water_Energy_Nexus_Dataset_2016_2026.csv",
    Path(os.getcwd()) / "AI_Water_Energy_Nexus_Dataset_2016_2026.csv",
]


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


class AppState:
    def __init__(self):
        self._original_df: Optional[pd.DataFrame] = None
        self._cleaned_df: Optional[pd.DataFrame] = None
        self._extended_df: Optional[pd.DataFrame] = None
        self.active_dataset: str = "original"
        self.current_path: Optional[Path] = None
        self.cleaning_pipeline: list[dict] = []
        self.saved_results: list[dict] = []
        self._comparison_id_counter: int = 0
        self.snapshots: dict[str, list[dict]] = {"cleaned": [], "extended": []}
        self._load_default()
        self._load_saved_results()
        self._load_snapshots()

    def _load_default(self):
        path = None
        for candidate in DEFAULT_CANDIDATES:
            if candidate.exists():
                path = candidate
                break
        if path is None:
            raise FileNotFoundError(
                f"Default CSV not found. Tried: {[str(p) for p in DEFAULT_CANDIDATES]}"
            )
        df = pd.read_csv(path, low_memory=False)
        cols = [c.strip() for c in df.columns]
        df.columns = cols
        for c in df.select_dtypes(include="object").columns:
            df[c] = df[c].astype(str).str.strip()
        self._original_df = df
        self._cleaned_df = df.copy()
        self._extended_df = df.copy()
        self.current_path = path

    def get_dataset(self, name: Optional[str] = None) -> pd.DataFrame:
        name = name or self.active_dataset
        if name == "original":
            return self._original_df
        elif name == "cleaned":
            if self._cleaned_df is not None:
                return self._cleaned_df
            return self._original_df
        elif name == "extended":
            if self._extended_df is not None:
                return self._extended_df
            return self._original_df
        return self._original_df

    def set_active_dataset(self, name: str):
        if name in ("original", "cleaned", "extended"):
            self.active_dataset = name
            return True
        return False

    # ── Cleaning ──────────────────────────────────────────

    def auto_clean(self) -> pd.DataFrame:
        df = self._original_df.copy()
        
        # 1. First fix categorical placeholders for sparse domain columns before any numerical imputation
        domain_sparse_cols = {
            "policy_type": "not_policy",
            "policy_level": "not_policy",
            "policy_stringency_score": "not_policy",
            "patent_class": "no_patent",
            "patent_family_size": "no_patent",
            "publication_venue": "no_publication",
            "open_access": "no_publication",
        }
        for col, placeholder in domain_sparse_cols.items():
            if col in df.columns:
                df[col] = df[col].replace(r"^\s*$", pd.NA, regex=True)
                df[col] = df[col].fillna(placeholder)

        # 2. Add missingness indicators
        if "investment_roi" in df.columns:
            df["has_investment_roi"] = df["investment_roi"].notna().astype(int)
        if "population_served" in df.columns:
            df["serves_population"] = df["population_served"].notna().astype(int)
        savings_cols = ["co2_reduction_tons", "water_savings_liters", "energy_savings_kwh"]
        existing_savings = [c for c in savings_cols if c in df.columns]
        if existing_savings:
            df["has_savings"] = df[existing_savings].notna().any(axis=1).astype(int)

        drop_cols = ['entry_id', 'title', 'abstract_summary', 'keywords']
        df = df.drop(columns=[c for c in drop_cols if c in df.columns])
        
        for c in df.select_dtypes(include="number").columns:
            df[c] = df[c].fillna(df[c].median())
            
        for c in df.select_dtypes(exclude="number").columns:
            placeholder = _categorical_placeholder(c)
            df[c] = df[c].replace(r"^\s*$", pd.NA, regex=True)
            if c in domain_sparse_cols:
                continue
            else:
                df[c] = df[c].fillna(df[c].mode().iloc[0] if not df[c].mode().empty else placeholder)
                
        num_cols = df.select_dtypes(include="number").columns
        for c in num_cols:
            q1, q3 = df[c].quantile(0.25), df[c].quantile(0.75)
            iqr = q3 - q1
            df = df[(df[c] >= q1 - 1.5 * iqr) & (df[c] <= q3 + 1.5 * iqr)]
            
        self._cleaned_df = df
        self.cleaning_pipeline = [{"operation": "auto_clean"}]
        return df

    def apply_cleaning(self, steps: list[dict]) -> pd.DataFrame:
        df = self._original_df.copy()
        for step in steps:
            op = step.get("operation")
            col = step.get("column")
            value = step.get("value")
            if op == "drop_na_rows":
                df = df.dropna(subset=[col] if col else None)
            elif op == "drop_na_cols":
                df = df.dropna(axis=1, how="all")
            elif op == "fill_na_mean":
                if col and col in df.select_dtypes(include="number").columns:
                    df[col] = df[col].fillna(df[col].mean())
            elif op == "fill_na_median":
                if col and col in df.select_dtypes(include="number").columns:
                    df[col] = df[col].fillna(df[col].median())
            elif op == "fill_na_mode":
                if col:
                    df[col] = df[col].fillna(df[col].mode().iloc[0] if not df[col].mode().empty else "")
            elif op == "fill_na_constant":
                if col:
                    df[col] = df[col].fillna(value) if value else df[col]
            elif op == "fill_na_ffill":
                if col:
                    df[col] = df[col].ffill()
            elif op == "fill_na_bfill":
                if col:
                    df[col] = df[col].bfill()
            elif op == "interpolate":
                if col and col in df.select_dtypes(include="number").columns:
                    df[col] = df[col].interpolate()
            elif op == "remove_outliers_zscore":
                if col and col in df.select_dtypes(include="number").columns:
                    threshold = float(value or 3)
                    z = (df[col] - df[col].mean()) / df[col].std()
                    df = df[z.abs() < threshold]
            elif op == "remove_outliers_iqr":
                if col and col in df.select_dtypes(include="number").columns:
                    factor = float(value or 1.5)
                    Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
                    iqr = Q3 - Q1
                    df = df[(df[col] >= Q1 - factor * iqr) & (df[col] <= Q3 + factor * iqr)]
            elif op == "remove_duplicates":
                df = df.drop_duplicates(subset=[col] if col else None)
            elif op == "strip_whitespace":
                if col:
                    df[col] = df[col].astype(str).str.strip()
            elif op == "lowercase":
                if col:
                    df[col] = df[col].astype(str).str.lower()
            elif op == "to_numeric":
                if col:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            elif op == "to_datetime":
                if col:
                    df[col] = pd.to_datetime(df[col], errors="coerce")
            elif op == "drop_column":
                if col and col in df.columns:
                    df = df.drop(columns=[col])
            elif op == "rename_column":
                if col and value:
                    df = df.rename(columns={col: value})
            elif op == "filter_rows":
                if col and value:
                    try:
                        df = df.query(value)
                    except Exception:
                        pass
        self._cleaned_df = df
        self.cleaning_pipeline = steps
        return df

    # ── Extend (synthetic data) ───────────────────────────

    def extend_data(self, new_rows: pd.DataFrame) -> pd.DataFrame:
        self._extended_df = pd.concat([self._original_df, new_rows], ignore_index=True)
        return self._extended_df

    # ── Snapshots ─────────────────────────────────────────

    def take_snapshot(self, dataset: str, label: str = "") -> dict:
        if dataset not in ("cleaned", "extended"):
            return {"error": "Can only snapshot 'cleaned' or 'extended'"}
        df = self._cleaned_df if dataset == "cleaned" else self._extended_df
        if df is None:
            return {"error": f"No data for '{dataset}'"}
        snapshot = {
            "id": f"SNAP-{dataset}-{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}",
            "dataset": dataset,
            "label": label or f"{dataset} snapshot",
            "timestamp": pd.Timestamp.now().isoformat(),
            "rows": len(df),
            "cols": len(df.columns),
        }
        # Persist the actual data
        SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        snap_path = SNAPSHOTS_DIR / f"{snapshot['id']}.parquet"
        df.to_parquet(snap_path)
        snapshot["path"] = str(snap_path)
        self.snapshots[dataset].append(snapshot)
        self._persist_snapshots()
        return snapshot

    def restore_snapshot(self, snapshot_id: str) -> bool:
        for dataset, snaps in self.snapshots.items():
            for snap in snaps:
                if snap["id"] == snapshot_id:
                    path = Path(snap["path"])
                    if not path.exists():
                        return False
                    df = pd.read_parquet(path)
                    if dataset == "cleaned":
                        self._cleaned_df = df
                    elif dataset == "extended":
                        self._extended_df = df
                    return True
        return False

    def list_snapshots(self, dataset: str | None = None) -> list[dict]:
        if dataset:
            return self.snapshots.get(dataset, [])
        all_snaps = []
        for snaps in self.snapshots.values():
            all_snaps.extend(snaps)
        return all_snaps

    def _persist_snapshots(self):
        meta = {}
        for ds, snaps in self.snapshots.items():
            meta[ds] = [
                {k: v for k, v in s.items() if k != "path"}
                for s in snaps
            ]
        path = SNAPSHOTS_DIR / "snapshots_index.json"
        with open(path, "w") as f:
            json.dump(meta, f, indent=2, default=str)

    def _load_snapshots(self):
        path = SNAPSHOTS_DIR / "snapshots_index.json"
        if path.exists():
            try:
                with open(path) as f:
                    meta = json.load(f)
                for ds, snaps in meta.items():
                    # reconstruct with paths
                    full_snaps = []
                    for s in snaps:
                        sid = s["id"]
                        snap_path = SNAPSHOTS_DIR / f"{sid}.parquet"
                        if snap_path.exists():
                            s["path"] = str(snap_path)
                            full_snaps.append(s)
                    if ds in self.snapshots:
                        self.snapshots[ds] = full_snaps
            except Exception:
                self.snapshots = {"cleaned": [], "extended": []}

    @property
    def original_df(self) -> pd.DataFrame:
        return self._original_df

    @property
    def cleaned_df(self) -> pd.DataFrame:
        return self._cleaned_df if self._cleaned_df is not None else self._original_df

    @property
    def extended_df(self) -> pd.DataFrame:
        return self._extended_df if self._extended_df is not None else self._original_df

    # ── Results storage (ML / NN) ──────────────────────────

    def save_result(self, result: dict) -> dict:
        self._comparison_id_counter += 1
        entry = {
            "id": f"RES-{self._comparison_id_counter:05d}",
            "timestamp": datetime.now().isoformat(),
            "dataset": self.active_dataset,
            **result,
        }
        self.saved_results.append(entry)
        self._persist_results()
        return entry

    def delete_result(self, result_id: str):
        self.saved_results = [r for r in self.saved_results if r.get("id") != result_id]
        self._persist_results()

    def get_result(self, result_id: str) -> Optional[dict]:
        for r in self.saved_results:
            if r.get("id") == result_id:
                return r
        return None

    def _persist_results(self):
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        path = RESULTS_DIR / "saved_results.json"
        with open(path, "w") as f:
            json.dump(self.saved_results, f, indent=2, default=str)

    def _load_saved_results(self):
        path = RESULTS_DIR / "saved_results.json"
        if path.exists():
            try:
                with open(path) as f:
                    self.saved_results = json.load(f)
                ids = [r.get("id") for r in self.saved_results if r.get("id", "").startswith("RES-")]
                if ids:
                    nums = [int(i.split("-")[1]) for i in ids]
                    self._comparison_id_counter = max(nums)
            except Exception:
                self.saved_results = []


state = AppState()
