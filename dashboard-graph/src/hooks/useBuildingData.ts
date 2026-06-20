import { useEffect, useMemo, useState } from 'react';
import type { AggregatedPoint, BuildingData } from '../types/data';
import {
  parsePowerCsv,
  parseServerCsv,
  parseWaterCsv,
} from '../lib/csv';
import {
  aggregate,
  mergeHourly,
} from '../lib/aggregate';

const POWER_URL = `${import.meta.env.BASE_URL}data/power_usage.csv`;
const WATER_URL = `${import.meta.env.BASE_URL}data/water_usage.csv`;
const SERVER_URL = `${import.meta.env.BASE_URL}data/server_metrics.csv`;

export interface UseBuildingDataResult {
  data: BuildingData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the three CSV files once, parses them, and derives the three
 * aggregated views (hourly / weekly / monthly). The derived dataset is
 * memoised so consumers can switch the global time unit cheaply.
 */
export function useBuildingData(): UseBuildingDataResult {
  const [raw, setRaw] = useState<AggregatedPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch(POWER_URL).then((r) => r.text()),
      fetch(WATER_URL).then((r) => r.text()),
      fetch(SERVER_URL).then((r) => r.text()),
    ])
      .then(([powerText, waterText, serverText]) => {
        if (cancelled) return;
        const power = parsePowerCsv(powerText);
        const water = parseWaterCsv(waterText);
        const servers = parseServerCsv(serverText);
        setRaw(mergeHourly(power, water, servers));
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo<BuildingData | null>(() => {
    if (!raw) return null;
    return {
      hourly: aggregate(raw, 'hourly'),
      weekly: aggregate(raw, 'weekly'),
      monthly: aggregate(raw, 'monthly'),
    };
  }, [raw]);

  return { data, loading, error };
}
