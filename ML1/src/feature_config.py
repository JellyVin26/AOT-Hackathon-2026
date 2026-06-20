"""Feature configuration for Model A: ML-based anomaly detection.

Centralises the list of allowed input features, the target column, and the set
of leakage / target-like columns that must NEVER be fed into the model.

Keeping this in one place makes the leakage rules easy to audit and test.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Target column (what we predict)
# ---------------------------------------------------------------------------
TARGET_COLUMN = "hourly_total_energy_kwh"

# Timestamp column used for the time-based train/test split and for output.
TIMESTAMP_COLUMN = "timestamp"

# ---------------------------------------------------------------------------
# Allowed input features (requested by spec).
#
# These are the ONLY columns the model is allowed to learn from. If any are
# missing from a particular dataset they are dropped gracefully at load time.
# ---------------------------------------------------------------------------
NUMERIC_FEATURES: list[str] = [
    "hour",
    "day_of_week_num",
    "is_weekend",
    "month",
    "floor_number",
    "is_operating_hour",
    "is_peak_traffic_hour",
    "visitor_count",
    "room_area_sq_m",
    "floor_area_sq_m",
    "outdoor_temperature_c",
    "humidity_percent_synthetic",
    "cooling_setpoint_c",
    "effective_tariff_rm_per_kwh",
]

CATEGORICAL_FEATURES: list[str] = [
    "floor_id",
    "room_id",
    "floor_zone_type",
    "room_zone_type",
    "business_period",
    "mall_open_status",
    "occupancy_level",
]

ALL_REQUESTED_FEATURES: list[str] = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# ---------------------------------------------------------------------------
# Diagnostic columns used ONLY for anomaly-type inference after prediction.
#
# These describe the energy breakdown (ac/lighting/plug/water) and contextual
# flags. They are NOT model inputs because:
#   - the *_kwh breakdowns directly encode the target (ac+light+plug == total)
#   - using them would leak the answer into the prediction.
# ---------------------------------------------------------------------------
DIAGNOSTIC_COLUMNS: list[str] = [
    "hourly_ac_kwh",
    "hourly_lighting_kwh",
    "hourly_plug_kwh",
    "hourly_water_liters",
    "water_per_kwh_liters",
]

# Context columns carried through to anomaly-type inference and output.
CONTEXT_COLUMNS: list[str] = [
    "floor_id",
    "room_id",
    "occupancy_level",
    "mall_open_status",
    "is_operating_hour",
    "visitor_count",
]

# ---------------------------------------------------------------------------
# Leakage columns: anything that directly contains generated answers,
# residuals, anomaly labels, baseline expected values, recommendation text,
# or other target-like outputs.
#
# We match any column whose name CONTAINS any of these substrings
# (case-insensitive). This is deliberately broad so a renamed/new leakage
# column is still caught.
# ---------------------------------------------------------------------------
LEAKAGE_SUBSTRINGS: list[str] = [
    "baseline_expected",
    "residual",
    "anomaly_score",
    "anomaly_label",
    "anomaly_severity",
    "anomaly_type",
    "possible_reason",
    "recommended_solution",
    "recommendation",
    "advice",
    "output_text",
    "business_benefit",
    "esg_alignment",
    "estimated_energy_saving",
    "estimated_cost_saving",
    "estimated_co2_reduction",
    "estimated_savable",
    "model_training_target_notes",
    "ml_output_use_case",
    "recommended_action",
    "energy_load_category",
    "energy_saving_opportunity",
    "energy_anomaly_label",
    "dominant_load_type",
]

# Explicit target / target-like columns that must also be excluded from inputs.
# These do not all match a substring above, so they are listed explicitly.
EXPLICIT_EXCLUDED_COLUMNS: list[str] = [
    TARGET_COLUMN,
    "hourly_lighting_kwh",
    "hourly_plug_kwh",
    "hourly_ac_kwh",
    "hourly_water_liters",
    "hourly_co2_emission_kg",
    "hourly_co2_emission_tonnes",
    "hourly_energy_cost_rm",
    "hourly_total_waste_kg",
    "energy_intensity_kwh_per_sqm",
    "energy_intensity_kwh_per_1000sqm",
    "ac_intensity_kwh_per_sqm",
    "lighting_intensity_kwh_per_sqm",
    "plug_intensity_kwh_per_sqm",
    "energy_per_visitor_kwh",
    "cost_per_visitor_rm",
    "co2_per_visitor_kg",
    "cooling_load_index",
    "emission_factor_kg_per_kwh",
    "lighting_energy_share",
    "plug_energy_share",
    "ac_energy_share",
]


def is_leakage_column(column_name: str) -> bool:
    """Return True if a column name should be treated as leakage / target-like.

    Matches both the explicit excluded list and any leakage substring
    (case-insensitive, partial match).
    """
    name_lower = column_name.lower()
    for sub in LEAKAGE_SUBSTRINGS:
        if sub.lower() in name_lower:
            return True
    return column_name in EXPLICIT_EXCLUDED_COLUMNS


def get_leakage_columns(available_columns) -> list[str]:
    """Return all columns from ``available_columns`` that are leakage/target."""
    return [c for c in available_columns if is_leakage_column(c)]


def select_features(available_columns) -> tuple[list[str], list[str], list[str]]:
    """Select numeric/categorical features actually present in the data.

    Returns
    -------
    (numeric_present, categorical_present, missing)
        ``missing`` lists any requested feature not found, so the caller can
        print a clear warning.
    """
    col_set = set(available_columns)
    numeric_present = [f for f in NUMERIC_FEATURES if f in col_set]
    categorical_present = [f for f in CATEGORICAL_FEATURES if f in col_set]
    missing = [f for f in ALL_REQUESTED_FEATURES if f not in col_set]
    return numeric_present, categorical_present, missing
