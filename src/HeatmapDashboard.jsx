import React, { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import { DoubleSide, MeshBasicMaterial } from 'three';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { create } from 'zustand';
import energyData from './allFloorsEnergyData_JulyAugust2018_10Floors.json';
import './App.css';

// ==========================================================
// 1. State Management
// ==========================================================
const useStore = create((set) => ({
  activeLevel: 'Level_1',
  activeRoom: 'Room_A',
  activeMetric: 'total',
  timeIndex: 0,
  hourIndex: 0,
  viewMode: 'current',
  buildingMode: 'light',
  periodMode: 'month',

  setActiveLevel: (level) => set({ activeLevel: level, activeRoom: 'Room_A' }),
  setActiveRoom: (room) => set({ activeRoom: room }),
  setActiveMetric: (metric) => set({ activeMetric: metric }),
  setTimeIndex: (index) => set({ timeIndex: parseInt(index, 10) }),
  setHourIndex: (index) => set({ hourIndex: parseInt(index, 10) }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setBuildingMode: (mode) => set({ buildingMode: mode }),
  setPeriodMode: (mode) => set({ periodMode: mode }),
}));

// ==========================================================
// 2. Building Model Transform
// ==========================================================
const BUILDING_CENTER = [1320, 894, -1080];
const BUILDING_SCALE = 0.003;

// Rotate the whole scene together so the heatmap stays inside the building.
const SCENE_ROTATION_Y = Math.PI / 4;

const DASHBOARD_FONT = 'var(--font-sans)';

// ==========================================================
// 3. Level and Room Mapping
// Daily summaries are connected for Floor 1 to Floor 7.
// z1 = Room A, z2 = Room B, z3 = Room C, z4 = Room D, z5 = Room E
// ==========================================================
const levelConfigs = [
  { id: 'Level_1', label: 'Floor 1', y: 70, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D'] },
  { id: 'Level_2', label: 'Floor 2', y: 230, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D'] },
  { id: 'Level_3', label: 'Floor 3', y: 390, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D', 'Room_E'] },
  { id: 'Level_4', label: 'Floor 4', y: 550, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D', 'Room_E'] },
  { id: 'Level_5', label: 'Floor 5', y: 710, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D', 'Room_E'] },
  { id: 'Level_6', label: 'Floor 6', y: 870, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D', 'Room_E'] },
  { id: 'Level_7', label: 'Floor 7', y: 1030, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D', 'Room_E'] },
  { id: 'Level_8', label: 'Floor 8', y: 1190, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D', 'Room_E'] },
  { id: 'Level_9', label: 'Floor 9', y: 1350, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D', 'Room_E'] },
  { id: 'Level_10', label: 'Floor 10', y: 1510, rooms: ['Room_A', 'Room_B', 'Room_C', 'Room_D', 'Room_E'] },
];

const ROOM_ROTATION_DEG = -45;
const ROOM_ROTATION_RAD = (ROOM_ROTATION_DEG * Math.PI) / 180;
const ROOM_ROTATION_PIVOT = { x: 1265, z: -1080 };

const baseRoomTemplates = [
  {
    id: 'Room_A',
    label: 'Room A',
    zoneName: 'Zone 1',
    description: 'West Wing',
    x: 650,
    z: -1850,
    size: [450, 1650],
    labelOffsetX: -70,
    labelOffsetZ: 30,
  },
  {
    id: 'Room_B',
    label: 'Room B',
    zoneName: 'Zone 2',
    description: 'East Wing',
    x: 2080,
    z: -1850,
    size: [1650, 450],
    labelOffsetX: 70,
    labelOffsetZ: 30,
  },
  {
    id: 'Room_C',
    label: 'Room C',
    zoneName: 'Zone 3',
    description: 'Central Area',
    x: 1350,
    z: -950,
    size: [750, 750],
    labelOffsetX: 0,
    labelOffsetZ: -20,
  },
  {
    id: 'Room_D',
    label: 'Room D',
    zoneName: 'Zone 4',
    description: 'Lighting Area',
    x: 1350,
    z: -1850,
    size: [600, 600],
    labelOffsetX: 0,
    labelOffsetZ: -20,
  },
  {
    id: 'Room_E',
    label: 'Room E',
    zoneName: 'Zone 5',
    description: 'Additional Area',
    x: 2080,
    z: -950,
    size: [600, 600],
    labelOffsetX: 0,
    labelOffsetZ: -20,
  },
];

const rotatePointXZ = (x, z, pivotX, pivotZ, angleRad) => {
  const dx = x - pivotX;
  const dz = z - pivotZ;

  const rotatedX = dx * Math.cos(angleRad) - dz * Math.sin(angleRad);
  const rotatedZ = dx * Math.sin(angleRad) + dz * Math.cos(angleRad);

  return {
    x: pivotX + rotatedX,
    z: pivotZ + rotatedZ,
  };
};

const roomTemplates = baseRoomTemplates.map((room) => {
  const rotated = rotatePointXZ(
    room.x,
    room.z,
    ROOM_ROTATION_PIVOT.x,
    ROOM_ROTATION_PIVOT.z,
    ROOM_ROTATION_RAD
  );

  return {
    ...room,
    x: rotated.x,
    z: rotated.z,
  };
});

const metricOptions = [
  { id: 'total', label: 'Total Energy', unit: 'kWh' },
  { id: 'light', label: 'Lighting', unit: 'kWh' },
  { id: 'plug', label: 'Plug Load', unit: 'kWh' },
  { id: 'ac', label: 'AC Load', unit: 'kWh' },
];

const periodOptions = [
  { id: 'hour', label: '1 Hour' },
  { id: 'week', label: '1 Week' },
  { id: 'month', label: '1 Month' },
  { id: 'total', label: 'Total' },
];

const getPeriodLabel = (periodMode) =>
  periodOptions.find((period) => period.id === periodMode)?.label || '1 Month';

const getLevelInfo = (levelId) =>
  levelConfigs.find((level) => level.id === levelId) || levelConfigs[0];

const getRoomsForLevel = (levelId) => {
  const level = getLevelInfo(levelId);
  return roomTemplates.filter((room) => level.rooms.includes(room.id));
};

const getRoomValue = (row, levelId, roomId, metric) => {
  const value = row?.levels?.[levelId]?.rooms?.[roomId]?.[metric];

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return value;
};

const getHourlyMultiplier = (hour) => {
  // Simple building usage pattern for prototype hourly view.
  // Early morning is lower, working hours are higher.
  const multipliers = [
    0.35, 0.30, 0.28, 0.28, 0.32, 0.45,
    0.65, 0.82, 1.05, 1.18, 1.25, 1.28,
    1.22, 1.18, 1.12, 1.08, 1.00, 0.92,
    0.78, 0.65, 0.55, 0.48, 0.42, 0.38,
  ];

  return multipliers[hour] || 1;
};

const getMonthKeys = () => {
  return Array.from(new Set(energyData.map((row) => row.date.slice(0, 7))));
};

const getMonthRows = (monthIndex) => {
  const monthKeys = getMonthKeys();
  const safeMonthIndex = Math.min(
    Math.max(0, monthIndex),
    Math.max(0, monthKeys.length - 1)
  );
  const monthKey = monthKeys[safeMonthIndex];

  return energyData.filter((row) => row.date.startsWith(monthKey));
};

const getMonthLabel = (monthKey) => {
  const [year, month] = monthKey.split('-');
  const monthNames = {
    '01': 'January',
    '02': 'February',
    '03': 'March',
    '04': 'April',
    '05': 'May',
    '06': 'June',
    '07': 'July',
    '08': 'August',
    '09': 'September',
    '10': 'October',
    '11': 'November',
    '12': 'December',
  };

  return `${monthNames[month] || monthKey} ${year}`;
};

const getPeriodRows = (timeIndex, periodMode) => {
  if (periodMode === 'week') {
    const startIndex = Math.min(
      Math.max(0, timeIndex),
      Math.max(0, energyData.length - 7)
    );

    return energyData.slice(startIndex, startIndex + 7);
  }

  if (periodMode === 'month') {
    return getMonthRows(timeIndex);
  }

  if (periodMode === 'total') {
    return energyData;
  }

  return [energyData[timeIndex]];
};

const getSliderMax = (periodMode) => {
  if (periodMode === 'hour') {
    return Math.max(0, energyData.length * 24 - 1);
  }

  if (periodMode === 'week') {
    return Math.max(0, energyData.length - 7);
  }

  if (periodMode === 'month') {
    return Math.max(0, getMonthKeys().length - 1);
  }

  return 0;
};

const getSliderValue = (periodMode, timeIndex, hourIndex) => {
  if (periodMode === 'hour') {
    return timeIndex * 24 + hourIndex;
  }

  if (periodMode === 'week') {
    return Math.min(timeIndex, getSliderMax('week'));
  }

  if (periodMode === 'month') {
    return Math.min(timeIndex, getSliderMax('month'));
  }

  return 0;
};

const getSliderLabel = (periodMode, timeIndex, hourIndex) => {
  if (periodMode === 'hour') {
    return `${energyData[timeIndex].date} ${String(hourIndex).padStart(2, '0')}:00`;
  }

  if (periodMode === 'week') {
    const rows = getPeriodRows(timeIndex, 'week');
    const start = rows[0]?.date || energyData[timeIndex].date;
    const end = rows[rows.length - 1]?.date || energyData[timeIndex].date;
    return `${start} to ${end}`;
  }

  if (periodMode === 'month') {
    const monthKeys = getMonthKeys();
    const safeMonthIndex = Math.min(
      Math.max(0, timeIndex),
      Math.max(0, monthKeys.length - 1)
    );

    return getMonthLabel(monthKeys[safeMonthIndex]);
  }

  if (periodMode === 'total') {
    return `Total usage: ${energyData[0]?.date} to ${energyData[energyData.length - 1]?.date}`;
  }

  return `${energyData[0]?.date} to ${energyData[energyData.length - 1]?.date}`;
};

const getReferenceX = (periodMode, timeIndex, hourIndex) => {
  if (periodMode === 'hour') {
    return `${String(hourIndex).padStart(2, '0')}:00`;
  }

  if (periodMode === 'month' || periodMode === 'total') {
    return undefined;
  }

  return energyData[timeIndex].date.slice(5);
};

const getAggregatedRoomValue = (
  levelId,
  roomId,
  metric,
  timeIndex,
  periodMode,
  hourIndex = 0
) => {
  const selectedDayValue = getRoomValue(
    energyData[timeIndex],
    levelId,
    roomId,
    metric
  );

  if (periodMode === 'hour') {
    if (selectedDayValue === null) {
      return null;
    }

    const baseHourlyValue = selectedDayValue / 24;
    return Math.round(baseHourlyValue * getHourlyMultiplier(hourIndex) * 100) / 100;
  }

  const rows = getPeriodRows(timeIndex, periodMode);
  const values = rows
    .map((row) => getRoomValue(row, levelId, roomId, metric))
    .filter((value) => typeof value === 'number');

  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total * 100) / 100;
};

const buildChartData = (levelId, roomId, metric, timeIndex, periodMode, hourIndex) => {
  if (periodMode === 'hour') {
    const selectedDayValue = getRoomValue(
      energyData[timeIndex],
      levelId,
      roomId,
      metric
    );

    if (selectedDayValue === null) {
      return [];
    }

    const baseHourlyValue = selectedDayValue / 24;

    return Array.from({ length: 24 }, (_, hour) => ({
      date: `${String(hour).padStart(2, '0')}:00`,
      value: Math.round(baseHourlyValue * getHourlyMultiplier(hour) * 100) / 100,
    }));
  }

  const rows = getPeriodRows(timeIndex, periodMode);

  return rows.map((row) => ({
    date: row.date.slice(5),
    value: getRoomValue(row, levelId, roomId, metric),
  }));
};

const getPeriodDescription = (timeIndex, periodMode, hourIndex = 0) => {
  if (periodMode === 'hour') {
    return `Estimated hour: ${energyData[timeIndex].date} ${String(hourIndex).padStart(2, '0')}:00`;
  }

  if (periodMode === 'week') {
    const rows = getPeriodRows(timeIndex, periodMode);
    const start = rows[0]?.date || energyData[timeIndex].date;
    const end = rows[rows.length - 1]?.date || energyData[timeIndex].date;
    return `${start} to ${end}`;
  }

  if (periodMode === 'month') {
    return getSliderLabel(periodMode, timeIndex, hourIndex);
  }

  const start = energyData[0]?.date;
  const end = energyData[energyData.length - 1]?.date;

  if (periodMode === 'total') {
    return `Total usage from ${start} to ${end}`;
  }

  return `${start} to ${end}`;
};

// ==========================================================
// 4. Helpers
// ==========================================================
const getMetricInfo = (metric) =>
  metricOptions.find((item) => item.id === metric) || metricOptions[0];

const getMetricRange = (metric, periodMode = 'month') => {
  const values = [];

  energyData.forEach((row, index) => {
    levelConfigs.forEach((level) => {
      getRoomsForLevel(level.id).forEach((room) => {
        if (periodMode === 'hour') {
          for (let hour = 0; hour < 24; hour += 1) {
            const value = getAggregatedRoomValue(
              level.id,
              room.id,
              metric,
              index,
              periodMode,
              hour
            );

            if (typeof value === 'number') {
              values.push(value);
            }
          }

          return;
        }

        const value = getAggregatedRoomValue(
          level.id,
          room.id,
          metric,
          index,
          periodMode
        );

        if (typeof value === 'number') {
          values.push(value);
        }
      });
    });
  });

  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    min,
    max: max === min ? min + 1 : max,
  };
};

const getHeatmapColor = (value, metric, periodMode = 'month') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '#64748b';
  }

  const { min, max } = getMetricRange(metric, periodMode);

  const percentage = Math.min(
    1,
    Math.max(0, (value - min) / (max - min))
  );

  const hue = 120 - percentage * 120;
  return `hsl(${hue}, 90%, 50%)`;
};

const formatValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'No data';
  }

  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
};

const predictNextValue = (levelId, room, metric, timeIndex) => {
  const currentValue = getRoomValue(energyData[timeIndex], levelId, room, metric);

  if (currentValue === null) {
    return null;
  }

  for (let index = timeIndex - 1; index >= 0; index -= 1) {
    const previousValue = getRoomValue(energyData[index], levelId, room, metric);

    if (previousValue !== null) {
      const trend = currentValue - previousValue;
      return Math.max(0, Math.round((currentValue + trend) * 100) / 100);
    }
  }

  return currentValue;
};

const getRiskLabel = (value, metric, periodMode = 'month') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'No data';
  }

  const { min, max } = getMetricRange(metric, periodMode);
  const percentage = (value - min) / (max - min);

  if (percentage < 0.35) return 'Low';
  if (percentage < 0.65) return 'Moderate';
  if (percentage < 0.85) return 'High';
  return 'Critical';
};

// ==========================================================
// 5. Building Model
// Light View = merged GLB for smoother rotation.
// Detailed View = original full model, heavier but more realistic.
// ==========================================================
function MergedLightBuildingModel() {
  const { scene } = useGLTF('/comm_building_xray_merged.glb');

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = false;
        child.receiveShadow = false;
        child.renderOrder = 1;

        child.material = new MeshBasicMaterial({
          color: '#f8fafc',
          transparent: true,
          opacity: 0.30,
          depthWrite: false,
          depthTest: true,
          side: DoubleSide,
        });
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

function DetailedBuildingModel() {
  const { scene } = useGLTF('/comm_building_xray.glb');

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = false;
        child.receiveShadow = false;
        child.renderOrder = 1;

        child.material = new MeshBasicMaterial({
          color: '#f8fafc',
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          depthTest: true,
          side: DoubleSide,
        });
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

function BuildingDisplay() {
  const { buildingMode } = useStore();

  if (buildingMode === 'detail') {
    return <DetailedBuildingModel />;
  }

  return <MergedLightBuildingModel />;
}

useGLTF.preload('/comm_building_xray_merged.glb');
useGLTF.preload('/comm_building_xray.glb');

// ==========================================================
// 6. Heatmap Overlay
// ==========================================================
function RoomHeatmapOverlay() {
  const {
    activeLevel,
    activeRoom,
    activeMetric,
    timeIndex,
    hourIndex,
    viewMode,
    periodMode,
    setActiveRoom,
  } = useStore();

  const level = getLevelInfo(activeLevel);
  const currentRow = energyData[timeIndex];
  const metricInfo = getMetricInfo(activeMetric);
  const visibleRooms = getRoomsForLevel(activeLevel);

  return (
    <group>
      {visibleRooms.map((room) => {
        const currentValue = getAggregatedRoomValue(
          activeLevel,
          room.id,
          activeMetric,
          timeIndex,
          periodMode,
          hourIndex
        );

        const predictedValue = currentValue;

        const valueToShow =
          viewMode === 'predicted' ? predictedValue : currentValue;

        const isActive = activeRoom === room.id;
        const roomColor = getHeatmapColor(valueToShow, activeMetric, periodMode);

        return (
          <group key={room.id}>
            <mesh
              position={[room.x, level.y + 45, room.z]}
              renderOrder={20}
              frustumCulled={false}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(event) => {
                event.stopPropagation();
                setActiveRoom(room.id);
              }}
            >
              <planeGeometry args={room.size} />
              <meshBasicMaterial
                color={roomColor}
                transparent
                opacity={isActive ? 0.92 : 0.72}
                side={DoubleSide}
                depthWrite={false}
                depthTest={false}
                polygonOffset
                polygonOffsetFactor={-4}
              />
            </mesh>

            <mesh
              position={[room.x, level.y + 47, room.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={21}
              frustumCulled={false}
            >
              <planeGeometry args={room.size} />
              <meshBasicMaterial
                color="#ffffff"
                transparent
                opacity={isActive ? 0.5 : 0.24}
                side={DoubleSide}
                depthWrite={false}
                depthTest={false}
                wireframe
              />
            </mesh>

            <Html
              position={[
                room.x + (room.labelOffsetX || 0),
                level.y + 145,
                room.z + (room.labelOffsetZ || 0),
              ]}
              center
              distanceFactor={10}
            >
              <div
                onClick={() => setActiveRoom(room.id)}
                style={{
                  background: isActive
                    ? 'rgba(15, 23, 42, 0.96)'
                    : 'rgba(15, 23, 42, 0.82)',
                  color: '#ffffff',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  border: isActive
                    ? '1px solid #60a5fa'
                    : '1px solid rgba(148, 163, 184, 0.25)',
                  cursor: 'pointer',
                  boxShadow: isActive
                    ? '0 0 18px rgba(96, 165, 250, 0.35)'
                    : 'none',
                }}
              >
                <div style={{ fontWeight: 600 }}>{room.label}</div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                  {room.zoneName} | {room.description}
                </div>
                <div style={{ marginTop: '4px' }}>
                  {metricInfo.label}: {valueToShow === null ? 'No data' : `${formatValue(valueToShow)} ${metricInfo.unit}`}
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function LevelGuide() {
  const { activeLevel } = useStore();
  const level = getLevelInfo(activeLevel);

  return (
    <mesh
      position={[1320, level.y + 45, -1080]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[2640, 2640]} />
      <meshBasicMaterial
        color="#60a5fa"
        transparent
        opacity={0.08}
        side={DoubleSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

// ==========================================================
// 7. UI Components
// ==========================================================
function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(148, 163, 184, 0.16)',
        borderRadius: '18px',
        boxShadow: '0 10px 30px rgba(2, 6, 23, 0.24)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: '12px',
        color: '#94a3b8',
        marginBottom: '6px',
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: '4px', fontSize: '13px', color: '#94a3b8' }}>
        {subtitle}
      </div>
    </div>
  );
}

function SegmentedButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 14px',
        background: active
          ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
          : 'rgba(51, 65, 85, 0.9)',
        color: '#ffffff',
        border: active
          ? '1px solid rgba(96, 165, 250, 0.8)'
          : '1px solid rgba(148, 163, 184, 0.16)',
        borderRadius: '11px',
        cursor: 'pointer',
        fontWeight: active ? 700 : 500,
        fontSize: '13px',
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, helper, valueColor = '#f8fafc' }) {
  return (
    <Card style={{ padding: '16px' }}>
      <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: '8px',
          fontSize: '20px',
          fontWeight: 800,
          color: valueColor,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: '6px', fontSize: '12px', color: '#cbd5e1' }}>
        {helper}
      </div>
    </Card>
  );
}

function InfoPill({ label, value }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: '14px',
        background: 'rgba(30, 41, 59, 0.78)',
        border: '1px solid rgba(148, 163, 184, 0.14)',
      }}
    >
      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}

function HeatmapLegend() {
  const { activeMetric, periodMode } = useStore();
  const metricInfo = getMetricInfo(activeMetric);
  const range = getMetricRange(activeMetric, periodMode);

  return (
    <Card
      style={{
        position: 'absolute',
        left: 20,
        bottom: 20,
        zIndex: 20,
        padding: '14px',
        width: '300px',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 800 }}>Heatmap Scale</div>
      <div
        style={{
          marginTop: '10px',
          height: '14px',
          width: '100%',
          borderRadius: '999px',
          background:
            'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '12px',
          color: '#cbd5e1',
        }}
      >
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
        <span>Critical</span>
      </div>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
        {metricInfo.label} range: {formatValue(range.min)} to {formatValue(range.max)} {metricInfo.unit}.
        Red means higher consumption compared to the dataset.
      </div>
    </Card>
  );
}

// ==========================================================
// 8. Main App
// ==========================================================
export default function HeatmapDashboard() {
  const {
    activeLevel,
    activeRoom,
    activeMetric,
    timeIndex,
    hourIndex,
    viewMode,
    periodMode,
    buildingMode,
    setActiveLevel,
    setActiveRoom,
    setActiveMetric,
    setTimeIndex,
    setHourIndex,
    setViewMode,
    setBuildingMode,
    setPeriodMode,
  } = useStore();

  const metricInfo = getMetricInfo(activeMetric);
  const visibleRooms = getRoomsForLevel(activeLevel);
  const resolvedRoomId = visibleRooms.some((room) => room.id === activeRoom)
    ? activeRoom
    : visibleRooms[0]?.id || 'Room_A';

  const selectedLevel = getLevelInfo(activeLevel);
  const selectedRoom =
    visibleRooms.find((item) => item.id === resolvedRoomId) || visibleRooms[0];

  const currentValue = getAggregatedRoomValue(
    activeLevel,
    resolvedRoomId,
    activeMetric,
    timeIndex,
    periodMode,
    hourIndex
  );

  const predictedValue = currentValue;

  const displayedValue =
    viewMode === 'predicted' ? predictedValue : currentValue;

  const riskLabel = getRiskLabel(displayedValue, activeMetric, periodMode);
  const valueColor = getHeatmapColor(displayedValue, activeMetric, periodMode);
  const delta =
    currentValue === null || predictedValue === null
      ? null
      : Number((predictedValue - currentValue).toFixed(2));

  const trendText =
    delta === null ? 'No data' : delta > 0 ? `+${formatValue(delta)}` : formatValue(delta);

  const chartData = useMemo(() => {
    return buildChartData(
      activeLevel,
      resolvedRoomId,
      activeMetric,
      timeIndex,
      periodMode,
      hourIndex
    );
  }, [activeLevel, resolvedRoomId, activeMetric, timeIndex, periodMode, hourIndex]);

  const sliderMax = getSliderMax(periodMode);
  const sliderValue = getSliderValue(periodMode, timeIndex, hourIndex);
  const sliderLabel = getSliderLabel(periodMode, timeIndex, hourIndex);
  const referenceX = getReferenceX(periodMode, timeIndex, hourIndex);

  const handleTimelineChange = (event) => {
    const value = parseInt(event.target.value, 10);

    if (periodMode === 'hour') {
      setTimeIndex(Math.floor(value / 24));
      setHourIndex(value % 24);
      return;
    }

    if (periodMode === 'week') {
      setTimeIndex(Math.min(value, getSliderMax('week')));
      setHourIndex(0);
      return;
    }

    if (periodMode === 'month') {
      setTimeIndex(Math.min(value, getSliderMax('month')));
      setHourIndex(0);
      return;
    }

    setTimeIndex(0);
    setHourIndex(0);
  };

  const handlePeriodChange = (periodId) => {
    setPeriodMode(periodId);
    setTimeIndex(0);
    setHourIndex(0);
  };

  return (
    <div
      className="dashboard-root"
      style={{
        minHeight: 'calc(100vh - 86px)',
        width: '100%',
        background:
          'linear-gradient(180deg, #0f172a 0%, #111827 35%, #0f172a 100%)',
        color: '#f8fafc',
        fontFamily: DASHBOARD_FONT,
        padding: '18px',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.35fr 0.85fr',
          gap: '18px',
          minHeight: 'calc(100vh - 122px)',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'auto minmax(520px, 1fr)',
            gap: '18px',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <Card style={{ padding: '18px 20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '18px',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className="dashboard-main-title" style={{ fontSize: '20px', fontWeight: 800 }}>
                  10 Floor Two-Month Energy Heatmap
                </div>
                <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '13px' }}>
                  Floors 1 to 7 use uploaded data. Floors 8 to 10 use generated similar data. July and August 2018 are included.
                </div>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '14px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(96, 165, 250, 0.22)',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 12px #22c55e',
                  }}
                />
                <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                  Dataset loaded
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))',
                gap: '12px',
                marginTop: '18px',
              }}
            >
              <div>
                <FieldLabel>Level</FieldLabel>
                <select
                  value={activeLevel}
                  onChange={(event) => setActiveLevel(event.target.value)}
                  style={selectStyle}
                >
                  {levelConfigs.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel>Room</FieldLabel>
                <select
                  value={resolvedRoomId}
                  onChange={(event) => setActiveRoom(event.target.value)}
                  style={selectStyle}
                >
                  {visibleRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.label} | {room.zoneName} | {room.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginTop: '16px',
              }}
            >
              <div>
                <FieldLabel>Dataset Metric</FieldLabel>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {metricOptions.map((metric) => (
                    <SegmentedButton
                      key={metric.id}
                      active={activeMetric === metric.id}
                      onClick={() => setActiveMetric(metric.id)}
                    >
                      {metric.label}
                    </SegmentedButton>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Mode</FieldLabel>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <SegmentedButton
                    active={viewMode === 'current'}
                    onClick={() => setViewMode('current')}
                  >
                    Current
                  </SegmentedButton>
                  <SegmentedButton
                    active={viewMode === 'predicted'}
                    onClick={() => setViewMode('predicted')}
                  >
                    Predicted
                  </SegmentedButton>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>Heatmap Time Range</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {periodOptions.map((period) => (
                  <SegmentedButton
                    key={period.id}
                    active={periodMode === period.id}
                    onClick={() => handlePeriodChange(period.id)}
                  >
                    {period.label}
                  </SegmentedButton>
                ))}
              </div>
              <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
                {periodMode === 'hour'
                  ? '1 Hour uses an estimated hourly average because the dataset is daily.'
                  : periodMode === 'total'
                  ? `Showing total usage for the full dataset: ${getPeriodDescription(timeIndex, periodMode, hourIndex)}.`
                  : `Showing ${getPeriodLabel(periodMode).toLowerCase()} data range: ${getPeriodDescription(timeIndex, periodMode, hourIndex)}.`}
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <FieldLabel>3D Building View</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <SegmentedButton
                  active={buildingMode === 'light'}
                  onClick={() => setBuildingMode('light')}
                >
                  Light View
                </SegmentedButton>
                <SegmentedButton
                  active={buildingMode === 'detail'}
                  onClick={() => setBuildingMode('detail')}
                >
                  Detailed View
                </SegmentedButton>
              </div>
              <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '12px' }}>
                Light View uses the merged GLB. The building and heatmap are rotated together so the heatmap stays aligned.
              </div>
            </div>

            <div style={{ marginTop: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  fontSize: '13px',
                  color: '#cbd5e1',
                  fontWeight: 600,
                }}
              >
                <span>
                  {periodMode === 'hour'
                    ? 'Hour'
                    : periodMode === 'week'
                    ? 'Week range'
                    : periodMode === 'total'
                    ? 'Total usage'
                    : 'Month range'}
                </span>
                <span>{sliderLabel}</span>
              </div>

              <input
                type="range"
                min="0"
                max={sliderMax}
                value={sliderValue}
                disabled={sliderMax === 0}
                onChange={handleTimelineChange}
                style={{
                  width: '100%',
                  accentColor: '#3b82f6',
                  cursor: 'pointer',
                }}
              />
            </div>
          </Card>

          <Card
            style={{
              position: 'relative',
              overflow: 'visible',
              minHeight: 0,
              background:
                'radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), rgba(15, 23, 42, 0.95) 35%), rgba(15, 23, 42, 0.95)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 18,
                zIndex: 20,
                padding: '10px 12px',
                borderRadius: '14px',
                background: 'rgba(15, 23, 42, 0.86)',
                border: '1px solid rgba(148, 163, 184, 0.16)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Now Viewing
              </div>
              <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 800 }}>
                {selectedLevel.label} | {selectedRoom.label}
              </div>
              <div style={{ marginTop: '2px', fontSize: '12px', color: '#cbd5e1' }}>
                {metricInfo.label} {getPeriodLabel(periodMode).toLowerCase()} heatmap | {sliderLabel}
              </div>
            </div>

            <Canvas
              camera={{ position: [7, 5.5, 8], fov: 42, near: 0.1, far: 1000 }}
              style={{ height: '100%' }}
              frameloop="demand"
              dpr={[0.75, 1]}
              gl={{
                antialias: false,
                powerPreference: 'high-performance',
                alpha: true,
              }}
            >
              <ambientLight intensity={1.35} />
              <directionalLight position={[8, 12, 8]} intensity={2.1} />
              <Suspense fallback={null}>
                <group
                  rotation={[0, SCENE_ROTATION_Y, 0]}
                  scale={BUILDING_SCALE}
                  position={[
                    -BUILDING_CENTER[0] * BUILDING_SCALE,
                    -BUILDING_CENTER[1] * BUILDING_SCALE,
                    -BUILDING_CENTER[2] * BUILDING_SCALE,
                  ]}
                >
                  <BuildingDisplay />
                  <LevelGuide />
                  <RoomHeatmapOverlay />
                </group>
              </Suspense>
              <OrbitControls
                makeDefault
                enableDamping
                dampingFactor={0.08}
                rotateSpeed={0.7}
                zoomSpeed={0.8}
              />
            </Canvas>

            <HeatmapLegend />
          </Card>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'auto auto 1fr auto',
            gap: '18px',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <Card style={{ padding: '18px 20px' }}>
            <SectionTitle
              title="Selected Room Analytics"
              subtitle="Summary from the uploaded dataset."
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <StatCard
                label="Displayed Value"
                value={displayedValue === null ? 'No data' : `${formatValue(displayedValue)} ${metricInfo.unit}`}
                valueColor={valueColor}
                helper={`${metricInfo.label} in ${selectedLevel.label}, ${selectedRoom.label}`}
              />
              <StatCard
                label="Risk Level"
                value={riskLabel}
                valueColor={valueColor}
                helper="Compared with the dataset range"
              />
            </div>
          </Card>

          <Card style={{ padding: '18px 20px' }}>
            <SectionTitle
              title="Dataset Mapping"
              subtitle="How the CSV columns are mapped into rooms."
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
              }}
            >
              <InfoPill label="Level" value={selectedLevel.label} />
              <InfoPill label="Room" value={`${selectedRoom.label} | ${selectedRoom.zoneName}`} />
              <InfoPill label="Area" value={selectedRoom.description} />
              <InfoPill label="Metric" value={metricInfo.label} />
              <InfoPill label="Selected time" value={sliderLabel} />
              <InfoPill label="Range" value={getPeriodLabel(periodMode)} />
              <InfoPill label="Mode" value={viewMode === 'current' ? 'Current' : 'Predicted'} />
            </div>
          </Card>

          <Card
            style={{
              padding: '18px 20px',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SectionTitle
              title="Energy Trend Chart"
              subtitle={
                periodMode === 'total'
                  ? `Total usage trend for ${selectedLevel.label}, ${selectedRoom.label}.`
                  : `${getPeriodLabel(periodMode)} ${metricInfo.label.toLowerCase()} trend for ${selectedLevel.label}, ${selectedRoom.label}.`
              }
            />

            <div style={{ height: '100%', minHeight: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148, 163, 184, 0.16)"
                  />
                  <XAxis dataKey="date" stroke="#cbd5e1" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#cbd5e1" tickFormatter={(value) => `${Math.round(value / 1000)}k`} />

                  <Tooltip
                    formatter={(value) => [
                      value === null ? 'No data' : `${formatValue(value)} ${metricInfo.unit}`,
                      metricInfo.label,
                    ]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(148, 163, 184, 0.16)',
                      borderRadius: '11px',
                      color: '#ffffff',
                    }}
                  />

                  {referenceX && (
                    <ReferenceLine
                      x={referenceX}
                      stroke="#f97316"
                      strokeDasharray="4 4"
                    />
                  )}

                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#60a5fa"
                    strokeWidth={3}
                    fill="url(#areaFill)"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#60a5fa"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#60a5fa' }}
                    activeDot={{ r: 7 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card style={{ padding: '18px 20px' }}>
            <SectionTitle
              title={periodMode === 'total' ? 'Total Usage Summary' : 'Range Summary'}
              subtitle={
                periodMode === 'total'
                  ? 'Total usage calculated across the full available dataset.'
                  : 'Summary for the selected heatmap time range.'
              }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <StatCard
                label="Selected Range Value"
                value={predictedValue === null ? 'No data' : `${formatValue(predictedValue)} ${metricInfo.unit}`}
                valueColor={getHeatmapColor(predictedValue, activeMetric, periodMode)}
                helper="Calculated from the selected range"
              />
              <StatCard
                label="Range Change"
                value={delta === null ? 'No data' : `${trendText} ${metricInfo.unit}`}
                valueColor={delta > 0 ? '#f97316' : delta < 0 ? '#22c55e' : '#cbd5e1'}
                helper={
                  delta === null
                    ? 'No previous data available'
                    : delta > 0
                    ? 'Usage likely increasing'
                    : delta < 0
                    ? 'Usage likely decreasing'
                    : 'No change for selected range'
                }
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const selectStyle = {
  width: '100%',
  padding: '12px 14px',
  backgroundColor: 'rgba(30, 41, 59, 0.88)',
  color: '#ffffff',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  borderRadius: '11px',
  cursor: 'pointer',
  outline: 'none',
  fontSize: '13px',
};
