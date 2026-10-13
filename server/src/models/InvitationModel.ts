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

  async findById(id: string) {
    const { data, error } = await supabaseAdmin.from('invitations').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Marks an unused invitation as used in one statement; false means someone else got there first. */
  async claim(id: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .update({ is_used: true })
      .eq('id', id)
      .eq('is_used', false)
      .select('id');
    if (error) throw error;
    return (data || []).length > 0;
  },

  async release(id: string) {
    const { error } = await supabaseAdmin.from('invitations').update({ is_used: false }).eq('id', id);
    if (error) throw error;
  },
};
