import re
import json
from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

import plotly.express as px


def extract_floor_name(file_name: str) -> str:
    match = re.search(r"Floor\s*(\d+)", file_name, re.IGNORECASE)
    if match:
        return f"Floor {match.group(1)}"
    return Path(file_name).stem


def figure_to_json(fig):
    return json.loads(fig.to_json())


def prepare_datetime(df: pd.DataFrame):
    if "day" not in df.columns:
        raise ValueError("CSV must contain a 'day' column.")

    if "hour" not in df.columns:
        raise ValueError("CSV must contain an 'hour' column.")

    df["day"] = pd.to_datetime(df["day"], errors="coerce")
    df = df.dropna(subset=["day"]).copy()

    df["hour"] = pd.to_numeric(df["hour"], errors="coerce")
    df = df.dropna(subset=["hour"]).copy()
    df["hour"] = df["hour"].astype(int)

    df["datetime"] = pd.to_datetime(
        df["day"].dt.strftime("%Y-%m-%d") + " " + df["hour"].astype(str) + ":00:00",
        errors="coerce",
    )

    df = df.dropna(subset=["datetime"]).copy()

    return df


def build_zone_features(df: pd.DataFrame):
    power_cols = []

    for col in df.columns:
        if re.match(r"^z\d+_", col) and "(kW)" in col:
            power_cols.append(col)

    if len(power_cols) == 0:
        raise ValueError(
            "No zone power columns found. Expected columns like z1_Light(kW), z2_AC1(kW), z3_Plug(kW)."
        )

    for col in power_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    zone_names = sorted(
        list(set([col.split("_")[0] for col in power_cols])),
        key=lambda x: int(x.replace("z", "")),
    )

    zone_total_cols = []
    ac_total_cols = []

    for zone in zone_names:
        zone_cols = [col for col in power_cols if col.startswith(zone + "_")]

        total_col = f"{zone}_total"
        df[total_col] = df[zone_cols].sum(axis=1)
        zone_total_cols.append(total_col)

        ac_cols = [col for col in zone_cols if "AC" in col.upper()]

        ac_total_col = f"{zone}_ac_total"

        if len(ac_cols) > 0:
            df[ac_total_col] = df[ac_cols].sum(axis=1)
        else:
            df[ac_total_col] = 0

        ac_total_cols.append(ac_total_col)

    df["total_usage"] = df[zone_total_cols].sum(axis=1)

    return df, power_cols, zone_names, zone_total_cols, ac_total_cols


def find_best_k(X_scaled, k_min=2, k_max=10, random_state=42):
    row_count = X_scaled.shape[0]
    safe_k_max = min(k_max, row_count - 1)

    if safe_k_max < k_min:
        raise ValueError("Not enough rows to perform K-Means clustering.")

    k_results = []

    for k in range(k_min, safe_k_max + 1):
        temp_kmeans = KMeans(
            n_clusters=k,
            random_state=random_state,
            n_init=10,
        )

        labels = temp_kmeans.fit_predict(X_scaled)

        k_results.append(
            {
                "k": int(k),
                "inertia": float(temp_kmeans.inertia_),
                "silhouette_score": float(silhouette_score(X_scaled, labels)),
            }
        )

    k_result_df = pd.DataFrame(k_results)

    best_k = int(
        k_result_df.loc[
            k_result_df["silhouette_score"].idxmax(),
            "k",
        ]
    )

    return best_k, k_result_df


