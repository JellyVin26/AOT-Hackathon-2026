import type { LucideIcon } from 'lucide-react';
import { Zap, Droplets, Thermometer, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import { formatDelta, formatNumber } from '../../lib/utils';

interface KpiCardsProps {
  totalPower: number;
  totalWater: number;
  avgTemp: number;
  /** Previous-period values, used to render trend deltas. */
  prevTotalPower?: number;
  prevTotalWater?: number;
  prevAvgTemp?: number;
}

interface KpiConfig {
  label: string;
  icon: LucideIcon;
  value: number;
  unit: string;
  prev?: number;
  /** For temperature, a rising delta is "bad"; invert the colour logic. */
  invertTrend?: boolean;
  accent: string;
  decimals?: number;
  /** Whether a higher number is better (used to colour the delta arrow). */
  higherIsBetter?: boolean;
}

export function KpiCards({
  totalPower,
  totalWater,
  avgTemp,
  prevTotalPower,
  prevTotalWater,
  prevAvgTemp,
}: KpiCardsProps) {
  const cards: KpiConfig[] = [
    {
      label: 'Total Power Usage',
      icon: Zap,
      value: totalPower,
      unit: 'kWh',
      prev: prevTotalPower,
      accent: 'text-power',
      higherIsBetter: false,
    },
    {
      label: 'Total Water Usage',
      icon: Droplets,
      value: totalWater,
      unit: 'L',
      prev: prevTotalWater,
      accent: 'text-water',
      higherIsBetter: false,
    },
    {
      label: 'Avg Server Temperature',
      icon: Thermometer,
      value: avgTemp,
      unit: '°C',
      prev: prevAvgTemp,
      accent: 'text-temp',
      invertTrend: true,
      decimals: 1,
      higherIsBetter: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </div>
  );
}

function KpiCard({ label, icon: Icon, value, unit, prev, accent, decimals = 0, higherIsBetter }: KpiConfig) {
  const hasDelta = prev != null && prev !== 0;
  const delta = hasDelta ? ((value - prev) / prev) * 100 : 0;
  const rising = delta > 0;
  // A rise is "bad" when higherIsBetter is false (i.e. more usage is worse).
  const isBad = hasDelta && (higherIsBetter ? !rising : rising);

  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2/60',
              accent,
            )}
          >
            <Icon size={18} strokeWidth={2} />
          </div>
          <span className="text-xs font-medium text-muted">{label}</span>
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-fg-strong tabular-nums">
          {formatNumber(value, decimals)}
        </span>
        <span className="text-sm text-muted">{unit}</span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs">
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-medium tabular-nums',
              isBad
                ? 'border-bad/30 bg-bad/10 text-bad'
                : 'border-good/30 bg-good/10 text-good',
            )}
          >
            {rising ? (
              <ArrowUpRight size={12} />
            ) : (
              <ArrowDownRight size={12} />
            )}
            {formatDelta(value, prev)}
          </span>
        ) : (
          <span className="rounded-md border border-border px-1.5 py-0.5 text-muted tabular-nums">
            —
          </span>
        )}
        <span className="text-muted">vs. previous period</span>
      </div>
    </Card>
  );
}
