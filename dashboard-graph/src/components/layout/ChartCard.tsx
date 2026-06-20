import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

interface ChartCardProps {
  title: string;
  description?: string;
  /** Optional controls rendered on the right of the header (e.g. toggles). */
  action?: ReactNode;
  /** Optional legend rendered under the header. */
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Standard wrapper for every chart: title, description, optional header
 * action (e.g. an in-card Power/Water toggle) and a consistent chart cavity.
 */
export function ChartCard({
  title,
  description,
  action,
  legend,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action}
        </div>
        {legend ? <div className="pt-1">{legend}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
