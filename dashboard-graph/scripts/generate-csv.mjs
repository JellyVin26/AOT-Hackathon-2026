// @ts-check
/**
 * Generates three realistic hourly-resolution CSV files for the dashboard:
 *   - public/data/power_usage.csv
 *   - public/data/water_usage.csv
 *   - public/data/server_metrics.csv
 *
 * The data spans ~90 days (≈ 2160 hourly rows) with believable seasonality:
 * day/night cycles, weekday/weekend patterns, and a power <-> temperature
 * correlation so the Infrastructure composed chart tells a real story.
 *
 * Run with:  npm run gen:data
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'data');

// --- helpers ----------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const fmtTs = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:00:00`;

/** Deterministic pseudo-random in [0,1) so reruns are stable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260620);

/** Clamp + round to 2 decimals. */
const r2 = (x) => Math.round(x * 100) / 100;

// --- date range -------------------------------------------------------------
const START = new Date('2026-03-22T00:00:00');
const DAYS = 90;
const HOURS = DAYS * 24;

// --- building model ---------------------------------------------------------
// Base kW draw per equipment category, per floor. AC scales with temperature;
// lighting & plugs follow occupancy. Rooms A..D are sub-areas split across
// floors (A,B on floor 1; C,D on floor 2).
const FLOORS = ['floor1', 'floor2'];
const ROOMS = ['roomA', 'roomB', 'roomC', 'roomD'];
const EQUIP = ['ac', 'light', 'plug'];

const baseEquip = {
  floor1: { ac: 7.5, light: 3.2, plug: 5.4 },
  floor2: { ac: 6.8, light: 2.9, plug: 4.9 },
};

/** Outdoor temperature (°C) over the period, with daily + seasonal swing. */
function outdoorTemp(hourIndex) {
  const t = hourIndex;
  const dayOfYear = Math.floor(t / 24);
  const hourOfDay = t % 24;
  // Seasonal warming across the 90-day window (~12 -> ~27 avg)
  const seasonal = 12 + (dayOfYear / DAYS) * 15;
  // Daily cycle: coldest ~5am, warmest ~15:00
  const daily = -6 * Math.cos(((hourOfDay - 5) / 24) * Math.PI * 2);
  const noise = (rnd() - 0.5) * 2.5;
  return seasonal + daily + noise;
}

/** Occupancy factor: ~1.0 working hours weekdays, lower nights/weekends. */
function occupancy(hourIndex) {
  const date = new Date(START.getTime() + hourIndex * 3600_000);
  const dow = date.getDay(); // 0 Sun .. 6 Sat
  const hour = date.getHours();
  const isWeekend = dow === 0 || dow === 6;
  const workPeak =
    hour >= 8 && hour <= 18 ? 1 : hour >= 6 && hour <= 22 ? 0.55 : 0.22;
  return isWeekend ? workPeak * 0.45 : workPeak;
}

// --- generate hourly rows ---------------------------------------------------
const powerRows = [];
const waterRows = [];
const serverRows = [];

