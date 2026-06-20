"""Train Model A: a regression model that predicts expected hourly energy use.

Pipeline
--------
1. Load the AI-ready dataset and sort by timestamp.
2. Select ONLY allowed features (no leakage columns, no target, no energy
   breakdown columns that sum to the target).
3. Build a scikit-learn ``Pipeline`` = ``ColumnTransformer`` (OneHotEncoder for
   categoricals, StandardScaler for numerics) -> ``RandomForestRegressor``.
4. Split by time: first 80% of timestamps -> train, last 20% -> test.
   (No random split.)
5. Evaluate with MAE, RMSE, MAPE, R2.
6. Refit on ALL data and save:
     - ML1/models/expected_energy_model.pkl   (full pipeline)
     - ML1/models/preprocessing_pipeline.pkl  (the transformer step)
     - ML1/models/model_metrics.json

Run directly:

    python ML1/src/train_model.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Allow running both as a script (`python ML1/src/train_model.py`) and as a
# package member (`python -m ML1.src.train_model`).
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from ML1.src import feature_config, utils  # type: ignore
else:
    from . import feature_config, utils


def time_based_split(df: pd.DataFrame, test_fraction: float = 0.2):
    """Split into train/test by timestamp (first 80% / last 20%).

    Rows are already sorted by timestamp in ``utils.load_dataset``. We split at
    the timestamp boundary so the test set contains strictly-later timestamps
    than the train set.
    """
    n = len(df)
    split_idx = int(n * (1.0 - test_fraction))
    split_idx = min(max(split_idx, 1), n - 1)
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()

    train_ts = train_df[feature_config.TIMESTAMP_COLUMN].iloc[0]
    test_ts = test_df[feature_config.TIMESTAMP_COLUMN].iloc[0]
    print(
        f"[split] train: {len(train_df)} rows from {train_ts}  |  "
        f"test: {len(test_df)} rows from {test_ts}"
    )
    return train_df, test_df


def build_pipeline(
    numeric_features: list[str],
    categorical_features: list[str],
) -> Pipeline:
    """Build the full preprocessing + regression pipeline."""
    transformers = []
    if numeric_features:
        transformers.append(("num", StandardScaler(), numeric_features))
    if categorical_features:
        transformers.append(
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categorical_features,
            )
        )
    preprocessor = ColumnTransformer(
        transformers=transformers, remainder="drop", verbose_feature_names_out=False
    )

    regressor = RandomForestRegressor(
        n_estimators=80,
        max_depth=None,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
    )
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("regressor", regressor),
        ]
    )


def _metric_bundle(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Compute MAE, RMSE, MAPE, R2.

    MAPE is computed over rows whose actual value is large enough to give a
    meaningful percentage (>= 1.0 kWh). Tiny/zero actuals make MAPE explode
    without saying anything useful about model quality; MAE/RMSE already cover
    those rows. The number of rows used is reported for transparency.
    """
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))

    meaningful = np.abs(y_true) >= 1.0
    if meaningful.any():
        yt = y_true[meaningful]
    else:
        yt = np.where(np.abs(y_true) < 1e-6, 1e-6, y_true)
    mape = float(np.mean(np.abs((yt - y_pred[meaningful]) / yt)) * 100.0)
    return {
        "mae": mae,
        "rmse": rmse,
        "mape": mape,
        "mape_rows_used": int(meaningful.sum()),
        "r2": r2,
    }


