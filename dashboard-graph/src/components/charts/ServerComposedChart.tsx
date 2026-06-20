import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AggregatedPoint } from '../../types/data';
import { palette } from '../../lib/constants';
import { axisProps, gridProps, ChartTooltip } from './chart-theme';
import { formatCompact } from '../../lib/utils';

interface ServerComposedChartProps {
  data: AggregatedPoint[];
}

interface ServerDatum {
  server: string;
  power: number;
  water: number;
  temp: number;
}

const SERVERS = [
  {
    label: 'Server 01',
    powerKey: 'server1_power_kw',
    waterKey: 'server1_water_l',
    tempKey: 'server1_temp_c',
    color: palette.server1,
  },
  {
    label: 'Server 02',
    powerKey: 'server2_power_kw',
    waterKey: 'server2_water_l',
    tempKey: 'server2_temp_c',
    color: palette.server2,
  },
  {
    label: 'Server 03',
    powerKey: 'server3_power_kw',
    waterKey: 'server3_water_l',
    tempKey: 'server3_temp_c',
    color: palette.server3,
  },
] as const;

/**
 * Chart 5 — Infrastructure: Composed chart correlating each server's
 * Power (kWh) and Water (L) — bars — against its Temperature (°C) — line.
 * Lets you answer: "do servers that draw more power also run hotter?"
 *
 * Power & water are summed over the period; temperature is averaged.
 */
export function ServerComposedChart({ data }: ServerComposedChartProps) {
  const rows = useMemo<ServerDatum[]>(() => {
    return SERVERS.map((s) => {
      const power = data.reduce(
        (sum, p) => sum + (p[s.powerKey] as number),
        0,
      );
      const water = data.reduce(
        (sum, p) => sum + (p[s.waterKey] as number),
        0,
      );
      const temp = data.length
        ? data.reduce((sum, p) => sum + (p[s.tempKey] as number), 0) /
          data.length
        : 0;
      return { server: s.label, power, water, temp };
    });
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart
        data={rows}
        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        barCategoryGap="30%"
      >
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="server" {...axisProps} />
        <YAxis
          yAxisId="left"
          {...axisProps}
          tickFormatter={(v) => formatCompact(v as number)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          {...axisProps}
          tickFormatter={(v) => `${Math.round(v as number)}°`}
          domain={['dataMin - 2', 'dataMax + 2']}
        />

        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,0.06)' }}
          content={({ active, payload, label }) => {
            const point = payload?.[0]?.payload as ServerDatum | undefined;
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
                  {
                    label: 'Temperature',
                    value: point.temp,
                    unit: '°C',
                    color: palette.temp,
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

        <Bar
          yAxisId="left"
          dataKey="power"
          name="Power (kWh)"
          fill={palette.power}
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
        />
        <Bar
          yAxisId="left"
          dataKey="water"
          name="Water (L)"
          fill={palette.water}
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="temp"
          name="Temperature (°C)"
          stroke={palette.temp}
          strokeWidth={2.5}
          dot={{ r: 4, fill: palette.temp, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
