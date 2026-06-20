# Adaptive Compute Boundary Prediction for Energy-Efficient Data Centre Infrastructure

**Model A — Adaptive Compute Boundary (ACB) prediction** for a 10-floor data
centre. The model decides, hour by hour, how many floors should serve
**real-time workloads** versus **scheduled batch workloads** in order to reduce
electricity consumption, cooling-water usage and operating cost while still
protecting real-time workloads and keeping a background reserve.

---

## 1. What the project does

The data centre has **10 floors**, each containing server racks. Utilization is
tracked at the rack/floor level. Workloads fall into two main categories:

| Category | Behaviour |
|---|---|
| **Real-time / critical** | Must run immediately, low latency, high priority, protected from SLA violations. |
| **Scheduled batch / non-critical** | Can be delayed, shifted to cheaper-tariff periods, or relocated across floors to save energy and water. |

A small amount of **background processing** is also present, so the system must
reserve spare capacity.

The model predicts the **Adaptive Compute Boundary (ACB)** — a single integer
that splits the building:

```
Floors 1 .. predicted_acb_floor          -> Real-time zone
Floors predicted_acb_floor + 1 .. 10     -> Scheduled batch zone
```

Example: `predicted_acb_floor = 5` → Floors 1-5 are real-time, Floors 6-10 are batch.

### What is the Adaptive Compute Boundary?

The ACB is the floor index that partitions the building between the two
workload zones. The model is a **supervised multi-class classifier** whose
target column `target_acb_floor` is bounded to the valid range **[2, 8]** so
that no unrealistic split (e.g. all floors to one zone) is ever produced.

The objective is to minimise:
- electricity consumption
- cooling-water usage
- operating cost

…while protecting real-time workloads and keeping background reserve capacity.

---

## 2. Datasets

All CSVs live in the `data/` folder.

| File | Description |
|---|---|
| `model_a_adaptive_workload_boundary_dataset.csv` | **Main training data.** Hourly records with workload demand, tariff info, floor-level utilization, cooling, water usage, and the target boundary. |
| `workload_groups_dataset.csv` | Workload-level / job-group data (type, priority, delay flexibility, SLA deadline, resource demand). |
| `workload_hourly_aggregation_from_groups.csv` | How workload groups aggregate into the hourly summary features. |
| `model_a_acb_data_dictionary.csv` | Data dictionary for the main dataset. |
| `workload_groups_data_dictionary.csv` | Data dictionary for the workload-groups dataset. |

The `period_label` column splits the data into `past`, `present` and `future`
relative to `2026-06-20 11:00:00`. Only **past** rows are used for training and
testing; **present** and **future** rows are used for prediction/demo.

---

## 3. Project structure

```
ML1/
├── data/                          # Datasets + data dictionaries
├── models/
│   └── acb_model.pkl              # Trained model bundle (pipeline + metadata)
├── outputs/
│   ├── acb_predictions.csv        # Present + future ACB predictions
│   └── model_comparison.csv       # Train-time model comparison summary
├── src/
│   ├── train_model.py             # Train + compare + save best model
│   └── predict_boundary.py        # Predict present/future, write CSV
├── app/
│   └── dashboard.py               # Streamlit dashboard
├── requirements.txt
└── README.md
```

---

## 4. ML approach

- **Task:** supervised multi-class classification.
- **Target:** `target_acb_floor` (valid range **2-8**).
- **Split:** **chronological** (no random split). Past data is sorted by
  `timestamp`; the earliest 80% is training, the latest 20% is testing.
- **Leakage columns dropped:** `target_acb_floor`,
  `target_real_time_floor_count`, `target_batch_floor_count`,
  `target_background_reserve_met`.
- **Non-feature columns dropped:** `timestamp`, `period_label`
  (`period_label` is only used to separate past / present / future).
- **Preprocessing:** scikit-learn `Pipeline` + `ColumnTransformer`:
  - `tariff_version` → `OneHotEncoder(handle_unknown="ignore")`
  - numeric columns → passthrough (trees are scale-invariant)
  - missing values median-filled for numerics, `"missing"` for categoricals.
- **Models compared:**
  1. `DecisionTreeClassifier`
  2. `RandomForestClassifier` ← expected main model
  3. `GradientBoostingClassifier`

### Evaluation metrics (per model)

1. **Accuracy**
2. **Mean Absolute Error** between actual and predicted ACB floor
3. **Within ±1 floor accuracy** — a prediction is acceptable when
   `abs(actual - predicted) <= 1`
4. **Classification report**
5. **Confusion matrix**

### Model selection

Best model is chosen by, in order:
1. highest within ±1 floor accuracy
2. lowest MAE
3. highest accuracy

The selected model is saved (with its feature list and metadata) to
`models/acb_model.pkl`. Predictions are safety-clipped to **[2, 8]**.

---

## 5. How to run

> Run every command from the **project root** (`ML1/`).

### Install dependencies

```bash
pip install -r requirements.txt
```

`requirements.txt` contains: `pandas`, `numpy`, `scikit-learn`, `joblib`,
`streamlit`, `matplotlib`.

### Train the model

```bash
python src/train_model.py
```

This trains all three models, prints the evaluation metrics, selects the best
one, and writes:

- `models/acb_model.pkl` — best model bundle
- `outputs/model_comparison.csv` — comparison summary

### Generate predictions

```bash
python src/predict_boundary.py
```

Predicts the ACB for all **present** + **future** rows, applies safety clipping,
and writes `outputs/acb_predictions.csv` with columns:

`timestamp, period_label, predicted_acb_floor, predicted_real_time_floors,
predicted_batch_floors, effective_tariff_rm_per_kwh, is_daytime, is_nighttime,
is_weekend, is_public_holiday, real_time_workload_count, batch_workload_count,
background_workload_count, batch_delayable_percent,
required_background_reserve_percent, total_facility_power_kw, total_water_lph,
pue_estimate, wue_l_per_kwh`

Floor zones are formatted as `Floors 1-5` and `Floors 6-10`.

### Run the Streamlit dashboard

```bash
streamlit run app/dashboard.py
```

The dashboard lets you:

1. Select a timestamp (present / future).
2. See the **Predicted ACB**, real-time floors, batch floors and operational
   context (tariff, workload counts, power, water, PUE, WUE).
3. View a **10-floor allocation table** (`floor_id`, `allocation_type`).
4. View a **line chart** of `predicted_acb_floor` over the future horizon.
5. Read a **rule-based explanation** of why the boundary was chosen
   (nighttime tariff, low electricity cost, delayable batch %, high real-time
   workload, thermal pressure, cooling-water usage).

---

## 6. Notes

- All folders (`models/`, `outputs/`) are created automatically if missing.
- Missing values are handled during feature construction (median / sentinel).
- The saved bundle keeps the exact feature list, so prediction and the
  dashboard always reconstruct the same feature matrix the model was trained on.
