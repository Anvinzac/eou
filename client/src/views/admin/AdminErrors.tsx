import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminTelemetryApi } from '@/api/adminTelemetry';
import { useAdminDateRange } from '@/hooks/useAdminDateRange';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

export default function AdminErrors() {
  const { from, to, fromDate, toDate } = useAdminDateRange();
  const [severity, setSeverity] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>();

  const { data: eventsPage, isFetching } = useQuery({
    queryKey: ['admin', 'errors', from, to, cursor],
    queryFn: () =>
      adminTelemetryApi.events({
        event_type: 'error.reported',
        from,
        to,
        cursor,
        limit: 50,
      }),
  });

  const { data: versus } = useQuery({
    queryKey: ['admin', 'versus'],
    queryFn: () => adminTelemetryApi.versus(),
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    const rows = eventsPage?.events || [];
    if (!severity) return rows;
    return rows.filter((e) => e.severity === severity);
  }, [eventsPage, severity]);

  const byDay = useMemo(() => {
    const map = new Map<string, { date: string; error: number; critical: number; warn: number }>();
    (eventsPage?.events || []).forEach((e) => {
      const day = e.occurred_at.slice(0, 10).slice(5);
      if (!map.has(day)) map.set(day, { date: day, error: 0, critical: 0, warn: 0 });
      const row = map.get(day)!;
      if (e.severity === 'critical') row.critical += 1;
      else if (e.severity === 'warn') row.warn += 1;
      else row.error += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [eventsPage]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Error reports</h2>
        <p className="text-sm text-muted-foreground">
          Server 5xx + client reports + versus integrity signals ({fromDate} → {toDate}). Read-only in v1.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Versus cheats</p>
            <p className="text-2xl font-bold">{versus?.cheat_responses ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Versus timeouts</p>
            <p className="text-2xl font-bold">{versus?.timeout_responses ?? '—'}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Versus quizzes</p>
            <p className="text-2xl font-bold">{versus?.versus_quiz_count ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {['', 'warn', 'error', 'critical'].map((s) => (
          <Button key={s || 'all'} size="sm" variant={severity === s ? 'default' : 'outline'} onClick={() => setSeverity(s)}>
            {s || 'all'}
          </Button>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Errors / day by severity</CardTitle>
        </CardHeader>
        <CardContent className="h-52">
          {byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No errors in this range</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byDay}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="warn" stackId="1" stroke="#f59e0b" fill="#f59e0b55" />
                <Area type="monotone" dataKey="error" stackId="1" stroke="#ef4444" fill="#ef444455" />
                <Area type="monotone" dataKey="critical" stackId="1" stroke="#7f1d1d" fill="#7f1d1d88" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Error events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Severity</th>
                  <th className="py-2 pr-3">Message</th>
                  <th className="py-2 pr-3">Context</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      <Badge variant={e.severity === 'critical' || e.severity === 'error' ? 'destructive' : 'secondary'}>
                        {e.severity || 'error'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 max-w-xs truncate">
                      {String(e.metadata?.message || e.metadata?.kind || '—')}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {e.entity_type || '—'} {e.entity_id ? `· ${e.entity_id.slice(0, 8)}…` : ''}
                    </td>
                    <td className="py-2 text-muted-foreground">{new Date(e.occurred_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {eventsPage?.nextCursor && (
            <Button className="mt-4" variant="outline" disabled={isFetching} onClick={() => setCursor(eventsPage.nextCursor!)}>
              Load more
            </Button>
          )}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No error events</p>}
        </CardContent>
      </Card>
    </div>
  );
}
