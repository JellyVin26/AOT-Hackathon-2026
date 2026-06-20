import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AggregatedPoint } from '../../types/data';
import { palette } from '../../lib/constants';
import { axisProps, gridProps, ChartTooltip, ChartLegend } from './chart-theme';
import { formatCompact } from '../../lib/utils';

interface RoomComparisonChartProps {
  data: AggregatedPoint[];
}

interface RoomDatum {
  room: string;
  power: number;
  water: number;
}

const ROOMS = [
  { key: 'roomA', label: 'Room A' },
  { key: 'roomB', label: 'Room B' },
  { key: 'roomC', label: 'Room C' },
  { key: 'roomD', label: 'Room D' },
] as const;

/**
 * Chart 3 — Areas: grouped bars comparing Power (kWh) and Water (L) across
 * rooms A–D. The time series is collapsed into per-room totals over the
 * selected period so the global toggle still changes the values shown.
 */
export function RoomComparisonChart({ data }: RoomComparisonChartProps) {
  const rows = useMemo<RoomDatum[]>(() => {
    return ROOMS.map((r) => {
      const power = data.reduce(
        (s, p) => s + (p[`${r.key}_power_kw` as keyof AggregatedPoint] as number),
        0,
      );
      const water = data.reduce(
        (s, p) => s + (p[`${r.key}_water_l` as keyof AggregatedPoint] as number),
        0,
      );
      return { room: r.label, power, water };
    });
  }, [data]);

  return (
    <div>
      <div className="mb-3">
        <ChartLegend
          items={[
            { label: 'Power (kWh)', color: palette.power },
            { label: 'Water (L)', color: palette.water },
          ]}
        />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="room" {...axisProps} />
          <YAxis
            {...axisProps}
            tickFormatter={(v) => formatCompact(v as number)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.06)' }}
            content={({ active, payload, label }) => {
              const point = payload?.[0]?.payload as RoomDatum | undefined;
              if (!point) return <ChartTooltip active={false} entries={[]} />;
              return (
                <ChartTooltip
                  active={active}
                  label={label as string}
                  entries={[
                    {
                      label: 'Power',
                      value: point.power,
                      unit: 'kWh',
                      color: palette.power,
                    },
                    {
                      label: 'Water',
                      value: point.water,
                      unit: 'L',
                      color: palette.water,
                    },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="power"
            name="Power"
            fill={palette.power}
            radius={[4, 4, 0, 0]}
            maxBarSize={34}
          />
          <Bar
            dataKey="water"
            name="Water"
            fill={palette.water}
            radius={[4, 4, 0, 0]}
            maxBarSize={34}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