def train(
    data_path=None,
    save: bool = True,
) -> dict:
    """Train the expected-energy model.

    Returns a dict containing the fitted pipeline, metrics, selected features
    and the leakage check results.
    """
    utils.ensure_dirs()
    df = utils.load_dataset(data_path)
    print(f"[data] loaded {len(df)} rows, {len(df.columns)} columns")

    # ---- Leakage guard: verify no leakage column is selected as a feature ---
    numeric_features, categorical_features, missing = feature_config.select_features(
        df.columns
    )
    if missing:
        print(
            "[warning] missing optional features (training will continue without them):"
        )
        for col in missing:
            print(f"           - {col}")
    else:
        print("[features] all requested features present.")

    selected_features = numeric_features + categorical_features
    leakage_in_features = feature_config.get_leakage_columns(selected_features)
    if leakage_in_features:
        raise RuntimeError(
            "LEAKAGE DETECTED: these leakage/target columns would be used as "
            f"features: {leakage_in_features}. Refusing to train."
        )
    print(
        f"[features] using {len(selected_features)} input features "
        f"({len(numeric_features)} numeric, {len(categorical_features)} categorical)."
    )

    # ---- Time-based split --------------------------------------------------
    train_df, test_df = time_based_split(df, test_fraction=0.2)

    X_train = train_df[selected_features]
    y_train = train_df[feature_config.TARGET_COLUMN].astype(float).to_numpy()
    X_test = test_df[selected_features]
    y_test = test_df[feature_config.TARGET_COLUMN].astype(float).to_numpy()

    # ---- Train + evaluate --------------------------------------------------
    pipeline = build_pipeline(numeric_features, categorical_features)
    print("[train] fitting RandomForestRegressor on time-based train split...")
    pipeline.fit(X_train, y_train)

    y_pred_test = pipeline.predict(X_test)
    metrics = _metric_bundle(y_test, y_pred_test)
    print(
        "[metrics] MAE={mae:.3f}  RMSE={rmse:.3f}  MAPE={mape:.2f}%  R2={r2:.4f}".format(
            **metrics
        )
    )

    # Sanity check: predictions must not equal actuals (no leakage / no copy).
    if np.allclose(y_pred_test, y_test, atol=1e-6):
        raise RuntimeError(
            "Predictions are identical to actuals on the test set — the model is "
            "copying the target. Check for leakage."
        )

    # ---- Refit on ALL data for the deployed model --------------------------
    print("[train] refitting on full dataset for deployment...")
    full_pipeline = build_pipeline(numeric_features, categorical_features)
    X_all = df[selected_features]
    y_all = df[feature_config.TARGET_COLUMN].astype(float).to_numpy()
    full_pipeline.fit(X_all, y_all)

    # Persist feature lists on the pipeline object for later introspection.
    # (``feature_names_in_`` is a read-only property on Pipeline, so we store
    # the lists under our own attributes and expose them via a helper.)
    full_pipeline._ml1_features = list(selected_features)
    full_pipeline._ml1_numeric_features = list(numeric_features)
    full_pipeline._ml1_categorical_features = list(categorical_features)

    if save:
        utils.save_pickle(full_pipeline, utils.MODEL_PATH)
        utils.save_pickle(
            full_pipeline.named_steps["preprocessor"], utils.PIPELINE_PATH
        )
        payload = {
            "model": "RandomForestRegressor",
            "target": feature_config.TARGET_COLUMN,
            "split": {
                "method": "time_based",
                "train_fraction": 0.8,
                "test_fraction": 0.2,
                "train_rows": int(len(train_df)),
                "test_rows": int(len(test_df)),
            },
            "features": {
                "numeric": list(numeric_features),
                "categorical": list(categorical_features),
                "all": list(selected_features),
            },
            "leakage_columns_excluded": feature_config.get_leakage_columns(df.columns),
            "metrics": metrics,
        }
        utils.save_json(payload, utils.METRICS_PATH)
        print(f"[save] model   -> {utils.MODEL_PATH}")
        print(f"[save] pipeline-> {utils.PIPELINE_PATH}")
        print(f"[save] metrics -> {utils.METRICS_PATH}")

    return {
        "pipeline": full_pipeline,
        "metrics": metrics,
        "features": selected_features,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "train_rows": len(train_df),
        "test_rows": len(test_df),
    }


def main() -> None:
    print("=" * 70)
    print("Model A training: expected hourly energy (ML-based anomaly detection)")
    print("=" * 70)
    result = train(save=True)
    print("-" * 70)
    print("Done. Metrics:", json.dumps(result["metrics"], indent=2))


if __name__ == "__main__":
    main()
