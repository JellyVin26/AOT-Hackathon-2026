import React, { useEffect, useMemo, useState } from 'react';
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
import './GraphDashboard.css';

const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

const TIME_OPTIONS = [
  { id: 'hourly', label: 'Hourly' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const GRAPH_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'areas', label: 'Areas' },
  { id: 'infrastructure', label: 'Infrastructure' },
];

const palette = {
  power: '#38bdf8',
  water: '#2dd4bf',
  temp: '#fb923c',
  floor1: '#38bdf8',
  floor2: '#818cf8',
  roomA: '#38bdf8',
  roomB: '#22d3ee',
  roomC: '#818cf8',
  roomD: '#c084fc',
  ac: '#38bdf8',
  light: '#fbbf24',
  plug: '#f472b6',
  server1: '#38bdf8',
  server2: '#818cf8',
  server3: '#34d399',
};

const chartMargin = { top: 12, right: 14, left: 0, bottom: 0 };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }

  const headers = rows[0] || [];
  return rows.slice(1).filter((cells) => cells.length > 1).map((cells) => {
    const item = {};
    headers.forEach((header, index) => {
      const value = cells[index] ?? '';
      const numberValue = Number(value);
      item[header] = Number.isFinite(numberValue) && value !== '' ? numberValue : value;
    });
    return item;
  });
}

function parseDate(timestamp) {
  return new Date(String(timestamp).replace(' ', 'T'));
}

