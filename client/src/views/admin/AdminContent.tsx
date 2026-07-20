import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminTelemetryApi } from '@/api/adminTelemetry';
import { useAdminDateRange } from '@/hooks/useAdminDateRange';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

export default function AdminContent() {
  const { from, to, fromDate, toDate } = useAdminDateRange();
  const [entityType, setEntityType] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>();

  const { data: eventsPage, isFetching } = useQuery({
    queryKey: ['admin', 'content-events', from, to, entityType, cursor],
    queryFn: () =>
      adminTelemetryApi.events({
        event_type: 'content.created',
        from,
        to,
        entity_type: entityType || undefined,
        cursor,
        limit: 50,
      }),
  });

  const { data: allTypes } = useQuery({
    queryKey: ['admin', 'content-types', from, to],
    queryFn: async () => {
      const res = await adminTelemetryApi.events({
        event_type: 'content.created',
        from,
        to,
        limit: 200,
      });
      return res.events;
    },
  });

  const types = useMemo(() => {
    const set = new Set<string>();
    (allTypes || []).forEach((e) => {
      if (e.entity_type) set.add(e.entity_type);
    });
    return Array.from(set).sort();
  }, [allTypes]);

  const byDayType = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    (allTypes || []).forEach((e) => {
      const day = e.occurred_at.slice(0, 10).slice(5);
      const t = e.entity_type || 'other';
      if (!map.has(day)) map.set(day, {});
      const row = map.get(day)!;
      row[t] = (row[t] || 0) + 1;
    });
    return Array.from(map.entries()).map(([date, counts]) => ({ date, ...counts }));
  }, [allTypes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Content created</h2>
        <p className="text-sm text-muted-foreground">
          Entity types: quiz, versus_quiz, question_pack, couple_session ({fromDate} → {toDate})
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={!entityType ? 'default' : 'outline'} onClick={() => { setEntityType(''); setCursor(undefined); }}>
          All
        </Button>
        {types.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={entityType === t ? 'default' : 'outline'}
            onClick={() => { setEntityType(t); setCursor(undefined); }}
          >
            {t}
          </Button>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Created by type / day</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {byDayType.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data in this range</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDayType}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {types.map((t, i) => (
                  <Bar
                    key={t}
                    dataKey={t}
                    stackId="a"
                    fill={`hsl(${12 + i * 40} 80% ${55 + (i % 3) * 8}%)`}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Recent content events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Entity id</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {(eventsPage?.events || []).map((e) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="py-2 pr-3"><Badge variant="secondary">{e.entity_type || '—'}</Badge></td>
                    <td className="py-2 pr-3 font-mono text-xs">{e.entity_id?.slice(0, 8) || '—'}…</td>
                    <td className="py-2 pr-3 font-mono text-xs">{e.actor_user_id?.slice(0, 8) || 'anon'}…</td>
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
          {(eventsPage?.events || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No content events in this range</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
