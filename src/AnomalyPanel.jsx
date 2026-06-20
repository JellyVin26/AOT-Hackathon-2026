// AnomalyPanel — displays ML-backed (Model A) anomaly results from the ML1 API.
//
// This component NEVER computes severity by raw threshold. It consumes the
// severity, anomaly_type, possible_reason and recommended_solution that the ML
// backend returns, and just renders them.
//
// Data source: GET /latest-anomalies (every floor/room at the latest timestamp,
// sorted by anomaly_score descending). An optional floor filter narrows the
// list locally. Clicking a row calls POST /detect-anomaly for that key.

import { useEffect, useMemo, useState } from 'react';
import { detectAnomalyByKey, getMetrics } from './api/ml1Api';
import { useLatestAnomalies, severityToColor, floorLabel } from './api/ml1Helpers';
import './AnomalyPanel.css';

const NUMBER_FMT = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

// Plain-number formatter for energy values (2 dp).
function fmtKwh(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);
}

function fmtPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const sign = Number(value) > 0 ? '+' : '';
  return `${sign}${NUMBER_FMT.format(value)}%`;
}

function StatusBanner({ status, error }) {
  if (status === 'ok') {
    return (
      <div className="ml1-banner ml1-banner-ok">
        <span className="ml1-banner-dot ml1-banner-dot-ok" />
        ML1 anomaly API connected
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="ml1-banner ml1-banner-error">
        <span className="ml1-banner-dot ml1-banner-dot-error" />
        {error || 'Could not reach the ML1 anomaly API.'}
      </div>
    );
  }
  return null;
}

function SeverityChip({ severity }) {
  const color = severityToColor(severity);
  return (
    <span
      className="ml1-severity-chip"
      style={{ color, borderColor: `${color}66`, background: `${color}1f` }}
    >
      {severity}
    </span>
  );
}

// One anomaly card. The expanded detail view is populated by the backend.
function AnomalyCard({ item, onSelect, isActive }) {
  const color = severityToColor(item.severity);
  return (
    <button
      type="button"
      className={`ml1-anomaly-card ${isActive ? 'ml1-anomaly-card-active' : ''}`}
      style={{ borderLeftColor: color }}
      onClick={() => onSelect(item)}
    >
      <div className="ml1-anomaly-card-head">
        <div className="ml1-anomaly-card-where">
          {floorLabel(item.floor_id)} · {item.room_id?.replace('Room_', 'Room ')}
        </div>
        <SeverityChip severity={item.severity} />
      </div>

      <div className="ml1-anomaly-card-type">{item.anomaly_type}</div>

      <div className="ml1-anomaly-card-metrics">
        <div>
          <span>Actual</span>
          <strong>{fmtKwh(item.actual_energy_kwh)} kWh</strong>
        </div>
        <div>
          <span>Expected</span>
          <strong>{fmtKwh(item.expected_energy_kwh)} kWh</strong>
        </div>
        <div>
          <span>Residual</span>
          <strong style={{ color }}>{fmtPercent(item.residual_percent)}</strong>
        </div>
      </div>
    </button>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="ml1-detail-row">
      <span className="ml1-detail-label">{label}</span>
      <div className="ml1-detail-value">{children}</div>
    </div>
  );
}

