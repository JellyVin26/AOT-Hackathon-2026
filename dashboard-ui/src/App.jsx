import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import { DoubleSide } from 'three';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { create } from 'zustand';
import telemetryData from './mockTelemetry.json';

// ===============================
// 1. State Management
// ===============================
const useStore = create((set) => ({
  activeZone: 'Zone_A',
  activeMetric: 'power',
  timeIndex: 0,
  viewMode: 'current',

  setActiveZone: (zone) => set({ activeZone: zone }),
  setActiveMetric: (metric) => set({ activeMetric: metric }),
  setTimeIndex: (index) => set({ timeIndex: parseInt(index, 10) }),
  setViewMode: (mode) => set({ viewMode: mode }),
}));

// ===============================
// 2. Heatmap Colour Function
// Green = low
// Yellow = medium
// Orange = high
// Red = very high
// ===============================
const getHeatmapColor = (value, metric) => {
  const ranges = {
    power: { min: 0, max: 3000 },
    co2: { min: 400, max: 1600 },
    temperature: { min: 18, max: 40 },
  };

  const range = ranges[metric] || ranges.power;

  const percentage = Math.min(
    1,
    Math.max(0, (value - range.min) / (range.max - range.min))
  );

  const hue = 120 - percentage * 120;

  return `hsl(${hue}, 90%, 50%)`;
};

// ===============================
// 3. Simple Prediction Function
// This predicts next value using recent trend
// Later, replace this with your ML model output
// ===============================
const predictNextValue = (data, zone, metric, timeIndex) => {
  const currentValue = data[timeIndex][zone][metric];

  if (timeIndex === 0) {
    return currentValue;
  }

  const previousValue = data[timeIndex - 1][zone][metric];
  const trend = currentValue - previousValue;

  return Math.max(0, Math.round(currentValue + trend));
};

// ===============================
// 4. Roof Heatmap Zones
// IMPORTANT:
// These are now placed higher on the Y axis,
// so the heatmap appears on top of the factory.
// If it is still slightly off, only adjust position.
// position = [left/right, up/down, front/back]
// ===============================
const heatmapZones = [
  {
    id: 'Zone_A',
    label: 'Production Area',
    position: [-2.5, 5.8, 0.2],
    size: [3.0, 2.5],
  },
  {
    id: 'Zone_B',
    label: 'Machine Area',
    position: [1.9, 6.4, 0.1],
    size: [3.2, 2.6],
  },
  {
    id: 'Zone_C',
    label: 'Storage Area',
    position: [-0.4, 5.4, 3.6],
    size: [3.4, 2.2],
  },
];

