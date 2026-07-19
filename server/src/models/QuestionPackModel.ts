import { supabaseAdmin } from '../lib/supabase.js';

export const QuestionPackModel = {
  async listVisible(userId?: string) {
    let query = supabaseAdmin.from('question_packs').select('*').order('created_at', { ascending: false });
    if (userId) {
      query = query.or(`is_system.eq.true,user_id.eq.${userId}`);
    } else {
      query = query.eq('is_system', true);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async listMine(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('question_packs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(row: {
    user_id: string;
    title: string;
    description: string;
    emoji: string;
    questions: unknown;
    is_system: boolean;
  }) {
    const { data, error } = await supabaseAdmin.from('question_packs').insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async update(id: string, userId: string, patch: Record<string, unknown>) {
    const { data, error } = await supabaseAdmin
      .from('question_packs')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string, userId: string) {
    const { error } = await supabaseAdmin.from('question_packs').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },
};
