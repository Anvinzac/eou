import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';
import { adminTelemetryApi } from '@/api/adminTelemetry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'flags' | 'users' | 'telemetry'>('flags');

  const { data: flagsData, refetch: refetchFlags } = useQuery({
    queryKey: ['admin', 'flags'],
    queryFn: () => adminApi.featureFlags(),
  });

  const { data: profilesData } = useQuery({
    queryKey: ['admin', 'settings-profiles'],
    queryFn: () => adminApi.profiles(),
    enabled: tab === 'users',
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_enabled }: { id: string; is_enabled: boolean }) =>
      adminApi.toggleFlag(id, is_enabled),
    onSuccess: () => {
      toast.success('Flag updated');
      void refetchFlags();
    },
    onError: (err: any) => toast.error(err.message || 'Failed'),
  });

  const backfill = useMutation({
    mutationFn: () => adminTelemetryApi.backfill(),
    onSuccess: (res) => {
      if (res.skipped) toast.info(res.reason || 'Already backfilled');
      else toast.success(`Backfilled ${res.inserted || 0} events`);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err: any) => toast.error(err.message || 'Backfill failed'),
  });

  useEffect(() => {
    // touch access log via any admin call
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Settings</h2>
        <p className="text-sm text-muted-foreground">Feature flags, profiles, and telemetry maintenance</p>
      </div>

      <div className="flex gap-2">
        {([
          ['flags', 'Feature flags'],
          ['users', 'Users'],
          ['telemetry', 'Telemetry'],
        ] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={tab === key ? 'default' : 'outline'} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === 'flags' && (
        <div className="space-y-3">
          {(flagsData?.flags || []).map((flag: any) => (
            <Card key={flag.id} className="rounded-2xl">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-semibold text-sm">{flag.flag_label}</h3>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">{flag.flag_key}</Badge>
                </div>
                <Switch
                  checked={!!flag.is_enabled}
                  onCheckedChange={(v) => toggle.mutate({ id: flag.id, is_enabled: v })}
                />
              </CardContent>
            </Card>
          ))}
          {(flagsData?.flags || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No feature flags</p>
          )}
        </div>
      )}

      {tab === 'users' && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Profiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(profilesData?.profiles || []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                <div>
                  <span className="font-medium">{p.display_name || 'No name'}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.user_id?.slice(0, 8)}…</span>
                </div>
                <Badge variant="outline">User</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'telemetry' && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Backfill historical events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              One-shot import from profiles, quizzes, invitations, attempts, packs, and completed couple sessions
              into <code>telemetry_events</code> + daily rollups. Skips if events already exist.
            </p>
            <Button onClick={() => backfill.mutate()} disabled={backfill.isPending}>
              {backfill.isPending ? 'Running…' : 'Run backfill'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
