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
import energyData from './modelA_unified_10floor_dashboard_dataset.json';
import './AnomalyDetectionDashboard.css';

const COLORS = {
  energy: '#38bdf8',
  water: '#2dd4bf',
  temp: '#fb923c',
  workload: '#818cf8',
  maintenance: '#f87171',
  normal: '#34d399',
  warning: '#fbbf24',
};

const TYPE_COLORS = {
  'High energy anomaly': '#f87171',
  'Low energy anomaly': '#34d399',
  'Temperature anomaly': '#fb923c',
  'Water usage anomaly': '#2dd4bf',
  'Workload anomaly': '#818cf8',
  'Maintenance anomaly': '#fbbf24',
  'Pattern anomaly': '#94a3b8',
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

function std(values) {
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

function getFloorRows() {
  const rows = [];

  energyData.forEach((day) => {
    Object.entries(day.levels || {}).forEach(([levelId, level]) => {
      if (!level?.available) return;

      let totalEnergy = 0;
      let totalWater = 0;
      let tempSum = 0;
      let tempCount = 0;
      let ac = 0;
      let light = 0;
      let plug = 0;

      Object.values(level.rooms || {}).forEach((room) => {
        totalEnergy += Number(room.total) || 0;
        totalWater += Number(room.water) || 0;
        ac += Number(room.ac) || 0;
        light += Number(room.light) || 0;
        plug += Number(room.plug) || 0;

        const temp = Number(room.temperature);
        if (Number.isFinite(temp)) {
          tempSum += temp;
          tempCount += 1;
        }
      });

      const telemetry = level.acbTelemetry || {};
      const floorNumber = Number(levelId.replace('Level_', ''));

      rows.push({
        date: day.date,
        label: dateLabel(day.date),
        floorId: levelId,
        floor: `Floor ${floorNumber}`,
        floorNumber,
        energy: totalEnergy,
        water: totalWater,
        temperature: tempCount ? tempSum / tempCount : Number(telemetry.avg_temp_c) || 0,
        rackUtilization: Number(telemetry.avg_rack_utilization_percent) || 0,
        availableCapacity: Number(telemetry.available_capacity_percent) || 0,
        efficiency: Number(telemetry.efficiency_score) || 0,
        maintenance: Number(telemetry.maintenance_rack_percent) || 0,
        ac,
        light,
        plug,
      });
    });
  });

  return rows;
}

function explainAnomaly(row, stats) {
  const zEnergy = (row.energy - stats.energy.mean) / stats.energy.std;
  const zWater = (row.water - stats.water.mean) / stats.water.std;
  const zTemp = (row.temperature - stats.temperature.mean) / stats.temperature.std;
  const zRack = (row.rackUtilization - stats.rackUtilization.mean) / stats.rackUtilization.std;
  const zMaintenance = (row.maintenance - stats.maintenance.mean) / stats.maintenance.std;

  const checks = [
    { key: 'energy', abs: Math.abs(zEnergy), z: zEnergy },
    { key: 'water', abs: Math.abs(zWater), z: zWater },
    { key: 'temperature', abs: Math.abs(zTemp), z: zTemp },
    { key: 'rack', abs: Math.abs(zRack), z: zRack },
    { key: 'maintenance', abs: Math.abs(zMaintenance), z: zMaintenance },
  ];

  const dominant = checks.sort((a, b) => b.abs - a.abs)[0];

  if (dominant.key === 'energy') {
    return {
      type: dominant.z >= 0 ? 'High energy anomaly' : 'Low energy anomaly',
      reason:
        dominant.z >= 0
          ? 'Energy usage is much higher than the normal floor pattern.'
          : 'Energy usage is much lower than the normal floor pattern.',
      action:
        dominant.z >= 0
          ? 'Check AC schedule, plug load and after-hours equipment usage.'
          : 'Check whether sensors, meters or equipment are reporting correctly.',
    };
  }

  if (dominant.key === 'water') {
    return {
      type: 'Water usage anomaly',
      reason: 'Water usage is far from the normal daily floor pattern.',
      action: 'Check possible leakage, cooling water demand or abnormal facility use.',
    };
  }

  if (dominant.key === 'temperature') {
    return {
      type: 'Temperature anomaly',
      reason: 'Average floor temperature is outside the expected pattern.',
      action: 'Review cooling performance, thermostat settings and AC operation.',
    };
  }

  if (dominant.key === 'rack') {
    return {
      type: 'Workload anomaly',
      reason: 'Rack utilization is unusual compared with the building pattern.',
      action: 'Review workload distribution and available capacity for this floor.',
    };
  }

  if (dominant.key === 'maintenance') {
    return {
      type: 'Maintenance anomaly',
      reason: 'Maintenance rack percentage is unusually high.',
      action: 'Prioritize this floor for equipment inspection or maintenance planning.',
    };
  }

  return {
    type: 'Pattern anomaly',
    reason: 'The floor pattern is unusual across multiple indicators.',
    action: 'Review energy, water, temperature and workload readings together.',
  };
}

function buildAnomalyData() {
  const rows = getFloorRows();

  const metrics = ['energy', 'water', 'temperature', 'rackUtilization', 'maintenance'];
  const stats = {};

  metrics.forEach((metric) => {
    const values = rows.map((row) => Number(row[metric]) || 0);
    stats[metric] = {
      mean: mean(values),
      std: std(values),
    };
  });

  const scoredRows = rows.map((row) => {
    const energyZ = (row.energy - stats.energy.mean) / stats.energy.std;
    const waterZ = (row.water - stats.water.mean) / stats.water.std;
    const tempZ = (row.temperature - stats.temperature.mean) / stats.temperature.std;
    const rackZ = (row.rackUtilization - stats.rackUtilization.mean) / stats.rackUtilization.std;
    const maintenanceZ = (row.maintenance - stats.maintenance.mean) / stats.maintenance.std;

    const anomalyScore =
      Math.abs(energyZ) * 0.35 +
      Math.abs(waterZ) * 0.15 +
      Math.abs(tempZ) * 0.2 +
      Math.abs(rackZ) * 0.2 +
      Math.abs(maintenanceZ) * 0.1;

    return {
      ...row,
      energyZ,
      waterZ,
      tempZ,
      rackZ,
      maintenanceZ,
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
      ? explainAnomaly(row, stats)
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

function ChartCard({ title, description, children, wide = false }) {
  return (
    <section className={`anomaly-card ${wide ? 'anomaly-card-wide' : ''}`}>
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
  return (
    <span
      className="anomaly-type-pill"
      style={{
        color: TYPE_COLORS[type] || '#94a3b8',
        borderColor: `${TYPE_COLORS[type] || '#94a3b8'}66`,
        backgroundColor: `${TYPE_COLORS[type] || '#94a3b8'}1f`,
      }}
    >
      {type}
    </span>
  );
}

export default function AnomalyDetectionDashboard() {
  const [selectedFloor, setSelectedFloor] = useState('All');

  const anomalyData = useMemo(() => buildAnomalyData(), []);
  const allRows = anomalyData.rows;

  const floorOptions = useMemo(
    () => ['All', ...Array.from(new Set(allRows.map((row) => row.floor))).sort((a, b) => Number(a.replace('Floor ', '')) - Number(b.replace('Floor ', '')))],
    [allRows]
  );

  const visibleRows = useMemo(() => {
    if (selectedFloor === 'All') return allRows;
    return allRows.filter((row) => row.floor === selectedFloor);
  }, [allRows, selectedFloor]);

  const anomalies = visibleRows
    .filter((row) => row.isAnomaly)
    .sort((a, b) => b.anomalyScore - a.anomalyScore);

  const dailyTrend = useMemo(() => {
    const map = new Map();

    visibleRows.forEach((row) => {
      if (!map.has(row.date)) {
        map.set(row.date, {
          date: row.date,
          label: row.label,
          anomalyCount: 0,
          normalCount: 0,
          avgScore: 0,
          scoreSum: 0,
          rowCount: 0,
        });
      }

      const item = map.get(row.date);
      item.rowCount += 1;
      item.scoreSum += row.anomalyScore;
      if (row.isAnomaly) item.anomalyCount += 1;
      else item.normalCount += 1;
      item.avgScore = item.scoreSum / item.rowCount;
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
          avgEnergy: 0,
          avgTemperature: 0,
          scoreSum: 0,
          energySum: 0,
          tempSum: 0,
          records: 0,
        });
      }

      const item = map.get(row.floor);
      item.records += 1;
      item.scoreSum += row.anomalyScore;
      item.energySum += row.energy;
      item.tempSum += row.temperature;
      if (row.isAnomaly) item.anomalyCount += 1;
      item.avgEnergy = item.energySum / item.records;
      item.avgTemperature = item.tempSum / item.records;
      item.avgScore = item.scoreSum / item.records;
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
  const anomalyRate = visibleRows.length ? (anomalies.length / visibleRows.length) * 100 : 0;

  return (
    <div className="anomaly-dashboard">
      <header className="anomaly-hero">
        <div>
          <span className="anomaly-eyebrow">Model A unified dataset</span>
          <h1>Anomaly Detection Dashboard</h1>
          <p>
            Detects unusual sustainability patterns using the same 10-floor data used by the
            main dashboard and 3D heatmap.
          </p>
        </div>

        <div className="anomaly-filter">
          <span>Floor filter</span>
          <select value={selectedFloor} onChange={(event) => setSelectedFloor(event.target.value)}>
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
              <span>Water</span>
              <strong>{formatCompact(critical.water)} L</strong>
            </div>
            <div>
              <span>Temperature</span>
              <strong>{formatNumber(critical.temperature, 1)} °C</strong>
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

      <div className="anomaly-chart-grid">
        <ChartCard
          title="Daily Anomaly Trend"
          description="Number of detected floor anomalies per day"
          wide
        >
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={dailyTrend} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.13)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="anomalyCount" name="Anomalies" fill={COLORS.maintenance} radius={[6, 6, 0, 0]} />
              <Line dataKey="avgScore" name="Avg score" stroke={COLORS.warning} strokeWidth={2.5} dot={false} />
              <ReferenceLine y={anomalyData.threshold} stroke={COLORS.warning} strokeDasharray="5 5" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Anomalies by Floor"
          description="Which floors show the most unusual patterns"
          wide
        >
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={floorSummary} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.13)" strokeDasharray="3 3" />
              <XAxis dataKey="floor" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="anomalyCount" name="Anomaly count" radius={[6, 6, 0, 0]}>
                {floorSummary.map((row, index) => (
                  <Cell key={row.floor} fill={index % 2 === 0 ? COLORS.energy : COLORS.workload} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Anomaly Type Split"
          description="Breakdown by main cause"
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
          title="Floor Score Profile"
          description="Average anomaly score by floor"
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
                <th>Water</th>
                <th>Temp</th>
                <th>Score</th>
                <th>Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.slice(0, 20).map((row) => (
                <tr key={`${row.date}-${row.floor}`}>
                  <td>{row.date}</td>
                  <td>{row.floor}</td>
                  <td>
                    <TypePill type={row.anomalyType} />
                  </td>
                  <td>{formatCompact(row.energy)} kWh</td>
                  <td>{formatCompact(row.water)} L</td>
                  <td>{formatNumber(row.temperature, 1)} °C</td>
                  <td>{formatNumber(row.anomalyScore, 2)}</td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="anomaly-footer">
        Detection method: weighted z-score across energy, water, temperature, rack utilization and maintenance indicators.
      </footer>
    </div>
  );
}
