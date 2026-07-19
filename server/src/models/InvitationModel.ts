import { supabaseAdmin } from '../lib/supabase.js';

export const InvitationModel = {
  async createMany(rows: Array<{ quiz_id: string; code: string; label: string }>) {
    const { data, error } = await supabaseAdmin.from('invitations').insert(rows).select();
    if (error) throw error;
    return data || [];
  },

  async listByQuiz(quizId: string) {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async findByQuizAndCode(quizId: string, code: string) {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('code', code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async markUsed(id: string) {
    const { error } = await supabaseAdmin.from('invitations').update({ is_used: true }).eq('id', id);
    if (error) throw error;
  },
};
