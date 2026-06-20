"""
train_model.py
==============

Trains Model A — Adaptive Compute Boundary (ACB) prediction.

The Adaptive Compute Boundary (ACB) decides how many of the 10 data-centre
floors should be allocated to real-time workloads versus scheduled batch
workloads:

    Floors 1 .. target_acb_floor          -> real-time zone
    Floors target_acb_floor + 1 .. 10     -> scheduled batch zone

This is a supervised **multi-class classification** problem where the target
column `target_acb_floor` is bounded to the range [2, 8].

Pipeline summary
----------------
1. Load the main dataset.
2. Split by `period_label` -> train/test on PAST rows only (chronological
   80/20 split sorted by timestamp). PRESENT and FUTURE rows are kept aside
   for prediction/demo.
3. Drop leakage columns, timestamp and period_label.
4. Build a scikit-learn Pipeline + ColumnTransformer
   (OneHotEncode categoricals, passthrough numerics).
5. Train and compare DecisionTree, RandomForest, GradientBoosting.
6. Evaluate each model (accuracy, MAE, within +/-1 floor, classification
   report, confusion matrix).
7. Select the best model and save it together with its feature list to
   models/acb_model.pkl.

Run from the project root:
    python src/train_model.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    mean_absolute_error,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier

# ---------------------------------------------------------------------------
# Project paths (script works when run from the project root)
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "model_a_adaptive_workload_boundary_dataset.csv"
MODEL_DIR = PROJECT_ROOT / "models"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
MODEL_PATH = MODEL_DIR / "acb_model.pkl"

# ---------------------------------------------------------------------------
# Column groups
# ---------------------------------------------------------------------------

# Columns that leak the answer or are reserved for splitting only.
LEAKAGE_COLS = [
    "target_acb_floor",
    "target_real_time_floor_count",
    "target_batch_floor_count",
    "target_background_reserve_met",
]

# Used only for ordering / splitting, never as features.
META_COLS = ["timestamp", "period_label"]

# Categorical columns that need OneHot encoding.
CATEGORICAL_COLS = ["tariff_version"]

# The model must only predict boundaries in this inclusive range.
ACB_MIN = 2
ACB_MAX = 8

# Thresholds used for the rule-based explanations (shared with predict step).
NIGHT_TARIFF_IS_ACTIVE = "is_nighttime"


# ---------------------------------------------------------------------------
# Data loading & preparation
# ---------------------------------------------------------------------------
def load_dataset(path: Path) -> pd.DataFrame:
    """Load the main dataset and parse the timestamp into a real datetime."""
    df = pd.read_csv(path)
    # Parse timestamp purely for chronological sorting; it is dropped before fit.
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def build_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return the feature dataframe X (no target, no leakage, no meta cols).

    Missing numeric values are median-filled; missing categoricals are filled
    with a sentinel 'missing' string so OneHotEncoder can handle them.
    """
    drop_cols = LEAKAGE_COLS + META_COLS
    feature_cols = [c for c in df.columns if c not in drop_cols]
    X = df[feature_cols].copy()

    # Fill missing values so the pipeline never breaks on NaNs.
    for col in X.columns:
        if col in CATEGORICAL_COLS:
            X[col] = X[col].fillna("missing").astype(str)
        else:
            # Numeric columns -> median imputation
            if X[col].isna().any():
                med = X[col].median()
                X[col] = X[col].fillna(med if pd.notna(med) else 0.0)
    return X


def chronological_split(past_df: pd.DataFrame, train_frac: float = 0.8):
    """
    Sort past data by timestamp and take the earliest 80% as train and the
    remaining 20% as test. This avoids the look-ahead bias of a random split
    on time-series-like data.
    """
    past_sorted = past_df.sort_values("timestamp").reset_index(drop=True)
    n = len(past_sorted)
    split_idx = int(n * train_frac)
    train_df = past_sorted.iloc[:split_idx].copy()
    test_df = past_sorted.iloc[split_idx:].copy()
    return train_df, test_df


# ---------------------------------------------------------------------------
# Pipeline construction
# ---------------------------------------------------------------------------
def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    """
    Build a ColumnTransformer that one-hot encodes the categorical columns
    and leaves the numeric columns untouched. Numeric scaling is intentionally
    omitted because tree-based models are scale-invariant.
    """
    numeric_cols = [c for c in X.columns if c not in CATEGORICAL_COLS]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_COLS,
            ),
            ("num", "passthrough", numeric_cols),
        ],
        remainder="drop",
    )
    return preprocessor


def build_pipeline(preprocessor: ColumnTransformer, model) -> Pipeline:
    """Bundle the preprocessor and an estimator into a single Pipeline."""
    return Pipeline(steps=[("preprocessor", preprocessor), ("model", model)])


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------
def within_plus_minus_one_accuracy(y_true, y_pred) -> float:
    """Fraction of predictions within +/- 1 floor of the true boundary."""
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    return float(np.mean(np.abs(y_true - y_pred) <= 1))


def clip_predictions(y_pred: np.ndarray) -> np.ndarray:
    """Safety-clip predictions into the valid ACB range [ACB_MIN, ACB_MAX]."""
    return np.clip(y_pred, ACB_MIN, ACB_MAX)


