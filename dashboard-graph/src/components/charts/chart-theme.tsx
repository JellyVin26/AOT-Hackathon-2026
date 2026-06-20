import type { CSSProperties } from 'react';
import { palette } from '../../lib/constants';

/**
 * Shared chart theming & tooltip building blocks.
 *
 * Each chart composes a `ChartTooltip` with an array of `TooltipEntry`s so the
 * hover popups stay consistent (values + units + colour swatches) across the
 * whole dashboard.
 */

export const axisProps = {
  tick: { fill: palette.muted, fontSize: 11 },
  axisLine: { stroke: palette.grid },
  tickLine: false,
} as const;

export const gridProps = {
  stroke: palette.grid,
  strokeDasharray: '4 4',
  vertical: false,
} as const;

export interface TooltipEntry {
  label: string;
  value: number;
  unit: string;
  color: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  /** Display label for the X-axis point (e.g. "W12"). */
  label?: string | number;
  /** Entries to render in the tooltip body. */
  entries: TooltipEntry[];
}

export function ChartTooltip({ active, label, entries }: ChartTooltipProps) {
  if (!active || entries.length === 0) return null;
  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 150,
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.7)',
      }}
    >
      <div
        style={{
          color: palette.fg,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 6,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map((e) => (
          <div
            key={e.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: e.color,
                  flex: '0 0 auto',
                }}
              />
              <span style={{ color: palette.muted, fontSize: 12 }}>
                {e.label}
              </span>
            </span>
            <span
              style={{
                color: palette.fg,
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTooltipValue(e.value)}{' '}
              <span style={{ color: palette.muted, fontWeight: 400 }}>
                {e.unit}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact formatter used inside tooltips. */
function formatTooltipValue(value: number): string {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: value < 100 ? 1 : 0,
  });
}

/** Inline legend renderer used by charts that hide Recharts' default legend. */
export function ChartLegend({
  items,
  style,
}: {
  items: { label: string; color: string }[];
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 16px',
        ...style,
      }}
    >
      {items.map((it) => (
        <span
          key={it.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: palette.muted,
            fontSize: 12,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 3,
              background: it.color,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