function AnomalyDetail({ item, loading }) {
  if (!item) {
    return (
      <div className="ml1-detail-empty">
        Select an anomaly on the left to see the full ML explanation.
      </div>
    );
  }

  if (loading) {
    return <div className="ml1-detail-empty">Fetching ML analysis…</div>;
  }

  const color = severityToColor(item.severity);

  return (
    <div className="ml1-detail">
      <div className="ml1-detail-head">
        <div>
          <div className="ml1-detail-where">
            {floorLabel(item.floor_id)} · {item.room_id?.replace('Room_', 'Room ')}
          </div>
          <div className="ml1-detail-when">{item.timestamp}</div>
        </div>
        <SeverityChip severity={item.severity} />
      </div>

      <div className="ml1-detail-scorebar">
        <div
          className="ml1-detail-scorebar-fill"
          style={{
            width: `${Math.min(100, Math.max(0, item.anomaly_score))}%`,
            background: color,
          }}
        />
        <span className="ml1-detail-scorebar-label">
          Anomaly score {NUMBER_FMT.format(item.anomaly_score)} / 100
        </span>
      </div>

      <DetailRow label="Anomaly type">
        <span style={{ color, fontWeight: 700 }}>{item.anomaly_type}</span>
      </DetailRow>

      <DetailRow label="Energy comparison">
        <div className="ml1-energy-row">
          <div>
            <span>Actual</span>
            <strong>{fmtKwh(item.actual_energy_kwh)} kWh</strong>
          </div>
          <div>
            <span>Expected</span>
            <strong>{fmtKwh(item.expected_energy_kwh)} kWh</strong>
          </div>
          <div>
            <span>Residual</span>
            <strong style={{ color }}>
              {fmtKwh(item.residual_kwh)} kWh ({fmtPercent(item.residual_percent)})
            </strong>
          </div>
        </div>
      </DetailRow>

      <DetailRow label="Possible reason">{item.possible_reason}</DetailRow>

      <DetailRow label="Recommended solution">
        {item.recommended_solution}
      </DetailRow>

      <div className="ml1-detail-grid">
        <DetailRow label="Business benefit">
          {item.business_benefit}
        </DetailRow>
        <DetailRow label="ESG alignment">{item.esg_alignment}</DetailRow>
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }) {
  return (
    <div className="ml1-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

export default function AnomalyPanel() {
  const { data, loading, error, refresh } = useLatestAnomalies();
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [floorFilter, setFloorFilter] = useState('All');
  const [metrics, setMetrics] = useState(null);

  // Floor options derived from the returned anomalies.
  const floorOptions = useMemo(() => {
    const set = new Set(['All']);
    (data?.anomalies || []).forEach((item) => {
      if (item?.floor_id) set.add(item.floor_id);
    });
    return Array.from(set).sort((a, b) => {
      if (a === 'All') return -1;
      if (b === 'All') return 1;
      return (
        Number(a.replace('Level_', '')) - Number(b.replace('Level_', ''))
      );
    });
  }, [data]);

  const filtered = useMemo(() => {
    const list = data?.anomalies || [];
    if (floorFilter === 'All') return list;
    return list.filter((item) => item.floor_id === floorFilter);
  }, [data, floorFilter]);

  // Counts for the summary header.
  const summary = useMemo(() => {
    const list = data?.anomalies || [];
    const flagged = list.filter((i) => i.severity && i.severity !== 'Normal');
    const top = list[0];
    return {
      total: list.length,
      flagged: flagged.length,
      topScore: top ? top.anomaly_score : null,
      topWhere: top ? `${floorLabel(top.floor_id)} · ${top.room_id}` : null,
    };
  }, [data]);

  // Load model metrics once for the header context.
  useEffect(() => {
    let cancelled = false;
    getMetrics()
      .then((payload) => {
        if (!cancelled) setMetrics(payload);
      })
      .catch(() => {
        /* metrics are optional context; ignore failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When a card is selected, re-fetch the precise ML analysis for that key.
  // (The list payload already has everything; this demonstrates the
  // /detect-anomaly endpoint and guarantees fresh explanation text.)
  const handleSelect = async (item) => {
    setSelected(item);
    setDetailLoading(true);
    try {
      const fresh = await detectAnomalyByKey({
        timestamp: item.timestamp,
        floor_id: item.floor_id,
        room_id: item.room_id,
      });
      setSelected(fresh);
    } catch (fetchError) {
      // Keep the list version if the lookup fails.
      console.warn('detectAnomalyByKey failed:', fetchError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="ml1-panel">
      <header className="ml1-hero">
        <div>
          <span className="ml1-eyebrow">Model A · ML anomaly detection</span>
          <h1>Anomaly Panel</h1>
          <p>
            Each reading is compared against a regression model's expected
            energy. Severity, type and recommended actions come from the ML1
            backend — no raw energy thresholds are used here.
          </p>
        </div>

        <div className="ml1-hero-actions">
          <button
            type="button"
            className="ml1-refresh-btn"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <StatusBanner
        status={error ? 'error' : data ? 'ok' : 'pending'}
        error={error}
      />

      <div className="ml1-summary-grid">
        <MetricCard
          label="Readings analysed"
          value={summary.total}
          helper={data ? `at ${data.timestamp}` : '—'}
        />
        <MetricCard
          label="Flagged anomalies"
          value={summary.flagged}
          helper="non-Normal severity"
        />
        <MetricCard
          label="Highest anomaly score"
          value={summary.topScore === null ? '—' : NUMBER_FMT.format(summary.topScore)}
          helper={summary.topWhere || '—'}
        />
        <MetricCard
          label="Model R²"
          value={metrics?.metrics?.r2 != null ? metrics.metrics.r2.toFixed(3) : '—'}
          helper={metrics ? metrics.model : 'metrics unavailable'}
        />
      </div>

      <div className="ml1-body">
        <section className="ml1-list-col">
          <div className="ml1-list-controls">
            <h3>Latest anomalies</h3>
            <select
              value={floorFilter}
              onChange={(event) => setFloorFilter(event.target.value)}
            >
              {floorOptions.map((floor) => (
                <option key={floor} value={floor}>
                  {floor === 'All' ? 'All floors' : floorLabel(floor)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="ml1-empty">Loading anomalies from ML1…</div>
          ) : error ? (
            <div className="ml1-empty">
              Could not load anomalies. Make sure the ML1 API is running at
              <code> http://localhost:8000</code>.
            </div>
          ) : filtered.length === 0 ? (
            <div className="ml1-empty">No anomalies for this floor.</div>
          ) : (
            <div className="ml1-list">
              {filtered.map((item) => (
                <AnomalyCard
                  key={`${item.floor_id}-${item.room_id}`}
                  item={item}
                  onSelect={handleSelect}
                  isActive={
                    selected &&
                    selected.floor_id === item.floor_id &&
                    selected.room_id === item.room_id
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="ml1-detail-col">
          <div className="ml1-list-controls">
            <h3>Explanation</h3>
          </div>
          <AnomalyDetail item={selected} loading={detailLoading} />
        </section>
      </div>

      <footer className="ml1-footer">
        Severity and explanations are produced by Model A (ML1). The frontend
        only renders what the backend returns.
      </footer>
    </div>
  );
}
