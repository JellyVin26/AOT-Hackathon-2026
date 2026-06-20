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
import energyData from './original_10floor_energy_co2_waste_ac_fixed_no_room_e_dataset.json';
import './GraphDashboard.css';

const TIME_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'areas', label: 'Areas' },
  { id: 'infrastructure', label: 'Infrastructure' },
];

const METRICS = [
  {
    id: 'energy',
    label: 'Energy',
    kpiLabel: 'Total Energy Usage',
    dataKey: 'totalEnergy',
    floorKey: 'energy',
    roomKey: 'energy',
    unit: 'kWh',
    color: '#38bdf8',
    icon: 'power',
  },
  {
    id: 'co2',
    label: 'CO₂',
    kpiLabel: 'CO₂ Emission',
    dataKey: 'totalCo2',
    floorKey: 'co2',
    roomKey: 'co2',
    unit: 'kgCO₂e',
    color: '#34d399',
    icon: 'co2',
  },
  {
    id: 'waste',
    label: 'Waste',
    kpiLabel: 'Total Waste',
    dataKey: 'totalWaste',
    floorKey: 'waste',
    roomKey: 'waste',
    unit: 'kg',
    color: '#a78bfa',
    icon: 'waste',
  },
  {
    id: 'water',
    label: 'Water',
    kpiLabel: 'Total Water Usage',
    dataKey: 'totalWater',
    floorKey: 'water',
    roomKey: 'water',
    unit: 'L',
    color: '#2dd4bf',
    icon: 'water',
  },
  {
    id: 'temperature',
    label: 'Temperature',
    kpiLabel: 'Avg Building Temperature',
    dataKey: 'avgTemperature',
    floorKey: 'temperature',
    roomKey: 'temperature',
    unit: '°C',
    color: '#fb923c',
    icon: 'temp',
    decimals: 1,
  },
];

const palette = {
  energy: '#38bdf8',
  co2: '#34d399',
  waste: '#a78bfa',
  water: '#2dd4bf',
  temp: '#fb923c',
  ac: '#38bdf8',
  light: '#fbbf24',
  plug: '#f472b6',
  rubbish: '#f87171',
  food: '#fbbf24',
  recycle: '#22c55e',
  ewaste: '#94a3b8',
};

