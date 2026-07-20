import { useQuery } from '@tanstack/react-query';
import { adminTelemetryApi } from '@/api/adminTelemetry';
import { useAdminDateRange } from '@/hooks/useAdminDateRange';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar,
} from 'recharts';

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-display">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function humanEvent(e: { event_type: string; entity_type?: string | null; metadata?: Record<string, unknown> }) {
  const meta = e.metadata || {};
  switch (e.event_type) {
    case 'user.registered':
      return `New user registered${meta.display_name ? `: ${meta.display_name}` : ''}`;
    case 'content.created':
      return `Created ${e.entity_type || 'content'}${meta.title ? ` “${meta.title}”` : ''}`;
    case 'content.updated':
      return `Updated ${e.entity_type || 'content'}`;
    case 'link.created':
      return `Invitation created${meta.code ? ` (${meta.code})` : ''}`;
    case 'link.interacted':
      return `Quiz attempt (${meta.interaction_kind || 'interaction'})`;
    case 'error.reported':
      return `Error: ${meta.message || meta.kind || 'reported'}`;
    case 'system.heartbeat':
      return `Health heartbeat (${meta.status || 'ok'})`;
    default:
      return e.event_type;
  }
}

export default function AdminOverview() {
  const { fromDate, toDate } = useAdminDateRange();

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: () => adminTelemetryApi.summary(),
    refetchInterval: 30_000,
  });

  const { data: funnel } = useQuery({
    queryKey: ['admin', 'funnel'],
    queryFn: () => adminTelemetryApi.funnel(),
    refetchInterval: 60_000,
  });

  const { data: feed } = useQuery({
    queryKey: ['admin', 'events', 'feed'],
    queryFn: () => adminTelemetryApi.events({ limit: 50 }),
    staleTime: 0,
    refetchInterval: 15_000,
  });

  const { data: rollups } = useQuery({
    queryKey: ['admin', 'rollups', fromDate, toDate],
    queryFn: () => adminTelemetryApi.rollupsDaily(fromDate, toDate),
    staleTime: 60_000,
  });

  if (summaryLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <Card className="rounded-2xl border-destructive/40">
        <CardContent className="p-6 text-sm text-destructive">
          Telemetry unreachable. Check that the API is running and you have admin access.
        </CardContent>
      </Card>
    );
  }

  const chartData = (rollups?.rollups || summary.sparklines_7d || []).map((r) => ({
    date: r.date.slice(5),
    users: r.new_users,
    content: r.content_created,
    errors: r.errors_total + r.errors_critical,
    links: r.link_interactions,
  }));

  const funnelSteps = funnel
    ? [
        { label: 'Drafts', value: funnel.drafts },
        { label: 'Owned quizzes', value: funnel.claimed_or_owned },
        { label: 'Invitations', value: funnel.invitations },
        { label: 'Attempts', value: funnel.attempts },
        { label: 'Couple done', value: funnel.couple_completed },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Overview</h2>
        <p className="text-sm text-muted-foreground">Live operating data for eou</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total users" value={summary.total_users} hint={`+${summary.new_users_7d} last 7d`} />
        <StatCard label="New users today" value={summary.new_users_today} hint={`${summary.new_users_30d} / 30d`} />
        <StatCard label="Quizzes" value={summary.total_quizzes} hint={`${summary.content_created_7d} content events / 7d`} />
        <StatCard label="Attempts today" value={summary.attempts_today} />
        <StatCard label="Errors (1h)" value={summary.errors_last_1h} />
        <StatCard
          label="System status"
          value={summary.health.status.replace('_', ' ')}
          hint={`p95 ${summary.health.p95_latency_ms}ms · err ${summary.health.error_rate_pct}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">7–30d activity</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data in this range</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="users" stackId="1" stroke="hsl(var(--coral))" fill="hsl(var(--coral) / 0.35)" name="New users" />
                  <Area type="monotone" dataKey="content" stackId="1" stroke="hsl(var(--lavender))" fill="hsl(var(--lavender) / 0.35)" name="Content" />
                  <Area type="monotone" dataKey="errors" stackId="1" stroke="hsl(0 70% 50%)" fill="hsl(0 70% 50% / 0.25)" name="Errors" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {funnelSteps.length === 0 ? (
              <Skeleton className="h-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelSteps}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--coral))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Live activity feed</CardTitle>
        </CardHeader>
        <CardContent>
          {(feed?.events || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet. Run backfill from Settings if tables are empty.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {(feed?.events || []).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm">
                  <div>
                    <p>{humanEvent(e)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.event_type}
                      {e.entity_type ? ` · ${e.entity_type}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {e.severity && (
                      <Badge variant={e.severity === 'critical' || e.severity === 'error' ? 'destructive' : 'secondary'} className="mb-1">
                        {e.severity}
                      </Badge>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