function formatHour(date) {
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${String(date.getHours()).padStart(2, '0')}:00`;
}

function formatDay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonth(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatCompact(value) {
  return new Intl.NumberFormat('en', {
    notation: Math.abs(Number(value) || 0) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value || 0);
}

function mergeRows(powerRows, waterRows, serverRows) {
  const waterByTimestamp = new Map(waterRows.map((row) => [row.timestamp, row]));
  const serverByTimestamp = new Map(serverRows.map((row) => [row.timestamp, row]));

  return powerRows.map((power) => {
    const water = waterByTimestamp.get(power.timestamp) || {};
    const server = serverByTimestamp.get(power.timestamp) || {};
    const date = parseDate(power.timestamp);

    return {
      timestamp: power.timestamp,
      time: date.getTime(),
      label: formatHour(date),
      total_power_kw: power.total_power_kw || 0,
      floor1_power_kw: power.floor1_power_kw || 0,
      floor2_power_kw: power.floor2_power_kw || 0,
      roomA_power_kw: power.roomA_power_kw || 0,
      roomB_power_kw: power.roomB_power_kw || 0,
      roomC_power_kw: power.roomC_power_kw || 0,
      roomD_power_kw: power.roomD_power_kw || 0,
      floor1_ac_kw: power.floor1_ac_kw || 0,
      floor1_light_kw: power.floor1_light_kw || 0,
      floor1_plug_kw: power.floor1_plug_kw || 0,
      floor2_ac_kw: power.floor2_ac_kw || 0,
      floor2_light_kw: power.floor2_light_kw || 0,
      floor2_plug_kw: power.floor2_plug_kw || 0,
      total_water_l: water.total_water_l || 0,
      floor1_water_l: water.floor1_water_l || 0,
      floor2_water_l: water.floor2_water_l || 0,
      roomA_water_l: water.roomA_water_l || 0,
      roomB_water_l: water.roomB_water_l || 0,
      roomC_water_l: water.roomC_water_l || 0,
      roomD_water_l: water.roomD_water_l || 0,
      server1_power_kw: server.server1_power_kw || 0,
      server2_power_kw: server.server2_power_kw || 0,
      server3_power_kw: server.server3_power_kw || 0,
      server1_water_l: server.server1_water_l || 0,
      server2_water_l: server.server2_water_l || 0,
      server3_water_l: server.server3_water_l || 0,
      server1_temp_c: server.server1_temp_c || 0,
      server2_temp_c: server.server2_temp_c || 0,
      server3_temp_c: server.server3_temp_c || 0,
    };
  }).sort((a, b) => a.time - b.time);
}

const sumKeys = [
  'total_power_kw',
  'floor1_power_kw',
  'floor2_power_kw',
  'roomA_power_kw',
  'roomB_power_kw',
  'roomC_power_kw',
  'roomD_power_kw',
  'floor1_ac_kw',
  'floor1_light_kw',
  'floor1_plug_kw',
  'floor2_ac_kw',
  'floor2_light_kw',
  'floor2_plug_kw',
  'total_water_l',
  'floor1_water_l',
  'floor2_water_l',
  'roomA_water_l',
  'roomB_water_l',
  'roomC_water_l',
  'roomD_water_l',
  'server1_power_kw',
  'server2_power_kw',
  'server3_power_kw',
  'server1_water_l',
  'server2_water_l',
  'server3_water_l',
];

const avgKeys = ['server1_temp_c', 'server2_temp_c', 'server3_temp_c'];

function aggregateBucket(rows, label, group) {
  const output = {
    label,
    group,
    time: rows[0]?.time || 0,
  };

  sumKeys.forEach((key) => {
    output[key] = rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  });

  avgKeys.forEach((key) => {
    output[key] = rows.length
      ? rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) / rows.length
      : 0;
  });

  return output;
}

function aggregateGraphData(hourlyRows, timeUnit) {
  if (timeUnit === 'hourly') {
    return hourlyRows.slice(-24);
  }

  const buckets = new Map();

  hourlyRows.forEach((row) => {
    const date = new Date(row.time);
    let key;
    let label;

    if (timeUnit === 'monthly') {
      key = `${date.getFullYear()}-${date.getMonth()}`;
      label = formatMonth(date);
    } else {
      const start = new Date(hourlyRows[0].time);
      const weekIndex = Math.floor((row.time - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      key = `week-${weekIndex}`;
      const weekStart = new Date(start.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000);
      label = formatDay(weekStart);
    }

    if (!buckets.has(key)) {
      buckets.set(key, { label, rows: [] });
    }

    buckets.get(key).rows.push(row);
  });

  return [...buckets.entries()].map(([key, bucket]) =>
    aggregateBucket(bucket.rows, bucket.label, key)
  );
}

function useGraphData() {
  const [state, setState] = useState({
    loading: true,
    error: '',
    hourlyRows: [],
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`${DATA_BASE}power_usage.csv`).then((response) => response.text()),
      fetch(`${DATA_BASE}water_usage.csv`).then((response) => response.text()),
      fetch(`${DATA_BASE}server_metrics.csv`).then((response) => response.text()),
    ])
      .then(([powerCsv, waterCsv, serverCsv]) => {
        if (cancelled) return;

        const hourlyRows = mergeRows(
          parseCsv(powerCsv),
          parseCsv(waterCsv),
          parseCsv(serverCsv)
        );

        setState({
          loading: false,
          error: '',
          hourlyRows,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load CSV data.',
          hourlyRows: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
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

function KpiCard({ label, value, unit, previous, type }) {
  const hasPrevious = typeof previous === 'number' && previous !== 0;
  const delta = hasPrevious ? ((value - previous) / previous) * 100 : 0;
  const rising = delta > 0;
  const isUsage = type !== 'temp';
  const bad = isUsage ? rising : rising;

  return (
    <div className="graph-kpi-card">
      <div className="graph-kpi-top">
        <span className={`graph-icon-dot graph-icon-${type}`} />
        <span>{label}</span>
      </div>
      <div className="graph-kpi-value">
        <span>{formatNumber(value, type === 'temp' ? 1 : 0)}</span>
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
        title="Building Trend Overview"
        description="Total power and water usage across the selected period"
        className="graph-span-3"
      >
        <ResponsiveContainer width="100%" height={315}>
          <AreaChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Area
              type="monotone"
              dataKey="total_power_kw"
              name="Power"
              stroke={palette.power}
              fill={palette.power}
              fillOpacity={0.15}
              strokeWidth={2.5}
            />
            <Area
              type="monotone"
              dataKey="total_water_l"
              name="Water"
              stroke={palette.water}
              fill={palette.water}
              fillOpacity={0.08}
              strokeWidth={2.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Per-Floor Breakdown"
        description="Power contribution by floor"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={315}>
          <BarChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey="floor1_power_kw" name="Floor 1" stackId="floor" fill={palette.floor1} radius={[0, 0, 0, 0]} />
            <Bar dataKey="floor2_power_kw" name="Floor 2" stackId="floor" fill={palette.floor2} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>
    </div>
  );
}

function AreasCharts({ data }) {
  const latest = data[data.length - 1] || {};
  const roomRows = [
    { name: 'Room A', power: latest.roomA_power_kw || 0, water: latest.roomA_water_l || 0, color: palette.roomA },
    { name: 'Room B', power: latest.roomB_power_kw || 0, water: latest.roomB_water_l || 0, color: palette.roomB },
    { name: 'Room C', power: latest.roomC_power_kw || 0, water: latest.roomC_water_l || 0, color: palette.roomC },
    { name: 'Room D', power: latest.roomD_power_kw || 0, water: latest.roomD_water_l || 0, color: palette.roomD },
  ];

  const equipmentRows = data.map((row) => ({
    label: row.label,
    ac: (row.floor1_ac_kw || 0) + (row.floor2_ac_kw || 0),
    light: (row.floor1_light_kw || 0) + (row.floor2_light_kw || 0),
    plug: (row.floor1_plug_kw || 0) + (row.floor2_plug_kw || 0),
  }));

  return (
    <div className="graph-grid graph-grid-overview">
      <GraphCard
        title="Room Comparison"
        description="Latest room-level power usage"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={315}>
          <BarChart data={roomRows} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey="power" name="Power" radius={[6, 6, 0, 0]}>
              {roomRows.map((room) => (
                <Cell key={room.name} fill={room.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Equipment Usage"
        description="Air conditioning, lighting, and plug loads"
        className="graph-span-3"
      >
        <ResponsiveContainer width="100%" height={315}>
          <BarChart data={equipmentRows} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Legend />
            <Bar dataKey="ac" name="Air Conditioning" stackId="equipment" fill={palette.ac} />
            <Bar dataKey="light" name="Lighting" stackId="equipment" fill={palette.light} />
            <Bar dataKey="plug" name="Plug Loads" stackId="equipment" fill={palette.plug} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>
    </div>
  );
}

function InfrastructureCharts({ data }) {
  return (
    <div className="graph-grid graph-grid-overview">
      <GraphCard
        title="Server Power and Temperature"
        description="Power bars with average temperature trend"
        className="graph-span-3"
      >
        <ResponsiveContainer width="100%" height={315}>
          <ComposedChart
            data={data.map((row) => ({
              ...row,
              avg_temp:
                ((row.server1_temp_c || 0) +
                  (row.server2_temp_c || 0) +
                  (row.server3_temp_c || 0)) /
                3,
            }))}
            margin={chartMargin}
          >
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Legend />
            <Bar dataKey="server1_power_kw" name="Server 01 Power" stackId="server" fill={palette.server1} />
            <Bar dataKey="server2_power_kw" name="Server 02 Power" stackId="server" fill={palette.server2} />
            <Bar dataKey="server3_power_kw" name="Server 03 Power" stackId="server" fill={palette.server3} radius={[5, 5, 0, 0]} />
            <Line dataKey="avg_temp" name="Avg Temp" stroke={palette.temp} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Server Cooling Water"
        description="Latest water consumption by server"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={315}>
          <PieChart>
            <Pie
              data={[
                { name: 'Server 01', value: data[data.length - 1]?.server1_water_l || 0, color: palette.server1 },
                { name: 'Server 02', value: data[data.length - 1]?.server2_water_l || 0, color: palette.server2 },
                { name: 'Server 03', value: data[data.length - 1]?.server3_water_l || 0, color: palette.server3 },
              ]}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={105}
              paddingAngle={4}
            >
              {[
                palette.server1,
                palette.server2,
                palette.server3,
              ].map((color) => (
                <Cell key={color} fill={color} />
              ))}
            </Pie>
            <Tooltip content={<GraphTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </GraphCard>
    </div>
  );
}

export default function GraphDashboard() {
  const { loading, error, hourlyRows } = useGraphData();
  const [timeUnit, setTimeUnit] = useState('weekly');
  const [activeTab, setActiveTab] = useState('overview');

  const data = useMemo(
    () => aggregateGraphData(hourlyRows, timeUnit),
    [hourlyRows, timeUnit]
  );

  const kpi = useMemo(() => {
    const current = data[data.length - 1];
    const previous = data[data.length - 2];

    if (!current) return null;

    const avgTemp =
      ((current.server1_temp_c || 0) +
        (current.server2_temp_c || 0) +
        (current.server3_temp_c || 0)) /
      3;

    const previousAvgTemp = previous
      ? ((previous.server1_temp_c || 0) +
          (previous.server2_temp_c || 0) +
          (previous.server3_temp_c || 0)) /
        3
      : undefined;

    return {
      totalPower: current.total_power_kw,
      totalWater: current.total_water_l,
      avgTemp,
      previousPower: previous?.total_power_kw,
      previousWater: previous?.total_water_l,
      previousAvgTemp,
    };
  }, [data]);

  const powerUnit = timeUnit === 'hourly' ? 'kW' : 'kWh';

  return (
    <div className="graph-dashboard">
      <header className="graph-header">
        <div className="graph-title-row">
          <div className="graph-logo-mark">B</div>
          <div>
            <h1>Building Operations Dashboard</h1>
            <p>Power, water and server telemetry from the dashboard-graph module</p>
          </div>
        </div>

        <div className="graph-header-actions">
          <span className="graph-mini-pill graph-power">Power</span>
          <span className="graph-mini-pill graph-water">Water</span>
          <span className="graph-mini-pill graph-temp">Temp</span>
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

      {error ? (
        <div className="graph-state-card graph-error">Failed to load graph data: {error}</div>
      ) : loading || !kpi ? (
        <div className="graph-state-card">Loading graph telemetry data…</div>
      ) : (
        <>
          <div className="graph-kpi-grid">
            <KpiCard
              label="Total Power Usage"
              value={kpi.totalPower}
              unit={powerUnit}
              previous={kpi.previousPower}
              type="power"
            />
            <KpiCard
              label="Total Water Usage"
              value={kpi.totalWater}
              unit="L"
              previous={kpi.previousWater}
              type="water"
            />
            <KpiCard
              label="Avg Server Temperature"
              value={kpi.avgTemp}
              unit="°C"
              previous={kpi.previousAvgTemp}
              type="temp"
            />
          </div>

          <p className="graph-note">
            Showing {powerUnit === 'kW' ? 'instantaneous power readings' : 'aggregated consumption totals'} · {data.length} {timeUnit} buckets
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
          {activeTab === 'areas' && <AreasCharts data={data} />}
          {activeTab === 'infrastructure' && <InfrastructureCharts data={data} />}

          <footer className="graph-footer">
            Data loaded from dashboard-graph CSV files · {hourlyRows.length} hourly records
          </footer>
        </>
      )}
    </div>
  );
}