def build_anomaly_explanations(df, zone_total_cols, ac_total_cols):
    zone_q90 = {col: df[col].quantile(0.90) for col in zone_total_cols}
    zone_q10 = {col: df[col].quantile(0.10) for col in zone_total_cols}

    ac_q90 = {col: df[col].quantile(0.90) for col in ac_total_cols}

    total_q90 = df["total_usage"].quantile(0.90)
    total_q10 = df["total_usage"].quantile(0.10)
    total_median = df["total_usage"].median()

    def get_highest_zone(row):
        zone_values = {
            col.replace("_total", ""): row[col]
            for col in zone_total_cols
        }
        return max(zone_values, key=zone_values.get)

    def get_lowest_zone(row):
        zone_values = {
            col.replace("_total", ""): row[col]
            for col in zone_total_cols
        }
        return min(zone_values, key=zone_values.get)

    def get_anomaly_type(row):
        if not row["is_anomaly"]:
            return "Normal"

        if row["total_usage"] < total_q10:
            return "Low usage anomaly"

        if row["total_usage"] > total_q90:
            return "High usage anomaly"

        return "Pattern anomaly"

    def explain_anomaly(row):
        if not row["is_anomaly"]:
            return ""

        reasons = []

        datetime_text = str(row["datetime"])
        hour = int(row["hour"])
        anomaly_type = get_anomaly_type(row)

        if anomaly_type == "Low usage anomaly":
            reasons.append(f"Total floor electricity usage is unusually low at {datetime_text}")

            for col in zone_total_cols:
                zone = col.replace("_total", "")
                if row[col] < zone_q10[col]:
                    reasons.append(f"{zone} usage is below its normal range")

            return "; ".join(reasons)

        if anomaly_type == "High usage anomaly":
            if hour < 6 and row["total_usage"] > total_median:
                reasons.append(f"Night-time usage is high at {datetime_text}")

            for col in zone_total_cols:
                zone = col.replace("_total", "")
                if row[col] > zone_q90[col]:
                    reasons.append(f"{zone} usage is above its normal range")

            for col in ac_total_cols:
                zone = col.replace("_ac_total", "")
                if row[col] > ac_q90[col] and row[col] > 0:
                    reasons.append(f"{zone} AC usage is above its normal range")

            reasons.append("Total floor electricity usage is unusually high")

            return "; ".join(reasons)

        reasons.append(
            "Total usage is not extremely high or low, but the usage pattern is far from its normal cluster behavior"
        )

        highest_zone = get_highest_zone(row)
        lowest_zone = get_lowest_zone(row)

        reasons.append(f"Highest zone during this anomaly is {highest_zone}")
        reasons.append(f"Lowest zone during this anomaly is {lowest_zone}")

        return "; ".join(reasons)

    def make_recommendation_category(row):
        if not row["is_anomaly"]:
            return ""

        anomaly_type = get_anomaly_type(row)
        hour = int(row["hour"])

        if anomaly_type == "Low usage anomaly":
            lowest_zone = get_lowest_zone(row)
            return f"Check possible sensor or equipment issue in {lowest_zone}"

        if anomaly_type == "High usage anomaly":
            for col in ac_total_cols:
                zone = col.replace("_ac_total", "")
                if row[col] > ac_q90[col] and row[col] > 0:
                    return f"Review AC operation schedule in {zone}"

            if hour < 6 and row["total_usage"] > total_median:
                return "Check night-time equipment operation"

            return "Investigate unusually high total floor usage"

        highest_zone = get_highest_zone(row)
        return f"Review unusual usage pattern in {highest_zone}"

    def make_recommendation(row):
        if not row["is_anomaly"]:
            return ""

        anomaly_type = get_anomaly_type(row)
        highest_zone = get_highest_zone(row)
        lowest_zone = get_lowest_zone(row)
        hour = int(row["hour"])
        datetime_text = str(row["datetime"])

        if anomaly_type == "Low usage anomaly":
            return (
                f"Check {lowest_zone} at {datetime_text}: usage is unusually low. "
                f"Verify sensor data, meter reading, or whether equipment was unexpectedly turned off."
            )

        if anomaly_type == "High usage anomaly":
            for col in ac_total_cols:
                zone = col.replace("_ac_total", "")
                if row[col] > ac_q90[col] and row[col] > 0:
                    return f"Check {zone} AC at {datetime_text}: unusually high AC usage."

            if hour < 6 and row["total_usage"] > total_median:
                return f"Check night-time equipment at {datetime_text}: usage is higher than expected."

            return f"Investigate building usage at {datetime_text}: total usage is unusually high."

        return (
            f"Check {highest_zone} and {lowest_zone} at {datetime_text}: "
            f"the zone-level usage pattern is unusual compared with similar hours."
        )

    df["highest_zone"] = df.apply(get_highest_zone, axis=1)
    df["lowest_zone"] = df.apply(get_lowest_zone, axis=1)
    df["anomaly_type"] = df.apply(get_anomaly_type, axis=1)
    df["anomaly_reason"] = df.apply(explain_anomaly, axis=1)
    df["recommendation_category"] = df.apply(make_recommendation_category, axis=1)
    df["recommendation"] = df.apply(make_recommendation, axis=1)

    return df


