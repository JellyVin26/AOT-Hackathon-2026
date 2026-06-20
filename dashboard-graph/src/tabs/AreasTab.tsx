import type { AggregatedPoint } from '../types/data';
import { ChartCard } from '../components/layout/ChartCard';
import { RoomComparisonChart } from '../components/charts/RoomComparisonChart';
import { EquipmentChart } from '../components/charts/EquipmentChart';

interface AreasTabProps {
  data: AggregatedPoint[];
}

/** Tab 2 — room-level and equipment-level comparisons. */
export function AreasTab({ data }: AreasTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="Room Comparison"
        description="Power (kWh) vs. water (L) per room"
      >
        <RoomComparisonChart data={data} />
      </ChartCard>

      <ChartCard
        title="Equipment Power by Floor"
        description="AC vs. lighting vs. plug loads"
      >
        <EquipmentChart data={data} />
      </ChartCard>
    </div>
  );
}
