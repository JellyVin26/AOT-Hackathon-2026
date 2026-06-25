"""Shared helpers for Model A: paths, data loading, model (de)serialisation.

These helpers keep file paths consistent across training, inference, the API
and the tests, regardless of the current working directory.
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import pandas as pd

from . import feature_config

# ---------------------------------------------------------------------------
# Path handling
#
# All paths resolve relative to this file so that the module works whether it
# is run as ``python ML1/src/train_model.py`` or imported as
# ``ML1.src.utils`` (e.g. by uvicorn / pytest).
# ---------------------------------------------------------------------------
_THIS_FILE = Path(__file__).resolve()
SRC_DIR = _THIS_FILE.parent               # ML1/src
ML1_DIR = SRC_DIR.parent                  # ML1
DATA_DIR = ML1_DIR / "data"
MODELS_DIR = ML1_DIR / "models"

DATA_PATH = DATA_DIR / "shopping_mall_all_floors_hourly_ai_ready_training.csv"
MODEL_PATH = MODELS_DIR / "expected_energy_model.pkl"
PIPELINE_PATH = MODELS_DIR / "preprocessing_pipeline.pkl"
METRICS_PATH = MODELS_DIR / "model_metrics.json"


def ensure_dirs() -> None:
    """Create the data/ and models/ directories if they don't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load_dataset(path: Path | str | None = None) -> pd.DataFrame:
    """Load the training dataset, sorted by timestamp.

    Parameters
    ----------
    path:
        Optional override for the CSV location (used by tests).
    """
    import collections
    csv_path = Path(path) if path is not None else DATA_PATH
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {csv_path}. Expected the AI-ready training "
            f"CSV under ML1/data/."
        )
    # Read only the last 20,000 rows to prevent Render Free Tier OOM (512MB RAM limit)
    # 160MB CSV spikes memory to >500MB if read all at once.
    chunks = collections.deque(pd.read_csv(csv_path, chunksize=10000), maxlen=2)
    df = pd.concat(chunks, ignore_index=True)
    
    if feature_config.TIMESTAMP_COLUMN in df.columns:
        df = df.sort_values(feature_config.TIMESTAMP_COLUMN).reset_index(drop=True)
    return df


def row_to_input_frame(row) -> pd.DataFrame:
    """Normalise a dict / Series / single-row DataFrame into a 1-row DataFrame."""
    if isinstance(row, pd.DataFrame):
        if len(row) == 0:
            raise ValueError("Provided DataFrame is empty.")
        return row.head(1).copy()
    if isinstance(row, pd.Series):
        return row.to_frame().T.copy()
    if isinstance(row, dict):
        return pd.DataFrame([row])
    raise TypeError(f"Unsupported row type: {type(row)!r}")


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------
def save_pickle(obj, path: Path | str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(obj, f)


def load_pickle(path: Path | str):
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Pickle file not found: {path}")
    with open(path, "rb") as f:
        return pickle.load(f)


def save_json(obj, path: Path | str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)


def load_json(path: Path | str | None = None):
    path = Path(path) if path is not None else METRICS_PATH
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
