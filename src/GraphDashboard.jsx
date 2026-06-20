import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import energyData from './modelA_unified_10floor_dashboard_dataset.json';
import './GraphDashboard.css';

const TIME_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const GRAPH_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'floors', label: 'Floors' },
  { id: 'rooms', label: 'Rooms' },
];

const palette = {
  power: '#38bdf8',
  water: '#2dd4bf',
  temp: '#fb923c',
  ac: '#38bdf8',
  light: '#fbbf24',
  plug: '#f472b6',
  floorA: '#38bdf8',
  floorB: '#818cf8',
  floorC: '#34d399',
  floorD: '#fbbf24',
  floorE: '#f472b6',
};

const chartMargin = { top: 12, right: 14, left: 0, bottom: 0 };

const formatCompact = (value) =>
  new Intl.NumberFormat('en', {
    notation: Math.abs(Number(value) || 0) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value || 0);

const formatNumber = (value, decimals = 0) =>
  new Intl.NumberFormat('en', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value || 0);

const getMonthLabel = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const getWeekLabel = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function summariseRow(row) {
  const summary = {
    date: row.date,
    label: row.date.slice(5),
    totalEnergy: 0,
    totalWater: 0,
    temperatureSum: 0,
    temperatureCount: 0,
    ac: 0,
    light: 0,
    plug: 0,
    floorEnergy: {},
    floorWater: {},
    floorTempSum: {},
    floorTempCount: {},
    roomEnergy: {},
    roomWater: {},
    roomTempSum: {},
    roomTempCount: {},
  };

  Object.entries(row.levels || {}).forEach(([levelId, level]) => {
    if (!level?.available) return;

    Object.entries(level.rooms || {}).forEach(([roomId, room]) => {
      const energy = Number(room.total) || 0;
      const water = Number(room.water) || 0;
      const temp = Number(room.temperature);
      const ac = Number(room.ac) || 0;
      const light = Number(room.light) || 0;
      const plug = Number(room.plug) || 0;

      summary.totalEnergy += energy;
      summary.totalWater += water;
      summary.ac += ac;
      summary.light += light;
      summary.plug += plug;

      summary.floorEnergy[levelId] = (summary.floorEnergy[levelId] || 0) + energy;
      summary.floorWater[levelId] = (summary.floorWater[levelId] || 0) + water;

      summary.roomEnergy[roomId] = (summary.roomEnergy[roomId] || 0) + energy;
      summary.roomWater[roomId] = (summary.roomWater[roomId] || 0) + water;

      if (Number.isFinite(temp)) {
        summary.temperatureSum += temp;
        summary.temperatureCount += 1;

        summary.floorTempSum[levelId] = (summary.floorTempSum[levelId] || 0) + temp;
        summary.floorTempCount[levelId] = (summary.floorTempCount[levelId] || 0) + 1;

        summary.roomTempSum[roomId] = (summary.roomTempSum[roomId] || 0) + temp;
        summary.roomTempCount[roomId] = (summary.roomTempCount[roomId] || 0) + 1;
      }
    });
  });

  summary.avgTemperature = summary.temperatureCount
    ? summary.temperatureSum / summary.temperatureCount
    : 0;

  return summary;
}

function combineSummaries(rows, label) {
  const combined = {
    label,
    totalEnergy: 0,
    totalWater: 0,
    temperatureSum: 0,
    temperatureCount: 0,
    ac: 0,
    light: 0,
    plug: 0,
    floorEnergy: {},
    floorWater: {},
    floorTempSum: {},
    floorTempCount: {},
    roomEnergy: {},
    roomWater: {},
    roomTempSum: {},
    roomTempCount: {},
  };

  rows.forEach((row) => {
    combined.totalEnergy += row.totalEnergy;
    combined.totalWater += row.totalWater;
    combined.temperatureSum += row.temperatureSum;
    combined.temperatureCount += row.temperatureCount;
    combined.ac += row.ac;
    combined.light += row.light;
    combined.plug += row.plug;

    Object.entries(row.floorEnergy).forEach(([key, value]) => {
      combined.floorEnergy[key] = (combined.floorEnergy[key] || 0) + value;
    });

    Object.entries(row.floorWater).forEach(([key, value]) => {
      combined.floorWater[key] = (combined.floorWater[key] || 0) + value;
    });

    Object.entries(row.floorTempSum).forEach(([key, value]) => {
      combined.floorTempSum[key] = (combined.floorTempSum[key] || 0) + value;
    });

    Object.entries(row.floorTempCount).forEach(([key, value]) => {
      combined.floorTempCount[key] = (combined.floorTempCount[key] || 0) + value;
    });

    Object.entries(row.roomEnergy).forEach(([key, value]) => {
      combined.roomEnergy[key] = (combined.roomEnergy[key] || 0) + value;
    });

    Object.entries(row.roomWater).forEach(([key, value]) => {
      combined.roomWater[key] = (combined.roomWater[key] || 0) + value;
    });

    Object.entries(row.roomTempSum).forEach(([key, value]) => {
      combined.roomTempSum[key] = (combined.roomTempSum[key] || 0) + value;
    });

    Object.entries(row.roomTempCount).forEach(([key, value]) => {
      combined.roomTempCount[key] = (combined.roomTempCount[key] || 0) + value;
    });
  });

  combined.avgTemperature = combined.temperatureCount
    ? combined.temperatureSum / combined.temperatureCount
    : 0;

  return combined;
}

function aggregateData(timeUnit) {
  const daily = energyData.map(summariseRow);

  if (timeUnit === 'daily') {
    return daily;
  }

  const buckets = new Map();

  daily.forEach((row, index) => {
    let key;
    let label;

    if (timeUnit === 'monthly') {
      key = row.date.slice(0, 7);
      label = getMonthLabel(row.date);
    } else {
      const weekIndex = Math.floor(index / 7);
      key = `week-${weekIndex}`;
      label = `Week of ${getWeekLabel(daily[weekIndex * 7]?.date || row.date)}`;
    }

    if (!buckets.has(key)) {
      buckets.set(key, { label, rows: [] });
    }

    buckets.get(key).rows.push(row);
  });

  return [...buckets.values()].map((bucket) => combineSummaries(bucket.rows, bucket.label));
}

function getFloorRows(data) {
  const latest = data[data.length - 1] || {};
  return Object.keys(latest.floorEnergy || {})
    .sort((a, b) => Number(a.replace('Level_', '')) - Number(b.replace('Level_', '')))
    .map((levelId) => {
      const floorNumber = levelId.replace('Level_', '');
      const tempSum = latest.floorTempSum?.[levelId] || 0;
      const tempCount = latest.floorTempCount?.[levelId] || 0;

      return {
        name: `Floor ${floorNumber}`,
        energy: latest.floorEnergy[levelId] || 0,
        water: latest.floorWater[levelId] || 0,
        temperature: tempCount ? tempSum / tempCount : 0,
      };
    });
}

function getRoomRows(data) {
  const latest = data[data.length - 1] || {};
  return Object.keys(latest.roomEnergy || {})
    .sort()
    .map((roomId) => {
      const tempSum = latest.roomTempSum?.[roomId] || 0;
      const tempCount = latest.roomTempCount?.[roomId] || 0;

      return {
        name: roomId.replace('Room_', 'Room '),
        energy: latest.roomEnergy[roomId] || 0,
        water: latest.roomWater[roomId] || 0,
        temperature: tempCount ? tempSum / tempCount : 0,
      };
    });
}

function KpiIcon({ type }) {
  if (type === 'water') {
    return (
      <svg viewBox="0 0 24 24" className="graph-kpi-svg" aria-hidden="true">
        <path d="M12 3.2C9.2 6.5 6.5 10.2 6.5 13.3C6.5 16.7 9 19.5 12 19.5C15 19.5 17.5 16.7 17.5 13.3C17.5 10.2 14.8 6.5 12 3.2Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.8 13.8C10.1 15.1 11 16 12.3 16.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'temp') {
    return (
      <svg viewBox="0 0 24 24" className="graph-kpi-svg" aria-hidden="true">
        <path d="M10 14.7V5.8C10 4.3 11.1 3.2 12.6 3.2C14.1 3.2 15.2 4.3 15.2 5.8V14.7C16.1 15.4 16.7 16.4 16.7 17.6C16.7 19.8 14.9 21.5 12.6 21.5C10.3 21.5 8.5 19.8 8.5 17.6C8.5 16.4 9.1 15.4 10 14.7Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.6 7.2V17.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="12.6" cy="17.7" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="graph-kpi-svg" aria-hidden="true">
      <path d="M13.2 2.8L5.6 13H11L9.9 21.2L18.4 10.6H12.8L13.2 2.8Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      className={`graph-toggle ${active ? 'graph-toggle-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function GraphCard({ title, description, children, className = '' }) {
  return (
    <section className={`graph-card ${className}`}>
      <div className="graph-card-header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="graph-card-body">{children}</div>
    </section>
  );
}

function KpiCard({ label, value, unit, previous, type, decimals = 0 }) {
  const hasPrevious = typeof previous === 'number' && previous !== 0;
  const delta = hasPrevious ? ((value - previous) / previous) * 100 : 0;
  const rising = delta > 0;
  const bad = type === 'temp' ? rising : rising;

  return (
    <div className="graph-kpi-card">
      <div className="graph-kpi-top">
        <span className={`graph-icon-box graph-icon-${type}`}>
          <KpiIcon type={type} />
        </span>
        <span>{label}</span>
      </div>
      <div className="graph-kpi-value">
        <span>{formatNumber(value, decimals)}</span>
        <small>{unit}</small>
      </div>
      <div className="graph-kpi-delta">
        {hasPrevious ? (
          <span className={bad ? 'delta-bad' : 'delta-good'}>
            {rising ? '+' : ''}
            {formatNumber(delta, 1)}%
          </span>
        ) : (
          <span className="delta-neutral">—</span>
        )}
        <span>vs. previous period</span>
      </div>
    </div>
  );
}

function GraphTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="graph-tooltip">
      <div className="graph-tooltip-label">{label}</div>
      {payload.map((item) => (
        <div key={item.dataKey} className="graph-tooltip-row">
          <span style={{ backgroundColor: item.color }} />
          <p>{item.name}</p>
          <strong>{formatCompact(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function OverviewCharts({ data }) {
  return (
    <div className="graph-grid graph-grid-overview">
      <GraphCard
        title="Sustainable Building Trend"
        description="Energy and water usage from the same 10-floor dataset"
        className="graph-span-3"
      >
        <ResponsiveContainer width="100%" height={315}>
          <AreaChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Area type="monotone" dataKey="totalEnergy" name="Energy" stroke={palette.power} fill={palette.power} fillOpacity={0.15} strokeWidth={2.5} />
            <Area type="monotone" dataKey="totalWater" name="Water" stroke={palette.water} fill={palette.water} fillOpacity={0.08} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Average Building Temperature"
        description="Generated temperature data linked to room energy patterns"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={315}>
          <ComposedChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey="totalEnergy" name="Energy" fill={palette.power} fillOpacity={0.55} radius={[5, 5, 0, 0]} />
            <Line dataKey="avgTemperature" name="Temperature" stroke={palette.temp} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </GraphCard>
    </div>
  );
}

function FloorsCharts({ data }) {
  const floorRows = getFloorRows(data);
  const colours = [palette.floorA, palette.floorB, palette.floorC, palette.floorD, palette.floorE];

  return (
    <div className="graph-grid graph-grid-overview">
      <GraphCard
        title="10-Floor Energy Comparison"
        description="Latest selected period energy usage by floor"
        className="graph-span-3"
      >
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={floorRows} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey="energy" name="Energy" radius={[6, 6, 0, 0]}>
              {floorRows.map((row, index) => (
                <Cell key={row.name} fill={colours[index % colours.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Floor Water Usage"
        description="Generated water usage by floor"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={floorRows} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey="water" name="Water" fill={palette.water} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>
    </div>
  );
}

function RoomsCharts({ data }) {
  const roomRows = getRoomRows(data);

  return (
    <div className="graph-grid graph-grid-overview">
      <GraphCard
        title="Room Energy Usage"
        description="Energy usage grouped by room type across all 10 floors"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={330}>
          <PieChart>
            <Pie data={roomRows} dataKey="energy" nameKey="name" innerRadius={58} outerRadius={108} paddingAngle={4}>
              {roomRows.map((row, index) => (
                <Cell key={row.name} fill={[palette.floorA, palette.floorB, palette.floorC, palette.floorD, palette.floorE][index % 5]} />
              ))}
            </Pie>
            <Tooltip content={<GraphTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Equipment Load Breakdown"
        description="Air conditioning, lighting and plug load from the same energy dataset"
        className="graph-span-3"
      >
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Legend />
            <Bar dataKey="ac" name="AC Load" stackId="equipment" fill={palette.ac} />
            <Bar dataKey="light" name="Lighting" stackId="equipment" fill={palette.light} />
            <Bar dataKey="plug" name="Plug Load" stackId="equipment" fill={palette.plug} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>
    </div>
  );
}

export default function GraphDashboard() {
  const [timeUnit, setTimeUnit] = useState('weekly');
  const [activeTab, setActiveTab] = useState('overview');

  const data = useMemo(() => aggregateData(timeUnit), [timeUnit]);

  const kpi = useMemo(() => {
    const current = data[data.length - 1];
    const previous = data[data.length - 2];

    if (!current) return null;

    return {
      totalEnergy: current.totalEnergy,
      totalWater: current.totalWater,
      avgTemp: current.avgTemperature,
      previousEnergy: previous?.totalEnergy,
      previousWater: previous?.totalWater,
      previousAvgTemp: previous?.avgTemperature,
    };
  }, [data]);

  return (
    <div className="graph-dashboard">
      <header className="graph-header">
        <div className="graph-title-row">
          <div className="graph-logo-mark">S</div>
          <div>
            <h1>Sustainability Dashboard</h1>
            <p>Energy, water, workload and temperature insights from one unified Model A dataset</p>
          </div>
        </div>

        <div className="graph-header-actions">
          <span className="graph-mini-pill graph-power">Energy</span>
          <span className="graph-mini-pill graph-water">Water</span>
          <span className="graph-mini-pill graph-temp">Temperature</span>
          <div className="graph-toggle-group">
            {TIME_OPTIONS.map((option) => (
              <ToggleButton
                key={option.id}
                active={timeUnit === option.id}
                onClick={() => setTimeUnit(option.id)}
              >
                {option.label}
              </ToggleButton>
            ))}
          </div>
        </div>
      </header>

      {!kpi ? (
        <div className="graph-state-card">Loading 10-floor telemetry data…</div>
      ) : (
        <>
          <div className="graph-kpi-grid">
            <KpiCard label="Total Energy Usage" value={kpi.totalEnergy} unit="kWh" previous={kpi.previousEnergy} type="power" />
            <KpiCard label="Total Water Usage" value={kpi.totalWater} unit="L" previous={kpi.previousWater} type="water" />
            <KpiCard label="Avg Building Temperature" value={kpi.avgTemp} unit="°C" previous={kpi.previousAvgTemp} type="temp" decimals={1} />
          </div>

          <p className="graph-note">
            Showing {timeUnit} data from 10 floors · All 10 floors generated from the same Model A dataset
          </p>

          <div className="graph-tabs">
            {GRAPH_TABS.map((tab) => (
              <ToggleButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </ToggleButton>
            ))}
          </div>

          {activeTab === 'overview' && <OverviewCharts data={data} />}
          {activeTab === 'floors' && <FloorsCharts data={data} />}
          {activeTab === 'rooms' && <RoomsCharts data={data} />}

          <footer className="graph-footer">
            Dataset source: modelA_unified_10floor_dashboard_dataset.json · {energyData.length} daily records
          </footer>
        </>
      )}
    </div>
  );
}
