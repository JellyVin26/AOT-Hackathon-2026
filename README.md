# EcoVision

**EcoVision** is a web-based sustainability monitoring system that helps users understand building performance through interactive visual analytics.

The system provides a combined dashboard for energy usage, CO₂ emissions, waste, water, temperature, anomaly detection, and 3D building heatmap visualisation.

## Team Name & Team Members

**Team Name:** ChatGPT Did This

**Team Members:**

* WIlliam Melvin Sukamto
* Bunta Iwasaki
* Morikawa Kaoru
* Ryan Ngiam Hong Seng
* Ong Ding Zhang

## Technologies Used

* React
* Vite
* JavaScript / JSX
* CSS
* Python
* Recharts
* Three.js / React Three Fiber
* Zustand
* JSON dataset

## Challenge and Approach
We chose track 3 that talk about smart resource managament because we think we can give different perspective and able to do this track. The challenge was to combine different sustainability-related data into one clear dashboard. The system helps users understand electricity usage, water consumption, carbon emissions, and waste disposal.
Our solution is a sustainability monitoring dashboard that helps companies track key environmental factors such as energy, CO₂ emissions, water usage, temperature, and waste.

## Usage Instructions

### 1. Install frontend dependencies

From the main project folder, run:

```powershell
npm install
```

### 2. Install backend dependencies

Go into the backend folder:

```powershell
cd backend
```

Create a virtual environment:

```powershell
python -m venv venv
```

Activate the virtual environment on Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the backend packages:

```powershell
pip install fastapi uvicorn openai python-dotenv
```

Go back to the main project folder:

```powershell
cd ..
```

### 3. Install concurrently

This allows the frontend and backend to run together using one command:

```powershell
npm install --save-dev concurrently
```

### 4. Run the full system

From the main project folder, run:

```powershell
npm run start:all
```

This will start both:

```txt
Frontend: http://localhost:5173
Backend:  http://127.0.0.1:8001
```


## Demo / Screenshots

**Video Demo:** (video link)

**Screenshots:**

* Dashboard overview screenshot
* Anomaly detection screenshot
* 3D heatmap screenshot
