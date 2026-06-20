import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AggregatedPoint } from '../../types/data';
import { palette } from '../../lib/constants';
import { axisProps, gridProps, ChartTooltip } from './chart-theme';
import { formatCompact } from '../../lib/utils';

interface EquipmentChartProps {
  data: AggregatedPoint[];
}

interface EquipmentDatum {
  floor: string;
  ac: number;
  light: number;
  plug: number;
}

const SERIES = [
  { key: 'ac', label: 'Air Conditioning', color: palette.ac },
  { key: 'light', label: 'Lighting', color: palette.light },
  { key: 'plug', label: 'Plug Loads', color: palette.plug },
] as const;

/**
 * Chart 4 — Areas: grouped bars comparing equipment power consumption
 * (AC / Lighting / Plug loads) across floors. Makes the differing consumption
 * characteristics of each equipment type immediately legible.
 */
export function EquipmentChart({ data }: EquipmentChartProps) {
  const rows = useMemo<EquipmentDatum[]>(() => {
    const floors = [
      { label: 'Floor 1', acKey: 'floor1_ac_kw', lightKey: 'floor1_light_kw', plugKey: 'floor1_plug_kw' },
      { label: 'Floor 2', acKey: 'floor2_ac_kw', lightKey: 'floor2_light_kw', plugKey: 'floor2_plug_kw' },
    ] as const;
    return floors.map((f) => ({
      floor: f.label,
      ac: data.reduce((s, p) => s + (p[f.acKey] as number), 0),
      light: data.reduce((s, p) => s + (p[f.lightKey] as number), 0),
      plug: data.reduce((s, p) => s + (p[f.plugKey] as number), 0),
    }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={rows}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="28%"
      >
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="floor" {...axisProps} />
        <YAxis
          {...axisProps}
          tickFormatter={(v) => formatCompact(v as number)}
        />
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,0.06)' }}
          content={({ active, payload, label }) => {
            const point = payload?.[0]?.payload as EquipmentDatum | undefined;
            if (!point) return <ChartTooltip active={false} entries={[]} />;
            return (
              <ChartTooltip
                active={active}
                label={label as string}
                entries={SERIES.map((s) => ({
                  label: s.label,
                  value: point[s.key],
                  unit: 'kWh',
                  color: s.color,
                }))}
              />
            );
          }}
        />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: 12, color: palette.muted }}
          iconType="circle"
          iconSize={8}
        />
        {SERIES.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
