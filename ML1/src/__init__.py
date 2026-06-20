"""Model A: ML-based anomaly detection package (ML1.src).

Provides:
- feature_config: feature lists and leakage rules
- utils: paths, data/model loading helpers
- train_model: regression training pipeline
- anomaly_detector: prediction + explainable anomaly output
- api: FastAPI service exposing the anomaly endpoints
"""

__all__ = ["feature_config", "utils", "train_model", "anomaly_detector"]
