/**
 * Shared type definitions for the building telemetry dashboard.
 *
 * The three source CSVs share an hourly `timestamp` column and are parsed
 * into strongly-typed row objects below. Aggregated views collapse hourly
 * rows into weekly / monthly buckets (see `lib/aggregate.ts`).
 */

/** Global time-unit toggle, surfaced in the header. */
export type TimeUnit = 'hourly' | 'weekly' | 'monthly';

/** A parsed row from `power_usage.csv` (1-hour resolution). */
export interface PowerRow {
  timestamp: string; // 'YYYY-MM-DD HH:mm:ss'
  total_power_kw: number;
  floor1_power_kw: number;
  floor2_power_kw: number;
  roomA_power_kw: number;
  roomB_power_kw: number;
  roomC_power_kw: number;
  roomD_power_kw: number;
  floor1_ac_kw: number;
  floor1_light_kw: number;
  floor1_plug_kw: number;
  floor2_ac_kw: number;
  floor2_light_kw: number;
  floor2_plug_kw: number;
}

/** A parsed row from `water_usage.csv` (1-hour resolution). */
export interface WaterRow {
  timestamp: string;
  total_water_l: number;
  floor1_water_l: number;
  floor2_water_l: number;
  roomA_water_l: number;
  roomB_water_l: number;
  roomC_water_l: number;
  roomD_water_l: number;
}

/** A parsed row from `server_metrics.csv` (1-hour resolution). */
export interface ServerRow {
  timestamp: string;
  server1_power_kw: number;
  server2_power_kw: number;
  server3_power_kw: number;
  server1_water_l: number;
  server2_water_l: number;
  server3_water_l: number;
  server1_temp_c: number;
  server2_temp_c: number;
  server3_temp_c: number;
}

/**
 * A single aggregated point produced by the aggregation layer.
 * `label` is the display string for the X-axis (e.g. "W12", "Apr").
 * `group` is the bucket key used internally (week number / month id / hour).
 *
 * Power & water fields are SUMMED across the bucket (consumption totals);
 * server temperatures are AVERAGED.
 */
export interface AggregatedPoint {
  label: string;
  group: string;
  /** epoch-ms for the start of the bucket — handy for sorting / reference lines */
  time: number;

  total_power_kw: number;
  floor1_power_kw: number;
  floor2_power_kw: number;
  roomA_power_kw: number;
  roomB_power_kw: number;
  roomC_power_kw: number;
  roomD_power_kw: number;
  floor1_ac_kw: number;
  floor1_light_kw: number;
  floor1_plug_kw: number;
  floor2_ac_kw: number;
  floor2_light_kw: number;
  floor2_plug_kw: number;

  total_water_l: number;
  floor1_water_l: number;
  floor2_water_l: number;
  roomA_water_l: number;
  roomB_water_l: number;
  roomC_water_l: number;
  roomD_water_l: number;

  server1_power_kw: number;
  server2_power_kw: number;
  server3_power_kw: number;
  server1_water_l: number;
  server2_water_l: number;
  server3_water_l: number;
  server1_temp_c: number;
  server2_temp_c: number;
  server3_temp_c: number;
}

/** Shape returned by the `useBuildingData` hook. */
export interface BuildingData {
  hourly: AggregatedPoint[];
  weekly: AggregatedPoint[];
  monthly: AggregatedPoint[];
}

/** Asset key — identifies which of the three CSVs a column belongs to. */
export type MetricKind = 'power' | 'water' | 'temp';