def build_summary(df, file_name, floor_name, zone_names, zone_total_cols, best_k, threshold):
    zone_usage = {}

    for col in zone_total_cols:
        zone = col.replace("_total", "")
        zone_usage[zone] = float(df[col].sum())

    highest_zone = max(zone_usage, key=zone_usage.get)

    total_records = int(len(df))
    anomaly_count = int(df["is_anomaly"].sum())

    high_anomaly_count = int((df["anomaly_type"] == "High usage anomaly").sum())
    low_anomaly_count = int((df["anomaly_type"] == "Low usage anomaly").sum())
    pattern_anomaly_count = int((df["anomaly_type"] == "Pattern anomaly").sum())

    anomaly_rate = 0
    if total_records > 0:
        anomaly_rate = round((anomaly_count / total_records) * 100, 2)

    return {
        "file_name": file_name,
        "floor_name": floor_name,
        "detected_zones": zone_names,
        "best_k": int(best_k),
        "anomaly_threshold": round(float(threshold), 4),
        "total_records": total_records,
        "anomaly_count": anomaly_count,
        "high_anomaly_count": high_anomaly_count,
        "low_anomaly_count": low_anomaly_count,
        "pattern_anomaly_count": pattern_anomaly_count,
        "anomaly_rate": anomaly_rate,
        "total_usage": round(float(df["total_usage"].sum()), 2),
        "highest_zone": highest_zone,
        "highest_zone_usage": round(float(zone_usage[highest_zone]), 2),
    }


def build_charts(df, k_result_df, best_k, threshold, zone_total_cols, ac_total_cols, X_scaled):
    dark_template = "plotly_dark"

    fig_silhouette = px.line(
        k_result_df,
        x="k",
        y="silhouette_score",
        markers=True,
        title="Silhouette Score for Different K Values",
        template=dark_template,
    )
    fig_silhouette.update_layout(
        xaxis_title="Number of clusters, k",
        yaxis_title="Silhouette score",
        paper_bgcolor="#0f172a",
        plot_bgcolor="#0f172a",
        font_color="#e2e8f0",
    )

    fig_elbow = px.line(
        k_result_df,
        x="k",
        y="inertia",
        markers=True,
        title="Elbow Method for K-Means",
        template=dark_template,
    )
    fig_elbow.update_layout(
        xaxis_title="Number of clusters, k",
        yaxis_title="Inertia",
        paper_bgcolor="#0f172a",
        plot_bgcolor="#0f172a",
        font_color="#e2e8f0",
    )

    pca = PCA(n_components=2)
    pca_result = pca.fit_transform(X_scaled)

    df["pca1"] = pca_result[:, 0]
    df["pca2"] = pca_result[:, 1]

    hover_cols = [
        "datetime",
        "hour",
        "anomaly_type",
        "highest_zone",
        "lowest_zone",
        "total_usage",
        "distance_to_cluster",
        "anomaly_reason",
    ] + zone_total_cols + ac_total_cols

    fig_pca = px.scatter(
        df,
        x="pca1",
        y="pca2",
        color="cluster_label",
        symbol="anomaly_label",
        hover_data=hover_cols,
        title=f"K-Means Clustering Anomaly Detection, k={best_k}",
        template=dark_template,
    )
    fig_pca.update_layout(
        xaxis_title="PCA component 1",
        yaxis_title="PCA component 2",
        paper_bgcolor="#0f172a",
        plot_bgcolor="#0f172a",
        font_color="#e2e8f0",
    )

    fig_time = px.scatter(
        df,
        x="datetime",
        y="total_usage",
        color="anomaly_type",
        hover_data=[
            "cluster",
            "highest_zone",
            "lowest_zone",
            "distance_to_cluster",
            "anomaly_reason",
            "recommendation",
        ] + zone_total_cols + ac_total_cols,
        title="Hourly Electricity Usage with Detected Anomalies",
        template=dark_template,
    )
    fig_time.update_layout(
        xaxis_title="Date and hour",
        yaxis_title="Total electricity usage",
        paper_bgcolor="#0f172a",
        plot_bgcolor="#0f172a",
        font_color="#e2e8f0",
    )

    fig_distance = px.line(
        df,
        x="datetime",
        y="distance_to_cluster",
        title="Distance from Assigned Cluster Center",
        template=dark_template,
    )
    fig_distance.add_hline(
        y=threshold,
        line_dash="dash",
        annotation_text="Anomaly threshold",
        annotation_position="top left",
    )
    fig_distance.update_layout(
        xaxis_title="Date and hour",
        yaxis_title="Distance to cluster center",
        paper_bgcolor="#0f172a",
        plot_bgcolor="#0f172a",
        font_color="#e2e8f0",
    )

    heatmap_df = df.copy()
    heatmap_df["date_only"] = heatmap_df["day"].dt.date.astype(str)
    heatmap_df["anomaly_value"] = heatmap_df["is_anomaly"].astype(int)

    pivot = heatmap_df.pivot_table(
        index="hour",
        columns="date_only",
        values="anomaly_value",
        aggfunc="sum",
        fill_value=0,
    )

    fig_heatmap = px.imshow(
        pivot,
        labels=dict(x="Day", y="Hour", color="Anomaly count"),
        title="Anomaly Heatmap by Day and Hour",
        aspect="auto",
        template=dark_template,
    )
    fig_heatmap.update_layout(
        paper_bgcolor="#0f172a",
        plot_bgcolor="#0f172a",
        font_color="#e2e8f0",
    )

    charts = {
        "silhouette": figure_to_json(fig_silhouette),
        "elbow": figure_to_json(fig_elbow),
        "pca": figure_to_json(fig_pca),
        "time_series": figure_to_json(fig_time),
        "distance": figure_to_json(fig_distance),
        "heatmap": figure_to_json(fig_heatmap),
    }

    return charts, df


