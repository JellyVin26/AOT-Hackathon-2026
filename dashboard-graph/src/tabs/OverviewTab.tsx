import type { AggregatedPoint } from '../types/data';
import { ChartCard } from '../components/layout/ChartCard';
import { TrendChart } from '../components/charts/TrendChart';
import { FloorStackedChart } from '../components/charts/FloorStackedChart';

interface OverviewTabProps {
  data: AggregatedPoint[];
}

/** Tab 1 — macro trends + per-floor breakdown. */
export function OverviewTab({ data }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <ChartCard
        title="Building Trend Overview"
        description="Total power vs. total water across the selected period"
        className="lg:col-span-3"
      >
        <TrendChart data={data} />
      </ChartCard>

      <ChartCard
        title="Per-Floor Breakdown"
        description="Stacked contribution of each floor"
        className="lg:col-span-2"
      >
        <FloorStackedChart data={data} />
      </ChartCard>
    </div>
  );
}
