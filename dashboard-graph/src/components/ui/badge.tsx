import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'neutral' | 'good' | 'bad' | 'brand';

const variants: Record<Variant, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  good: 'bg-good/10 text-good border-good/30',
  bad: 'bg-bad/10 text-bad border-bad/30',
  brand: 'bg-brand/10 text-brand border-brand/30',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
