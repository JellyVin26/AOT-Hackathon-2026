"""Tests: the anomaly detection output shape and explainability guarantees.

Covers the required correctness checks:
- detect_anomaly returns all required keys (severity, anomaly_type, etc.).
- residual math is correct.
- severity bands follow the spec thresholds.
- expected != actual (no target copying).
- anomaly-type inference covers the documented branches.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from ML1.src import anomaly_detector, feature_config, utils  # type: ignore  # noqa: E402


REQUIRED_KEYS = {
    "output_type",
    "timestamp",
    "floor_id",
    "room_id",
    "actual_energy_kwh",
    "expected_energy_kwh",
    "residual_kwh",
    "residual_percent",
    "anomaly_score",
    "severity",
    "anomaly_type",
    "possible_reason",
    "recommended_solution",
    "business_benefit",
    "esg_alignment",
}


@pytest.fixture(scope="module")
def sample_row():
    df = utils.load_dataset()
    return df.iloc[100].to_dict()


@pytest.fixture(scope="module")
def trained_model():
    if not utils.MODEL_PATH.exists():
        pytest.skip("Model not trained yet (run ML1/src/train_model.py).")
    return anomaly_detector.load_model()


# ---------------------------------------------------------------------------
# Output shape
# ---------------------------------------------------------------------------
def test_detect_anomaly_has_all_required_keys(sample_row, trained_model):
    out = anomaly_detector.detect_anomaly(sample_row)
    missing = REQUIRED_KEYS - set(out.keys())
    assert not missing, f"Missing keys in anomaly output: {missing}"
    assert out["output_type"] == "anomaly_detection"


def test_output_values_are_consistent(sample_row, trained_model):
    out = anomaly_detector.detect_anomaly(sample_row)
    # residual_kwh == actual - expected (within rounding).
    assert round(out["actual_energy_kwh"] - out["expected_energy_kwh"], 1) == round(
        out["residual_kwh"], 1
    )
    # anomaly_score == min(100, |residual_percent|).
    expected_score = min(100.0, abs(out["residual_percent"]))
    assert abs(out["anomaly_score"] - expected_score) < 0.05


def test_expected_energy_is_not_actual(sample_row, trained_model):
    out = anomaly_detector.detect_anomaly(sample_row)
    # They should not be exactly equal (a copy would be a leakage bug).
    assert out["expected_energy_kwh"] != out["actual_energy_kwh"]


# ---------------------------------------------------------------------------
# Severity bands
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "residual_percent, expected_band",
    [
        (0.0, "Normal"),
        (19.9, "Normal"),
        (20.0, "Low"),
        (39.9, "Low"),
        (40.0, "Medium"),
        (69.9, "Medium"),
        (70.0, "High"),
        (150.0, "High"),
    ],
)
def test_classify_severity_bands(residual_percent, expected_band):
    assert anomaly_detector.classify_severity(residual_percent) == expected_band


def test_negative_residual_is_efficiency_opportunity():
    """Actual < expected should be framed as an efficiency opportunity."""
    sev = anomaly_detector.classify_severity(-55.0)
    assert "Efficiency" in sev


# ---------------------------------------------------------------------------
# Anomaly math
# ---------------------------------------------------------------------------
def test_calculate_anomaly_math():
    out = anomaly_detector.calculate_anomaly(actual_energy=42.6, expected_energy=25.1)
    assert out["residual_kwh"] == round(42.6 - 25.1, 4)
    expected_pct = (42.6 - 25.1) / 25.1 * 100
    assert abs(out["residual_percent"] - round(expected_pct, 2)) < 0.01
    # anomaly_score == min(100, |residual_percent|), both rounded to 2 dp.
    assert out["anomaly_score"] == round(min(100.0, abs(expected_pct)), 2)


# ---------------------------------------------------------------------------
# Anomaly-type inference branches
# ---------------------------------------------------------------------------
def _make_row(**overrides):
    """Build a synthetic row with sensible defaults for type inference."""
    base = {
        "floor_id": "Level_4",
        "room_id": "Room_A",
        "hour": 2,
        "occupancy_level": "Very Low",
        "mall_open_status": "Closed",
        "is_operating_hour": 0,
        "visitor_count": 5,
        "hourly_total_energy_kwh": 100.0,
        "hourly_ac_kwh": 0.0,
        "hourly_lighting_kwh": 0.0,
        "hourly_plug_kwh": 0.0,
        "hourly_water_liters": 0.0,
        "water_per_kwh_liters": 0.0,
    }
    base.update(overrides)
    return base


def test_type_hvac_overcooling():
    row = _make_row(hourly_ac_kwh=60.0, hourly_total_energy_kwh=100.0)  # 60% AC
    assert anomaly_detector.infer_anomaly_type(row, 50.0) == "Possible HVAC overcooling"


def test_type_lighting_after_hours():
    row = _make_row(
        hourly_lighting_kwh=70.0, hourly_total_energy_kwh=100.0,
        mall_open_status="Closed", is_operating_hour=0,
    )  # 70% lighting, closed
    assert (
        anomaly_detector.infer_anomaly_type(row, 50.0)
        == "Lighting active after operating hours"
    )


def test_type_standby_plug_load():
    row = _make_row(
        hourly_plug_kwh=50.0, hourly_total_energy_kwh=100.0,
        is_operating_hour=0,
    )  # 50% plug, off-hours
    assert (
        anomaly_detector.infer_anomaly_type(row, 50.0)
        == "Unnecessary standby plug load"
    )


def test_type_water_spike():
    row = _make_row(
        water_per_kwh_liters=0.5, visitor_count=10,  # high water, few visitors
        hourly_ac_kwh=0.0,
    )
    assert anomaly_detector.infer_anomaly_type(row, 50.0) == "Possible water usage spike"


def test_type_fallback_high_total():
    row = _make_row(
        hourly_ac_kwh=20.0, hourly_lighting_kwh=20.0, hourly_plug_kwh=10.0,
        hourly_total_energy_kwh=100.0,
        mall_open_status="Open", is_operating_hour=1, occupancy_level="High",
        visitor_count=400, water_per_kwh_liters=0.0,
    )
    assert (
        anomaly_detector.infer_anomaly_type(row, 50.0) == "High total energy usage"
    )


def test_negative_residual_yields_efficiency_type():
    row = _make_row()
    t = anomaly_detector.infer_anomaly_type(row, -50.0)
    assert t.startswith("Unusually low energy usage")


# ---------------------------------------------------------------------------
# Explanation text generation
# ---------------------------------------------------------------------------
def test_explanations_are_generated_for_every_type():
    types = [
        "No major anomaly",
        "Possible HVAC overcooling",
        "Lighting active after operating hours",
        "Unnecessary standby plug load",
        "Possible water usage spike",
        "High total energy usage",
        "Unusually low energy usage (efficiency opportunity)",
    ]
    for t in types:
        reason = anomaly_detector.generate_possible_reason(
            _make_row(), t, 45.0
        )
        solution = anomaly_detector.generate_recommended_solution(t)
        benefit = anomaly_detector.generate_business_benefit(t)
        esg = anomaly_detector.generate_esg_alignment(t)
        for text in (reason, solution, benefit, esg):
            assert isinstance(text, str) and len(text) > 10


def test_possible_reason_references_context():
    """possible_reason should mention floor/room context, not be a fixed string."""
    row = _make_row(floor_id="Level_7", room_id="Room_C")
    reason = anomaly_detector.generate_possible_reason(
        row, "High total energy usage", 60.0
    )
    assert "Level_7" in reason and "Room_C" in reason
