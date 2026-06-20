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
import energyData from './original_10floor_energy_co2_waste_dataset.json';
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
  { id: 'waste', label: 'Waste' },
];

const palette = {
  energy: '#38bdf8',
  co2: '#34d399',
  waste: '#a78bfa',
  rubbish: '#f87171',
  food: '#fbbf24',
  recycle: '#22c55e',
  ewaste: '#94a3b8',
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
    totalCo2: 0,
    totalWater: 0,
    totalWaste: 0,
    rubbishWaste: 0,
    foodWaste: 0,
    recyclableWaste: 0,
    eWaste: 0,
    temperatureSum: 0,
    temperatureCount: 0,
    ac: 0,
    light: 0,
    plug: 0,
    floorEnergy: {},
    floorCo2: {},
    floorWater: {},
    floorWaste: {},
    floorTempSum: {},
    floorTempCount: {},
    roomEnergy: {},
    roomCo2: {},
    roomWater: {},
    roomWaste: {},
    roomTempSum: {},
    roomTempCount: {},
  };

  Object.entries(row.levels || {}).forEach(([levelId, level]) => {
    if (!level?.available) return;

    Object.entries(level.rooms || {}).forEach(([roomId, room]) => {
      const energy = Number(room.total) || 0;
      const co2 = Number(room.co2EmissionKg) || energy * 0.758;
      const water = Number(room.water) || 0;
      const waste = Number(room.totalWasteKg) || Number(room.waste?.totalWasteKg) || 0;
      const rubbishWaste = Number(room.rubbishWasteKg) || Number(room.waste?.rubbishWasteKg) || 0;
      const foodWaste = Number(room.foodWasteKg) || Number(room.waste?.foodWasteKg) || 0;
      const recyclableWaste = Number(room.recyclableWasteKg) || Number(room.waste?.recyclableWasteKg) || 0;
      const eWaste = Number(room.eWasteKg) || Number(room.waste?.eWasteKg) || 0;
      const temp = Number(room.temperature);
      const ac = Number(room.ac) || 0;
      const light = Number(room.light) || 0;
      const plug = Number(room.plug) || 0;

      summary.totalEnergy += energy;
      summary.totalCo2 += co2;
      summary.totalWater += water;
      summary.totalWaste += waste;
      summary.rubbishWaste += rubbishWaste;
      summary.foodWaste += foodWaste;
      summary.recyclableWaste += recyclableWaste;
      summary.eWaste += eWaste;
      summary.ac += ac;
      summary.light += light;
      summary.plug += plug;

      summary.floorEnergy[levelId] = (summary.floorEnergy[levelId] || 0) + energy;
      summary.floorCo2[levelId] = (summary.floorCo2[levelId] || 0) + co2;
      summary.floorWater[levelId] = (summary.floorWater[levelId] || 0) + water;
      summary.floorWaste[levelId] = (summary.floorWaste[levelId] || 0) + waste;

      summary.roomEnergy[roomId] = (summary.roomEnergy[roomId] || 0) + energy;
      summary.roomCo2[roomId] = (summary.roomCo2[roomId] || 0) + co2;
      summary.roomWater[roomId] = (summary.roomWater[roomId] || 0) + water;
      summary.roomWaste[roomId] = (summary.roomWaste[roomId] || 0) + waste;

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
    totalCo2: 0,
    totalWater: 0,
    totalWaste: 0,
    rubbishWaste: 0,
    foodWaste: 0,
    recyclableWaste: 0,
    eWaste: 0,
    temperatureSum: 0,
    temperatureCount: 0,
    ac: 0,
    light: 0,
    plug: 0,
    floorEnergy: {},
    floorCo2: {},
    floorWater: {},
    floorWaste: {},
    floorTempSum: {},
    floorTempCount: {},
    roomEnergy: {},
    roomCo2: {},
    roomWater: {},
    roomWaste: {},
    roomTempSum: {},
    roomTempCount: {},
  };

  rows.forEach((row) => {
    combined.totalEnergy += row.totalEnergy;
    combined.totalCo2 += row.totalCo2;
    combined.totalWater += row.totalWater;
    combined.totalWaste += row.totalWaste;
    combined.rubbishWaste += row.rubbishWaste;
    combined.foodWaste += row.foodWaste;
    combined.recyclableWaste += row.recyclableWaste;
    combined.eWaste += row.eWaste;
    combined.temperatureSum += row.temperatureSum;
    combined.temperatureCount += row.temperatureCount;
    combined.ac += row.ac;
    combined.light += row.light;
    combined.plug += row.plug;

    Object.entries(row.floorEnergy).forEach(([key, value]) => {
      combined.floorEnergy[key] = (combined.floorEnergy[key] || 0) + value;
    });

    Object.entries(row.floorCo2).forEach(([key, value]) => {
      combined.floorCo2[key] = (combined.floorCo2[key] || 0) + value;
    });

    Object.entries(row.floorWater).forEach(([key, value]) => {
      combined.floorWater[key] = (combined.floorWater[key] || 0) + value;
    });

    Object.entries(row.floorWaste).forEach(([key, value]) => {
      combined.floorWaste[key] = (combined.floorWaste[key] || 0) + value;
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

    Object.entries(row.roomCo2).forEach(([key, value]) => {
      combined.roomCo2[key] = (combined.roomCo2[key] || 0) + value;
    });

    Object.entries(row.roomWater).forEach(([key, value]) => {
      combined.roomWater[key] = (combined.roomWater[key] || 0) + value;
    });

    Object.entries(row.roomWaste).forEach(([key, value]) => {
      combined.roomWaste[key] = (combined.roomWaste[key] || 0) + value;
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
        co2: latest.floorCo2[levelId] || 0,
        water: latest.floorWater[levelId] || 0,
        waste: latest.floorWaste[levelId] || 0,
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
        co2: latest.roomCo2[roomId] || 0,
        water: latest.roomWater[roomId] || 0,
        waste: latest.roomWaste[roomId] || 0,
        temperature: tempCount ? tempSum / tempCount : 0,
      };
    });
}

function KpiIcon({ type }) {
  if (type === 'co2') {
    return (
      <svg viewBox="0 0 24 24" className="graph-kpi-svg" aria-hidden="true">
        <path d="M7.5 16.5C5 16.5 3 14.6 3 12.2C3 9.9 4.7 8.1 7 7.9C8 5.8 10 4.5 12.4 4.5C15.4 4.5 17.8 6.7 18.1 9.6C19.8 10.1 21 11.4 21 13.1C21 15 19.4 16.5 17.5 16.5H7.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 19.5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'waste') {
    return (
      <svg viewBox="0 0 24 24" className="graph-kpi-svg" aria-hidden="true">
        <path d="M8 8H16L15.3 20H8.7L8 8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 8H17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.5 8L10 5H14L14.5 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.5 11V17M13.5 11V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
  const bad = rising;

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
        title="Energy and CO₂ Emission Trend"
        description="CO₂ is calculated from the original 10-floor energy dataset"
        className="graph-span-3"
      >
        <ResponsiveContainer width="100%" height={315}>
          <AreaChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Area type="monotone" dataKey="totalEnergy" name="Energy" stroke={palette.energy} fill={palette.energy} fillOpacity={0.15} strokeWidth={2.5} />
            <Area type="monotone" dataKey="totalCo2" name="CO₂ emission" stroke={palette.co2} fill={palette.co2} fillOpacity={0.09} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Temperature vs Energy"
        description="Supporting demo temperature trend against energy usage"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={315}>
          <ComposedChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey="totalEnergy" name="Energy" fill={palette.energy} fillOpacity={0.55} radius={[5, 5, 0, 0]} />
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
        description="Original 10-floor energy usage by floor"
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
        title="CO₂ Emission by Floor"
        description="Calculated from each floor's energy usage"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={floorRows} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey="co2" name="CO₂ emission" fill={palette.co2} radius={[6, 6, 0, 0]} />
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
        title="Room CO₂ Emission"
        description="CO₂ grouped by room type across all 10 floors"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={330}>
          <PieChart>
            <Pie data={roomRows} dataKey="co2" nameKey="name" innerRadius={58} outerRadius={108} paddingAngle={4}>
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
        description="Air conditioning, lighting and plug load from the original energy dataset"
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


function WasteCharts({ data }) {
  const latest = data[data.length - 1] || {};
  const floorRows = getFloorRows(data);
  const wasteBreakdown = [
    { name: 'Rubbish', value: latest.rubbishWaste || 0 },
    { name: 'Food waste', value: latest.foodWaste || 0 },
    { name: 'Recyclable', value: latest.recyclableWaste || 0 },
    { name: 'E-waste', value: latest.eWaste || 0 },
  ];

  return (
    <div className="graph-grid graph-grid-overview">
      <GraphCard
        title="Waste Generation Trend"
        description="Generated waste values linked to the original 10-floor energy usage"
        className="graph-span-3"
      >
        <ResponsiveContainer width="100%" height={330}>
          <AreaChart data={data} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Area type="monotone" dataKey="totalWaste" name="Total waste" stroke={palette.waste} fill={palette.waste} fillOpacity={0.16} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Waste Type Breakdown"
        description="Rubbish, food waste, recyclable waste and e-waste"
        className="graph-span-2"
      >
        <ResponsiveContainer width="100%" height={330}>
          <PieChart>
            <Pie data={wasteBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={108} paddingAngle={4}>
              <Cell fill={palette.rubbish} />
              <Cell fill={palette.food} />
              <Cell fill={palette.recycle} />
              <Cell fill={palette.ewaste} />
            </Pie>
            <Tooltip content={<GraphTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Waste by Floor"
        description="Latest selected period total waste by floor"
        className="graph-span-5"
      >
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={floorRows} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey="waste" name="Waste" fill={palette.waste} radius={[6, 6, 0, 0]} />
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
      totalCo2: current.totalCo2,
      totalWaste: current.totalWaste,
      avgTemp: current.avgTemperature,
      previousEnergy: previous?.totalEnergy,
      previousCo2: previous?.totalCo2,
      previousWaste: previous?.totalWaste,
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
            <p>Energy, CO₂ emissions, waste and temperature insights from the original 10-floor dataset</p>
          </div>
        </div>

        <div className="graph-header-actions">
          <span className="graph-mini-pill graph-power">Energy</span>
          <span className="graph-mini-pill graph-water">CO₂</span>
          <span className="graph-mini-pill graph-temp">Waste</span>
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
        <div className="graph-state-card">Loading original 10-floor dataset…</div>
      ) : (
        <>
          <div className="graph-kpi-grid">
            <KpiCard label="Total Energy Usage" value={kpi.totalEnergy} unit="kWh" previous={kpi.previousEnergy} type="power" />
            <KpiCard label="CO₂ Emission" value={kpi.totalCo2} unit="kgCO₂e" previous={kpi.previousCo2} type="co2" />
            <KpiCard label="Total Waste" value={kpi.totalWaste} unit="kg" previous={kpi.previousWaste} type="waste" />
            <KpiCard label="Avg Building Temperature" value={kpi.avgTemp} unit="°C" previous={kpi.previousAvgTemp} type="temp" decimals={1} />
          </div>

          <p className="graph-note">
            Showing {timeUnit} data from the original 10-floor dataset · CO₂ factor: 0.758 kgCO₂e/kWh · waste values are generated for demo
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
          {activeTab === 'waste' && <WasteCharts data={data} />}

          <footer className="graph-footer">
            Dataset source: original_10floor_energy_co2_waste_dataset.json · {energyData.length} daily records
          </footer>
        </>
      )}
    </div>
  );
}
