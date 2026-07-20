import { apiRequest, getAccessToken } from './client';

export type TelemetryEvent = {
  id: string;
  app_id: string;
  event_type: string;
  occurred_at: string;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  severity?: string | null;
};

export type DailyRollup = {
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

export type HealthSnapshot = {
  app_id: string;
  captured_at: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  uptime_pct_24h: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  error_rate_pct: number;
};

function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const adminTelemetryApi = {
  events(params: {
    event_type?: string;
    from?: string;
    to?: string;
    actor_user_id?: string;
    entity_type?: string;
    cursor?: string;
    limit?: number;
  } = {}) {
    return apiRequest<{ events: TelemetryEvent[]; nextCursor: string | null }>(
      `/admin/telemetry/events${qs(params)}`,
    );
  },

  rollupsDaily(from: string, to: string) {
    return apiRequest<{ rollups: DailyRollup[]; from: string; to: string }>(
      `/admin/telemetry/rollups/daily${qs({ from, to })}`,
    );
  },

  health() {
    return apiRequest<HealthSnapshot>('/admin/telemetry/health');
  },

  healthHistory(from: string, to: string) {
    return apiRequest<{ history: HealthSnapshot[] }>(
      `/admin/telemetry/health/history${qs({ from, to })}`,
    );
  },

  summary() {
    return apiRequest<{
      total_users: number;
      total_quizzes: number;
      attempts_today: number;
      errors_last_1h: number;
      new_users_today: number;
      new_users_7d: number;
      new_users_30d: number;
      content_created_7d: number;
      health: HealthSnapshot;
      sparklines_7d: DailyRollup[];
    }>('/admin/usage/summary');
  },

  funnel() {
    return apiRequest<{
      drafts: number;
      claimed_or_owned: number;
      invitations: number;
      attempts: number;
      couple_sessions: number;
      couple_completed: number;
    }>('/admin/usage/funnel');
  },

  versus() {
    return apiRequest<{
      versus_quiz_count: number;
      attempt_count: number;
      cheat_responses: number;
      timeout_responses: number;
    }>('/admin/usage/versus');
  },

  couple() {
    return apiRequest<{
      total: number;
      completed: number;
      waiting: number;
      completion_rate_pct: number;
      avg_match_percentage: number;
    }>('/admin/usage/couple');
  },

  invitations(cursor?: string, limit = 50) {
    return apiRequest<{ invitations: any[]; nextCursor: string | null }>(
      `/admin/usage/invitations${qs({ cursor, limit })}`,
    );
  },

  profiles(cursor?: string, limit = 50) {
    return apiRequest<{ profiles: any[]; nextCursor: string | null }>(
      `/admin/usage/profiles${qs({ cursor, limit })}`,
    );
  },

  backfill() {
    return apiRequest<{ skipped: boolean; inserted?: number; reason?: string }>(
      '/admin/telemetry/backfill',
      { method: 'POST' },
    );
  },

  reportClientError(payload: {
    message: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }) {
    return apiRequest('/admin/telemetry/client-error', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload),
      headers: getAccessToken()
        ? { Authorization: `Bearer ${getAccessToken()}` }
        : undefined,
    });
  },
};

export function openTelemetryStream(onEvent: (e: TelemetryEvent) => void): () => void {
  const token = getAccessToken();
  const base = import.meta.env.VITE_API_URL || '/api';
  // EventSource cannot set Authorization headers — use fetch stream polyfill via query is unsafe.
  // Prefer fetch-based SSE with Authorization header.
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${base}/admin/telemetry/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const chunk of parts) {
          const lines = chunk.split('\n');
          let eventName = 'message';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (eventName === 'telemetry' && data) {
            try {
              onEvent(JSON.parse(data));
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* aborted or network */
    }
  })();

  return () => controller.abort();
}
