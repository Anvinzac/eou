import { supabaseAdmin } from '../lib/supabase.js';
import { APP_ID } from '../types/telemetry.js';
import { TelemetryService } from './telemetryService.js';

/**
 * One-shot backfill of telemetry_events + daily rollups from existing domain tables.
 * Safe to re-run only on empty telemetry_events (guards against duplicate floods).
 */
export const TelemetryBackfillService = {
  async run() {
    const { count } = await supabaseAdmin
      .from('telemetry_events')
      .select('*', { count: 'exact', head: true })
      .eq('app_id', APP_ID);

    if ((count || 0) > 0) {
      return { skipped: true, reason: 'telemetry_events already populated', inserted: 0 };
    }

    let inserted = 0;

    // user.registered ← profiles
    const { data: profiles } = await supabaseAdmin.from('profiles').select('user_id, created_at, display_name');
    for (const p of profiles || []) {
      await TelemetryService.emit({
        event_type: 'user.registered',
        occurred_at: p.created_at,
        actor_user_id: p.user_id,
        entity_type: 'profile',
        entity_id: p.user_id,
        metadata: { display_name: p.display_name, source: 'backfill' },
      });
      inserted += 1;
    }

    // content.created ← quizzes
    const { data: quizzes } = await supabaseAdmin
      .from('quizzes')
      .select('id, user_id, title, created_at, draft_token, is_open');
    for (const q of quizzes || []) {
      const isVersus = (q.title || '').startsWith('[Versus]');
      await TelemetryService.emit({
        event_type: 'content.created',
        occurred_at: q.created_at,
        actor_user_id: q.user_id,
        entity_type: isVersus ? 'versus_quiz' : 'quiz',
        entity_id: q.id,
        metadata: {
          title: q.title,
          is_draft: !q.user_id && !!q.draft_token,
          is_open: q.is_open,
          source: 'backfill',
        },
      });
      inserted += 1;
    }

    // content.created ← question_packs
    const { data: packs } = await supabaseAdmin
      .from('question_packs')
      .select('id, user_id, title, created_at, is_system');
    for (const pack of packs || []) {
      await TelemetryService.emit({
        event_type: 'content.created',
        occurred_at: pack.created_at,
        actor_user_id: pack.user_id,
        entity_type: 'question_pack',
        entity_id: pack.id,
        metadata: { title: pack.title, is_system: pack.is_system, source: 'backfill' },
      });
      inserted += 1;
    }

    // content.created ← completed couple_sessions
    const { data: couples } = await supabaseAdmin
      .from('couple_sessions')
      .select('id, quiz_id, status, created_at, completed_at, match_percentage')
      .eq('status', 'completed');
    for (const c of couples || []) {
      await TelemetryService.emit({
        event_type: 'content.created',
        occurred_at: c.completed_at || c.created_at,
        entity_type: 'couple_session',
        entity_id: c.id,
        metadata: {
          quiz_id: c.quiz_id,
          match_percentage: c.match_percentage,
          source: 'backfill',
        },
      });
      inserted += 1;
    }

    // link.created ← invitations
    const { data: invites } = await supabaseAdmin
      .from('invitations')
      .select('id, quiz_id, code, label, is_used, created_at');
    for (const inv of invites || []) {
      await TelemetryService.emit({
        event_type: 'link.created',
        occurred_at: inv.created_at,
        entity_type: 'invitation',
        entity_id: inv.id,
        metadata: {
          quiz_id: inv.quiz_id,
          code: inv.code,
          label: inv.label,
          is_used: inv.is_used,
          source: 'backfill',
        },
      });
      inserted += 1;
    }

    // link.interacted ← attempts with invitation or open quiz
    const { data: attempts } = await supabaseAdmin
      .from('quiz_attempts')
      .select('id, quiz_id, invitation_id, created_at, score, total_questions');
    const quizOpen = new Map((quizzes || []).map((q) => [q.id, !!q.is_open]));
    for (const a of attempts || []) {
      const open = quizOpen.get(a.quiz_id);
      if (!a.invitation_id && !open) continue;
      await TelemetryService.emit({
        event_type: 'link.interacted',
        occurred_at: a.created_at,
        entity_type: 'quiz_attempt',
        entity_id: a.id,
        metadata: {
          quiz_id: a.quiz_id,
          invitation_id: a.invitation_id,
          interaction_kind: a.invitation_id ? 'invite_attempt' : 'open_quiz_attempt',
          score: a.score,
          total_questions: a.total_questions,
          source: 'backfill',
        },
      });
      inserted += 1;
    }

    return { skipped: false, inserted };
  },
};
