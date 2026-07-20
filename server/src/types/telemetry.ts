export const APP_ID = 'eou';

export type TelemetryEventType =
  | 'user.registered'
  | 'content.created'
  | 'content.updated'
  | 'content.deleted'
  | 'link.created'
  | 'link.interacted'
  | 'error.reported'
  | 'system.heartbeat';

export type TelemetrySeverity = 'info' | 'warn' | 'error' | 'critical';

export type TelemetryEventInput = {
  event_type: TelemetryEventType;
  occurred_at?: string | Date;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  severity?: TelemetrySeverity | null;
};

export type DailyRollupRow = {
  app_id: string;
  date: string;
  new_users: number;
  active_users: number;
  content_created: number;
  content_updated: number;
  links_created: number;
  link_interactions: number;
  errors_total: number;
  errors_critical: number;
};

export type SystemHealthSnapshot = {
  app_id: string;
  captured_at: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  uptime_pct_24h: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  error_rate_pct: number;
  queue_depth?: number | null;
  db_connections_used?: number | null;
  db_connections_max?: number | null;
};
