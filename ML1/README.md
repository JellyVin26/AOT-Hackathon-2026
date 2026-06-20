# ML1 — Model A: ML-Based Anomaly Detection

Model A is the machine-learning anomaly-detection module for the Sustainable
Building Intelligence Dashboard. It predicts the **expected** hourly energy use
for each floor/room/hour and compares it with the **actual** reading, then
returns an **explainable** anomaly verdict: severity, anomaly type, possible
reason, recommended solution, business benefit, and ESG alignment.

This module is deliberately self-contained inside `ML1/`. It does **not**
implement Model B or the energy-advice chatbot.

---

## 1. What Model A does

For a single observation (one floor + room + hour):

1. A `RandomForestRegressor` predicts `expected_energy_kwh` from the operating
   context (time, floor/room, weather, occupancy, tariff, …).
2. The residual is computed:

   ```
   residual_kwh      = actual_energy_kwh − expected_energy_kwh
   residual_percent  = residual_kwh / max(expected_energy_kwh, ε) × 100
   anomaly_score     = min(100, |residual_percent|)
   ```
3. Severity is banded **after** prediction on `|residual_percent|`:
   `<20` Normal · `20–<40` Low · `40–<70` Medium · `≥70` High.
4. The anomaly type is inferred from the energy breakdown + context flags
   (HVAC overcooling, lighting after hours, standby plug load, water spike,
   high total energy, or efficiency opportunity when actual < expected).
5. A data-aware `possible_reason`, `recommended_solution`, `business_benefit`
   and `esg_alignment` are generated automatically.

---

## 2. Why this is ML-based, not raw thresholding

A raw threshold flags any reading above *X kWh* as anomalous. That is brittle:
a large anchor store *should* use more energy than a small back-office room, and
energy *should* be high at noon in summer. A flat threshold raises false alarms
on large/busy zones and misses real waste in small zones.

Model A instead **learns the expected usage** for each floor/room/hour/condition
from the data. The anomaly is the **deviation from that learned expectation**
(the residual), and thresholds are applied *only* to the residual percentage.
This makes detection scale-aware and context-aware — the same kWh can be normal
in one context and an anomaly in another.

---

## 3. Project structure

```
ML1/
├── data/
│   └── shopping_mall_all_floors_hourly_ai_ready_training.csv
├── models/
│   ├── expected_energy_model.pkl     # full Pipeline (preprocessor + regressor)
│   ├── preprocessing_pipeline.pkl    # the ColumnTransformer step
│   └── model_metrics.json            # MAE / RMSE / MAPE / R2 + metadata
├── src/
│   ├── __init__.py
│   ├── feature_config.py             # feature lists + leakage rules
│   ├── utils.py                      # paths, data/model (de)serialisation
│   ├── train_model.py                # training CLI
│   ├── anomaly_detector.py           # prediction + explainable output
│   └── api.py                        # FastAPI service
├── tests/
│   ├── conftest.py
│   ├── test_no_leakage.py
│   ├── test_anomaly_output.py
│   └── test_api.py
├── requirements.txt
└── README.md
```

---

## 4. Setup

From the repository root:

```bash
python -m venv venv
venv\Scripts\activate              # Windows PowerShell
# source venv/bin/activate         # macOS / Linux

pip install -r ML1/requirements.txt
```

The training dataset must be at
`ML1/data/shopping_mall_all_floors_hourly_ai_ready_training.csv`.

---

## 5. Train the model

```bash
python ML1/src/train_model.py
```

This will:

- load and time-sort the dataset,
- select the 21 allowed features (printing a warning for any that are missing),
- enforce the no-leakage guard (aborts if a leakage column would be used),
- train + evaluate on a **time-based** 80/20 split (first 80% of timestamps →
  train, last 20% → test; **no random split**),
- refit on all data, and save `expected_energy_model.pkl`,
  `preprocessing_pipeline.pkl`, and `model_metrics.json`.

Current metrics (time-based test set):

| Metric | Value |
|--------|-------|
| MAE  | ~118.6 kWh |
| RMSE | ~296.3 kWh |
| MAPE | ~24.4% |
| R²   | ~0.79 |

---

## 6. Start the API

```bash
uvicorn ML1.src.api:app --reload
```

The API runs on `http://127.0.0.1:8000`. Interactive docs are at `/docs`.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/health` | Liveness check |
| POST | `/detect-anomaly` | Detect by `{timestamp, floor_id, room_id}` lookup |
| POST | `/detect-anomaly-row` | Detect on a full row supplied as JSON |
| GET  | `/latest-anomalies` | All floor/rooms at the latest timestamp, sorted by `anomaly_score` desc |
| GET  | `/metrics` | Saved model evaluation metrics |

---

## 7. Example API requests and responses

### Health

```bash
curl http://127.0.0.1:8000/health
```
```json
{"status": "ok", "module": "ML1 anomaly detection"}
```

### Detect by lookup

```bash
curl -X POST http://127.0.0.1:8000/detect-anomaly ^
  -H "Content-Type: application/json" ^
  -d "{\"timestamp\":\"2026-06-20 14:00:00\",\"floor_id\":\"Level_4\",\"room_id\":\"Room_A\"}"
```
```json
{
  "output_type": "anomaly_detection",
  "timestamp": "2026-06-20 14:00:00",
  "floor_id": "Level_4",
  "room_id": "Room_A",
  "actual_energy_kwh": 966.5177,
  "expected_energy_kwh": 971.6189,
  "residual_kwh": -5.1012,
  "residual_percent": -0.53,
  "anomaly_score": 0.53,
  "severity": "Normal",
  "anomaly_type": "No major anomaly",
  "possible_reason": "Energy use is close to the expected baseline for Level_4, Room_A at hour 14 given the current operating and occupancy conditions.",
  "recommended_solution": "Continue monitoring and maintain normal operating schedules; no action required at this time.",
  "business_benefit": "Continued efficient operation with no avoidable cost detected.",
  "esg_alignment": "Supports ongoing energy-efficiency reporting and stable sustainability governance."
}
```

### Detect on a raw row

```bash
curl -X POST http://127.0.0.1:8000/detect-anomaly-row ^
  -H "Content-Type: application/json" ^
  -d @row.json
