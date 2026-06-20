import type { AggregatedPoint } from '../types/data';
import { ChartCard } from '../components/layout/ChartCard';
import { ServerComposedChart } from '../components/charts/ServerComposedChart';

interface InfrastructureTabProps {
  data: AggregatedPoint[];
}

/** Tab 3 — server power, water & temperature correlation. */
export function InfrastructureTab({ data }: InfrastructureTabProps) {
  return (
    <ChartCard
      title="Server Power, Water & Temperature"
      description="Do servers that draw more power also run hotter? Hover to inspect each server."
    >
      <ServerComposedChart data={data} />
    </ChartCard>
  );
}