def convert_table_datetime_to_string(table: pd.DataFrame):
    if len(table) == 0:
        return table

    table["datetime"] = table["datetime"].astype(str)
    table["day"] = table["day"].astype(str)

    return table


def convert_numpy_values(record: dict):
    converted = {}

    for key, value in record.items():
        if isinstance(value, (np.integer, np.int64)):
            converted[key] = int(value)
        elif isinstance(value, (np.floating, np.float64)):
            converted[key] = round(float(value), 4)
        elif isinstance(value, np.bool_):
            converted[key] = bool(value)
        else:
            converted[key] = value

    return converted


def get_top_anomalies_by_type(anomaly_rows: pd.DataFrame, output_cols):
    anomaly_types = [
        "High usage anomaly",
        "Low usage anomaly",
        "Pattern anomaly",
    ]

    top_anomalies = []

    for anomaly_type in anomaly_types:
        type_rows = anomaly_rows[anomaly_rows["anomaly_type"] == anomaly_type].copy()

        if len(type_rows) == 0:
            continue

        top_row = (
            type_rows
            .sort_values("distance_to_cluster", ascending=False)
            .iloc[0]
        )

        record = top_row[output_cols].to_dict()
        record["datetime"] = str(record["datetime"])
        record["day"] = str(record["day"])
        record = convert_numpy_values(record)

        top_anomalies.append(record)

    return top_anomalies