```

where `row.json` is any single CSV row (it must include the
`hourly_total_energy_kwh` target plus the input feature columns).

### Latest anomalies (sorted)

```bash
curl "http://127.0.0.1:8000/latest-anomalies?limit=3"
```
```json
{
  "timestamp": "2026-06-20 23:00:00",
  "count": 3,
  "anomalies": [
    {
      "floor_id": "Level_10", "room_id": "Room_E",
      "actual_energy_kwh": 82.69, "expected_energy_kwh": 58.98,
      "residual_percent": 40.19, "anomaly_score": 40.19,
      "severity": "Medium",
      "anomaly_type": "Possible HVAC overcooling",
      "...": "..."
    }
  ]
}
```

### Metrics

```bash
curl http://127.0.0.1:8000/metrics
```
Returns `model_metrics.json` (model, split, features, excluded leakage columns,
and the four metrics).

---

## 8. Columns excluded to prevent leakage

The model must never see the answer. `ML1/src/feature_config.py` excludes any
column whose name **contains** (case-insensitive) any of these substrings, plus
the explicit target/target-like list:

**Leakage substrings:** `baseline_expected`, `residual`, `anomaly_score`,
`anomaly_label`, `anomaly_severity`, `anomaly_type`, `possible_reason`,
`recommended_solution`, `recommendation`, `advice`, `output_text`,
`business_benefit`, `esg_alignment`, `estimated_energy_saving`,
`estimated_cost_saving`, `estimated_co2_reduction`, `estimated_savable`,
`model_training_target_notes`, `ml_output_use_case`, `recommended_action`,
`energy_load_category`, `energy_saving_opportunity`, `energy_anomaly_label`,
`dominant_load_type`.

**Explicit target-like exclusions:** the target `hourly_total_energy_kwh` and
the components that sum to it (`hourly_ac_kwh`, `hourly_lighting_kwh`,
`hourly_plug_kwh`), plus derived outputs (`hourly_co2_emission_*`,
`hourly_energy_cost_rm`, `*_intensity_*`, `*_share`, `energy_per_visitor_kwh`,
etc.).

The energy-breakdown columns (`hourly_ac_kwh`, `hourly_lighting_kwh`,
`hourly_plug_kwh`, `hourly_water_liters`) are used **only** for post-prediction
anomaly-type inference — never as model inputs.

### Allowed input features (21)

- **Numeric:** `hour`, `day_of_week_num`, `is_weekend`, `month`, `floor_number`,
  `is_operating_hour`, `is_peak_traffic_hour`, `visitor_count`, `room_area_sq_m`,
  `floor_area_sq_m`, `outdoor_temperature_c`, `humidity_percent_synthetic`,
  `cooling_setpoint_c`, `effective_tariff_rm_per_kwh`
- **Categorical:** `floor_id`, `room_id`, `floor_zone_type`, `room_zone_type`,
  `business_period`, `mall_open_status`, `occupancy_level`

Missing optional features are dropped gracefully with a printed warning.

---

## 9. How the frontend can use the output

Each anomaly payload is a single JSON object the dashboard can render directly:

| Field | Frontend use |
|-------|--------------|
| `expected_energy_kwh` | Plot the learned baseline next to `actual_energy_kwh` so users see *expected vs actual*. |
| `severity` | Colour the badge / heatmap cell (Normal=grey, Low=yellow, Medium=orange, High=red, Efficiency=green). |
| `anomaly_type` | The headline category — route to the right widget (HVAC / lighting / plug / water / total). |
| `possible_reason` | One-line, context-aware explanation ("…higher than expected for Level_4, Room_A at hour 14…"). |
| `recommended_solution` | The actionable next step to show in the detail panel or "What to do" card. |
| `business_benefit` / `esg_alignment` | Supporting copy for the recommendation (cost / sustainability framing). |
| `anomaly_score` | Numeric 0–100 for sorting the anomaly list (`/latest-anomalies` already sorts descending). |

Typical flow: call `GET /latest-anomalies` to populate the anomaly feed and 3D
heatmap colours, then `POST /detect-anomaly` (or `/detect-anomaly-row`) when a
user drills into a specific floor/room/hour for the full explanation.

---

## 10. Running the tests

```bash
python -m pytest ML1/tests/ -v
```

The suite covers:

- **Leakage** (`test_no_leakage.py`): leakage columns are detected; none are
  selected as features; the saved model's features contain no leakage; expected
  ≠ actual on held-out rows; metrics are non-trivial (no target-copying).
- **Output** (`test_anomaly_output.py`): all required keys present; residual
  math correct; severity bands; every anomaly-type branch; explanations are
  generated and context-aware.
- **API** (`test_api.py`): health, lookup detect (incl. 404), raw-row detect
  (incl. 400), `/latest-anomalies` sorting, and `/metrics`.

---

## 11. Notes

- This module implements **only Model A** (anomaly detection). Model B and the
  advice chatbot are intentionally not included.
- The deployed model is refit on the **full** dataset after evaluation, so it
  has seen the most recent operating conditions.
- MAPE is reported over rows with `|actual| ≥ 1 kWh` (tiny/zero actuals make
  the percentage meaningless); `mape_rows_used` records how many rows were used.
