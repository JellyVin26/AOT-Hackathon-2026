# Integrated AOT Dashboard

This version combines:

- dashboard-ui: 3D building heatmap dashboard
- dashboard-graph: analytics graph dashboard

Use the top navigation bar to switch between:

1. 3D Heatmap
2. Analytics Graphs

## Run

```bash
npm install
npm run dev
```

## Important files changed/added

- `src/App.jsx` - top navigation and view switcher
- `src/HeatmapDashboard.jsx` - original 3D heatmap dashboard
- `src/GraphDashboard.jsx` - graph dashboard integrated from dashboard-graph CSV data
- `src/GraphDashboard.css` - graph dashboard styling
- `src/App.css` - added top navigation styling
- `public/data/*.csv` - copied from dashboard-graph
