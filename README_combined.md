# EcoVision

**EcoVision** is a web-based sustainability monitoring system that helps users understand building performance through interactive visual analytics.

The system combines energy usage, CO₂ emissions, waste, water, temperature, anomaly detection, ML-based anomaly prediction, and 3D building heatmap visualisation into one dashboard.

---

## Team Name & Team Members

**Team Name:** ChatGPT Did This

**Team Members:**

- William Melvin Sukamto
- Bunta Iwasaki
- Morikawa Kaoru
- Ryan Ngiam Hong Seng
- Ong Ding Zhang

---

## Technologies Used

- React
- Vite
- JavaScript / JSX
- CSS
- Python
- FastAPI
- Recharts
- Three.js / React Three Fiber
- Zustand
- RandomForestRegressor
- JSON dataset
- CSV training dataset

---

## Challenge and Approach

We chose **Track 3: Smart Resource Management** because ESG performance is becoming important for companies, especially in the environmental area. Many companies collect data such as energy usage, water consumption, CO₂ emissions, and waste disposal, but the data is often stored separately and can be difficult to understand.

Our solution is a sustainability monitoring dashboard that helps companies track key environmental factors such as energy, CO₂ emissions, water usage, temperature, and waste. The system presents the data through simple visualisations so non-technical staff can understand building performance easily. It also includes anomaly detection and ML-based anomaly prediction to highlight unusual patterns and support better decision-making for improving ESG performance.

---

## Main Features

- Interactive sustainability KPI dashboard
- Clickable metrics for energy, CO₂, waste, water, and temperature
- Overview, Areas, and Infrastructure chart sections
- Floor-level and room-level comparisons
- 3D building heatmap
- Statistical anomaly detection dashboard
- ML-based anomaly panel using Model A
- Explainable anomaly output with severity, possible reason, recommendation, business benefit, and ESG alignment

---

## Project Structure

```txt
AOT-Hackathon-2026/
├── backend/
│   ├── main.py
│   └── venv/
├── ML1/
│   ├── data/
│   ├── models/
│   ├── src/
│   ├── tests/
│   ├── requirements.txt
│   └── README.md
├── public/
├── src/
│   ├── App.jsx
│   ├── GraphDashboard.jsx
│   ├── AnomalyDetectionDashboard.jsx
│   ├── HeatmapDashboard.jsx
│   └── main.jsx
├── package.json
└── README.md
```

---

## Usage Instructions

### 1. Clone the repository

```powershell
git clone https://github.com/JellyVin26/AOT-Hackathon-2026.git
cd AOT-Hackathon-2026
```

### 2. Install frontend dependencies

```powershell
npm install
```

### 3. Create the backend virtual environment

```powershell
python -m venv backend\venv
```

### 4. Install backend dependencies

```powershell
.\backend\venv\Scripts\python.exe -m pip install fastapi uvicorn openai python-dotenv
```

### 5. Install ML1 dependencies

```powershell
.\backend\venv\Scripts\python.exe -m pip install -r ML1\requirements.txt
```

If packages are still missing, run:

```powershell
.\backend\venv\Scripts\python.exe -m pip install pandas numpy scikit-learn joblib pytest
```

### 6. Train the ML1 model

Make sure the training dataset is located here:

```txt
ML1\data\shopping_mall_all_floors_hourly_ai_ready_training.csv
```

Then run:

```powershell
.\backend\venv\Scripts\python.exe ML1\src\train_model.py
```

This creates or updates:

```txt
ML1\models\expected_energy_model.pkl
ML1\models\preprocessing_pipeline.pkl
ML1\models\model_metrics.json
```

### 7. Run the ML1 anomaly API

```powershell
.\backend\venv\Scripts\python.exe -m uvicorn ML1.src.api:app --reload --port 8000
```

Keep this terminal open.

Test the ML1 API:

```txt
http://127.0.0.1:8000/health
http://127.0.0.1:8000/latest-anomalies
http://127.0.0.1:8000/metrics
```

### 8. Run the backend API

Open another terminal:

```powershell
cd to main root directory
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8001
```

### 9. Run the frontend

Open another terminal from the main project folder:

```powershell
cd to main root directory
npm run dev
```

Open the Vite link shown in the terminal, usually:

```txt
http://localhost:5173
```

If port 5173 is already in use, Vite may use:

```txt
http://localhost:5174
```

---

## Optional: Run Everything Together

Install concurrently:

```powershell
npm install --save-dev concurrently
```

Add these scripts into `package.json`:

```json
{
  "dev": "vite",
  "ml1": "backend\\venv\\Scripts\\python.exe -m uvicorn ML1.src.api:app --reload --port 8000",
  "backend": "cd backend && venv\\Scripts\\python.exe -m uvicorn main:app --reload --port 8001",
  "start:all": "npx concurrently \"npm run ml1\" \"npm run backend\" \"npm run dev\"",
  "build": "vite build",
  "preview": "vite preview"
}
```

Then run:

```powershell
npm run start:all
```

This starts:

```txt
Frontend: http://localhost:5173
ML1 API:  http://127.0.0.1:8000
Backend:  http://127.0.0.1:8001
```

---

# ML1 — Model A: ML-Based Anomaly Detection

Model A is the machine-learning anomaly-detection module for EcoVision. It predicts the **expected hourly energy use** for each floor, room, and hour, then compares it with the **actual reading**.

It returns an explainable anomaly verdict that includes:

- Severity
- Anomaly type
- Possible reason
- Recommended solution
- Business benefit
- ESG alignment

---

## Running ML1 Tests

```powershell
.\backend\venv\Scripts\python.exe -m pytest ML1\tests\ -v
```

The tests check feature leakage prevention, anomaly output, residual calculation, severity bands, API routes, and model metrics.

---

## Demo / Screenshots

**Video Demo:** (video link)

**Screenshots:**

- Dashboard overview screenshot
- Anomaly detection screenshot
- ML anomaly detection screenshot
- 3D heatmap screenshot

---

## Notes

- The project includes both dashboard visualisation and ML anomaly detection.
- Model A focuses only on ML-based anomaly detection.
- Model B and the energy-advice chatbot are not included in ML1.
- Some sustainability values used in the dashboard may be generated for prototype demonstration purposes.
- The ML model is context-aware because it compares actual energy use against learned expected energy use, rather than using a fixed raw energy threshold.