def analyze_energy_csv(
    df: pd.DataFrame,
    file_name: str,
    random_state: int = 42,
    k_min: int = 2,
    k_max: int = 10,
    anomaly_percentile: float = 0.95,
):
    floor_name = extract_floor_name(file_name)

    df = prepare_datetime(df)

    df, power_cols, zone_names, zone_total_cols, ac_total_cols = build_zone_features(df)

    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["day_of_week"] = df["day"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    feature_cols = [
        "hour_sin",
        "hour_cos",
        "is_weekend",
    ] + zone_total_cols + ac_total_cols

    X = df[feature_cols].fillna(0)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    best_k, k_result_df = find_best_k(
        X_scaled=X_scaled,
        k_min=k_min,
        k_max=k_max,
        random_state=random_state,
    )

    kmeans = KMeans(
        n_clusters=best_k,
        random_state=random_state,
        n_init=10,
    )

    df["cluster"] = kmeans.fit_predict(X_scaled)

    centers = kmeans.cluster_centers_
    assigned_centers = centers[df["cluster"]]

    df["distance_to_cluster"] = np.linalg.norm(
        X_scaled - assigned_centers,
        axis=1,
    )

    threshold = df["distance_to_cluster"].quantile(anomaly_percentile)

    df["is_anomaly"] = df["distance_to_cluster"] > threshold

    df["anomaly_label"] = df["is_anomaly"].map(
        {
            True: "Anomaly",
            False: "Normal",
        }
    )

    df["cluster_label"] = df["cluster"].astype(str)

    df = build_anomaly_explanations(
        df=df,
        zone_total_cols=zone_total_cols,
        ac_total_cols=ac_total_cols,
    )

    profile_cols = [
        "hour",
    ] + zone_total_cols + ac_total_cols + [
        "total_usage",
    ]

    cluster_profile = (
        df.groupby("cluster")[profile_cols]
        .mean()
        .round(2)
        .reset_index()
    )

    cluster_counts = (
        df["cluster"]
        .value_counts()
        .sort_index()
        .rename_axis("cluster")
        .reset_index(name="record_count")
    )

    cluster_profile = cluster_profile.merge(
        cluster_counts,
        on="cluster",
        how="left",
    )

    summary = build_summary(
        df=df,
        file_name=file_name,
        floor_name=floor_name,
        zone_names=zone_names,
        zone_total_cols=zone_total_cols,
        best_k=best_k,
        threshold=threshold,
    )

    charts, df = build_charts(
        df=df,
        k_result_df=k_result_df,
        best_k=best_k,
        threshold=threshold,
        zone_total_cols=zone_total_cols,
        ac_total_cols=ac_total_cols,
        X_scaled=X_scaled,
    )

    output_cols = [
        "datetime",
        "day",
        "hour",
        "cluster",
        "distance_to_cluster",
        "is_anomaly",
        "anomaly_label",
        "anomaly_type",
        "highest_zone",
        "lowest_zone",
    ] + zone_total_cols + ac_total_cols + [
        "total_usage",
        "anomaly_reason",
        "recommendation_category",
        "recommendation",
    ]

    result_table = df[output_cols].copy()
    anomaly_rows = df[df["is_anomaly"]].copy()
    anomalies = anomaly_rows[output_cols].copy()

    top_anomalies_by_type = get_top_anomalies_by_type(
        anomaly_rows=anomaly_rows,
        output_cols=output_cols,
    )

    top_anomaly = None

    if len(anomaly_rows) > 0:
        top_anomaly_row = (
            anomaly_rows
            .sort_values("distance_to_cluster", ascending=False)
            .iloc[0]
        )

        top_anomaly = top_anomaly_row[output_cols].to_dict()
        top_anomaly["datetime"] = str(top_anomaly["datetime"])
        top_anomaly["day"] = str(top_anomaly["day"])
        top_anomaly = convert_numpy_values(top_anomaly)

    result_table = convert_table_datetime_to_string(result_table)
    anomalies = convert_table_datetime_to_string(anomalies)

    return {
        "metadata": {
            "file_name": file_name,
            "floor_name": floor_name,
            "data_type": "hourly_floor_data",
            "detected_power_columns": power_cols,
            "detected_zones": zone_names,
            "feature_columns": feature_cols,
            "zone_total_columns": zone_total_cols,
            "ac_total_columns": ac_total_cols,
            "best_k": int(best_k),
            "anomaly_threshold_percentile": int(anomaly_percentile * 100),
        },
        "summary": summary,
        "k_evaluation": k_result_df.round(4).to_dict(orient="records"),
        "cluster_profile": cluster_profile.to_dict(orient="records"),
        "top_anomaly": top_anomaly,
        "top_anomalies_by_type": top_anomalies_by_type,
        "anomalies": anomalies.round(4).to_dict(orient="records"),
        "result_preview": result_table.head(50).round(4).to_dict(orient="records"),
        "charts": charts,
    }