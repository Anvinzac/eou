import { EventEmitter } from 'events';
import { supabaseAdmin } from '../lib/supabase.js';
import {
  APP_ID,
  type DailyRollupRow,
  type SystemHealthSnapshot,
  type TelemetryEventInput,
  type TelemetryEventType,
} from '../types/telemetry.js';

type LatencySample = { at: number; ms: number; status: number };

const recentLatencies: LatencySample[] = [];
const MAX_SAMPLES = 2000;
const WINDOW_MS = 5 * 60 * 1000;

export const telemetryBus = new EventEmitter();
telemetryBus.setMaxListeners(50);

function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function rollupFieldForEvent(eventType: TelemetryEventType, severity?: string | null): keyof DailyRollupRow | null {
  switch (eventType) {
    case 'user.registered':
      return 'new_users';
    case 'content.created':
      return 'content_created';
    case 'content.updated':
      return 'content_updated';
    case 'link.created':
      return 'links_created';
    case 'link.interacted':
      return 'link_interactions';
    case 'error.reported':
      return severity === 'critical' ? 'errors_critical' : 'errors_total';
    default:
      return null;
  }
}

async function bumpRollup(date: string, field: keyof DailyRollupRow, amount = 1) {
  const { data: existing } = await supabaseAdmin
    .from('telemetry_daily_rollups')
    .select('*')
    .eq('app_id', APP_ID)
    .eq('date', date)
    .maybeSingle();

  if (!existing) {
    const row: Record<string, unknown> = {
      app_id: APP_ID,
      date,
      new_users: 0,
      active_users: 0,
      content_created: 0,
      content_updated: 0,
      links_created: 0,
      link_interactions: 0,
      errors_total: 0,
      errors_critical: 0,
      [field]: amount,
    };
    await supabaseAdmin.from('telemetry_daily_rollups').insert(row);
    return;
  }

  const next = Number(existing[field] ?? 0) + amount;
  await supabaseAdmin
    .from('telemetry_daily_rollups')
    .update({ [field]: next, updated_at: new Date().toISOString() })
    .eq('id', existing.id);

  if (field === 'errors_critical') {
    await supabaseAdmin
      .from('telemetry_daily_rollups')
      .update({
        errors_total: Number(existing.errors_total ?? 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  }
}

export const TelemetryService = {
  recordLatency(ms: number, status: number) {
    const now = Date.now();
    recentLatencies.push({ at: now, ms, status });
    while (recentLatencies.length > MAX_SAMPLES) recentLatencies.shift();
    const cutoff = now - WINDOW_MS;
    while (recentLatencies.length && recentLatencies[0].at < cutoff) recentLatencies.shift();
  },

  async emit(input: TelemetryEventInput) {
    try {
      const occurred = input.occurred_at
        ? new Date(input.occurred_at).toISOString()
        : new Date().toISOString();

      const row = {
        app_id: APP_ID,
        event_type: input.event_type,
        occurred_at: occurred,
        actor_user_id: input.actor_user_id || null,
        entity_type: input.entity_type || null,
        entity_id: input.entity_id || null,
        metadata: input.metadata || {},
        severity: input.severity || null,
      };

      const { data, error } = await supabaseAdmin.from('telemetry_events').insert(row).select().single();
      if (error) throw error;

      const field = rollupFieldForEvent(input.event_type, input.severity);
      if (field) {
        await bumpRollup(utcDateString(new Date(occurred)), field, 1);
      }

      // Creator-active users: bump when a signed-in actor creates content
      if (
        input.actor_user_id &&
        (input.event_type === 'content.created' || input.event_type === 'content.updated')
      ) {
        // Approximate: increment active_users counter (not distinct); UI documents this.
        await bumpRollup(utcDateString(new Date(occurred)), 'active_users', 1);
      }

      telemetryBus.emit('event', data);
      return data;
    } catch (err) {
      console.error('[telemetry] emit failed', err);
      return null;
    }
  },

  /** Fire-and-forget wrapper so domain flows never fail on telemetry. */
  emitSafe(input: TelemetryEventInput) {
    void this.emit(input);
  },

  async listEvents(opts: {
    event_type?: string;
    from?: string;
    to?: string;
    actor_user_id?: string;
    entity_type?: string;
    cursor?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(opts.limit || 50, 1), 200);
    let query = supabaseAdmin
      .from('telemetry_events')
      .select('*')
      .eq('app_id', APP_ID)
      .order('occurred_at', { ascending: false })
      .limit(limit + 1);

    if (opts.event_type) query = query.eq('event_type', opts.event_type);
    if (opts.actor_user_id) query = query.eq('actor_user_id', opts.actor_user_id);
    if (opts.entity_type) query = query.eq('entity_type', opts.entity_type);
    if (opts.from) query = query.gte('occurred_at', opts.from);
    if (opts.to) query = query.lte('occurred_at', opts.to);
    if (opts.cursor) query = query.lt('occurred_at', opts.cursor);

    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.occurred_at : null;
    return { events: items, nextCursor };
  },

  async listRollups(from: string, to: string) {
    const { data, error } = await supabaseAdmin
      .from('telemetry_daily_rollups')
      .select('*')
      .eq('app_id', APP_ID)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });
    if (error) throw error;
    return (data || []) as DailyRollupRow[];
  },

  async liveHealth(): Promise<SystemHealthSnapshot> {
    const now = Date.now();
    const window = recentLatencies.filter((s) => s.at >= now - WINDOW_MS);
    const sorted = [...window].map((s) => s.ms).sort((a, b) => a - b);
    const p = (pct: number) => {
      if (!sorted.length) return 0;
      const idx = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
      return sorted[idx];
    };
    const errors = window.filter((s) => s.status >= 500).length;
    const errorRate = window.length ? (errors / window.length) * 100 : 0;

    let dbOk = true;
    const t0 = Date.now();
    try {
      const { error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
      if (error) dbOk = false;
    } catch {
      dbOk = false;
    }
    const dbMs = Date.now() - t0;

    let status: SystemHealthSnapshot['status'] = 'operational';
    if (!dbOk || errorRate > 10) status = 'major_outage';
    else if (errorRate > 5 || p(95) > 2000) status = 'partial_outage';
    else if (errorRate > 1 || p(95) > 800 || dbMs > 200) status = 'degraded';

    // Rough uptime from recent samples (no failures = 100)
    const uptime = window.length ? ((window.length - errors) / window.length) * 100 : 100;

    return {
      app_id: APP_ID,
      captured_at: new Date().toISOString(),
      status,
      uptime_pct_24h: Number(uptime.toFixed(3)),
      p50_latency_ms: Number(p(50).toFixed(3)),
      p95_latency_ms: Number(p(95).toFixed(3)),
      error_rate_pct: Number(errorRate.toFixed(4)),
      queue_depth: null,
      db_connections_used: null,
      db_connections_max: null,
    };
  },

  async persistHealthSnapshot() {
    const snap = await this.liveHealth();
    const { data, error } = await supabaseAdmin
      .from('telemetry_health_snapshots')
      .insert({
        app_id: snap.app_id,
        captured_at: snap.captured_at,
        status: snap.status,
        uptime_pct_24h: snap.uptime_pct_24h,
        p50_latency_ms: snap.p50_latency_ms,
        p95_latency_ms: snap.p95_latency_ms,
        error_rate_pct: snap.error_rate_pct,
        queue_depth: snap.queue_depth,
        db_connections_used: snap.db_connections_used,
        db_connections_max: snap.db_connections_max,
      })
      .select()
      .single();
    if (error) throw error;
    this.emitSafe({
      event_type: 'system.heartbeat',
      metadata: { status: snap.status, p95: snap.p95_latency_ms },
      severity: 'info',
    });
    return data;
  },

  async healthHistory(from: string, to: string) {
    const { data, error } = await supabaseAdmin
      .from('telemetry_health_snapshots')
      .select('*')
      .eq('app_id', APP_ID)
      .gte('captured_at', from)
      .lte('captured_at', to)
      .order('captured_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async pruneOldEvents(days = 90) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    await supabaseAdmin.from('telemetry_events').delete().lt('occurred_at', cutoff);
  },

  async logAdminAccess(adminUserId: string, path: string) {
    try {
      await supabaseAdmin.from('admin_access_log').insert({
        admin_user_id: adminUserId,
        path,
      });
    } catch (err) {
      console.error('[telemetry] admin access log failed', err);
    }
  },
};
