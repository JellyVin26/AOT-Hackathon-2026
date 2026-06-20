import { useState } from "react";
import Plot from "react-plotly.js";
import "./App.css";

const API_URL = "http://localhost:8000/analyze-multiple-csv";

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);

    const csvFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith(".csv")
    );

    if (csvFiles.length === 0) {
      setSelectedFiles([]);
      setResult(null);
      setMessage("Please select at least one CSV file.");
      return;
    }

    setSelectedFiles(csvFiles);
    setResult(null);
    setActiveFloorIndex(0);
    setMessage(`${csvFiles.length} CSV file(s) selected.`);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setMessage("Please select CSV files first.");
      return;
    }

    try {
      setIsUploading(true);
      setMessage("Uploading and analyzing CSV files...");

      const formData = new FormData();

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();

      console.log("Backend result:", data);

      setResult(data);
      setActiveFloorIndex(0);

      if (data.status === "success") {
        setMessage("Analysis completed.");
      } else {
        setMessage("Analysis completed with some errors.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Upload failed. Check if FastAPI backend is running.");
    } finally {
      setIsUploading(false);
    }
  };

  const floors = result?.floors || [];
  const activeFloor = floors[activeFloorIndex];

  const renderPlot = (chart, height = "520px") => {
    if (!chart) return null;

    return (
      <Plot
        data={chart.data}
        layout={{
          ...chart.layout,
          autosize: true,
          paper_bgcolor: "#0f172a",
          plot_bgcolor: "#0f172a",
          font: {
            color: "#e2e8f0",
          },
        }}
        config={{
          responsive: true,
          displaylogo: false,
        }}
        style={{
          width: "100%",
          height,
        }}
      />
    );
  };

  const getTypeClassName = (type) => {
    if (type === "High usage anomaly") return "type-pill high";
    if (type === "Low usage anomaly") return "type-pill low";
    if (type === "Pattern anomaly") return "type-pill pattern";
    return "type-pill";
  };

  return (
    <main className="app">
      <section className="dashboard">
        <header className="hero">
          <div>
            <h1>Smart Building Energy Dashboard</h1>
            <p>
              Upload one or more floor-level hourly CSV files to detect high,
              low, and pattern-based electricity usage anomalies.
            </p>
          </div>
        </header>

        <section className="upload-panel">
          <div className="upload-box">
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileChange}
            />

            <button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? "Analyzing..." : "Analyze CSVs"}
            </button>
          </div>

          {message && <p className="message">{message}</p>}

          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <h3>Selected files</h3>
              <ul>
                {selectedFiles.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {result?.errors?.length > 0 && (
          <section className="section error-box">
            <h2>Errors</h2>
            {result.errors.map((error) => (
              <div key={error.file_name} className="file-card">
                <h3>{error.file_name}</h3>
                <p>{error.error}</p>
              </div>
            ))}
          </section>
        )}

        {floors.length > 0 && (
          <section className="section">
            <div className="section-header">
              <h2>Analysis Results</h2>
              <p>
                Each uploaded CSV is analyzed independently as one floor-level
                dataset.
              </p>
            </div>

            <div className="tabs">
              {floors.map((floor, index) => (
                <button
                  key={floor.metadata.file_name}
                  className={index === activeFloorIndex ? "tab active" : "tab"}
                  onClick={() => setActiveFloorIndex(index)}
                >
                  {floor.metadata.floor_name}
                </button>
              ))}
            </div>

            {activeFloor && (
              <div className="floor-result">
                <div className="floor-title">
                  <div>
                    <h2>{activeFloor.metadata.floor_name}</h2>
                    <p>{activeFloor.metadata.file_name}</p>
                  </div>

                  <div className="badge">
                    Best k: {activeFloor.summary.best_k}
                  </div>
                </div>

                <div className="summary-grid">
                  <div className="summary-card">
                    <span>Total records</span>
                    <strong>{activeFloor.summary.total_records}</strong>
                  </div>

                  <div className="summary-card">
                    <span>Total anomalies</span>
                    <strong>{activeFloor.summary.anomaly_count}</strong>
                  </div>

                  <div className="summary-card">
                    <span>Anomaly rate</span>
                    <strong>{activeFloor.summary.anomaly_rate}%</strong>
                  </div>

                  <div className="summary-card">
                    <span>High anomalies</span>
                    <strong>{activeFloor.summary.high_anomaly_count}</strong>
                  </div>

                  <div className="summary-card">
                    <span>Low anomalies</span>
                    <strong>{activeFloor.summary.low_anomaly_count}</strong>
                  </div>

                  <div className="summary-card">
                    <span>Pattern anomalies</span>
                    <strong>{activeFloor.summary.pattern_anomaly_count}</strong>
                  </div>
                </div>

                <section className="section">
                  <h3>Detected zones</h3>
                  <p>{activeFloor.metadata.detected_zones.join(", ")}</p>
                </section>

                {activeFloor.top_anomalies_by_type?.length > 0 && (
                  <section className="section critical-box">
                    <h3>Most Critical Anomalies by Type</h3>
                    <p>
                      For each anomaly type, this section shows the record with
                      the largest distance from its assigned cluster center.
                    </p>

                    <div className="critical-anomaly-list">
                      {activeFloor.top_anomalies_by_type.map((item, index) => (
                        <div className="critical-anomaly-card" key={index}>
                          <div className="critical-card-header">
                            <span className={getTypeClassName(item.anomaly_type)}>
                              {item.anomaly_type}
                            </span>
                            <strong>{item.datetime}</strong>
                          </div>

                          <div className="critical-grid">
                            <div>
                              <span>Highest zone</span>
                              <strong>{item.highest_zone}</strong>
                            </div>

                            <div>
                              <span>Lowest zone</span>
                              <strong>{item.lowest_zone}</strong>
                            </div>

                            <div>
                              <span>Total usage</span>
                              <strong>{item.total_usage}</strong>
                            </div>

                            <div>
                              <span>Distance to cluster</span>
                              <strong>{item.distance_to_cluster}</strong>
                            </div>
                          </div>

                          <div className="critical-text">
                            <h4>Reason</h4>
                            <p>{item.anomaly_reason}</p>

                            <h4>Recommended action</h4>
                            <p>{item.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="section">
                  <h3>Visualizations</h3>

                  <div className="chart-card">
                    <h4>Silhouette Score</h4>
                    {renderPlot(activeFloor.charts?.silhouette, "420px")}
                  </div>

                  <div className="chart-card">
                    <h4>Elbow Method</h4>
                    {renderPlot(activeFloor.charts?.elbow, "420px")}
                  </div>

                  <div className="chart-card">
                    <h4>K-Means PCA Anomaly Detection</h4>
                    {renderPlot(activeFloor.charts?.pca, "560px")}
                  </div>

                  <div className="chart-card">
                    <h4>Hourly Usage with Anomalies</h4>
                    {renderPlot(activeFloor.charts?.time_series, "520px")}
                  </div>

                  <div className="chart-card">
                    <h4>Distance from Cluster Center</h4>
                    {renderPlot(activeFloor.charts?.distance, "520px")}
                  </div>

                  <div className="chart-card">
                    <h4>Anomaly Heatmap</h4>
                    {renderPlot(activeFloor.charts?.heatmap, "560px")}
                  </div>
                </section>

                <section className="section">
                  <h3>Cluster Profile</h3>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {activeFloor.cluster_profile.length > 0 &&
                            Object.keys(activeFloor.cluster_profile[0]).map(
                              (key) => <th key={key}>{key}</th>
                            )}
                        </tr>
                      </thead>

                      <tbody>
                        {activeFloor.cluster_profile.map((row, index) => (
                          <tr key={index}>
                            {Object.values(row).map((value, i) => (
                              <td key={i}>{value}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="section">
                  <h3>Anomaly Table</h3>

                  {activeFloor.anomalies.length === 0 ? (
                    <p>No anomalies detected.</p>
                  ) : (
                    <>
                      <p>
                        Showing first 30 anomaly records. Total anomalies:{" "}
                        {activeFloor.anomalies.length}
                      </p>

                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Datetime</th>
                              <th>Type</th>
                              <th>Hour</th>
                              <th>Cluster</th>
                              <th>Highest zone</th>
                              <th>Lowest zone</th>
                              <th>Total usage</th>
                              <th>Reason</th>
                              <th>Recommendation</th>
                            </tr>
                          </thead>

                          <tbody>
                            {activeFloor.anomalies
                              .slice(0, 30)
                              .map((row, index) => (
                                <tr key={index}>
                                  <td>{row.datetime}</td>
                                  <td>
                                    <span className={getTypeClassName(row.anomaly_type)}>
                                      {row.anomaly_type}
                                    </span>
                                  </td>
                                  <td>{row.hour}</td>
                                  <td>{row.cluster}</td>
                                  <td>{row.highest_zone}</td>
                                  <td>{row.lowest_zone}</td>
                                  <td>{row.total_usage}</td>
                                  <td>{row.anomaly_reason}</td>
                                  <td>{row.recommendation}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

export default App;