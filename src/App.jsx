import React, { useState } from 'react';
import HeatmapDashboard from './HeatmapDashboard';
import GraphDashboard from './GraphDashboard';
import './App.css';

const navItems = [
  {
    id: 'graphs',
    label: 'Dashboard',
    description: 'Power, water and server trends',
  },
  {
    id: 'heatmap',
    label: '3D Heatmap',
    description: 'Building energy heatmap',
  },
];

function TopNavigation({ activeView, setActiveView }) {
  return (
    <header className="top-navigation">
      <div className="top-nav-brand">
        <div className="top-nav-logo">S</div>
        <div>
          <h1>Sustainable Building Intelligence</h1>
          <p>Energy efficiency, water usage and smart building insights</p>
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
        {activeView === 'graphs' ? <GraphDashboard /> : <HeatmapDashboard />}
      </main>
    </div>
  );
}
