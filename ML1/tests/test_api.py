"""Tests: the FastAPI API surface (health, detect endpoints, sorting, metrics)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from ML1.src import anomaly_detector, utils  # type: ignore  # noqa: E402

# Importing the app also exercises the route definitions.
try:
    from ML1.src.api import app  # type: ignore
    _API_AVAILABLE = True
except Exception as exc:  # pragma: no cover
    _API_AVAILABLE = False
    _IMPORT_ERROR = exc

try:
    import httpx  # noqa: F401
    _HTTPX_AVAILABLE = True
except Exception:
    _HTTPX_AVAILABLE = False

client = TestClient(app) if _API_AVAILABLE else None


@pytest.fixture(scope="module")
def sample_key():
    """A real (timestamp, floor_id, room_id) known to exist in the data."""
    df = utils.load_dataset()
    row = df.iloc[0]
    return {
        "timestamp": str(row["timestamp"]),
        "floor_id": str(row["floor_id"]),
        "room_id": str(row["room_id"]),
    }


def test_api_imports():
    if not _API_AVAILABLE:
        pytest.fail(f"Could not import the FastAPI app: {_IMPORT_ERROR}")


@pytest.mark.skipif(not _HTTPX_AVAILABLE, reason="httpx not installed")
def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["module"] == "ML1 anomaly detection"


@pytest.mark.skipif(not _HTTPX_AVAILABLE, reason="httpx not installed")
def test_detect_anomaly_by_lookup(sample_key):
    res = client.post("/detect-anomaly", json=sample_key)
    assert res.status_code == 200, res.text
    body = res.json()
    for key in (
        "severity", "anomaly_type", "possible_reason",
        "recommended_solution", "business_benefit", "esg_alignment",
        "actual_energy_kwh", "expected_energy_kwh",
    ):
        assert key in body, f"missing {key} in /detect-anomaly response"
    assert body["floor_id"] == sample_key["floor_id"]


@pytest.mark.skipif(not _HTTPX_AVAILABLE, reason="httpx not installed")
def test_detect_anomaly_by_lookup_404():
    res = client.post(
        "/detect-anomaly",
        json={"timestamp": "1900-01-01 00:00:00", "floor_id": "X", "room_id": "Y"},
    )
    assert res.status_code == 404


@pytest.mark.skipif(not _HTTPX_AVAILABLE, reason="httpx not installed")
def test_detect_anomaly_row(sample_key):
    """Use a full row from the dataset via /detect-anomaly-row."""
    df = utils.load_dataset()
    row = df.iloc[0].to_dict()
    res = client.post("/detect-anomaly-row", json=row)
    assert res.status_code == 200, res.text
    body = res.json()
    assert "expected_energy_kwh" in body
    assert body["anomaly_score"] >= 0


@pytest.mark.skipif(not _HTTPX_AVAILABLE, reason="httpx not installed")
def test_detect_anomaly_row_missing_target():
    res = client.post("/detect-anomaly-row", json={"floor_id": "Level_1"})
    assert res.status_code == 400


@pytest.mark.skipif(not _HTTPX_AVAILABLE, reason="httpx not installed")
def test_latest_anomalies_sorted_desc():
    res = client.get("/latest-anomalies")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["count"] > 0
    scores = [a["anomaly_score"] for a in body["anomalies"]]
    # Must be sorted descending by anomaly_score.
    assert scores == sorted(scores, reverse=True), (
        "latest anomalies not sorted by anomaly_score descending"
    )
    # One entry per available (floor, room) at the latest timestamp.
    assert body["count"] > 0


@pytest.mark.skipif(not _HTTPX_AVAILABLE, reason="httpx not installed")
def test_metrics_endpoint():
    if not utils.METRICS_PATH.exists():
        pytest.skip("Model not trained yet.")
    res = client.get("/metrics")
    assert res.status_code == 200
    body = res.json()
    assert "metrics" in body
    for m in ("mae", "rmse", "mape", "r2"):
        assert m in body["metrics"]