// ===============================
// 5. Factory Model
// ===============================
function FactoryModel() {
  const { scene } = useGLTF('/low_poly_factory.glb');

  return (
    <primitive
      object={scene}
      scale={1}
      position={[0, 0, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

// ===============================
// 6. Heatmap Overlay Component
// ===============================
function HeatmapOverlay() {
  const {
    activeZone,
    activeMetric,
    timeIndex,
    viewMode,
    setActiveZone,
  } = useStore();

  const currentData = telemetryData[timeIndex];

  return (
    <group>
      {heatmapZones.map((zone) => {
        const currentValue = currentData[zone.id][activeMetric];

        const predictedValue = predictNextValue(
          telemetryData,
          zone.id,
          activeMetric,
          timeIndex
        );

        const valueToShow =
          viewMode === 'predicted' ? predictedValue : currentValue;

        const isActive = activeZone === zone.id;
        const zoneColor = getHeatmapColor(valueToShow, activeMetric);

        return (
          <group key={zone.id}>
            <mesh
              position={zone.position}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(e) => {
                e.stopPropagation();
                setActiveZone(zone.id);
              }}
            >
              <planeGeometry args={zone.size} />
              <meshStandardMaterial
                color={zoneColor}
                transparent
                opacity={isActive ? 0.82 : 0.62}
                emissive={zoneColor}
                emissiveIntensity={isActive ? 0.45 : 0.22}
                side={DoubleSide}
                depthWrite={false}
              />
            </mesh>

            <Html
              position={[
                zone.position[0],
                zone.position[1] + 0.55,
                zone.position[2],
              ]}
              center
            >
              <div
                style={{
                  background: isActive ? '#0f172a' : 'rgba(15, 23, 42, 0.78)',
                  color: '#ffffff',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  border: isActive ? '1px solid #38bdf8' : '1px solid #334155',
                  cursor: 'pointer',
                  boxShadow: isActive
                    ? '0 0 12px rgba(56, 189, 248, 0.7)'
                    : 'none',
                }}
                onClick={() => setActiveZone(zone.id)}
              >
                <strong>{zone.label}</strong>
                <br />
                {activeMetric.toUpperCase()}: {valueToShow}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ===============================
// 7. Legend
// ===============================
function HeatmapLegend() {
  const { activeMetric } = useStore();

  const unit =
    activeMetric === 'power'
      ? 'kWh'
      : activeMetric === 'co2'
      ? 'ppm'
      : '°C';

  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        bottom: 20,
        zIndex: 20,
        background: 'rgba(15, 23, 42, 0.9)',
        padding: '14px',
        borderRadius: '10px',
        border: '1px solid #334155',
        width: '260px',
      }}
    >
      <h4 style={{ margin: '0 0 10px 0' }}>Heatmap Scale</h4>

      <div
        style={{
          height: '14px',
          width: '100%',
          borderRadius: '10px',
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
        <span>Very High</span>
      </div>

      <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#cbd5e1' }}>
        Unit: {unit}. Red means the zone has high consumption or unsafe level.
      </p>
    </div>
  );
}

// ===============================
// 8. Main App
// ===============================
export default function App() {
  const {
    activeZone,
    activeMetric,
    timeIndex,
    viewMode,
    setActiveMetric,
    setTimeIndex,
    setViewMode,
  } = useStore();

  const currentValue = telemetryData[timeIndex][activeZone][activeMetric];

  const predictedValue = predictNextValue(
    telemetryData,
    activeZone,
    activeMetric,
    timeIndex
  );

  const displayedValue =
    viewMode === 'predicted' ? predictedValue : currentValue;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Left Side: 3D Building Heatmap */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px', zIndex: 10 }}>
          <h2 style={{ margin: 0 }}>Factory Heatmap Predictor</h2>
          <p style={{ marginTop: '8px', color: '#cbd5e1' }}>
            Green means low. Yellow means medium. Red means high.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button
              onClick={() => setActiveMetric('power')}
              style={buttonStyle(activeMetric === 'power')}
            >
              Energy
            </button>

            <button
              onClick={() => setActiveMetric('co2')}
              style={buttonStyle(activeMetric === 'co2')}
            >
              CO2
            </button>

            <button
              onClick={() => setActiveMetric('temperature')}
              style={buttonStyle(activeMetric === 'temperature')}
            >
              Temperature
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button
              onClick={() => setViewMode('current')}
              style={buttonStyle(viewMode === 'current')}
            >
              Current Heatmap
            </button>

            <button
              onClick={() => setViewMode('predicted')}
              style={buttonStyle(viewMode === 'predicted')}
            >
              Predicted Heatmap
            </button>
          </div>

          <div style={{ marginTop: '20px' }}>
            <label>
              Time: <strong>{telemetryData[timeIndex].time}</strong>
            </label>

            <input
              type="range"
              min="0"
              max={telemetryData.length - 1}
              value={timeIndex}
              onChange={(e) => setTimeIndex(e.target.value)}
              style={{ width: '100%', marginTop: '10px' }}
            />
          </div>
        </div>

        <Canvas camera={{ position: [8, 8, 10], fov: 45 }} style={{ flex: 1 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 20, 10]} intensity={1.7} />

          <Suspense fallback={null}>
            <FactoryModel />
            <HeatmapOverlay />
          </Suspense>

          <OrbitControls />
        </Canvas>

        <HeatmapLegend />
      </div>

      {/* Right Side: Data Analytics */}
      <div
        style={{
          flex: 1,
          padding: '40px',
          backgroundColor: '#1e293b',
          borderLeft: '1px solid #334155',
          overflowY: 'auto',
        }}
      >
        <h2>Zone Analytics</h2>

        <div
          style={{
            background: '#0f172a',
            padding: '18px',
            borderRadius: '12px',
            border: '1px solid #334155',
            marginTop: '20px',
          }}
        >
          <p>
            Selected Zone:{' '}
            <strong>{activeZone.replace('_', ' ')}</strong>
          </p>

          <p>
            Metric: <strong>{activeMetric.toUpperCase()}</strong>
          </p>

          <p>
            Mode:{' '}
            <strong>
              {viewMode === 'current' ? 'Current' : 'Predicted'}
            </strong>
          </p>

          <p>
            Displayed Value:{' '}
            <strong style={{ color: getHeatmapColor(displayedValue, activeMetric) }}>
              {displayedValue}
            </strong>
          </p>

          <p style={{ color: '#cbd5e1', fontSize: '14px' }}>
            The prediction is currently based on recent trend. Later, this can
            be replaced with a trained machine learning model.
          </p>
        </div>

        <div style={{ height: '460px', width: '100%', marginTop: '40px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#cbd5e1" />
              <YAxis stroke="#cbd5e1" />

              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  color: '#ffffff',
                }}
              />

              <ReferenceLine
                x={telemetryData[timeIndex].time}
                stroke="#ef4444"
                strokeDasharray="3 3"
              />

              <Line
                type="monotone"
                dataKey={`${activeZone}.${activeMetric}`}
                stroke="#38bdf8"
                strokeWidth={4}
                dot={{ r: 4, fill: '#38bdf8' }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ===============================
// 9. Button Style Helper
// ===============================
const buttonStyle = (active) => ({
  padding: '10px 18px',
  backgroundColor: active ? '#3b82f6' : '#334155',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: active ? 'bold' : 'normal',
});
