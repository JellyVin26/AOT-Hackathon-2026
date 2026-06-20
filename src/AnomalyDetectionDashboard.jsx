import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import energyData from './original_10floor_energy_co2_waste_ac_fixed_dataset.json';
import './AnomalyDetectionDashboard.css';

const COLORS = {
  energy: '#38bdf8',
  co2: '#34d399',
  waste: '#a78bfa',
  water: '#2dd4bf',
  temp: '#fb923c',
  warning: '#fbbf24',
  danger: '#f87171',
};

const TYPE_COLORS = {
  'High energy anomaly': '#f87171',
  'High CO₂ anomaly': '#34d399',
  'Waste anomaly': '#a78bfa',
  'Water anomaly': '#2dd4bf',
  'Temperature anomaly': '#fb923c',
  Normal: '#94a3b8',
};

function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(Number(value) || 0);
}

function formatCompact(value) {
  return new Intl.NumberFormat('en', {
    notation: Math.abs(Number(value) || 0) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

function dateLabel(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length <= 1) return 1;
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
    values.length;
  return Math.sqrt(variance) || 1;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

function zScore(value, stat) {
  if (!stat || !stat.std) return 0;
  return (Number(value || 0) - stat.mean) / stat.std;
}

function getFloorRows() {
  const rows = [];

  energyData.forEach((day) => {
    Object.entries(day.levels || {}).forEach(([levelId, level]) => {
      if (!level?.available) return;

      let energy = 0;
      let co2 = 0;
      let water = 0;
      let waste = 0;
      let tempSum = 0;
      let tempCount = 0;

      Object.values(level.rooms || {}).forEach((room) => {
        const roomEnergy = Number(room.total) || 0;
        const roomCo2 = Number(room.co2EmissionKg) || roomEnergy * 0.758;
        const roomWater = Number(room.water) || 0;
        const roomWaste =
          Number(room.totalWasteKg) ||
          Number(room.waste?.totalWasteKg) ||
          0;
        const roomTemp = Number(room.temperature);

        energy += roomEnergy;
        co2 += roomCo2;
        water += roomWater;
        waste += roomWaste;

        if (Number.isFinite(roomTemp)) {
          tempSum += roomTemp;
          tempCount += 1;
        }
      });

      const floorNumber = Number(levelId.replace('Level_', ''));

      rows.push({
        id: `${day.date}-${levelId}`,
        date: day.date,
        label: dateLabel(day.date),
        floorId: levelId,
        floor: `Floor ${floorNumber}`,
        floorNumber,
        energy,
        co2,
        water,
        waste,
        temperature: tempCount ? tempSum / tempCount : 0,
      });
    });
  });

  return rows;
}

function getStats(rows) {
  const metrics = ['energy', 'co2', 'waste', 'water', 'temperature'];
  const stats = {};

  metrics.forEach((metric) => {
    const values = rows.map((row) => Number(row[metric]) || 0);
    stats[metric] = {
      mean: mean(values),
      std: standardDeviation(values),
    };
  });

  return stats;
}

function classifyAnomaly(row, scores) {
  const checks = [
    { key: 'energy', label: 'High energy anomaly', value: scores.energy },
    { key: 'co2', label: 'High CO₂ anomaly', value: scores.co2 },
    { key: 'waste', label: 'Waste anomaly', value: scores.waste },
    { key: 'water', label: 'Water anomaly', value: scores.water },
    { key: 'temperature', label: 'Temperature anomaly', value: scores.temperature },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const main = checks[0];

  if (main.key === 'energy') {
    return {
      type: main.label,
      reason: 'Energy usage is much higher than the normal floor pattern.',
      action: 'Check AC load, plug load and after-hours equipment usage.',
    };
  }

  if (main.key === 'co2') {
    return {
      type: main.label,
      reason: 'CO₂ emission is high because the energy usage is high.',
      action: 'Reduce unnecessary electricity use and check high-consumption equipment.',
    };
  }

  if (main.key === 'waste') {
    return {
      type: main.label,
      reason: 'Waste generation is higher than the normal floor pattern.',
      action: 'Check rubbish, food waste, recyclable waste and e-waste disposal.',
    };
  }

  if (main.key === 'water') {
    return {
      type: main.label,
      reason: 'Water usage is higher than the normal floor pattern.',
      action: 'Check possible leakage, cleaning schedule or facility usage.',
    };
  }

  return {
    type: 'Temperature anomaly',
    reason: 'Average temperature is outside the expected pattern.',
    action: 'Review cooling performance and thermostat settings.',
  };
}

function buildAnomalyData() {
  const rows = getFloorRows();
  const stats = getStats(rows);

  const scoredRows = rows.map((row) => {
    const scores = {
      energy: zScore(row.energy, stats.energy),
      co2: zScore(row.co2, stats.co2),
      waste: zScore(row.waste, stats.waste),
      water: zScore(row.water, stats.water),
      temperature: zScore(row.temperature, stats.temperature),
    };

    const anomalyScore =
      Math.abs(scores.energy) * 0.3 +
      Math.abs(scores.co2) * 0.25 +
      Math.abs(scores.waste) * 0.25 +
      Math.abs(scores.water) * 0.1 +
      Math.abs(scores.temperature) * 0.1;

    return {
      ...row,
      scores,
      anomalyScore,
    };
  });

  const threshold = percentile(
    scoredRows.map((row) => row.anomalyScore),
    0.9
  );

  const finalRows = scoredRows.map((row) => {
    const isAnomaly = row.anomalyScore >= threshold;
    const explanation = isAnomaly
      ? classifyAnomaly(row, row.scores)
      : {
          type: 'Normal',
          reason: 'No unusual pattern detected.',
          action: 'No action required.',
        };

    return {
      ...row,
      isAnomaly,
      anomalyType: explanation.type,
      reason: explanation.reason,
      action: explanation.action,
    };
  });

  return {
    rows: finalRows,
    threshold,
  };
}

function KpiCard({ label, value, unit, tone }) {
  return (
    <div className={`anomaly-kpi-card ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  );
}

function ChartCard({ title, description, children }) {
  return (
    <section className="anomaly-card">
      <div className="anomaly-card-header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="anomaly-chart-body">{children}</div>
    </section>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="anomaly-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey} className="anomaly-tooltip-row">
          <span style={{ background: item.color }} />
          <p>{item.name}</p>
          <b>{formatCompact(item.value)}</b>
        </div>
      ))}
    </div>
  );
}

function TypePill({ type }) {
  const color = TYPE_COLORS[type] || '#94a3b8';

  return (
    <span
      className="anomaly-type-pill"
      style={{
        color,
        borderColor: `${color}66`,
        backgroundColor: `${color}1f`,
      }}
    >
      {type}
    </span>
  );
}

function buildAiPayload({
  selectedFloor,
  visibleRows,
  anomalies,
  critical,
  anomalyRate,
  typeSummary,
  floorSummary,
}) {
  return {
    dashboard_type: 'multi-resource anomaly dashboard',
    selected_floor: selectedFloor,
    summary: {
      records_checked: visibleRows.length,
      anomaly_count: anomalies.length,
      anomaly_rate: Number(anomalyRate.toFixed(2)),
      detection_method:
        'Weighted z-score across energy, CO2 emission, waste, water and temperature indicators',
      threshold_basis: 'Top 10% anomaly score',
    },
    anomaly_type_summary: typeSummary,
    floor_summary: floorSummary.map((item) => ({
      floor: item.floor,
      anomaly_count: item.anomalyCount,
      average_score: Number((item.avgScore || 0).toFixed(3)),
      records: item.records,
    })),
    most_critical_anomaly: critical
      ? {
          date: critical.date,
          floor: critical.floor,
          anomaly_type: critical.anomalyType,
          energy_kwh: Number(critical.energy.toFixed(2)),
          co2_kg: Number(critical.co2.toFixed(2)),
          waste_kg: Number(critical.waste.toFixed(2)),
          water: Number(critical.water.toFixed(2)),
          temperature: Number(critical.temperature.toFixed(2)),
          anomaly_score: Number(critical.anomalyScore.toFixed(3)),
          reason: critical.reason,
          current_recommended_action: critical.action,
        }
      : null,
    top_anomalies: anomalies.slice(0, 10).map((row) => ({
      date: row.date,
      floor: row.floor,
      anomaly_type: row.anomalyType,
      energy_kwh: Number(row.energy.toFixed(2)),
      co2_kg: Number(row.co2.toFixed(2)),
      waste_kg: Number(row.waste.toFixed(2)),
      water: Number(row.water.toFixed(2)),
      temperature: Number(row.temperature.toFixed(2)),
      anomaly_score: Number(row.anomalyScore.toFixed(3)),
      reason: row.reason,
      current_recommended_action: row.action,
    })),
  };
}

export default function AnomalyDetectionDashboard() {
  const [selectedFloor, setSelectedFloor] = useState('All');
  const [aiInsight, setAiInsight] = useState(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [aiInsightError, setAiInsightError] = useState('');

  const anomalyData = useMemo(() => buildAnomalyData(), []);
  const allRows = anomalyData.rows;

  const floorOptions = useMemo(() => {
    const floors = Array.from(new Set(allRows.map((row) => row.floor))).sort(
      (a, b) => Number(a.replace('Floor ', '')) - Number(b.replace('Floor ', ''))
    );
    return ['All', ...floors];
  }, [allRows]);

  const visibleRows = useMemo(() => {
    if (selectedFloor === 'All') return allRows;
    return allRows.filter((row) => row.floor === selectedFloor);
  }, [allRows, selectedFloor]);

  const anomalies = useMemo(
    () =>
      visibleRows
        .filter((row) => row.isAnomaly)
        .sort((a, b) => b.anomalyScore - a.anomalyScore),
    [visibleRows]
  );

  const dailyTrend = useMemo(() => {
    const map = new Map();

    visibleRows.forEach((row) => {
      if (!map.has(row.date)) {
        map.set(row.date, {
          date: row.date,
          label: row.label,
          anomalyCount: 0,
          scoreSum: 0,
          records: 0,
        });
      }

      const item = map.get(row.date);
      item.records += 1;
      item.scoreSum += row.anomalyScore;
      item.avgScore = item.scoreSum / item.records;

      if (row.isAnomaly) {
        item.anomalyCount += 1;
      }
    });

    return Array.from(map.values());
  }, [visibleRows]);

  const floorSummary = useMemo(() => {
    const map = new Map();

    visibleRows.forEach((row) => {
      if (!map.has(row.floor)) {
        map.set(row.floor, {
          floor: row.floor,
          floorNumber: row.floorNumber,
          anomalyCount: 0,
          energySum: 0,
          co2Sum: 0,
          wasteSum: 0,
          scoreSum: 0,
          records: 0,
        });
      }

      const item = map.get(row.floor);
      item.records += 1;
      item.energySum += row.energy;
      item.co2Sum += row.co2;
      item.wasteSum += row.waste;
      item.scoreSum += row.anomalyScore;
      item.avgScore = item.scoreSum / item.records;

      if (row.isAnomaly) {
        item.anomalyCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.floorNumber - b.floorNumber);
  }, [visibleRows]);

  const typeSummary = useMemo(() => {
    const map = new Map();

    anomalies.forEach((row) => {
      map.set(row.anomalyType, (map.get(row.anomalyType) || 0) + 1);
    });

    return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
  }, [anomalies]);

  const critical = anomalies[0];
  const anomalyRate = visibleRows.length
    ? (anomalies.length / visibleRows.length) * 100
    : 0;

  const handleGenerateAiInsight = async () => {
    try {
      setIsGeneratingInsight(true);
      setAiInsightError('');
      setAiInsight(null);

      const payload = buildAiPayload({
        selectedFloor,
        visibleRows,
        anomalies,
        critical,
        anomalyRate,
        typeSummary,
        floorSummary,
      });

      const response = await fetch('http://localhost:8001/generate-ai-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.error || 'Failed to generate AI insight.');
      }

      setAiInsight(data.insight);
    } catch (error) {
      console.error(error);
      setAiInsightError(error.message || 'Failed to generate AI insight.');
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  return (
    <div className="anomaly-dashboard">
      <header className="anomaly-hero">
        <div>
          <span className="anomaly-eyebrow">Original 10-floor dataset</span>
          <h1>Anomaly Detection Dashboard</h1>
          <p>
            Detects unusual energy, CO₂ emission, waste, water and temperature patterns
            using the same dataset as the dashboard and 3D heatmap.
          </p>
        </div>

        <div className="anomaly-filter">
          <span>Floor filter</span>
          <select
            value={selectedFloor}
            onChange={(event) => {
              setSelectedFloor(event.target.value);
              setAiInsight(null);
              setAiInsightError('');
            }}
          >
            {floorOptions.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="anomaly-kpi-grid">
        <KpiCard label="Records checked" value={formatNumber(visibleRows.length)} unit="floor-day records" />
        <KpiCard label="Anomalies found" value={formatNumber(anomalies.length)} unit="unusual patterns" tone="warning" />
        <KpiCard label="Anomaly rate" value={`${formatNumber(anomalyRate, 1)}%`} unit="of selected records" tone="danger" />
        <KpiCard label="Threshold score" value={formatNumber(anomalyData.threshold, 2)} unit="top 10% scored" />
      </div>

      {critical ? (
        <section className="anomaly-critical-card">
          <div>
            <span className="anomaly-eyebrow">Most critical anomaly</span>
            <h2>
              {critical.floor} · {critical.label}
            </h2>
            <TypePill type={critical.anomalyType} />
          </div>

          <div className="anomaly-critical-grid">
            <div>
              <span>Energy</span>
              <strong>{formatCompact(critical.energy)} kWh</strong>
            </div>
            <div>
              <span>CO₂</span>
              <strong>{formatCompact(critical.co2)} kg</strong>
            </div>
            <div>
              <span>Waste</span>
              <strong>{formatCompact(critical.waste)} kg</strong>
            </div>
            <div>
              <span>Score</span>
              <strong>{formatNumber(critical.anomalyScore, 2)}</strong>
            </div>
          </div>

          <div className="anomaly-critical-text">
            <p>
              <b>Reason:</b> {critical.reason}
            </p>
            <p>
              <b>Recommended action:</b> {critical.action}
            </p>
          </div>
        </section>
      ) : null}

      <section className="anomaly-card" style={{ marginTop: '18px' }}>
        <div className="anomaly-card-header">
          <h3>AI Action Plan</h3>
          <p>
            Generate a building-manager-oriented action plan from the detected anomaly summary.
          </p>
        </div>

        <button
          onClick={handleGenerateAiInsight}
          disabled={isGeneratingInsight || anomalies.length === 0}
          style={{
            border: '1px solid rgba(56, 189, 248, 0.45)',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            color: '#020617',
            padding: '11px 15px',
            borderRadius: '14px',
            fontWeight: 800,
            cursor: isGeneratingInsight || anomalies.length === 0 ? 'not-allowed' : 'pointer',
            opacity: isGeneratingInsight || anomalies.length === 0 ? 0.55 : 1,
          }}
        >
          {isGeneratingInsight ? 'Generating...' : 'Generate AI Action Plan'}
        </button>

        {aiInsightError ? (
          <p style={{ color: '#f87171', marginTop: '14px', fontWeight: 700 }}>
            {aiInsightError}
          </p>
        ) : null}

{aiInsight ? (
  <div style={{ marginTop: '20px', display: 'grid', gap: '18px' }}>
    <div
      style={{
        padding: '18px',
        borderRadius: '18px',
        background:
          'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(15, 23, 42, 0.9))',
        border: '1px solid rgba(56, 189, 248, 0.28)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-flex',
              marginBottom: '8px',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            AI Summary
          </span>

          <h3 style={{ margin: 0, color: '#f8fafc' }}>
            {aiInsight.overall_priority} Priority Action Plan
          </h3>
        </div>

        <span
          style={{
            padding: '8px 12px',
            borderRadius: '999px',
            color:
              aiInsight.overall_priority === 'High'
                ? '#f87171'
                : aiInsight.overall_priority === 'Medium'
                  ? '#fbbf24'
                  : '#34d399',
            background:
              aiInsight.overall_priority === 'High'
                ? 'rgba(248, 113, 113, 0.14)'
                : aiInsight.overall_priority === 'Medium'
                  ? 'rgba(251, 191, 36, 0.14)'
                  : 'rgba(52, 211, 153, 0.14)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            fontWeight: 800,
          }}
        >
          {aiInsight.overall_priority}
        </span>
      </div>

      <p style={{ margin: '14px 0 0', color: '#cbd5e1', lineHeight: 1.7 }}>
        {aiInsight.key_insight}
      </p>
    </div>

    <div
      style={{
        padding: '18px',
        borderRadius: '18px',
        background: 'rgba(15, 23, 42, 0.78)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
      }}
    >
      <h4 style={{ margin: '0 0 10px', color: '#f8fafc' }}>
        What this means
      </h4>
      <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.7 }}>
        {aiInsight.manager_explanation}
      </p>
    </div>

    <div>
      <h4 style={{ margin: '0 0 12px', color: '#f8fafc' }}>
        Immediate Actions
      </h4>

      <div style={{ display: 'grid', gap: '12px' }}>
        {aiInsight.immediate_actions?.map((item, index) => (
          <div
            key={index}
            style={{
              padding: '16px',
              borderRadius: '16px',
              background: 'rgba(30, 41, 59, 0.72)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  minWidth: '30px',
                  height: '30px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(56, 189, 248, 0.16)',
                  color: '#38bdf8',
                  fontWeight: 800,
                }}
              >
                {item.priority || index + 1}
              </span>

              <div>
                <h5 style={{ margin: 0, color: '#f8fafc', fontSize: '15px' }}>
                  {item.action}
                </h5>

                <p style={{ margin: '8px 0', color: '#94a3b8', lineHeight: 1.6 }}>
                  {item.why}
                </p>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginTop: '10px',
                  }}
                >
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: '999px',
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Target: {item.target_zone}
                  </span>

                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: '999px',
                      background: 'rgba(251, 191, 36, 0.12)',
                      color: '#fbbf24',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    When: {item.when}
                  </span>
                </div>

                <p style={{ margin: '10px 0 0', color: '#cbd5e1', lineHeight: 1.6 }}>
                  <b>Expected impact:</b> {item.expected_impact}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '14px',
      }}
    >
      <div
        style={{
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.78)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
        }}
      >
        <h4 style={{ margin: '0 0 10px', color: '#f8fafc' }}>
          Short-term Actions
        </h4>

        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {aiInsight.short_term_actions?.map((item, index) => (
            <li
              key={index}
              style={{
                color: '#94a3b8',
                marginBottom: '10px',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: '#cbd5e1' }}>{item.action}</strong>
              <br />
              <span>{item.timeframe}</span>
              <br />
              <span>{item.why}</span>
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.78)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
        }}
      >
        <h4 style={{ margin: '0 0 10px', color: '#f8fafc' }}>
          Data to Collect Next
        </h4>

        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {aiInsight.data_to_collect_next?.map((item, index) => (
            <li
              key={index}
              style={{
                color: '#94a3b8',
                marginBottom: '8px',
                lineHeight: 1.6,
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.78)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
        }}
      >
        <h4 style={{ margin: '0 0 10px', color: '#f8fafc' }}>
          Follow-up Checks
        </h4>

        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {aiInsight.follow_up_checks?.map((item, index) => (
            <li
              key={index}
              style={{
                color: '#94a3b8',
                marginBottom: '8px',
                lineHeight: 1.6,
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>

    <details
      style={{
        padding: '16px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(148, 163, 184, 0.14)',
      }}
    >
      <summary
        style={{
          color: '#f8fafc',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        View risk explanation and limitations
      </summary>

      <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
        <div>
          <h4 style={{ color: '#f8fafc', margin: '0 0 6px' }}>
            Risk Explanation
          </h4>
          <p style={{ color: '#94a3b8', lineHeight: 1.65 }}>
            {aiInsight.risk_explanation}
          </p>
        </div>

        <div>
          <h4 style={{ color: '#f8fafc', margin: '0 0 6px' }}>
            Limitations
          </h4>
          <p style={{ color: '#94a3b8', lineHeight: 1.65 }}>
            {aiInsight.limitations}
          </p>
        </div>
      </div>
    </details>
  </div>
) : null}
      </section>

      <div className="anomaly-chart-grid">
        <ChartCard
          title="Daily Anomaly Trend"
          description="Number of detected anomalies per day"
        >
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={dailyTrend} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.13)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="anomalyCount" name="Anomalies" fill={COLORS.danger} radius={[6, 6, 0, 0]} />
              <Line dataKey="avgScore" name="Avg score" stroke={COLORS.warning} strokeWidth={2.5} dot={false} />
              <ReferenceLine y={anomalyData.threshold} stroke={COLORS.warning} strokeDasharray="5 5" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Anomalies by Floor"
          description="Which floors show the most unusual patterns"
        >
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={floorSummary} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.13)" strokeDasharray="3 3" />
              <XAxis dataKey="floor" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="anomalyCount" name="Anomaly count" radius={[6, 6, 0, 0]}>
                {floorSummary.map((row, index) => (
                  <Cell key={row.floor} fill={index % 2 === 0 ? COLORS.energy : COLORS.waste} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Anomaly Type Split"
          description="Breakdown by the main detected cause"
        >
          <ResponsiveContainer width="100%" height={285}>
            <PieChart>
              <Pie data={typeSummary} dataKey="count" nameKey="type" innerRadius={54} outerRadius={96} paddingAngle={4}>
                {typeSummary.map((row) => (
                  <Cell key={row.type} fill={TYPE_COLORS[row.type] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Average Score by Floor"
          description="Higher score means stronger unusual pattern"
        >
          <ResponsiveContainer width="100%" height={285}>
            <BarChart data={floorSummary} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.13)" strokeDasharray="3 3" />
              <XAxis dataKey="floor" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgScore" name="Average score" fill={COLORS.warning} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="anomaly-table-card">
        <div className="anomaly-card-header">
          <h3>Top Detected Anomalies</h3>
          <p>Showing the strongest anomaly records from the selected floor range.</p>
        </div>

        <div className="anomaly-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Floor</th>
                <th>Type</th>
                <th>Energy</th>
                <th>CO₂</th>
                <th>Waste</th>
                <th>Score</th>
                <th>Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.slice(0, 20).map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.floor}</td>
                  <td>
                    <TypePill type={row.anomalyType} />
                  </td>
                  <td>{formatCompact(row.energy)} kWh</td>
                  <td>{formatCompact(row.co2)} kg</td>
                  <td>{formatCompact(row.waste)} kg</td>
                  <td>{formatNumber(row.anomalyScore, 2)}</td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="anomaly-footer">
        Detection method: weighted z-score across energy, CO₂ emission, waste, water and temperature indicators.
      </footer>
    </div>
  );
}