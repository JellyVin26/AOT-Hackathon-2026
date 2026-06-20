import { Zap, Droplets, Thermometer, Building2 } from 'lucide-react';
import { ToggleGroup, type ToggleOption } from '../ui/toggle-group';
import type { TimeUnit } from '../../types/data';

interface HeaderProps {
  timeUnit: TimeUnit;
  onTimeUnitChange: (unit: TimeUnit) => void;
}

const OPTIONS: ToggleOption<TimeUnit>[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/**
 * App header: dashboard title (left) + global time-unit toggle (right).
 */
export function Header({ timeUnit, onTimeUnitChange }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2/60 text-brand">
          <Building2 size={20} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg-strong">
            Building Operations Dashboard
          </h1>
          <p className="text-xs text-muted">
            Real-time power, water &amp; server telemetry
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 text-muted sm:flex">
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Zap size={14} className="text-power" /> Power
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Droplets size={14} className="text-water" /> Water
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Thermometer size={14} className="text-temp" /> Temp
          </span>
        </div>
        <ToggleGroup
          options={OPTIONS}
          value={timeUnit}
          onValueChange={onTimeUnitChange}
        />
      </div>
    </header>
  );
}
