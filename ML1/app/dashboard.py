"""
dashboard.py
============

Streamlit dashboard for the Adaptive Compute Boundary (ACB) model.

What it does
------------
1. Loads the dataset from data/model_a_adaptive_workload_boundary_dataset.csv.
2. Loads the trained model from models/acb_model.pkl.
3. Lets the user pick a timestamp (present + future rows).
4. Predicts the ACB for the selected hour and shows:
     - Predicted Adaptive Compute Boundary
     - Real-time floors / Batch floors
     - Operational context (tariff, workload counts, power, water, PUE, WUE ...)
5. Renders a 10-floor allocation table.
6. Plots the predicted ACB over the future horizon.
7. Adds a rule-based explanation section.

Run from the project root:
    streamlit run app/dashboard.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import streamlit as st

# Make the project root importable so we can reuse predict helpers.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import joblib  # noqa: E402

from src.predict_boundary import (  # noqa: E402
    align_features,
    clip_acb,
    format_batch_floors,
    format_real_time_floors,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_PATH = PROJECT_ROOT / "data" / "model_a_adaptive_workload_boundary_dataset.csv"
MODEL_PATH = PROJECT_ROOT / "models" / "acb_model.pkl"
TOTAL_FLOORS = 10


# ---------------------------------------------------------------------------
# Cached loaders
# ---------------------------------------------------------------------------
@st.cache_data(show_spinner=False)
def load_data() -> pd.DataFrame:
    """Load the dataset and parse the timestamp."""
    df = pd.read_csv(DATA_PATH)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


@st.cache_resource(show_spinner=False)
def load_model() -> dict:
    """Load the trained model bundle."""
    return joblib.load(MODEL_PATH)


# ---------------------------------------------------------------------------
# Prediction helpers
# ---------------------------------------------------------------------------
def predict_for_rows(rows: pd.DataFrame, bundle: dict) -> np.ndarray:
    """Run the model on a dataframe slice and return clipped ACB predictions."""
    X = align_features(rows, bundle["feature_list"], bundle["categorical_cols"])
    preds_raw = bundle["pipeline"].predict(X)
    return clip_acb(
        preds_raw, int(bundle["acb_min"]), int(bundle["acb_max"])
    ).astype(int)


def build_allocation_table(acb: int) -> pd.DataFrame:
    """
    Build the 10-floor allocation table.
    Floors 1..acb -> Real-time, the rest -> Batch.
    """
    rows = []
    for floor in range(1, TOTAL_FLOORS + 1):
        alloc = "Real-time" if floor <= acb else "Batch"
        rows.append({"floor_id": floor, "allocation_type": alloc})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Rule-based explanation engine
# ---------------------------------------------------------------------------
def build_explanations(row: pd.Series, acb: int) -> list[str]:
    """
    Generate human-readable explanations from simple rules. Each rule maps a
    measurable signal to a plain-English insight about why the ACB looks the
    way it does.
    """
    notes = []

    # Nighttime tariff -> cheaper electricity, batch can run more.
    if int(row.get("is_nighttime", 0)) == 1:
        notes.append(
            "Nighttime tariff is active, so cheaper electricity is available "
            "and more batch workloads can be scheduled."
        )

    # Low effective tariff.
    tariff = float(row.get("effective_tariff_rm_per_kwh", np.nan))
    if not np.isnan(tariff) and tariff <= 0.30:
        notes.append(
            f"Electricity cost is low (effective tariff RM {tariff:.3f}/kWh), "
            "which favours running more batch workloads now."
        )

    # Many batch jobs are delayable.
    delayable = float(row.get("batch_delayable_percent", np.nan))
    if not np.isnan(delayable) and delayable > 70:
        notes.append(
            f"{delayable:.1f}% of batch jobs are delayable, so the boundary "
            "can shift to prioritise real-time floors without losing flexibility."
        )

    # High real-time workload -> protect more real-time floors.
    rt_count = float(row.get("real_time_workload_count", np.nan))
    if not np.isnan(rt_count) and rt_count > 350:
        notes.append(
            f"Real-time workload count is high ({rt_count:.0f}), so more floors "
            f"({acb}) are reserved for real-time workloads."
        )

    # Thermal pressure.
    temp = float(row.get("building_avg_temp_c", np.nan))
    if not np.isnan(temp) and temp > 27.5:
        notes.append(
            f"Building average temperature is high ({temp:.2f} C); thermal "
            "pressure is high and cooling demand is elevated."
        )

    # High water usage.
    water = float(row.get("total_water_lph", np.nan))
    if not np.isnan(water) and water > 7000:
        notes.append(
            f"Cooling water usage is high ({water:.0f} L/h); the model should "
            "avoid inefficient floor allocation to keep WUE under control."
        )

    if not notes:
        notes.append(
            "All key signals are within normal ranges; the chosen boundary "
            "balances real-time protection with batch scheduling flexibility."
        )
    return notes


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
def main() -> None:
    st.set_page_config(
        page_title="Adaptive Compute Boundary Dashboard",
        page_icon="🏢",
        layout="wide",
    )
    st.title("🏢 Adaptive Compute Boundary (ACB) Dashboard")
    st.caption(
        "Model A — predicts how many of the 10 data-centre floors should serve "
        "real-time workloads vs. scheduled batch workloads."
    )

    # --- Load resources ----------------------------------------------------
    data = load_data()
    bundle = load_model()

    # We let the user pick from present + future rows (these are the
    # timestamps we actually want to forecast for).
    pf = data[data["period_label"].isin(["present", "future"])].sort_values(
        "timestamp"
    )
    if pf.empty:
        st.error("No present/future rows found in the dataset.")
        return

    # --- Timestamp selector -----------------------------------------------
    st.sidebar.header("Controls")
    timestamp_options = pf["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S").tolist()
    selected_label = st.sidebar.selectbox(
        "Select a timestamp (present / future)", timestamp_options
    )
    selected_ts = pd.to_datetime(selected_label)

    selected_row = pf[pf["timestamp"] == selected_ts].iloc[0]

    # --- Predict for the selected row -------------------------------------
    acb = int(predict_for_rows(selected_row.to_frame().T, bundle)[0])

    # --- Header metrics ----------------------------------------------------
    st.subheader("Prediction summary")
    col1, col2, col3 = st.columns(3)
    col1.metric("Predicted ACB floor", f"{acb}")
    col2.metric("Real-time floors", format_real_time_floors(acb))
    col3.metric("Batch floors", format_batch_floors(acb))

    # --- Operational context ----------------------------------------------
    st.subheader("Operational context")
    context_metrics = {
        "Effective tariff (RM/kWh)": float(selected_row["effective_tariff_rm_per_kwh"]),
        "Real-time workload count": int(selected_row["real_time_workload_count"]),
        "Batch workload count": int(selected_row["batch_workload_count"]),
        "Background workload count": int(selected_row["background_workload_count"]),
        "Batch delayable %": float(selected_row["batch_delayable_percent"]),
        "Total facility power (kW)": float(selected_row["total_facility_power_kw"]),
        "Total water (L/h)": float(selected_row["total_water_lph"]),
        "PUE estimate": float(selected_row["pue_estimate"]),
        "WUE (L/kWh)": float(selected_row["wue_l_per_kwh"]),
    }
    ccols = st.columns(3)
    for i, (label, value) in enumerate(context_metrics.items()):
        ccols[i % 3].metric(label, f"{value:,.2f}" if isinstance(value, float) else f"{value:,}")

    # --- Allocation table -------------------------------------------------
    st.subheader("10-floor allocation")
    alloc = build_allocation_table(acb)
    left, right = st.columns([1, 3])
    with left:
        st.dataframe(alloc, hide_index=True, use_container_width=True)
    with right:
        # Visual strip of the 10 floors coloured by allocation type.
        html = "<div style='display:flex; gap:6px; margin-top:6px;'>"
        for _, r in alloc.iterrows():
            color = "#2e7d32" if r["allocation_type"] == "Real-time" else "#1565c0"
            html += (
                f"<div style='flex:1; background:{color}; color:white; "
                f"border-radius:6px; padding:18px 4px; text-align:center; "
                f"font-weight:600;'>F{r['floor_id']}<br>"
                f"<span style='font-size:0.75em'>{r['allocation_type']}</span></div>"
            )
        html += "</div>"
        st.markdown(html, unsafe_allow_html=True)
        st.caption("Green = Real-time zone · Blue = Scheduled batch zone")

    # --- Future ACB line chart --------------------------------------------
    st.subheader("Predicted ACB over time (present + future)")
    pf_predictions = predict_for_rows(pf, bundle)
    chart_df = pd.DataFrame(
        {
            "timestamp": pf["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S").values,
            "predicted_acb_floor": pf_predictions,
        }
    )
    chart_df["timestamp"] = pd.to_datetime(chart_df["timestamp"])
    st.line_chart(chart_df.set_index("timestamp")["predicted_acb_floor"])
    st.caption(
        f"Showing {len(chart_df)} hourly predictions. "
        f"ACB ranges from {int(bundle['acb_min'])} to {int(bundle['acb_max'])} floors."
    )

    # --- Rule-based explanation -------------------------------------------
    st.subheader("Why this boundary? (rule-based explanation)")
    notes = build_explanations(selected_row, acb)
    for note in notes:
        st.markdown(f"- {note}")

    st.divider()
    st.caption(
        f"Model metrics on held-out test set — "
        f"accuracy: {bundle['metrics']['accuracy']:.4f}, "
        f"MAE: {bundle['metrics']['mae']:.4f} floors, "
        f"within +/-1 floor: {bundle['metrics']['within1']:.4f}."
    )


if __name__ == "__main__":
    main()
