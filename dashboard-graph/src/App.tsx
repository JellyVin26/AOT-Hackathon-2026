import { useMemo, useState } from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import type { TimeUnit } from './types/data';
import { useBuildingData } from './hooks/useBuildingData';
import { Header } from './components/layout/Header';
import { KpiCards } from './components/kpi/KpiCards';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './components/ui/tabs';
import { OverviewTab } from './tabs/OverviewTab';
import { AreasTab } from './tabs/AreasTab';
import { InfrastructureTab } from './tabs/InfrastructureTab';

export default function App() {
  const { data, loading, error } = useBuildingData();
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('weekly');

  const series = data ? data[timeUnit] : [];

  // KPI values: latest point vs. the previous point (for trend deltas).
  const kpi = useMemo(() => {
    const cur = series.at(-1);
    const prev = series.at(-2);
    if (!cur) return null;

    const curTemp =
      (cur.server1_temp_c + cur.server2_temp_c + cur.server3_temp_c) / 3;
    const prevTemp = prev
      ? (prev.server1_temp_c + prev.server2_temp_c + prev.server3_temp_c) / 3
      : undefined;

    return {
      totalPower: cur.total_power_kw,
      totalWater: cur.total_water_l,
      avgTemp: curTemp,
      prevTotalPower: prev?.total_power_kw,
      prevTotalWater: prev?.total_water_l,
      prevAvgTemp: prevTemp,
    };
  }, [series]);

  // Power is shown as kW (hourly) or kWh (aggregated consumption totals).
  const powerUnit = timeUnit === 'hourly' ? 'kW' : 'kWh';

  return (
    <div className="relative z-10 min-h-full">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
        <Header timeUnit={timeUnit} onTimeUnitChange={setTimeUnit} />

        {error ? (
          <ErrorState message={error} />
        ) : loading || !data || !kpi ? (
          <LoadingState />
        ) : (
          <>
            <KpiCards
              totalPower={kpi.totalPower}
              totalWater={kpi.totalWater}
              avgTemp={kpi.avgTemp}
              prevTotalPower={kpi.prevTotalPower}
              prevTotalWater={kpi.prevTotalWater}
              prevAvgTemp={kpi.prevAvgTemp}
            />
            <KpiCardsUnitNote powerUnit={powerUnit} />

            <Tabs defaultValue="overview" className="mt-1">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="areas">Areas</TabsTrigger>
                <TabsTrigger value="infrastructure">
                  Infrastructure
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <OverviewTab data={series} />
              </TabsContent>
              <TabsContent value="areas">
                <AreasTab data={series} />
              </TabsContent>
              <TabsContent value="infrastructure">
                <InfrastructureTab data={series} />
              </TabsContent>
            </Tabs>

            <footer className="pt-2 text-center text-xs text-muted">
              Data aggregated from hourly telemetry ·{' '}
              {series.length} {timeUnit} buckets
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/** Small helper that surfaces the active power unit under the KPI row. */
function KpiCardsUnitNote({ powerUnit }: { powerUnit: string }) {
  return (
    <p className="-mt-2 text-xs text-muted">
      Showing {powerUnit === 'kW' ? 'instantaneous (kW)' : 'consumption totals (kWh)'}{' '}
      · values reflect the latest {powerUnit === 'kW' ? 'hour' : 'period'}
    </p>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface/60 py-24 text-muted">
      <Activity size={22} className="animate-pulse text-brand" />
      <p className="text-sm">Loading telemetry data…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-bad/30 bg-bad/5 py-24 text-bad">
      <AlertCircle size={22} />
      <p className="text-sm">Failed to load data</p>
      <p className="max-w-md text-center text-xs text-muted">{message}</p>
    </div>
  );
}
