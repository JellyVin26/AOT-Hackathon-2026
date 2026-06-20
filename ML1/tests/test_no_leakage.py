"""Tests: leakage protection and that the model doesn't copy the target.

These tests guarantee:
1. No leakage / target-like column is used as a model input feature.
2. The saved feature list excludes every leakage column present in the data.
3. ``expected_energy_kwh`` is not simply a copy of ``actual_energy_kwh``.
4. The metrics file reports a plausible (non-trivial) test error — a model
   that perfectly copied the target would have MAE ~ 0, which we reject.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Make ``ML1`` importable when tests run from the repo root.
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from ML1.src import anomaly_detector, feature_config, utils  # type: ignore  # noqa: E402


def test_leakage_substrings_catch_known_columns():
    """Every leakage column in the dataset is flagged by is_leakage_column."""
    df = utils.load_dataset()
    leakage_present = feature_config.get_leakage_columns(df.columns)
    # These MUST be detected as leakage.
    must_be_leakage = [
        "baseline_expected_total_energy_kwh",
        "energy_residual_kwh",
        "energy_residual_percent",
        "anomaly_score_0_100",
        "energy_anomaly_label",
        "anomaly_severity",
        "anomaly_type",
        "possible_reason",
        "recommended_solution",
        "advice_category",
        "anomaly_output_text",
        "business_benefit",
        "esg_alignment",
        "estimated_energy_saving_kwh_ai",
        "model_training_target_notes",
        "ml_output_use_case",
    ]
    for col in must_be_leakage:
        assert col in leakage_present, f"{col!r} should be flagged as leakage"


def test_no_leakage_columns_in_selected_features():
    """select_features must return no leakage / target columns."""
    df = utils.load_dataset()
    numeric, categorical, _ = feature_config.select_features(df.columns)
    selected = numeric + categorical
    leakage_in_selected = feature_config.get_leakage_columns(selected)
    assert leakage_in_selected == [], (
        f"Leakage columns leaked into features: {leakage_in_selected}"
    )
    assert feature_config.TARGET_COLUMN not in selected
    # The energy breakdown columns sum to the target -> must be excluded.
    for forbidden in ["hourly_ac_kwh", "hourly_lighting_kwh", "hourly_plug_kwh"]:
        assert forbidden not in selected, f"{forbidden} must not be an input feature"


def test_saved_model_excludes_leakage_columns():
    """The trained model's recorded features must contain no leakage columns."""
    if not utils.MODEL_PATH.exists():
        pytest.skip("Model not trained yet (run ML1/src/train_model.py).")
    model = anomaly_detector.load_model()
    features = list(getattr(model, "_ml1_features", []))
    assert features, "Model should record its feature names."
    leakage_in_features = feature_config.get_leakage_columns(features)
    assert leakage_in_features == [], (
        f"Leakage columns present in trained model features: {leakage_in_features}"
    )
    assert feature_config.TARGET_COLUMN not in features


def test_expected_energy_not_copied_from_actual():
    """Predicted expected energy must differ from actual energy on test rows."""
    if not utils.MODEL_PATH.exists():
        pytest.skip("Model not trained yet.")
    df = utils.load_dataset()
    # Use the last 5 rows (the held-out future period).
    sample = df.tail(5)
    diffs = []
    for _, row in sample.iterrows():
        actual = float(row[feature_config.TARGET_COLUMN])
        expected = anomaly_detector.predict_expected_energy(row.to_dict())
        diffs.append(abs(actual - expected))
    # At least one prediction must differ from the actual by a non-trivial amount.
    assert max(diffs) > 1.0, (
        "expected_energy_kwh looks copied from actual_energy_kwh "
        f"(max diff {max(diffs):.4f}). Check for leakage."
    )


def test_metrics_show_non_trivial_error():
    """A model that copied the target would have ~0 test error; reject that."""
    if not utils.METRICS_PATH.exists():
        pytest.skip("Metrics not found (model not trained yet).")
    metrics = utils.load_json(utils.METRICS_PATH)["metrics"]
    # MAE should be > 0 but finite; reject a suspiciously perfect model.
    assert metrics["mae"] > 0.0, "MAE is 0 — model may be copying the target."
    # R2 should be plausible (negative-ish to ~0.99). A copy would be exactly 1.0.
    assert metrics["r2"] < 0.9999, (
        f"R2={metrics['r2']} is suspiciously perfect — likely leakage."
    )