def evaluate_model(name: str, model, X_test, y_test) -> dict:
    """Run a model on the test set and print/collect the requested metrics."""
    y_pred_raw = model.predict(X_test)
    y_pred = clip_predictions(y_pred_raw)

    acc = accuracy_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    within1 = within_plus_minus_one_accuracy(y_test, y_pred)
    labels = sorted(set(y_test) | set(y_pred))
    report = classification_report(y_test, y_pred, labels=labels, zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=labels)

    print("\n" + "=" * 70)
    print(f"MODEL: {name}")
    print("=" * 70)
    print(f"Accuracy              : {acc:.4f}")
    print(f"Mean Absolute Error   : {mae:.4f} floors")
    print(f"Within +/-1 floor     : {within1:.4f}")
    print("\nClassification report:")
    print(report)
    print("Confusion matrix (rows=true, cols=pred), labels =", labels)
    print(cm)

    return {
        "name": name,
        "model": model,
        "accuracy": acc,
        "mae": mae,
        "within1": within1,
    }


# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------
def select_best_model(results: list[dict]) -> dict:
    """
    Pick the best model. Primary key = highest within +/-1 floor accuracy,
    tie-breaker = lowest MAE, final tie-breaker = highest accuracy.
    """
    return max(
        results,
        key=lambda r: (r["within1"], -r["mae"], r["accuracy"]),
    )


# ---------------------------------------------------------------------------
# Saving
# ---------------------------------------------------------------------------
def save_model(bundle: dict, path: Path) -> None:
    """Persist the model bundle (pipeline + metadata) to disk."""
    import joblib

    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, path)
    print(f"\nSaved best model bundle -> {path}")


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    # Make sure output folders exist.
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading dataset ...")
    df = load_dataset(DATA_PATH)
    print(f"  rows={len(df)}  cols={df.shape[1]}")

    # --- Split past / present / future -------------------------------------
    past_df = df[df["period_label"] == "past"].copy()
    print(
        f"\nPeriod split -> past={len(past_df)}, "
        f"present={len(df[df['period_label']=='present'])}, "
        f"future={len(df[df['period_label']=='future'])}"
    )

    train_df, test_df = chronological_split(past_df, train_frac=0.8)
    print(
        f"Chronological split -> train={len(train_df)} "
        f"({train_df['timestamp'].min()} -> {train_df['timestamp'].max()})"
    )

    # --- Build feature / target arrays -------------------------------------
    X_train = build_feature_matrix(train_df)
    X_test = build_feature_matrix(test_df)
    y_train = train_df["target_acb_floor"].astype(int).to_numpy()
    y_test = test_df["target_acb_floor"].astype(int).to_numpy()

    # Persist the feature list so predict/dashboard use the exact same columns.
    feature_list = list(X_train.columns)
    print(f"\nFeatures used ({len(feature_list)}): {feature_list[:8]} ...")

    # --- Build the shared preprocessor -------------------------------------
    preprocessor = build_preprocessor(X_train)

    # --- Candidate models --------------------------------------------------
    # RandomForest is the expected main model; the other two are baselines.
    candidate_models = {
        "DecisionTree": DecisionTreeClassifier(
            max_depth=12, min_samples_leaf=5, random_state=42
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=300,
            max_depth=None,
            min_samples_leaf=2,
            n_jobs=-1,
            random_state=42,
        ),
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=200, max_depth=3, learning_rate=0.1, random_state=42
        ),
    }

    results = []
    for name, estimator in candidate_models.items():
        print(f"\nTraining {name} ...")
        pipe = build_pipeline(build_preprocessor(X_train), estimator)
        pipe.fit(X_train, y_train)
        results.append(evaluate_model(name, pipe, X_test, y_test))

    # --- Select & save the best model --------------------------------------
    best = select_best_model(results)
    print("\n" + "#" * 70)
    print("MODEL COMPARISON SUMMARY")
    print("#" * 70)
    summary = pd.DataFrame(
        [{"Model": r["name"], "Accuracy": r["accuracy"], "MAE": r["mae"],
          "Within +/-1": r["within1"]} for r in results]
    )
    print(summary.to_string(index=False))
    print(f"\nBEST MODEL: {best['name']}  "
          f"(within +/-1 = {best['within1']:.4f}, MAE = {best['mae']:.4f}, "
          f"acc = {best['accuracy']:.4f})")

    bundle = {
        "pipeline": best["model"],
        "feature_list": feature_list,
        "categorical_cols": CATEGORICAL_COLS,
        "acb_min": ACB_MIN,
        "acb_max": ACB_MAX,
        "target_column": "target_acb_floor",
        "metrics": {
            "accuracy": best["accuracy"],
            "mae": best["mae"],
            "within1": best["within1"],
        },
    }
    save_model(bundle, MODEL_PATH)

    # Also write the comparison summary CSV for reference.
    summary_path = OUTPUT_DIR / "model_comparison.csv"
    summary.to_csv(summary_path, index=False)
    print(f"Saved comparison summary -> {summary_path}")
    print("\nTraining complete.")


if __name__ == "__main__":
    sys.exit(main())
