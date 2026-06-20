import { useState } from 'react';
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
import { ToggleGroup, type ToggleOption } from '../ui/toggle-group';

type Metric = 'power' | 'water';

interface FloorStackedChartProps {
  data: AggregatedPoint[];
}

const TOGGLE_OPTIONS: ToggleOption<Metric>[] = [
  { value: 'power', label: 'Power' },
  { value: 'water', label: 'Water' },
];

/**
 * Chart 2 — Overview: stacked bar breakdown per floor.
 * An in-card toggle switches between power (kWh) and water (L).
 */
export function FloorStackedChart({ data }: FloorStackedChartProps) {
  const [metric, setMetric] = useState<Metric>('power');
  const isPower = metric === 'power';
  const key1 = isPower ? 'floor1_power_kw' : 'floor1_water_l';
  const key2 = isPower ? 'floor2_power_kw' : 'floor2_water_l';
  const unit = isPower ? 'kWh' : 'L';
  const label1 = isPower ? 'Floor 1 (Power)' : 'Floor 1 (Water)';
  const label2 = isPower ? 'Floor 2 (Power)' : 'Floor 2 (Water)';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ChartLegend
          items={[
            { label: 'Floor 1', color: palette.floor1 },
            { label: 'Floor 2', color: palette.floor2 },
          ]}
        />
        <ToggleGroup
          options={TOGGLE_OPTIONS}
          value={metric}
          onValueChange={setMetric}
          className="scale-90 origin-right"
        />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis
            {...axisProps}
            tickFormatter={(v) => formatCompact(v as number)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.06)' }}
            content={({ active, payload, label }) => {
              const point = payload?.[0]?.payload as
                | AggregatedPoint
                | undefined;
              if (!point) return <ChartTooltip active={false} entries={[]} />;
              return (
                <ChartTooltip
                  active={active}
                  label={label as string}
                  entries={[
                    {
                      label: label1,
                      value: point[key1] as number,
                      unit,
                      color: palette.floor1,
                    },
                    {
                      label: label2,
                      value: point[key2] as number,
                      unit,
                      color: palette.floor2,
                    },
                  ]}
                />
              );
            }}
          />

          <Bar
            dataKey={key1}
            name={label1}
            stackId="f"
            fill={palette.floor1}
            radius={[0, 0, 0, 0]}
            maxBarSize={48}
          />
          <Bar
            dataKey={key2}
            name={label2}
            stackId="f"
            fill={palette.floor2}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
