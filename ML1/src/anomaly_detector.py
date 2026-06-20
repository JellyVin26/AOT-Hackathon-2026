"""Model A inference: predict expected energy and explain anomalies.

Workflow for a single observation
---------------------------------
1. ``load_model()`` lazily loads the trained pipeline.
2. ``prepare_input(row)`` normalises a dict / Series / DataFrame row and keeps
   only the model's expected feature columns.
3. ``predict_expected_energy(input_data)`` returns the model's kWh prediction.
4. ``calculate_anomaly(actual, expected)`` computes residual + residual %.
5. ``classify_severity(residual_percent)`` maps the magnitude to a band.
6. ``infer_anomaly_type(row, residual_percent)`` uses the energy breakdown +
   context flags to name the most likely anomaly type.
7. ``generate_possible_reason / recommended_solution / business_benefit /
   esg_alignment`` produce the explainable text (data-aware, not hardcoded).
8. ``detect_anomaly(row)`` wires all of the above into one JSON payload.

Thresholds are applied ONLY AFTER prediction — the model itself never sees the
answer. If actual < expected we frame this as an efficiency opportunity, not a
high-consumption anomaly.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from ML1.src import feature_config, utils  # type: ignore
else:
    from . import feature_config, utils

# Small number to avoid division by zero when expected energy is ~0.
_EPS = 1e-6

# ---------------------------------------------------------------------------
# Severity thresholds (applied to |residual_percent|).
# ---------------------------------------------------------------------------
SEVERITY_NORMAL = "Normal"
SEVERITY_LOW = "Low"
SEVERITY_MEDIUM = "Medium"
SEVERITY_HIGH = "High"
# Severity used for the "lower-than-expected" direction.
SEVERITY_EFFICIENCY = "Efficiency opportunity"


# ===========================================================================
# 1. Model loading & input preparation
# ===========================================================================
def load_model():
    """Load the trained pipeline (cached on this function for reuse)."""
    if not hasattr(load_model, "_cache"):
        try:
            load_model._cache = utils.load_pickle(utils.MODEL_PATH)
        except FileNotFoundError:
            raise FileNotFoundError(
                f"Trained model not found at {utils.MODEL_PATH}. "
                f"Run `python ML1/src/train_model.py` first."
            )
    return load_model._cache


def _model_features() -> list[str]:
    """Return the feature columns the model was trained on."""
    model = load_model()
    cached = getattr(model, "_ml1_features", None)
    if cached is not None:
        return list(cached)
    # Fallback to the config list (present subset).
    num, cat, _ = feature_config.select_features(
        utils.load_dataset().columns
    )
    return num + cat


def prepare_input(row) -> pd.DataFrame:
    """Normalise ``row`` into a 1-row DataFrame with the model's features only.

    ``row`` may be a dict, pandas Series, or single-row DataFrame. Missing
    feature columns are filled with NaN and handled by the pipeline.
    """
    frame = utils.row_to_input_frame(row)

    # Coerce numeric features to numeric so a JSON payload with string numbers
    # (e.g. {"hour": "14"}) still works.
    for col in feature_config.NUMERIC_FEATURES:
        if col in frame.columns:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")

    features = _model_features()
    # Build a frame with exactly the expected columns, in order.
    prepared = pd.DataFrame(index=[0], columns=features)
    for col in features:
        if col in frame.columns:
            prepared[col] = frame[col].values
        else:
            prepared[col] = np.nan
    return prepared


# ===========================================================================
# 2. Prediction & anomaly maths
# ===========================================================================
def predict_expected_energy(input_data) -> float:
    """Predict expected ``hourly_total_energy_kwh`` for one prepared row."""
    model = load_model()
    prepared = prepare_input(input_data)
    pred = model.predict(prepared)
    return float(np.asarray(pred).ravel()[0])


def calculate_anomaly(actual_energy: float, expected_energy: float) -> dict:
    """Compute residual, residual percent and anomaly score.

    residual_kwh      = actual - expected
    residual_percent  = residual / max(expected, eps) * 100
    anomaly_score     = min(100, |residual_percent|)
    """
    actual_energy = float(actual_energy)
    expected_energy = float(expected_energy)
    residual_kwh = actual_energy - expected_energy
    denom = max(abs(expected_energy), _EPS)
    residual_percent = (residual_kwh / denom) * 100.0
    anomaly_score = min(100.0, abs(residual_percent))
    return {
        "actual_energy_kwh": round(actual_energy, 4),
        "expected_energy_kwh": round(expected_energy, 4),
        "residual_kwh": round(residual_kwh, 4),
        "residual_percent": round(residual_percent, 2),
        "anomaly_score": round(anomaly_score, 2),
    }


def classify_severity(residual_percent: float) -> str:
    """Map |residual_percent| to a severity band.

    < 20     -> Normal
    20-<40   -> Low
    40-<70   -> Medium
    >= 70    -> High

    Negative residuals (actual < expected) that still cross a band are flagged
    as an efficiency opportunity instead of a consumption anomaly.
    """
    mag = abs(float(residual_percent))
    if mag < 20.0:
        return SEVERITY_NORMAL
    band = (
        SEVERITY_LOW if mag < 40.0
        else SEVERITY_MEDIUM if mag < 70.0
        else SEVERITY_HIGH
    )
    if residual_percent < 0:
        return f"{SEVERITY_EFFICIENCY} ({band})"
    return band


# ===========================================================================
# 3. Anomaly-type inference (feature based, data aware)
# ===========================================================================
def _num(value: Any, default: float = 0.0) -> float:
    """Best-effort numeric coercion for possibly-missing / string values."""
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _str_lower(value: Any) -> str:
    if value is None:
        return ""
    try:
        if isinstance(value, float) and np.isnan(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value).strip().lower()


def _row_dict(row) -> dict:
    """Return a plain dict view of a dict / Series / DataFrame row."""
    if isinstance(row, pd.Series):
        return row.to_dict()
    if isinstance(row, pd.DataFrame):
        if len(row) == 0:
            return {}
        return row.iloc[0].to_dict()
    if isinstance(row, dict):
        return dict(row)
    raise TypeError(f"Unsupported row type: {type(row)!r}")


def infer_anomaly_type(row, residual_percent: float) -> str:
    """Pick the most likely anomaly type from features + residual direction.

    Logic:
      - |residual_percent| < 20 (Normal band) -> "No major anomaly"
      - meaningful negative residual -> efficiency opportunity
      - meaningful positive residual (actual > expected), in priority order:
          1. HVAC overcooling   - high AC share AND (low occupancy OR mall closed)
          2. Lighting after hrs - high lighting share AND (closed OR non-operating)
          3. Standby plug load  - high plug share AND non-operating hour
          4. Water usage spike  - high water-per-kWh AND low visitor count
          5. Fallback           - High total energy usage
    """
    data = _row_dict(row)
    pct = float(residual_percent)
    mag = abs(pct)

    # Normal band: no meaningful deviation either way.
    if mag < 20.0:
        return "No major anomaly"

    actual_high = pct > 0

    # Energy breakdown (diagnostic only — never a model input).
    total = _num(data.get("hourly_total_energy_kwh"), 0.0)
    total_safe = max(abs(total), _EPS)
    ac_share = _num(data.get("hourly_ac_kwh"), 0.0) / total_safe
    light_share = _num(data.get("hourly_lighting_kwh"), 0.0) / total_safe
    plug_share = _num(data.get("hourly_plug_kwh"), 0.0) / total_safe

    occ = _str_lower(data.get("occupancy_level"))
    low_occupancy = occ in {"very low", "low"}
    open_status = _str_lower(data.get("mall_open_status"))
    mall_closed = "closed" in open_status  # 'Closed', 'Post-closing'
    is_operating = _num(data.get("is_operating_hour"), 0.0) >= 1.0

    water_per_kwh = _num(data.get("water_per_kwh_liters"), 0.0)
    visitor_count = _num(data.get("visitor_count"), 0.0)
    water_high = water_per_kwh > 0.05  # well above the ~0.009 median

    if not actual_high:
        # Meaningfully lower than expected -> efficiency / unusually low usage.
        return "Unusually low energy usage (efficiency opportunity)"

    # ---- High-consumption checks (in priority order) ----------------------
    if ac_share >= 0.40 and (low_occupancy or mall_closed):
        return "Possible HVAC overcooling"
    if light_share >= 0.40 and (mall_closed or not is_operating):
        return "Lighting active after operating hours"
    if plug_share >= 0.30 and not is_operating:
        return "Unnecessary standby plug load"
    if water_high and visitor_count < 30:
        return "Possible water usage spike"
    return "High total energy usage"


# ===========================================================================
# 4. Explainable text generation
# ===========================================================================
def generate_possible_reason(row, anomaly_type: str, residual_percent: float) -> str:
    """Build a data-aware possible reason sentence.

    The reason references the actual floor/room/hour/occupancy context and the
    dominant load, so it is never a single hardcoded string for every case.
    """
    data = _row_dict(row)
    floor = data.get("floor_id", "this floor")
    room = data.get("room_id", "this room")
    hour = data.get("hour", "this hour")
    occ = data.get("occupancy_level")
    occ_phrase = f"low occupancy ({occ})" if occ else "current occupancy"

    total = _num(data.get("hourly_total_energy_kwh"), 0.0)
    total_safe = max(abs(total), _EPS)
    shares = {
        "cooling": _num(data.get("hourly_ac_kwh"), 0.0) / total_safe,
        "lighting": _num(data.get("hourly_lighting_kwh"), 0.0) / total_safe,
        "plug load": _num(data.get("hourly_plug_kwh"), 0.0) / total_safe,
    }
    dominant = max(shares, key=shares.get)

    pct = abs(float(residual_percent))
    direction = "higher" if residual_percent > 0 else "lower"

    if anomaly_type == "No major anomaly":
        return (
            f"Energy use is close to the expected baseline for {floor}, {room} "
            f"at hour {hour} given the current operating and occupancy conditions."
        )
    if anomaly_type == "Possible HVAC overcooling":
        return (
            f"Cooling energy is {direction} than expected for {floor}, {room} "
            f"at hour {hour} under {occ_phrase}; cooling is the dominant load "
            f"({shares['cooling']*100:.0f}% of total energy)."
        )
    if anomaly_type == "Lighting active after operating hours":
        return (
            f"Lighting draw is {direction} than expected for {floor}, {room} "
            f"at hour {hour} while the mall is outside operating hours; lighting "
            f"is {shares['lighting']*100:.0f}% of total energy."
        )
    if anomaly_type == "Unnecessary standby plug load":
        return (
            f"Plug load is {direction} than expected for {floor}, {room} at hour "
            f"{hour} outside operating hours; plug equipment may be left on "
            f"({shares['plug load']*100:.0f}% of total energy)."
        )
    if anomaly_type == "Possible water usage spike":
        return (
            f"Water usage per kWh is elevated for {floor}, {room} at hour {hour} "
            f"with only {int(_num(data.get('visitor_count'), 0))} visitors, "
            f"suggesting a possible leak or non-routine draw."
        )
    if anomaly_type.startswith("Unusually low energy usage"):
        return (
            f"Actual energy is about {pct:.0f}% lower than the model expects for "
            f"{floor}, {room} at hour {hour} — this may be an efficiency gain or "
            f"reduced activity worth confirming."
        )
    # High total energy usage (fallback)
    return (
        f"Total energy is {pct:.0f}% {direction} than the model expects for "
        f"{floor}, {room} at hour {hour}; the dominant load is {dominant} "
        f"({shares[dominant]*100:.0f}% of total energy)."
    )


def generate_recommended_solution(anomaly_type: str) -> str:
    """Return a concrete recommended action for the anomaly type."""
    if anomaly_type == "No major anomaly":
        return (
            "Continue monitoring and maintain normal operating schedules; "
            "no action required at this time."
        )
    if anomaly_type == "Possible HVAC overcooling":
        return (
            "Check the HVAC schedule and reduce cooling intensity during "
            "low-occupancy periods; raise the cooling setpoint slightly and "
            "inspect HVAC controls for stuck/overdriven zones."
        )
    if anomaly_type == "Lighting active after operating hours":
        return (
            "Switch to zone-based lighting, dim non-essential lights, turn off "
            "lights after closing, and verify the lighting automation/schedule."
        )
    if anomaly_type == "Unnecessary standby plug load":
        return (
            "Shut down idle equipment, deploy smart plugs, and review the tenant "
            "equipment schedule to remove after-hours standby load."
        )
    if anomaly_type == "Possible water usage spike":
        return (
            "Inspect for leaks, running toilets and cleaning schedules, and "
            "review cooling-tower make-up water usage for this zone."
        )
    if anomaly_type.startswith("Unusually low energy usage"):
        return (
            "Confirm the reduction is intentional (e.g. scheduled shutdown), "
            "record the operating change, and apply the same pattern to similar "
            "low-traffic periods if comfort is unaffected."
        )
    return (
        "Review the operating schedule for this zone, prioritise the largest "
        "energy component, and compare usage patterns across similar floors and "
        "rooms to find the source of the excess."
    )


def generate_business_benefit(anomaly_type: str) -> str:
    """Return the expected business benefit for the anomaly type."""
    if anomaly_type == "No major anomaly":
        return "Continued efficient operation with no avoidable cost detected."
    if anomaly_type == "Possible HVAC overcooling":
        return "Lower electricity cost and reduced HVAC equipment strain."
    if anomaly_type == "Lighting active after operating hours":
        return "Lower electricity cost and reduced lighting maintenance."
    if anomaly_type == "Unnecessary standby plug load":
        return "Lower avoidable electricity cost and better operational efficiency."
    if anomaly_type == "Possible water usage spike":
        return "Lower water cost and reduced maintenance risk from undetected leaks."
    if anomaly_type.startswith("Unusually low energy usage"):
        return "Sustained lower operating cost and better operational efficiency."
    return "Lower electricity cost and improved operational efficiency."


def generate_esg_alignment(anomaly_type: str) -> str:
    """Return the ESG alignment statement for the anomaly type."""
    if anomaly_type == "No major anomaly":
        return (
            "Supports ongoing energy-efficiency reporting and stable "
            "sustainability governance."
        )
    if anomaly_type == "Possible HVAC overcooling":
        return (
            "Reduces electricity consumption and Scope 2 carbon emissions, and "
            "supports energy-efficiency reporting."
        )
    if anomaly_type == "Lighting active after operating hours":
        return (
            "Reduces electricity consumption and Scope 2 carbon emissions "
            "through avoided after-hours lighting."
        )
    if anomaly_type == "Unnecessary standby plug load":
        return (
            "Reduces electricity consumption and Scope 2 carbon emissions, and "
            "improves sustainability governance via measurable load tracking."
        )
    if anomaly_type == "Possible water usage spike":
        return (
            "Supports water efficiency and improves sustainability governance "
            "through measurable anomaly tracking."
        )
    if anomaly_type.startswith("Unusually low energy usage"):
        return (
            "Supports energy-efficiency reporting and reinforces measurable "
            "sustainability governance."
        )
    return (
        "Reduces electricity consumption and Scope 2 carbon emissions, and "
        "supports energy-efficiency reporting."
    )


# ===========================================================================
# 5. End-to-end detection
# ===========================================================================
def detect_anomaly(row) -> dict:
    """Run the full anomaly-detection pipeline on one observation.

    Returns the explainable anomaly JSON payload.
    """
    data = _row_dict(row)
    actual_energy = _num(data.get(feature_config.TARGET_COLUMN), 0.0)
    expected_energy = predict_expected_energy(data)

    calc = calculate_anomaly(actual_energy, expected_energy)
    severity = classify_severity(calc["residual_percent"])
    anomaly_type = infer_anomaly_type(data, calc["residual_percent"])
    possible_reason = generate_possible_reason(
        data, anomaly_type, calc["residual_percent"]
    )
    recommended_solution = generate_recommended_solution(anomaly_type)
    business_benefit = generate_business_benefit(anomaly_type)
    esg_alignment = generate_esg_alignment(anomaly_type)

    return {
        "output_type": "anomaly_detection",
        "timestamp": data.get(feature_config.TIMESTAMP_COLUMN),
        "floor_id": data.get("floor_id"),
        "room_id": data.get("room_id"),
        "actual_energy_kwh": calc["actual_energy_kwh"],
        "expected_energy_kwh": calc["expected_energy_kwh"],
        "residual_kwh": calc["residual_kwh"],
        "residual_percent": calc["residual_percent"],
        "anomaly_score": calc["anomaly_score"],
        "severity": severity,
        "anomaly_type": anomaly_type,
        "possible_reason": possible_reason,
        "recommended_solution": recommended_solution,
        "business_benefit": business_benefit,
        "esg_alignment": esg_alignment,
    }
