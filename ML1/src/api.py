"""FastAPI service for Model A: ML-based anomaly detection.

Endpoints
---------
GET  /health              -> service liveness
POST /detect-anomaly      -> lookup a row by {timestamp, floor_id, room_id} and detect
POST /detect-anomaly-row  -> detect on a full row supplied as JSON
GET  /latest-anomalies    -> detect for every floor/room at the latest timestamp,
                             sorted by anomaly_score descending
GET  /metrics             -> return saved model evaluation metrics

Run:
    uvicorn ML1.src.api:app --reload
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import anomaly_detector, feature_config, utils

app = FastAPI(
    title="ML1 Anomaly Detection API",
    description="Model A: ML-based hourly energy anomaly detection.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class LookupRequest(BaseModel):
    timestamp: str
    floor_id: str
    room_id: str


# ---------------------------------------------------------------------------
# Dataset access (cached so we don't re-read the CSV per request)
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _dataset() -> pd.DataFrame:
    return utils.load_dataset()


def _row_for(timestamp: str, floor_id: str, room_id: str) -> dict:
    """Find a single matching row in the dataset by key."""
    df = _dataset()
    mask = (
        (df[feature_config.TIMESTAMP_COLUMN].astype(str) == str(timestamp))
        & (df["floor_id"].astype(str) == str(floor_id))
        & (df["room_id"].astype(str) == str(room_id))
    )
    matches = df[mask]
    if matches.empty:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No row found for timestamp={timestamp!r}, "
                f"floor_id={floor_id!r}, room_id={room_id!r}."
            ),
        )
    return matches.iloc[0].to_dict()


# ---------------------------------------------------------------------------
# 1. Health
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "module": "ML1 anomaly detection"}


# ---------------------------------------------------------------------------
# 2. Detect anomaly by lookup
# ---------------------------------------------------------------------------
@app.post("/detect-anomaly")
def detect_anomaly(req: LookupRequest):
    row = _row_for(req.timestamp, req.floor_id, req.room_id)
    return anomaly_detector.detect_anomaly(row)


# ---------------------------------------------------------------------------
# 3. Detect anomaly on a raw row
# ---------------------------------------------------------------------------
@app.post("/detect-anomaly-row")
def detect_anomaly_row(row: dict):
    if not row:
        raise HTTPException(status_code=400, detail="Request body is empty.")
    if feature_config.TARGET_COLUMN not in row:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Row must include the target column "
                f"{feature_config.TARGET_COLUMN!r}."
            ),
        )
    return anomaly_detector.detect_anomaly(row)


# ---------------------------------------------------------------------------
# 4. Latest anomalies (all floors/rooms at the latest timestamp)
# ---------------------------------------------------------------------------
@app.get("/latest-anomalies")
def latest_anomalies(limit: Optional[int] = None):
    df = _dataset()
    latest_ts = df[feature_config.TIMESTAMP_COLUMN].max()
    rows = df[df[feature_config.TIMESTAMP_COLUMN] == latest_ts]

    results = [anomaly_detector.detect_anomaly(r.to_dict()) for _, r in rows.iterrows()]
    # Sort by anomaly_score descending (highest first).
    results.sort(key=lambda r: r["anomaly_score"], reverse=True)
    if limit is not None:
        results = results[: int(limit)]
    return {
        "timestamp": str(latest_ts),
        "count": len(results),
        "anomalies": results,
    }


# ---------------------------------------------------------------------------
# 5. Metrics
# ---------------------------------------------------------------------------
@app.get("/metrics")
def metrics():
    try:
        payload = utils.load_json(utils.METRICS_PATH)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="model_metrics.json not found. Train the model first.",
        )
    return payload


@app.get("/")
def root():
    return {
        "module": "ML1 anomaly detection",
        "endpoints": [
            "/health",
            "/detect-anomaly",
            "/detect-anomaly-row",
            "/latest-anomalies",
            "/metrics",
        ],
    }


if __name__ == "__main__":
    # Allow running directly:  python ML1/src/api.py
    # This inserts the repo root onto sys.path so `ML1` resolves, regardless
    # of the current working directory, then starts uvicorn.
    import sys
    from pathlib import Path

    _repo_root = str(Path(__file__).resolve().parent.parent.parent)
    if _repo_root not in sys.path:
        sys.path.insert(0, _repo_root)

    import uvicorn

    uvicorn.run("ML1.src.api:app", host="127.0.0.1", port=8000, reload=True)
