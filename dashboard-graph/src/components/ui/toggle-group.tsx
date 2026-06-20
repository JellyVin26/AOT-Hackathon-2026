import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * Segmented control for single-select toggles (used by the global time-unit
 * filter and in-card power/water switches).
 */

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleGroupProps<T extends string>
  extends Omit<ButtonHTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: ToggleOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onValueChange,
  className,
  ...props
}: ToggleGroupProps<T>) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2/60 p-1',
        className,
      )}
      {...(props as ButtonHTMLAttributes<HTMLDivElement>)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
              active
                ? 'bg-brand text-bg shadow-[0_0_0_1px_rgba(56,189,248,0.4),0_4px_14px_-4px_rgba(56,189,248,0.6)]'
                : 'text-muted hover:text-fg',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
