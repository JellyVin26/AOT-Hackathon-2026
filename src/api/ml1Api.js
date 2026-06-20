// API service for Model A (ML1) anomaly detection.
//
// All functions wrap the FastAPI backend at ML1_API_BASE (default
// http://localhost:8000). Each call throws an Error with a helpful message on
// network failure or non-2xx responses, so callers can use try/catch.
//
// Endpoints:
//   GET  /health
//   GET  /latest-anomalies            -> { timestamp, count, anomalies: [...] }
//   POST /detect-anomaly              -> single anomaly object (lookup by key)
//   GET  /metrics                     -> { model, metrics: {...}, ... }

// Allow overriding the base URL via Vite env (VITE_ML1_API_URL) for deployment.
const ML1_API_BASE =
  (import.meta.env && import.meta.env.VITE_ML1_API_URL) ||
  'http://localhost:8000';

/**
 * Centralised fetch wrapper that parses JSON and raises on failure.
 * @param {string} path     Path under the ML1 API base, e.g. "/health".
 * @param {RequestInit} [options] Optional fetch options (method, body, ...).
 * @returns {Promise<any>} Parsed JSON response.
 */
async function ml1Fetch(path, options) {
  let response;
  try {
    response = await fetch(`${ML1_API_BASE}${path}`, options);
  } catch (networkError) {
    throw new Error(
      `Could not reach the ML1 anomaly API at ${ML1_API_BASE}${path}. ` +
        'Is the backend running? (uvicorn ML1.src.api:app --reload)',
      { cause: networkError }
    );
  }

  if (!response.ok) {
    let detail = await response.text().catch(() => '');
    try {
      detail = JSON.parse(detail)?.detail || detail;
    } catch {
      // keep raw text as detail
    }
    throw new Error(
      `ML1 API ${path} returned ${response.status} ${response.statusText}` +
        (detail ? `: ${detail}` : '')
    );
  }

  return response.json();
}

/**
 * GET /health — service liveness check.
 * @returns {Promise<{status: string, module: string}>}
 */
export function getHealth() {
  return ml1Fetch('/health');
}

/**
 * GET /latest-anomalies — detect anomalies for every floor/room at the latest
 * dataset timestamp, sorted by anomaly_score descending.
 * @param {object} [options]
 * @param {number} [options.limit] Optional cap on the number of results.
 * @returns {Promise<{timestamp: string, count: number, anomalies: AnomalyResult[]}>}
 */
export function getLatestAnomalies({ limit } = {}) {
  const query = typeof limit === 'number' ? `?limit=${limit}` : '';
  return ml1Fetch(`/latest-anomalies${query}`);
}

/**
 * POST /detect-anomaly — lookup a single row by its key and detect the anomaly.
 * @param {{timestamp: string, floor_id: string, room_id: string}} key
 * @returns {Promise<AnomalyResult>}
 */
export function detectAnomalyByKey({ timestamp, floor_id, room_id }) {
  return ml1Fetch('/detect-anomaly', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, floor_id, room_id }),
  });
}

/**
 * POST /detect-anomaly-row — detect an anomaly on a full row provided as JSON.
 * The row must include the `hourly_total_energy_kwh` target column.
 * @param {object} row Full dataset row.
 * @returns {Promise<AnomalyResult>}
 */
export function detectAnomalyByRow(row) {
  return ml1Fetch('/detect-anomaly-row', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  });
}

/**
 * GET /metrics — saved model evaluation metrics.
 * @returns {Promise<object>} The contents of model_metrics.json.
 */
export function getMetrics() {
  return ml1Fetch('/metrics');
}

/**
 * @typedef {Object} AnomalyResult
 * @property {string} output_type            Always "anomaly_detection".
 * @property {string} timestamp              ISO-like timestamp string.
 * @property {string} floor_id               e.g. "Level_4".
 * @property {string} room_id                e.g. "Room_A".
 * @property {number} actual_energy_kwh      Actual hourly energy.
 * @property {number} expected_energy_kwh    Model-predicted expected energy.
 * @property {number} residual_kwh           actual - expected.
 * @property {number} residual_percent       residual as % of expected.
 * @property {number} anomaly_score          min(100, |residual_percent|).
 * @property {string} severity               Normal | Low | Medium | High | Efficiency...
 * @property {string} anomaly_type           e.g. "Possible HVAC overcooling".
 * @property {string} possible_reason        Data-aware explanation.
 * @property {string} recommended_solution   Suggested action.
 * @property {string} business_benefit       Benefit text.
 * @property {string} esg_alignment          ESG statement.
 */

export { ML1_API_BASE };
