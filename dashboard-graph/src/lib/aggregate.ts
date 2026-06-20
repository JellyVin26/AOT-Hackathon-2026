import type {
  AggregatedPoint,
  PowerRow,
  ServerRow,
  TimeUnit,
  WaterRow,
} from '../types/data';

/**
 * Aggregation engine.
 *
 * Three raw hourly series (power, water, servers) are joined on `timestamp`
 * into unified `AggregatedPoint`s. They are then bucketed into:
 *   - hourly  -> last 24 hours (keeps the most recent day legible)
 *   - weekly  -> ISO-week buckets (summed/averaged)
 *   - monthly -> calendar-month buckets
 *
 * Rules:
 *   - power & water metrics are SUMMED (they are consumption totals)
 *   - server temperatures are AVERAGED (a temperature has no "total")
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Merge the three parsed CSV arrays into hourly aggregated points (sorted). */
export function mergeHourly(
  power: PowerRow[],
  water: WaterRow[],
  servers: ServerRow[],
): AggregatedPoint[] {
  const waterByTs = new Map(water.map((w) => [w.timestamp, w]));
  const serverByTs = new Map(servers.map((s) => [s.timestamp, s]));

  return power
    .map((p): AggregatedPoint => {
      const w = waterByTs.get(p.timestamp);
      const s = serverByTs.get(p.timestamp);
      const time = parseTimestamp(p.timestamp);
      return {
        label: formatHourLabel(time),
        group: `h${time.getTime()}`,
        time: time.getTime(),
        total_power_kw: p.total_power_kw,
        floor1_power_kw: p.floor1_power_kw,
        floor2_power_kw: p.floor2_power_kw,
        roomA_power_kw: p.roomA_power_kw,
        roomB_power_kw: p.roomB_power_kw,
        roomC_power_kw: p.roomC_power_kw,
        roomD_power_kw: p.roomD_power_kw,
        floor1_ac_kw: p.floor1_ac_kw,
        floor1_light_kw: p.floor1_light_kw,
        floor1_plug_kw: p.floor1_plug_kw,
        floor2_ac_kw: p.floor2_ac_kw,
        floor2_light_kw: p.floor2_light_kw,
        floor2_plug_kw: p.floor2_plug_kw,
        total_water_l: w?.total_water_l ?? 0,
        floor1_water_l: w?.floor1_water_l ?? 0,
        floor2_water_l: w?.floor2_water_l ?? 0,
        roomA_water_l: w?.roomA_water_l ?? 0,
        roomB_water_l: w?.roomB_water_l ?? 0,
        roomC_water_l: w?.roomC_water_l ?? 0,
        roomD_water_l: w?.roomD_water_l ?? 0,
        server1_power_kw: s?.server1_power_kw ?? 0,
        server2_power_kw: s?.server2_power_kw ?? 0,
        server3_power_kw: s?.server3_power_kw ?? 0,
        server1_water_l: s?.server1_water_l ?? 0,
        server2_water_l: s?.server2_water_l ?? 0,
        server3_water_l: s?.server3_water_l ?? 0,
        server1_temp_c: s?.server1_temp_c ?? 0,
        server2_temp_c: s?.server2_temp_c ?? 0,
        server3_temp_c: s?.server3_temp_c ?? 0,
      };
    })
    .sort((a, b) => a.time - b.time);
}

/** All numeric keys that should be SUMMED when aggregating. */
const SUM_KEYS: (keyof AggregatedPoint)[] = [
  'total_power_kw',
  'floor1_power_kw',
  'floor2_power_kw',
  'roomA_power_kw',
  'roomB_power_kw',
  'roomC_power_kw',
  'roomD_power_kw',
  'floor1_ac_kw',
  'floor1_light_kw',
  'floor1_plug_kw',
  'floor2_ac_kw',
  'floor2_light_kw',
  'floor2_plug_kw',
  'total_water_l',
  'floor1_water_l',
  'floor2_water_l',
  'roomA_water_l',
  'roomB_water_l',
  'roomC_water_l',
  'roomD_water_l',
  'server1_power_kw',
  'server2_power_kw',
  'server3_power_kw',
  'server1_water_l',
  'server2_water_l',
  'server3_water_l',
];

/** Keys that should be AVERAGED when aggregating (temperatures). */
const AVG_KEYS: (keyof AggregatedPoint)[] = [
  'server1_temp_c',
  'server2_temp_c',
  'server3_temp_c',
];

/** Collapse hourly points into buckets keyed by `groupFn`. */
function bucketize(
  hourly: AggregatedPoint[],
  groupFn: (time: number) => { group: string; label: string },
): AggregatedPoint[] {
  const buckets = new Map<
    string,
    { label: string; group: string; time: number; rows: AggregatedPoint[] }
  >();

  for (const row of hourly) {
    const { group, label } = groupFn(row.time);
    let bucket = buckets.get(group);
    if (!bucket) {
      bucket = { label, group, time: row.time, rows: [] };
      buckets.set(group, bucket);
    }
    bucket.rows.push(row);
  }

  return [...buckets.values()]
    .sort((a, b) => a.time - b.time)
    .map(({ label, group, time, rows }) => {
      // Accumulate into a plain numeric record, then widen to AggregatedPoint.
      // (Indexed assignment on the full union type confuses TS control-flow.)
      const out = {
        label,
        group,
        time,
      } as Record<keyof AggregatedPoint, number | string>;

      for (const key of SUM_KEYS) {
        out[key] = rows.reduce((sum, r) => sum + (r[key] as number), 0);
      }
      for (const key of AVG_KEYS) {
        const total = rows.reduce((sum, r) => sum + (r[key] as number), 0);
        out[key] = rows.length ? total / rows.length : 0;
      }
      return out as unknown as AggregatedPoint;
    });
}

/** ISO-8601 week of year + year, e.g. "2026-W12". */
function weekKey(time: number): { group: string; label: string } {
  const d = new Date(time);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return {
    group: `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`,
    label: `W${week}`,
  };
}

/** Calendar-month bucket, e.g. "2026-03" -> label "Mar". */
function monthKey(time: number): { group: string; label: string } {
  const d = new Date(time);
  const group = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { group, label: MONTHS[d.getMonth()] };
}

export function aggregate(
  hourly: AggregatedPoint[],
  unit: TimeUnit,
): AggregatedPoint[] {
  switch (unit) {
    case 'hourly':
      // Show the most recent 24 hourly points for a legible line.
      return hourly.slice(-24);
    case 'weekly':
      return bucketize(hourly, weekKey);
    case 'monthly':
      return bucketize(hourly, monthKey);
  }
}

// --- timestamp helpers ------------------------------------------------------
const TS_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/** Parse 'YYYY-MM-DD HH:mm:ss' (local) into a Date. */
export function parseTimestamp(ts: string): Date {
  const m = TS_RE.exec(ts);
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
    );
  }
  return new Date(ts); // fall back to native parsing
}

function formatHourLabel(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${h}:00`;
}
