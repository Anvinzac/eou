import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminDateRange, type RangeKey } from '@/hooks/useAdminDateRange';
import { useTelemetryLiveFeed } from '@/hooks/useTelemetryLiveFeed';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity, ArrowLeft, AlertTriangle, Link2, Users, Database, HeartPulse, Settings, LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { adminTelemetryApi } from '@/api/adminTelemetry';

const nav = [
  { to: '/admin', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/content', label: 'Content', icon: Database },
  { to: '/admin/links', label: 'Links', icon: Link2 },
  { to: '/admin/errors', label: 'Errors', icon: AlertTriangle },
  { to: '/admin/status', label: 'Status', icon: HeartPulse },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const ranges: { key: RangeKey; label: string }[] = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

export default function AdminLayout() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { range, setRange } = useAdminDateRange();
  const { connection } = useTelemetryLiveFeed(!!user && isAdmin);

  const { data: summary } = useQuery({
    queryKey: ['admin', 'summary'],
    queryFn: () => adminTelemetryApi.summary(),
    enabled: !!user && isAdmin,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      navigate('/dashboard');
    }
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Checking admin access…
      </div>
    );
  }

  const connColor =
    connection === 'connected' ? 'bg-emerald-500' : connection === 'polling' ? 'bg-amber-400' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-card/40 p-4 gap-1">
        <div className="mb-4 px-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">eou admin</p>
          <h1 className="font-display font-bold text-lg">Live Usage</h1>
        </div>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'gradient-coral text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.to === '/admin/errors' && (summary?.errors_last_1h || 0) > 0 && (
              <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                {summary?.errors_last_1h}
              </Badge>
            )}
          </NavLink>
        ))}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('h-2 w-2 rounded-full', connColor)} />
                <Activity className="h-3.5 w-3.5" />
                {connection === 'connected' ? 'Live' : connection === 'polling' ? 'Polling' : 'Stale'}
              </div>
            </div>
            <div className="flex gap-1">
              {ranges.map((r) => (
                <Button
                  key={r.key}
                  size="sm"
                  variant={range === r.key ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setRange(r.key)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          {/* Mobile nav */}
          <div className="md:hidden mt-3 flex gap-1 overflow-x-auto hide-scrollbar">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium',
                    isActive ? 'gradient-coral text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
