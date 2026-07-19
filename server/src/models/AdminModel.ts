import { supabaseAdmin } from '../lib/supabase.js';

export const AdminModel = {
  async listFeatureFlags() {
    const { data, error } = await supabaseAdmin.from('feature_flags').select('*').order('created_at');
    if (error) throw error;
    return data || [];
  },

  async toggleFlag(id: string, isEnabled: boolean) {
    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .update({ is_enabled: isEnabled })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listProfiles() {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async hasRole(userId: string, role: string) {
    const { data, error } = await supabaseAdmin.rpc('has_role', { _user_id: userId, _role: role });
    if (error) throw error;
    return !!data;
  },
};
