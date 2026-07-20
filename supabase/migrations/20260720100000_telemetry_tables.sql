-- Telemetry tables for admin live usage dashboard (Unified Telemetry Contract)

CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL DEFAULT 'eou',
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT CHECK (severity IS NULL OR severity IN ('info', 'warn', 'error', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_app_occurred
  ON public.telemetry_events (app_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_type_occurred
  ON public.telemetry_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_actor
  ON public.telemetry_events (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.telemetry_daily_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL DEFAULT 'eou',
  date DATE NOT NULL,
  new_users INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  content_created INTEGER NOT NULL DEFAULT 0,
  content_updated INTEGER NOT NULL DEFAULT 0,
  links_created INTEGER NOT NULL DEFAULT 0,
  link_interactions INTEGER NOT NULL DEFAULT 0,
  errors_total INTEGER NOT NULL DEFAULT 0,
  errors_critical INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, date)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_rollups_app_date
  ON public.telemetry_daily_rollups (app_id, date DESC);

CREATE TABLE IF NOT EXISTS public.telemetry_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL DEFAULT 'eou',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'operational'
    CHECK (status IN ('operational', 'degraded', 'partial_outage', 'major_outage')),
  uptime_pct_24h NUMERIC(6, 3) NOT NULL DEFAULT 100,
  p50_latency_ms NUMERIC(12, 3) NOT NULL DEFAULT 0,
  p95_latency_ms NUMERIC(12, 3) NOT NULL DEFAULT 0,
  error_rate_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
  queue_depth INTEGER,
  db_connections_used INTEGER,
  db_connections_max INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_telemetry_health_app_captured
  ON public.telemetry_health_snapshots (app_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  path TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_log_at
  ON public.admin_access_log (at DESC);

-- Service role / backend only; no public RLS policies for end users.
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_daily_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read telemetry_events"
  ON public.telemetry_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read telemetry_daily_rollups"
  ON public.telemetry_daily_rollups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read telemetry_health_snapshots"
  ON public.telemetry_health_snapshots FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read admin_access_log"
  ON public.admin_access_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