for (let h = 0; h < HOURS; h++) {
  const date = new Date(START.getTime() + h * 3600_000);
  const ts = fmtTs(date);
  const temp = outdoorTemp(h);
  const occ = occupancy(h);

  // POWER: equipment per floor, then derive floors/rooms/total from it.
  const equip = {};
  for (const f of FLOORS) {
    equip[f] = {
      ac:
        baseEquip[f].ac *
        (0.6 + Math.max(0, (temp - 16) / 18)) * // AC works harder when hotter
        (0.8 + 0.2 * occ) *
        (0.92 + rnd() * 0.16),
      light: baseEquip[f].light * occ * (0.85 + rnd() * 0.3),
      plug: baseEquip[f].plug * occ * (0.85 + rnd() * 0.3),
    };
  }

  let totalPower = 0;
  for (const f of FLOORS) totalPower += equip[f].ac + equip[f].light + equip[f].plug;

  // Servers draw their own power (independent of occupancy, always-on).
  const serverPower = [3.4, 3.9, 2.8].map(
    (base) => base * (0.9 + rnd() * 0.25) * (0.85 + 0.15 * (temp / 25)),
  );
  totalPower += serverPower.reduce((s, v) => s + v, 0);

  powerRows.push({
    ts,
    floor1: equip.floor1.ac + equip.floor1.light + equip.floor1.plug,
    floor2: equip.floor2.ac + equip.floor2.light + equip.floor2.plug,
    f1_ac: equip.floor1.ac,
    f1_light: equip.floor1.light,
    f1_plug: equip.floor1.plug,
    f2_ac: equip.floor2.ac,
    f2_light: equip.floor2.light,
    f2_plug: equip.floor2.plug,
    roomA: equip.floor1.ac * 0.4 + equip.floor1.plug * 0.45,
    roomB: equip.floor1.light + equip.floor1.plug * 0.55,
    roomC: equip.floor2.ac * 0.45 + equip.floor2.plug * 0.4,
    roomD: equip.floor2.light + equip.floor2.plug * 0.6,
    total: totalPower,
  });

  // WATER: cooling + domestic; rises with temperature (cooling demand).
  const waterScale = 0.8 + Math.max(0, (temp - 15) / 18) * 1.3;
  const serverWater = serverPower.map((p) => p * 4.2 * waterScale);
  const f1Water = (60 + occ * 90) * waterScale;
  const f2Water = (54 + occ * 84) * waterScale;
  const totalWater =
    f1Water + f2Water + serverWater.reduce((s, v) => s + v, 0);

  waterRows.push({
    ts,
    floor1: f1Water,
    floor2: f2Water,
    roomA: f1Water * 0.32,
    roomB: f1Water * 0.28,
    roomC: f2Water * 0.34,
    roomD: f2Water * 0.22,
    total: totalWater,
  });

  // SERVER METRICS: power, water, temp. Higher power -> hotter (correlation).
  serverRows.push({
    ts,
    s1_power: serverPower[0],
    s2_power: serverPower[1],
    s3_power: serverPower[2],
    s1_water: serverWater[0],
    s2_water: serverWater[1],
    s3_water: serverWater[2],
    s1_temp: r2(28 + (serverPower[0] / 4.5) * 12 + (temp - 20) * 0.4 + (rnd() - 0.5)),
    s2_temp: r2(30 + (serverPower[1] / 4.5) * 13 + (temp - 20) * 0.4 + (rnd() - 0.5)),
    s3_temp: r2(27 + (serverPower[2] / 4.5) * 11 + (temp - 20) * 0.4 + (rnd() - 0.5)),
  });
}

// --- to CSV -----------------------------------------------------------------
function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => row[h]).join(','));
  }
  return lines.join('\n');
}

const powerCsv = toCsv(
  [
    'timestamp',
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
  ],
  powerRows.map((r) => ({
    timestamp: r.ts,
    total_power_kw: r2(r.total),
    floor1_power_kw: r2(r.floor1),
    floor2_power_kw: r2(r.floor2),
    roomA_power_kw: r2(r.roomA),
    roomB_power_kw: r2(r.roomB),
    roomC_power_kw: r2(r.roomC),
    roomD_power_kw: r2(r.roomD),
    floor1_ac_kw: r2(r.f1_ac),
    floor1_light_kw: r2(r.f1_light),
    floor1_plug_kw: r2(r.f1_plug),
    floor2_ac_kw: r2(r.f2_ac),
    floor2_light_kw: r2(r.f2_light),
    floor2_plug_kw: r2(r.f2_plug),
  })),
);

const waterCsv = toCsv(
  [
    'timestamp',
    'total_water_l',
    'floor1_water_l',
    'floor2_water_l',
    'roomA_water_l',
    'roomB_water_l',
    'roomC_water_l',
    'roomD_water_l',
  ],
  waterRows.map((r) => ({
    timestamp: r.ts,
    total_water_l: r2(r.total),
    floor1_water_l: r2(r.floor1),
    floor2_water_l: r2(r.floor2),
    roomA_water_l: r2(r.roomA),
    roomB_water_l: r2(r.roomB),
    roomC_water_l: r2(r.roomC),
    roomD_water_l: r2(r.roomD),
  })),
);

const serverCsv = toCsv(
  [
    'timestamp',
    'server1_power_kw',
    'server2_power_kw',
    'server3_power_kw',
    'server1_water_l',
    'server2_water_l',
    'server3_water_l',
    'server1_temp_c',
    'server2_temp_c',
    'server3_temp_c',
  ],
  serverRows.map((r) => ({
    timestamp: r.ts,
    server1_power_kw: r2(r.s1_power),
    server2_power_kw: r2(r.s2_power),
    server3_power_kw: r2(r.s3_power),
    server1_water_l: r2(r.s1_water),
    server2_water_l: r2(r.s2_water),
    server3_water_l: r2(r.s3_water),
    server1_temp_c: r.s1_temp,
    server2_temp_c: r.s2_temp,
    server3_temp_c: r.s3_temp,
  })),
);

// --- write ------------------------------------------------------------------
await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, 'power_usage.csv'), powerCsv, 'utf8');
await writeFile(join(OUT_DIR, 'water_usage.csv'), waterCsv, 'utf8');
await writeFile(join(OUT_DIR, 'server_metrics.csv'), serverCsv, 'utf8');

console.log(
  `Generated ${powerRows.length} hourly rows across ${DAYS} days -> public/data/`,
);
