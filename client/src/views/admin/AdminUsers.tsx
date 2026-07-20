import { useQuery } from '@tanstack/react-query';
import { adminTelemetryApi } from '@/api/adminTelemetry';
import { useAdminDateRange } from '@/hooks/useAdminDateRange';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function AdminUsers() {
  const { fromDate, toDate } = useAdminDateRange();
  const [cursor, setCursor] = useState<string | undefined>();
  const [pages, setPages] = useState<any[][]>([]);

  const { data: rollups } = useQuery({
    queryKey: ['admin', 'rollups', fromDate, toDate],
    queryFn: () => adminTelemetryApi.rollupsDaily(fromDate, toDate),
  });

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'profiles', cursor],
    queryFn: () => adminTelemetryApi.profiles(cursor, 50),
  });

  const rows = cursor ? [...pages.flat(), ...(data?.profiles || [])] : data?.profiles || [];
  const chart = (rollups?.rollups || []).map((r) => ({ date: r.date.slice(5), users: r.new_users }));

  const current = rollups?.rollups?.reduce((a, r) => a + r.new_users, 0) || 0;
  const days = Math.max(1, (rollups?.rollups || []).length);
  // Prior period approx: use previous equal window from summary sparklines isn't here — show current only + note
  const priorApprox = current; // displayed as cohort note below

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">New user registration</h2>
        <p className="text-sm text-muted-foreground">
          Source: <code className="text-xs">profiles.created_at</code>. No email shown (not exposed by admin API).
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Registrations / day · {current} in range</CardTitle>
        </CardHeader>
        <CardContent className="h-52">
          {chart.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data in this range</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--coral))" fill="hsl(var(--coral) / 0.3)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cohort-lite: {current} registrations over {days} day(s). Compare periods by switching the range picker.
        {priorApprox === current ? '' : ''}
      </p>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3">Display name</th>
                  <th className="py-2 pr-3">User id</th>
                  <th className="py-2">Registered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{p.display_name || '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{p.user_id?.slice(0, 8)}…</td>
                    <td className="py-2 text-muted-foreground">{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.nextCursor && (
            <Button
              className="mt-4"
              variant="outline"
              disabled={isFetching}
              onClick={() => {
                setPages((prev) => [...prev, data.profiles || []]);
                setCursor(data.nextCursor!);
              }}
            >
              Load more
            </Button>
          )}
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No users yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}
