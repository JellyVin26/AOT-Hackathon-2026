import React, { useState } from 'react';
import HeatmapDashboard from './HeatmapDashboard';
import GraphDashboard from './GraphDashboard';
import AnomalyDetectionDashboard from './AnomalyDetectionDashboard';
import AnomalyPanel from './AnomalyPanel';
import './App.css';

const navItems = [
  {
    id: 'graphs',
    label: 'Dashboard',
    description: 'Sustainability overview',
  },
  {
    id: 'anomaly',
    label: 'Anomaly Detection',
    description: 'Unusual patterns',
  },
  {
    id: 'ml-anomaly',
    label: 'ML Anomaly',
    description: 'Model A predictions',
  },
  {
    id: 'heatmap',
    label: '3D Heatmap',
    description: 'Building heatmap',
  },
];

function TopNavigation({ activeView, setActiveView }) {
  return (
    <header className="top-navigation">
      <div className="top-nav-brand">
        <div className="top-nav-logo">S</div>
        <div>
          <h1>Sustainable Building Intelligence</h1>
          <p>Energy, CO₂, waste and anomaly monitoring</p>
        </div>
      </div>

      <nav className="top-nav-tabs" aria-label="Dashboard navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`top-nav-button ${activeView === item.id ? 'top-nav-button-active' : ''}`}
            onClick={() => setActiveView(item.id)}
          >
            <span>{item.label}</span>
            <small>{item.description}</small>
          </button>
        ))}
      </nav>
    </header>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState('graphs');

  return (
    <div className="integrated-shell">
      <TopNavigation activeView={activeView} setActiveView={setActiveView} />

      <main className="integrated-main">
        {activeView === 'graphs' && <GraphDashboard />}
        {activeView === 'anomaly' && <AnomalyDetectionDashboard />}
        {activeView === 'ml-anomaly' && <AnomalyPanel />}
        {activeView === 'heatmap' && <HeatmapDashboard />}
      </main>
    </div>
  );
}
