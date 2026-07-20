import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminTelemetryApi } from '@/api/adminTelemetry';
import { useAdminDateRange } from '@/hooks/useAdminDateRange';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

export default function AdminLinks() {
  const { from, to, fromDate, toDate } = useAdminDateRange();
  const [cursor, setCursor] = useState<string | undefined>();

  const { data: invites, isFetching } = useQuery({
    queryKey: ['admin', 'invitations', cursor],
    queryFn: () => adminTelemetryApi.invitations(cursor, 50),
  });

  const { data: interactions } = useQuery({
    queryKey: ['admin', 'link-interactions', from, to],
    queryFn: () =>
      adminTelemetryApi.events({
        event_type: 'link.interacted',
        from,
        to,
        limit: 200,
      }),
  });

  const { data: created } = useQuery({
    queryKey: ['admin', 'link-created', from, to],
    queryFn: () =>
      adminTelemetryApi.events({
        event_type: 'link.created',
        from,
        to,
        limit: 200,
      }),
  });

  const byDay: Record<string, { date: string; invite_attempt: number; open_quiz_attempt: number; created: number }> = {};
  (interactions?.events || []).forEach((e) => {
    const day = e.occurred_at.slice(0, 10).slice(5);
    if (!byDay[day]) byDay[day] = { date: day, invite_attempt: 0, open_quiz_attempt: 0, created: 0 };
    const kind = (e.metadata?.interaction_kind as string) || 'invite_attempt';
    if (kind === 'open_quiz_attempt') byDay[day].open_quiz_attempt += 1;
    else byDay[day].invite_attempt += 1;
  });
  (created?.events || []).forEach((e) => {
    const day = e.occurred_at.slice(0, 10).slice(5);
    if (!byDay[day]) byDay[day] = { date: day, invite_attempt: 0, open_quiz_attempt: 0, created: 0 };
    byDay[day].created += 1;
  });
  const chart = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Links & interactions</h2>
        <p className="text-sm text-muted-foreground">
          Invitations = shareable links. Interactions = invite attempts + open-quiz attempts ({fromDate} → {toDate}).
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Created vs interactions</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          {chart.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data in this range</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" fill="hsl(var(--lavender))" name="Links created" radius={[4, 4, 0, 0]} />
                <Bar dataKey="invite_attempt" stackId="i" fill="hsl(var(--coral))" name="Invite attempts" />
                <Bar dataKey="open_quiz_attempt" stackId="i" fill="hsl(var(--teal))" name="Open quiz attempts" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Quiz</th>
                  <th className="py-2 pr-3">Used</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {(invites?.invitations || []).map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-mono text-xs">{inv.code}</td>
                    <td className="py-2 pr-3">{inv.label}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{inv.quiz_id?.slice(0, 8)}…</td>
                    <td className="py-2 pr-3">
                      <Badge variant={inv.is_used ? 'secondary' : 'default'}>{inv.is_used ? 'used' : 'open'}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">{new Date(inv.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invites?.nextCursor && (
            <Button className="mt-4" variant="outline" disabled={isFetching} onClick={() => setCursor(invites.nextCursor!)}>
              Load more
            </Button>
          )}
          {(invites?.invitations || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No invitations yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
