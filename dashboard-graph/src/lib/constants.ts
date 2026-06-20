import type { TimeUnit } from '../types/data';

/** Chart colour palette — referenced by both CSS and Recharts fills/strokes. */
export const palette = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#25324a',
  grid: '#1c2740',
  muted: '#94a3b8',
  fg: '#e2e8f0',

  power: '#38bdf8',
  water: '#2dd4bf',
  temp: '#fb923c',

  floor1: '#38bdf8',
  floor2: '#818cf8',
  roomA: '#38bdf8',
  roomB: '#22d3ee',
  roomC: '#818cf8',
  roomD: '#c084fc',

  ac: '#38bdf8',
  light: '#fbbf24',
  plug: '#f472b6',

  server1: '#38bdf8',
  server2: '#818cf8',
  server3: '#34d399',

  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
} as const;

/** Metadata for the global time-unit toggle. */
export interface TimeUnitOption {
  value: TimeUnit;
  label: string;
  short: string;
}

export const TIME_UNITS: TimeUnitOption[] = [
  { value: 'hourly', label: 'Hourly', short: '24h' },
  { value: 'weekly', label: 'Weekly', short: '12w' },
  { value: 'monthly', label: 'Monthly', short: '3mo' },
];

/** Stable, friendly names for the servers shown in the Infrastructure tab. */
export const SERVERS = [
  { id: 'server1', label: 'Server 01', color: palette.server1 },
  { id: 'server2', label: 'Server 02', color: palette.server2 },
  { id: 'server3', label: 'Server 03', color: palette.server3 },
] as const;

export const ROOMS = [
  { id: 'roomA', label: 'Room A', color: palette.roomA },
  { id: 'roomB', label: 'Room B', color: palette.roomB },
  { id: 'roomC', label: 'Room C', color: palette.roomC },
  { id: 'roomD', label: 'Room D', color: palette.roomD },
] as const;

export const EQUIPMENT = [
  { key: 'ac', label: 'Air Conditioning', color: palette.ac },
  { key: 'light', label: 'Lighting', color: palette.light },
  { key: 'plug', label: 'Plug Loads', color: palette.plug },
] as const;