const floorColours = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6'];

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
    totalWaste: 0,
    totalWater: 0,
    temperatureSum: 0,
    temperatureCount: 0,
    ac: 0,
    light: 0,
    plug: 0,
    rubbishWaste: 0,
    foodWaste: 0,
    recyclableWaste: 0,
    eWaste: 0,
    floorEnergy: {},
    floorCo2: {},
    floorWaste: {},
    floorWater: {},
    floorAc: {},
    floorLight: {},
    floorPlug: {},
    floorTempSum: {},
    floorTempCount: {},
    roomEnergy: {},
    roomCo2: {},
    roomWaste: {},
    roomWater: {},
    roomTempSum: {},
    roomTempCount: {},
  };

  Object.entries(row.levels || {}).forEach(([levelId, level]) => {
    if (!level?.available) return;

    Object.entries(level.rooms || {}).forEach(([roomId, room]) => {
      const energy = Number(room.total) || 0;
      const co2 = Number(room.co2EmissionKg) || energy * 0.758;
      const waste = Number(room.totalWasteKg) || Number(room.waste?.totalWasteKg) || 0;
      const water = Number(room.water) || 0;
      const temperature = Number(room.temperature);
      const ac = Number(room.ac) || 0;
      const light = Number(room.light) || 0;
      const plug = Number(room.plug) || 0;
      const rubbishWaste = Number(room.rubbishWasteKg) || Number(room.waste?.rubbishWasteKg) || 0;
      const foodWaste = Number(room.foodWasteKg) || Number(room.waste?.foodWasteKg) || 0;
      const recyclableWaste = Number(room.recyclableWasteKg) || Number(room.waste?.recyclableWasteKg) || 0;
      const eWaste = Number(room.eWasteKg) || Number(room.waste?.eWasteKg) || 0;

      summary.totalEnergy += energy;
      summary.totalCo2 += co2;
      summary.totalWaste += waste;
      summary.totalWater += water;
      summary.ac += ac;
      summary.light += light;
      summary.plug += plug;
      summary.rubbishWaste += rubbishWaste;
      summary.foodWaste += foodWaste;
      summary.recyclableWaste += recyclableWaste;
      summary.eWaste += eWaste;

      summary.floorEnergy[levelId] = (summary.floorEnergy[levelId] || 0) + energy;
      summary.floorCo2[levelId] = (summary.floorCo2[levelId] || 0) + co2;
      summary.floorWaste[levelId] = (summary.floorWaste[levelId] || 0) + waste;
      summary.floorWater[levelId] = (summary.floorWater[levelId] || 0) + water;
      summary.floorAc[levelId] = (summary.floorAc[levelId] || 0) + ac;
      summary.floorLight[levelId] = (summary.floorLight[levelId] || 0) + light;
      summary.floorPlug[levelId] = (summary.floorPlug[levelId] || 0) + plug;

      summary.roomEnergy[roomId] = (summary.roomEnergy[roomId] || 0) + energy;
      summary.roomCo2[roomId] = (summary.roomCo2[roomId] || 0) + co2;
      summary.roomWaste[roomId] = (summary.roomWaste[roomId] || 0) + waste;
      summary.roomWater[roomId] = (summary.roomWater[roomId] || 0) + water;

      if (Number.isFinite(temperature)) {
        summary.temperatureSum += temperature;
        summary.temperatureCount += 1;

        summary.floorTempSum[levelId] = (summary.floorTempSum[levelId] || 0) + temperature;
        summary.floorTempCount[levelId] = (summary.floorTempCount[levelId] || 0) + 1;

        summary.roomTempSum[roomId] = (summary.roomTempSum[roomId] || 0) + temperature;
        summary.roomTempCount[roomId] = (summary.roomTempCount[roomId] || 0) + 1;
      }
    });
  });

  summary.avgTemperature = summary.temperatureCount
    ? summary.temperatureSum / summary.temperatureCount
    : 0;

  return summary;
}

function combineObjectSum(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    target[key] = (target[key] || 0) + value;
  });
}

function combineSummaries(rows, label) {
  const combined = {
    label,
    totalEnergy: 0,
    totalCo2: 0,
    totalWaste: 0,
    totalWater: 0,
    temperatureSum: 0,
    temperatureCount: 0,
    ac: 0,
    light: 0,
    plug: 0,
    rubbishWaste: 0,
    foodWaste: 0,
    recyclableWaste: 0,
    eWaste: 0,
    floorEnergy: {},
    floorCo2: {},
    floorWaste: {},
    floorWater: {},
    floorAc: {},
    floorLight: {},
    floorPlug: {},
    floorTempSum: {},
    floorTempCount: {},
    roomEnergy: {},
    roomCo2: {},
    roomWaste: {},
    roomWater: {},
    roomTempSum: {},
    roomTempCount: {},
  };

  rows.forEach((row) => {
    combined.totalEnergy += row.totalEnergy;
    combined.totalCo2 += row.totalCo2;
    combined.totalWaste += row.totalWaste;
    combined.totalWater += row.totalWater;
    combined.temperatureSum += row.temperatureSum;
    combined.temperatureCount += row.temperatureCount;
    combined.ac += row.ac;
    combined.light += row.light;
    combined.plug += row.plug;
    combined.rubbishWaste += row.rubbishWaste;
    combined.foodWaste += row.foodWaste;
    combined.recyclableWaste += row.recyclableWaste;
    combined.eWaste += row.eWaste;

    combineObjectSum(combined.floorEnergy, row.floorEnergy);
    combineObjectSum(combined.floorCo2, row.floorCo2);
    combineObjectSum(combined.floorWaste, row.floorWaste);
    combineObjectSum(combined.floorWater, row.floorWater);
    combineObjectSum(combined.floorAc, row.floorAc);
    combineObjectSum(combined.floorLight, row.floorLight);
    combineObjectSum(combined.floorPlug, row.floorPlug);
    combineObjectSum(combined.floorTempSum, row.floorTempSum);
    combineObjectSum(combined.floorTempCount, row.floorTempCount);
    combineObjectSum(combined.roomEnergy, row.roomEnergy);
    combineObjectSum(combined.roomCo2, row.roomCo2);
    combineObjectSum(combined.roomWaste, row.roomWaste);
    combineObjectSum(combined.roomWater, row.roomWater);
    combineObjectSum(combined.roomTempSum, row.roomTempSum);
    combineObjectSum(combined.roomTempCount, row.roomTempCount);
  });

  combined.avgTemperature = combined.temperatureCount
    ? combined.temperatureSum / combined.temperatureCount
    : 0;

  return combined;
}

