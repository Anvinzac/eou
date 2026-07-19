import { supabaseAdmin } from '../lib/supabase.js';

export const CoupleSessionModel = {
  async create(row: { quiz_id: string; session_code: string; first_name: string }) {
    const { data, error } = await supabaseAdmin.from('couple_sessions').insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async findByQuizAndCode(quizId: string, code: string) {
    const { data, error } = await supabaseAdmin
      .from('couple_sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('session_code', code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByCode(code: string) {
    const { data, error } = await supabaseAdmin
      .from('couple_sessions')
      .select('*')
      .eq('session_code', code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Record<string, unknown>) {
    const { data, error } = await supabaseAdmin
      .from('couple_sessions')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listByQuiz(quizId: string) {
    const { data, error } = await supabaseAdmin
      .from('couple_sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};
