// Shared helpers for ML1 anomaly results: severity colour mapping, lookups,
// and a React hook that loads the latest anomalies once and shares them.

import React, { useEffect, useState } from 'react';
import { getLatestAnomalies } from './ml1Api';

// ---------------------------------------------------------------------------
// Severity styling.
//
// The ML backend returns these severity strings:
//   "Normal", "Low", "Medium", "High", and
//   "Efficiency opportunity (Low|Medium|High)" when actual < expected.
// We map each to a colour and a human label. The colour is the single source
// of truth that the 3D heatmap and the AnomalyPanel both use.
// ---------------------------------------------------------------------------
export const SEVERITY_COLORS = {
  Normal: '#22c55e',
  Low: '#eab308',
  Medium: '#f97316',
  High: '#ef4444',
  Efficiency: '#38bdf8',
};

// Short label used for legends / chips.
export const SEVERITY_LABELS = {
  Normal: 'Normal',
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Efficiency: 'Efficiency',
};

/**
 * Reduce a raw severity string from the backend to a base band.
 * "Efficiency opportunity (Medium)" -> "Efficiency"
 * "Medium"                          -> "Medium"
 */
export function baseSeverityBand(severity) {
  if (!severity) return 'Normal';
  if (String(severity).startsWith('Efficiency')) return 'Efficiency';
  if (SEVERITY_COLORS[severity]) return severity;
  return 'Normal';
}

/**
 * Map a severity string to its display colour.
 */
export function severityToColor(severity) {
  return SEVERITY_COLORS[baseSeverityBand(severity)] || SEVERITY_COLORS.Normal;
}

/**
 * Normalise a floor_id like "Level_4" to a display label like "Floor 4".
 */
export function floorLabel(floorId) {
  const match = String(floorId || '').match(/Level_(\d+)/i);
  return match ? `Floor ${match[1]}` : floorId;
}

/**
 * Normalise a room_id like "Room_A" to a display label like "Room A".
 */
export function roomLabel(roomId) {
  return String(roomId || '').replace('Room_', 'Room ').replace('_', ' ');
}

// ---------------------------------------------------------------------------
// Lookup index of latest anomalies, keyed by `${floor_id}|${room_id}`.
// Used by the heatmap to colour each room by its ML severity.
// ---------------------------------------------------------------------------
export function buildAnomalyIndex(anomalies) {
  const index = new Map();
  (anomalies || []).forEach((item) => {
    if (!item || !item.floor_id || !item.room_id) return;
    index.set(`${item.floor_id}|${item.room_id}`, item);
  });
  return index;
}

/**
 * React hook: load the latest anomalies from the ML1 API once on mount.
 * Returns { data, loading, error, refresh }.
 *   data: { timestamp, count, anomalies: [...], index: Map }
 */
export function useLatestAnomalies() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await getLatestAnomalies();
      setData({
        timestamp: payload.timestamp,
        count: payload.count,
        anomalies: payload.anomalies || [],
        index: buildAnomalyIndex(payload.anomalies || []),
      });
    } catch (err) {
      setError(err.message || 'Failed to load latest anomalies.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Run the fetch asynchronously so setState happens in the async callback,
    // not synchronously during the effect body.
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await getLatestAnomalies();
        if (cancelled) return;
        setData({
          timestamp: payload.timestamp,
          count: payload.count,
          anomalies: payload.anomalies || [],
          index: buildAnomalyIndex(payload.anomalies || []),
        });
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Failed to load latest anomalies.');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error, refresh: load };
}
