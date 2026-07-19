import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { env } from './env.js';

/** Service-role client when available; otherwise anon (dev fallback). */
export const supabaseAdmin: SupabaseClient = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey || env.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/** Anon client used only to validate JWTs via auth.getUser. */
const supabaseAuth = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function getUserFromToken(token: string): Promise<User | null> {
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName?: string,
) {
  return supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });
}

export async function signInWithPassword(email: string, password: string) {
  return supabaseAuth.auth.signInWithPassword({ email, password });
}
