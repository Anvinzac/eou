import { useQuery } from '@tanstack/react-query';
import { adminTelemetryApi } from '@/api/adminTelemetry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusColor: Record<string, string> = {
  operational: 'bg-emerald-500',
  degraded: 'bg-amber-400',
  partial_outage: 'bg-orange-500',
  major_outage: 'bg-red-500',
};

export default function AdminStatus() {
  const { data: health, isError } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => adminTelemetryApi.health(),
    refetchInterval: 15_000,
  });

  const from = new Date(Date.now() - 90 * 86400000).toISOString();
  const to = new Date().toISOString();

  const { data: history } = useQuery({
    queryKey: ['admin', 'health-history'],
    queryFn: () => adminTelemetryApi.healthHistory(from, to),
    staleTime: 60_000,
  });

  const { data: couple } = useQuery({
    queryKey: ['admin', 'couple'],
    queryFn: () => adminTelemetryApi.couple(),
    refetchInterval: 60_000,
  });

  // Collapse snapshots into day blocks (worst status of the day)
  const dayBlocks: { date: string; status: string }[] = [];
  const byDay = new Map<string, string>();
  const rank = { operational: 0, degraded: 1, partial_outage: 2, major_outage: 3 };
  (history?.history || []).forEach((h) => {
    const d = h.captured_at.slice(0, 10);
    const prev = byDay.get(d);
    if (!prev || (rank[h.status as keyof typeof rank] ?? 0) > (rank[prev as keyof typeof rank] ?? 0)) {
      byDay.set(d, h.status);
    }
  });
  Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([date, status]) => dayBlocks.push({ date, status }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">System status</h2>
        <p className="text-sm text-muted-foreground">
          Live Express latency ring + DB ping. Queue depth: N/A for this app.
        </p>
      </div>

      {isError || !health ? (
        <Card className="rounded-2xl border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">Health endpoint unreachable</CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <span className={cn('h-3 w-3 rounded-full', statusColor[health.status])} />
              eou · {health.status.replace(/_/g, ' ')}
            </CardTitle>
            <Badge variant="outline">{new Date(health.captured_at).toLocaleTimeString()}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Uptime (sample window)</p>
              <p className="text-xl font-bold">{health.uptime_pct_24h}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">p50 latency</p>
              <p className="text-xl font-bold">{health.p50_latency_ms}ms</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">p95 latency</p>
              <p className="text-xl font-bold">{health.p95_latency_ms}ms</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Error rate (5m)</p>
              <p className="text-xl font-bold">{health.error_rate_pct}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">90-day uptime history</CardTitle>
        </CardHeader>
        <CardContent>
          {dayBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots yet — they are written every 5 minutes after API boot.</p>
          ) : (
            <div className="flex flex-wrap gap-0.5" title="Each block is one UTC day (worst status)">
              {dayBlocks.map((d) => (
                <div
                  key={d.date}
                  className={cn('h-4 w-2 rounded-sm', statusColor[d.status] || 'bg-muted')}
                  title={`${d.date}: ${d.status}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Couple sessions (domain health)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="text-xl font-bold">{couple?.total ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Completed</p>
            <p className="text-xl font-bold">{couple?.completed ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Completion rate</p>
            <p className="text-xl font-bold">{couple?.completion_rate_pct ?? '—'}%</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Avg match %</p>
            <p className="text-xl font-bold">{couple?.avg_match_percentage ?? '—'}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
