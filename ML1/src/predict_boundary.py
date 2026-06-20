"""
predict_boundary.py
===================

Uses the trained ACB model to predict the Adaptive Compute Boundary for the
PRESENT and FUTURE rows of the dataset and writes a tidy prediction CSV to
outputs/acb_predictions.csv.

For each predicted row we:
  * clip the predicted ACB into the valid range [2, 8] (safety clipping)
  * format the real-time zone as "Floors 1-N"
  * format the batch zone as "Floors (N+1)-10"
  * carry over the operational context columns required by the dashboard
    (tariff, workload counts, power, water, PUE, WUE, ...).

Run from the project root:
    python src/predict_boundary.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Project paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "model_a_adaptive_workload_boundary_dataset.csv"
MODEL_PATH = PROJECT_ROOT / "models" / "acb_model.pkl"
OUTPUT_PATH = PROJECT_ROOT / "outputs" / "acb_predictions.csv"

TOTAL_FLOORS = 10  # the data-centre has exactly 10 floors

# Columns carried over into the prediction output (operational context).
OUTPUT_CONTEXT_COLS = [
    "effective_tariff_rm_per_kwh",
    "is_daytime",
    "is_nighttime",
    "is_weekend",
    "is_public_holiday",
    "real_time_workload_count",
    "batch_workload_count",
    "background_workload_count",
    "batch_delayable_percent",
    "required_background_reserve_percent",
    "total_facility_power_kw",
    "total_water_lph",
    "pue_estimate",
    "wue_l_per_kwh",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def format_real_time_floors(acb: int) -> str:
    """Real-time zone covers floors 1..acb."""
    return f"Floors 1-{int(acb)}"


def format_batch_floors(acb: int) -> str:
    """Batch zone covers floors (acb + 1)..10."""
    start = int(acb) + 1
    if start > TOTAL_FLOORS:
        return "Floors (none)"
    return f"Floors {start}-{TOTAL_FLOORS}"


def clip_acb(values, acb_min: int, acb_max: int) -> np.ndarray:
    """Safety-clip predictions into the valid ACB range."""
    return np.clip(np.asarray(values), acb_min, acb_max)


def align_features(df: pd.DataFrame, feature_list: list[str],
                   categorical_cols: list[str]) -> pd.DataFrame:
    """
    Rebuild the exact feature matrix the model was trained on:
      * select the stored feature columns (in order)
      * fill missing categoricals / numerics the same way as training
    """
    # Add any missing feature columns as NaN so selection is robust.
    for col in feature_list:
        if col not in df.columns:
            df[col] = np.nan
    X = df[feature_list].copy()

    for col in X.columns:
        if col in categorical_cols:
            X[col] = X[col].fillna("missing").astype(str)
        else:
            if X[col].isna().any():
                med = X[col].median()
                X[col] = X[col].fillna(med if pd.notna(med) else 0.0)
    return X


def load_model(path: Path) -> dict:
    """Load the saved model bundle."""
    return joblib.load(path)


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    if not MODEL_PATH.exists():
        print(
            f"ERROR: model not found at {MODEL_PATH}. "
            "Run `python src/train_model.py` first."
        )
        sys.exit(1)

    print("Loading model bundle ...")
    bundle = load_model(MODEL_PATH)
    pipeline = bundle["pipeline"]
    feature_list = bundle["feature_list"]
    categorical_cols = bundle["categorical_cols"]
    acb_min = int(bundle["acb_min"])
    acb_max = int(bundle["acb_max"])

    print("Loading dataset ...")
    df = pd.read_csv(DATA_PATH)
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    # --- Predict only on PRESENT + FUTURE rows -----------------------------
    predict_df = df[df["period_label"].isin(["present", "future"])].copy()
    predict_df = predict_df.sort_values("timestamp").reset_index(drop=True)
    print(f"Rows to predict (present + future): {len(predict_df)}")

    # --- Build features & predict ------------------------------------------
    X = align_features(predict_df, feature_list, categorical_cols)
    preds_raw = pipeline.predict(X)
    preds = clip_acb(preds_raw, acb_min, acb_max).astype(int)

    # --- Assemble the output dataframe -------------------------------------
    out = pd.DataFrame()
    out["timestamp"] = predict_df["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")
    out["period_label"] = predict_df["period_label"].values
    out["predicted_acb_floor"] = preds
    out["predicted_real_time_floors"] = [format_real_time_floors(p) for p in preds]
    out["predicted_batch_floors"] = [format_batch_floors(p) for p in preds]

    # Carry over the requested operational context columns.
    for col in OUTPUT_CONTEXT_COLS:
        out[col] = predict_df[col].values

    # --- Persist -----------------------------------------------------------
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUTPUT_PATH, index=False)
    print(f"\nSaved predictions -> {OUTPUT_PATH}")

    # --- Console preview ---------------------------------------------------
    print("\nPrediction distribution:")
    print(pd.Series(preds).value_counts().sort_index().to_string())
    print("\nSample rows:")
    print(out.head(8).to_string(index=False))

    clipped_count = int(np.sum(preds_raw != preds))
    if clipped_count:
        print(f"\nSafety-clipped {clipped_count} predictions into [{acb_min}, {acb_max}].")
    else:
        print(f"\nNo safety clipping needed (all predictions within [{acb_min}, {acb_max}]).")
    print("Prediction complete.")


if __name__ == "__main__":
    sys.exit(main())
