import { supabaseAdmin } from '../lib/supabase.js';

export const AttemptModel = {
  async create(row: {
    quiz_id: string;
    invitation_id: string | null;
    respondent_name: string | null;
    score: number;
    total_questions: number;
    completed_at: string;
  }) {
    const { data, error } = await supabaseAdmin.from('quiz_attempts').insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async insertResponses(
    rows: Array<{
      attempt_id: string;
      question_id: string;
      selected_answer: string | null;
      is_correct: boolean;
    }>,
  ) {
    const { data, error } = await supabaseAdmin.from('quiz_responses').insert(rows).select();
    if (error) throw error;
    return data || [];
  },

  async findById(id: string) {
    const { data, error } = await supabaseAdmin.from('quiz_attempts').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async listByQuiz(quizId: string) {
    const { data, error } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async leaderboard(quizId: string, limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .order('score', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getResponsesByAttemptIds(attemptIds: string[]) {
    if (attemptIds.length === 0) return [];
    const { data, error } = await supabaseAdmin
      .from('quiz_responses')
      .select('*')
      .in('attempt_id', attemptIds);
    if (error) throw error;
    return data || [];
  },

  async countByQuiz(quizId: string) {
    const { count, error } = await supabaseAdmin
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId);
    if (error) throw error;
    return count || 0;
  },
};
