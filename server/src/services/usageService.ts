import { supabaseAdmin } from '../lib/supabase.js';
import { TelemetryService } from './telemetryService.js';

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export const UsageService = {
  async summary() {
    const today = new Date().toISOString().slice(0, 10);
    const d7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

    const [
      { count: totalUsers },
      { count: totalQuizzes },
      { count: attemptsToday },
      { count: errors1h },
      rollups7,
      rollups30,
      health,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('quizzes').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00.000Z`),
      supabaseAdmin
        .from('telemetry_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'error.reported')
        .gte('occurred_at', daysAgoIso(1 / 24)),
      TelemetryService.listRollups(d7, today),
      TelemetryService.listRollups(d30, today),
      TelemetryService.liveHealth(),
    ]);

    const sum = (rows: Array<Record<string, number>>, key: string) =>
      rows.reduce((acc, r) => acc + Number(r[key] || 0), 0);

    return {
      total_users: totalUsers || 0,
      total_quizzes: totalQuizzes || 0,
      attempts_today: attemptsToday || 0,
      errors_last_1h: errors1h || 0,
      new_users_today: sum(rollups7.filter((r) => r.date === today) as any, 'new_users'),
      new_users_7d: sum(rollups7 as any, 'new_users'),
      new_users_30d: sum(rollups30 as any, 'new_users'),
      content_created_7d: sum(rollups7 as any, 'content_created'),
      health,
      sparklines_7d: rollups7,
    };
  },

  async funnel() {
    const [
      { count: drafts },
      { count: claimed },
      { count: withInvites },
      { count: attempts },
      { count: coupleCompleted },
      { count: coupleTotal },
    ] = await Promise.all([
      supabaseAdmin
        .from('quizzes')
        .select('*', { count: 'exact', head: true })
        .is('user_id', null)
        .not('draft_token', 'is', null),
      supabaseAdmin
        .from('quizzes')
        .select('*', { count: 'exact', head: true })
        .not('user_id', 'is', null),
      supabaseAdmin.from('invitations').select('quiz_id', { count: 'exact', head: true }),
      supabaseAdmin.from('quiz_attempts').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('couple_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabaseAdmin.from('couple_sessions').select('*', { count: 'exact', head: true }),
    ]);

    return {
      drafts: drafts || 0,
      claimed_or_owned: claimed || 0,
      invitations: withInvites || 0,
      attempts: attempts || 0,
      couple_sessions: coupleTotal || 0,
      couple_completed: coupleCompleted || 0,
    };
  },

  async versus() {
    const { data: versusQuizzes } = await supabaseAdmin
      .from('quizzes')
      .select('id, title, created_at')
      .like('title', '[Versus]%');

    const ids = (versusQuizzes || []).map((q) => q.id);
    if (ids.length === 0) {
      return {
        versus_quiz_count: 0,
        attempt_count: 0,
        cheat_responses: 0,
        timeout_responses: 0,
        quizzes: [],
      };
    }

    const { data: attempts, count: attemptCount } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*', { count: 'exact' })
      .in('quiz_id', ids);

    const attemptIds = (attempts || []).map((a) => a.id);
    let cheat = 0;
    let timeout = 0;
    if (attemptIds.length) {
      const { data: responses } = await supabaseAdmin
        .from('quiz_responses')
        .select('selected_answer')
        .in('attempt_id', attemptIds);
      for (const r of responses || []) {
        if (r.selected_answer === '___CHEATED___') cheat += 1;
        if (r.selected_answer === '___TIMED_OUT___') timeout += 1;
      }
    }

    return {
      versus_quiz_count: ids.length,
      attempt_count: attemptCount || 0,
      cheat_responses: cheat,
      timeout_responses: timeout,
      quizzes: versusQuizzes || [],
    };
  },

  async couple() {
    const { data: sessions } = await supabaseAdmin
      .from('couple_sessions')
      .select('id, status, match_percentage, created_at, completed_at');

    const all = sessions || [];
    const completed = all.filter((s) => s.status === 'completed');
    const avgMatch =
      completed.length === 0
        ? 0
        : completed.reduce((acc, s) => acc + Number(s.match_percentage || 0), 0) / completed.length;

    return {
      total: all.length,
      completed: completed.length,
      waiting: all.filter((s) => s.status === 'waiting').length,
      completion_rate_pct: all.length ? Math.round((completed.length / all.length) * 100) : 0,
      avg_match_percentage: Math.round(avgMatch * 10) / 10,
    };
  },

  async listInvitations(limit = 50, cursor?: string) {
    let query = supabaseAdmin
      .from('invitations')
      .select('id, quiz_id, code, label, is_used, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 200) + 1);
    if (cursor) query = query.lt('created_at', cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      invitations: items,
      nextCursor: hasMore ? items[items.length - 1]?.created_at : null,
    };
  },

  async listProfiles(limit = 50, cursor?: string) {
    let query = supabaseAdmin
      .from('profiles')
      .select('id, user_id, display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 200) + 1);
    if (cursor) query = query.lt('created_at', cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      profiles: items,
      nextCursor: hasMore ? items[items.length - 1]?.created_at : null,
    };
  },
};
