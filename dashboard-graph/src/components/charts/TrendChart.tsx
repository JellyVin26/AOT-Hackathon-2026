import {
  Area,
  AreaChart,
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

interface TrendChartProps {
  data: AggregatedPoint[];
}

/**
 * Chart 1 — Overview: dual-axis Area chart comparing Total Power Usage (kWh)
 * against Total Water Usage (L). Gives a macro view of building-wide trends.
 */
export function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.power} stopOpacity={0.45} />
            <stop offset="100%" stopColor={palette.power} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.water} stopOpacity={0.4} />
            <stop offset="100%" stopColor={palette.water} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis
          yAxisId="power"
          {...axisProps}
          tickFormatter={(v) => formatCompact(v as number)}
        />
        <YAxis
          yAxisId="water"
          orientation="right"
          {...axisProps}
          tickFormatter={(v) => formatCompact(v as number)}
        />

        <Tooltip
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
                    label: 'Total Power',
                    value: point.total_power_kw,
                    unit: 'kWh',
                    color: palette.power,
                  },
                  {
                    label: 'Total Water',
                    value: point.total_water_l,
                    unit: 'L',
                    color: palette.water,
                  },
                ]}
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

        <Area
          yAxisId="power"
          type="monotone"
          dataKey="total_power_kw"
          name="Total Power"
          stroke={palette.power}
          strokeWidth={2.5}
          fill="url(#powerGrad)"
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
        <Area
          yAxisId="water"
          type="monotone"
          dataKey="total_water_l"
          name="Total Water"
          stroke={palette.water}
          strokeWidth={2.5}
          fill="url(#waterGrad)"
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