function aggregateData(timeUnit) {
  const daily = energyData.map(summariseRow);

  if (timeUnit === 'daily') return daily;

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
        floor: `Floor ${floorNumber}`,
        energy: latest.floorEnergy[levelId] || 0,
        co2: latest.floorCo2[levelId] || 0,
        waste: latest.floorWaste[levelId] || 0,
        water: latest.floorWater[levelId] || 0,
        ac: latest.floorAc[levelId] || 0,
        light: latest.floorLight[levelId] || 0,
        plug: latest.floorPlug[levelId] || 0,
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
        room: roomId.replace('Room_', 'Room '),
        energy: latest.roomEnergy[roomId] || 0,
        co2: latest.roomCo2[roomId] || 0,
        waste: latest.roomWaste[roomId] || 0,
        water: latest.roomWater[roomId] || 0,
        temperature: tempCount ? tempSum / tempCount : 0,
      };
    });
}

function KpiIcon({ type }) {
  if (type === 'water') {
    return (
      <svg viewBox="0 0 24 24" className="graph-kpi-svg" aria-hidden="true">
        <path d="M12 3.2C9.2 6.5 6.5 10.2 6.5 13.3C6.5 16.7 9 19.5 12 19.5C15 19.5 17.5 16.7 17.5 13.3C17.5 10.2 14.8 6.5 12 3.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.8 13.8C10.1 15.1 11 16 12.3 16.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

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
        <path d="M6.5 8H17.5M9.5 8L10 5H14L14.5 8M10.5 11V17M13.5 11V17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === 'temp') {
    return (
      <svg viewBox="0 0 24 24" className="graph-kpi-svg" aria-hidden="true">
        <path d="M10 14.7V5.8C10 4.3 11.1 3.2 12.6 3.2C14.1 3.2 15.2 4.3 15.2 5.8V14.7C16.1 15.4 16.7 16.4 16.7 17.6C16.7 19.8 14.9 21.5 12.6 21.5C10.3 21.5 8.5 19.8 8.5 17.6C8.5 16.4 9.1 15.4 10 14.7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.6 7.2V17.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="graph-kpi-svg" aria-hidden="true">
      <path d="M13.2 2.8L5.6 13H11L9.9 21.2L18.4 10.6H12.8L13.2 2.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

function MetricButton({ metric, active, onClick }) {
  return (
    <button
      type="button"
      className={`graph-metric-nav-button ${active ? 'graph-metric-nav-button-active' : ''}`}
      onClick={onClick}
      style={{ '--metric-color': metric.color }}
    >
      <span>{metric.label}</span>
    </button>
  );
}

function KpiCard({ metric, value, previous, active, onClick }) {
  const hasPrevious = typeof previous === 'number' && previous !== 0;
  const delta = hasPrevious ? ((value - previous) / previous) * 100 : 0;
  const rising = delta > 0;
  const decimals = metric.decimals || 0;

  return (
    <button
      type="button"
      className={`graph-kpi-card graph-kpi-card-clickable ${active ? 'graph-kpi-card-active' : ''}`}
      onClick={onClick}
      style={{ '--metric-color': metric.color }}
    >
      <div className="graph-kpi-top">
        <span className={`graph-icon-box graph-icon-${metric.icon}`}>
          <KpiIcon type={metric.icon} />
        </span>
        <span>{metric.kpiLabel}</span>
      </div>

      <div className="graph-kpi-value">
        <span>{formatNumber(value, decimals)}</span>
        <small>{metric.unit}</small>
      </div>

      <div className="graph-kpi-delta">
        {hasPrevious ? (
          <span className={rising ? 'delta-bad' : 'delta-good'}>
            {rising ? '+' : ''}
            {formatNumber(delta, 1)}%
          </span>
        ) : (
          <span className="delta-neutral">—</span>
        )}
        <span>vs. previous period</span>
      </div>
    </button>
  );
}

function GraphCard({ title, description, children, className = '' }) {
  return (
    <section className={`graph-card graph-main-chart-card ${className}`}>
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

function OverviewTab({ data, floorRows, activeMetric }) {
  return (
    <div className="graph-chart-grid-two">
      <GraphCard
        title={`${activeMetric.label} Trend Overview`}
        description="Click Energy, CO₂, Waste or Temperature above to change this chart."
      >
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={data} margin={{ top: 12, right: 22, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="selectedMetricFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeMetric.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={activeMetric.color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Area
              type="monotone"
              dataKey={activeMetric.dataKey}
              name={activeMetric.label}
              stroke={activeMetric.color}
              fill="url(#selectedMetricFill)"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title={`${activeMetric.label} Per-Floor Breakdown`}
        description="Latest selected period comparison across all 10 floors."
      >
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={floorRows} margin={{ top: 12, right: 22, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="floor" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey={activeMetric.floorKey} name={activeMetric.label} radius={[7, 7, 0, 0]}>
              {floorRows.map((row, index) => (
                <Cell key={row.floor} fill={index % 2 === 0 ? activeMetric.color : floorColours[index % floorColours.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>
    </div>
  );
}

function AreasTab({ roomRows, activeMetric }) {
  const pieRows = roomRows.map((room) => ({
    name: room.room,
    value: room[activeMetric.roomKey],
  }));

  return (
    <div className="graph-chart-grid-two">
      <GraphCard
        title={`Area Comparison by ${activeMetric.label}`}
        description="Room/area level comparison across the selected period."
      >
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={roomRows} margin={{ top: 12, right: 22, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="room" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Bar dataKey={activeMetric.roomKey} name={activeMetric.label} fill={activeMetric.color} radius={[7, 7, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title={`${activeMetric.label} Area Share`}
        description="How each room type contributes to the selected metric."
      >
        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <Pie data={pieRows} dataKey="value" nameKey="name" innerRadius={65} outerRadius={116} paddingAngle={4}>
              {pieRows.map((row, index) => (
                <Cell key={row.name} fill={floorColours[index % floorColours.length]} />
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

function InfrastructureTab({ data, floorRows }) {
  const latest = data[data.length - 1] || {};
  const wasteBreakdown = [
    { name: 'Rubbish', value: latest.rubbishWaste || 0 },
    { name: 'Food waste', value: latest.foodWaste || 0 },
    { name: 'Recyclable', value: latest.recyclableWaste || 0 },
    { name: 'E-waste', value: latest.eWaste || 0 },
  ];

  return (
    <div className="graph-chart-grid-two">
      <GraphCard
        title="Infrastructure Load Breakdown"
        description="AC load, lighting and plug load contribution."
      >
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data} margin={{ top: 12, right: 22, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Legend />
            <Bar dataKey="ac" name="AC Load" stackId="load" fill={palette.ac} />
            <Bar dataKey="light" name="Lighting" stackId="load" fill={palette.light} />
            <Bar dataKey="plug" name="Plug Load" stackId="load" fill={palette.plug} radius={[7, 7, 0, 0]} />
            <Line dataKey="avgTemperature" name="Avg Temperature" stroke={palette.temp} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </GraphCard>

      <GraphCard
        title="Waste Infrastructure Split"
        description="Waste categories from the selected period."
      >
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie data={wasteBreakdown} dataKey="value" nameKey="name" innerRadius={65} outerRadius={116} paddingAngle={4}>
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
        title="Per-Floor Load Contribution"
        description="AC, lighting and plug load by floor."
        className="graph-wide-card"
      >
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={floorRows} margin={{ top: 12, right: 22, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
            <XAxis dataKey="floor" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tickFormatter={formatCompact} tick={{ fontSize: 11 }} />
            <Tooltip content={<GraphTooltip />} />
            <Legend />
            <Bar dataKey="ac" name="AC Load" stackId="floor" fill={palette.ac} />
            <Bar dataKey="light" name="Lighting" stackId="floor" fill={palette.light} />
            <Bar dataKey="plug" name="Plug Load" stackId="floor" fill={palette.plug} radius={[7, 7, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GraphCard>
    </div>
  );
}

export default function GraphDashboard() {
  const [timeUnit, setTimeUnit] = useState('weekly');
  const [activeMetricId, setActiveMetricId] = useState('energy');
  const [activeTab, setActiveTab] = useState('overview');

  const activeMetric = METRICS.find((metric) => metric.id === activeMetricId) || METRICS[0];

  const data = useMemo(() => aggregateData(timeUnit), [timeUnit]);
  const floorRows = useMemo(() => getFloorRows(data), [data]);
  const roomRows = useMemo(() => getRoomRows(data), [data]);

  const kpi = useMemo(() => {
    const current = data[data.length - 1];
    const previous = data[data.length - 2];

    if (!current) return null;

    return {
      energy: { value: current.totalEnergy, previous: previous?.totalEnergy },
      co2: { value: current.totalCo2, previous: previous?.totalCo2 },
      waste: { value: current.totalWaste, previous: previous?.totalWaste },
      water: { value: current.totalWater, previous: previous?.totalWater },
      temperature: { value: current.avgTemperature, previous: previous?.avgTemperature },
    };
  }, [data]);

  return (
    <div className="graph-dashboard">
      <header className="graph-header graph-header-compact">
        <div className="graph-title-row">
          <div className="graph-logo-mark">S</div>
          <div>
            <h1>Sustainability Dashboard</h1>
            <p>Energy, CO₂ emissions, waste, water and temperature insights from the original 10-floor dataset</p>
          </div>
        </div>

        <div className="graph-header-actions graph-header-actions-wide">
          <div className="graph-metric-nav">
            {METRICS.map((metric) => (
              <MetricButton
                key={metric.id}
                metric={metric}
                active={activeMetricId === metric.id}
                onClick={() => setActiveMetricId(metric.id)}
              />
            ))}
          </div>

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
        <div className="graph-state-card">Loading dashboard data…</div>
      ) : (
        <>
          <div className="graph-kpi-grid graph-kpi-grid-four">
            {METRICS.map((metric) => (
              <KpiCard
                key={metric.id}
                metric={metric}
                value={kpi[metric.id].value}
                previous={kpi[metric.id].previous}
                active={activeMetricId === metric.id}
                onClick={() => setActiveMetricId(metric.id)}
              />
            ))}
          </div>

          <div className="graph-tabs graph-main-tabs">
            {TABS.map((tab) => (
              <ToggleButton
                key={tab.id}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </ToggleButton>
            ))}
          </div>

          {activeTab === 'overview' && (
            <OverviewTab data={data} floorRows={floorRows} activeMetric={activeMetric} />
          )}

          {activeTab === 'areas' && (
            <AreasTab roomRows={roomRows} activeMetric={activeMetric} />
          )}

          {activeTab === 'infrastructure' && (
            <InfrastructureTab data={data} floorRows={floorRows} />
          )}

          <footer className="graph-footer">
            Dataset source: original_10floor_energy_co2_waste_ac_fixed_no_room_e_dataset.json · {energyData.length} daily records
          </footer>
        </>
      )}
    </div>
  );
}
