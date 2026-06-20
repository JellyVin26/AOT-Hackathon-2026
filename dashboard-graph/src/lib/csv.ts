import type { PowerRow, ServerRow, WaterRow } from '../types/data';

/**
 * Minimal, dependency-free CSV parser.
 *
 * Handles quoted fields with embedded commas / newlines and trims whitespace.
 * Returns rows as objects keyed by the header row. Designed for our three
 * well-formed source files; not a general-purpose CSV library.
 */
export function parseCsv<T extends Record<string, string>>(
  text: string,
): T[] {
  const rows = lex(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const out: T[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0] === '') continue; // skip blank lines
    const obj = {} as Record<string, string>;
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (cells[c] ?? '').trim();
    }
    out.push(obj as T);
  }
  return out;
}

/** Lexer that respects RFC-4180 quoting rules. Returns a matrix of cells. */
function lex(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // handled by the following \n
    } else {
      field += ch;
    }
  }

  // flush trailing field / row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Parse `power_usage.csv` text into typed rows. */
export function parsePowerCsv(text: string): PowerRow[] {
  return parseCsv<Record<string, string>>(text).map((r) => ({
    timestamp: r.timestamp,
    total_power_kw: num(r.total_power_kw),
    floor1_power_kw: num(r.floor1_power_kw),
    floor2_power_kw: num(r.floor2_power_kw),
    roomA_power_kw: num(r.roomA_power_kw),
    roomB_power_kw: num(r.roomB_power_kw),
    roomC_power_kw: num(r.roomC_power_kw),
    roomD_power_kw: num(r.roomD_power_kw),
    floor1_ac_kw: num(r.floor1_ac_kw),
    floor1_light_kw: num(r.floor1_light_kw),
    floor1_plug_kw: num(r.floor1_plug_kw),
    floor2_ac_kw: num(r.floor2_ac_kw),
    floor2_light_kw: num(r.floor2_light_kw),
    floor2_plug_kw: num(r.floor2_plug_kw),
  }));
}

/** Parse `water_usage.csv` text into typed rows. */
export function parseWaterCsv(text: string): WaterRow[] {
  return parseCsv<Record<string, string>>(text).map((r) => ({
    timestamp: r.timestamp,
    total_water_l: num(r.total_water_l),
    floor1_water_l: num(r.floor1_water_l),
    floor2_water_l: num(r.floor2_water_l),
    roomA_water_l: num(r.roomA_water_l),
    roomB_water_l: num(r.roomB_water_l),
    roomC_water_l: num(r.roomC_water_l),
    roomD_water_l: num(r.roomD_water_l),
  }));
}

/** Parse `server_metrics.csv` text into typed rows. */
export function parseServerCsv(text: string): ServerRow[] {
  return parseCsv<Record<string, string>>(text).map((r) => ({
    timestamp: r.timestamp,
    server1_power_kw: num(r.server1_power_kw),
    server2_power_kw: num(r.server2_power_kw),
    server3_power_kw: num(r.server3_power_kw),
    server1_water_l: num(r.server1_water_l),
    server2_water_l: num(r.server2_water_l),
    server3_water_l: num(r.server3_water_l),
    server1_temp_c: num(r.server1_temp_c),
    server2_temp_c: num(r.server2_temp_c),
    server3_temp_c: num(r.server3_temp_c),
  }));
}
