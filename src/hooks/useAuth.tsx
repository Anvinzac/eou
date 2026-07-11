import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Supabase is not configured, use a mock user
    if (import.meta.env.VITE_SUPABASE_URL === 'https://your-project-id.supabase.co') {
      const mockUser = { id: 'demo-user-123', email: 'demo@example.com', user_metadata: { display_name: 'Demo User' } } as unknown as User;
      setUser(mockUser);
      setSession({ user: mockUser, access_token: 'mock-token', refresh_token: 'mock-refresh' } as any);
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (import.meta.env.VITE_SUPABASE_URL === 'https://your-project-id.supabase.co') {
      const mockUser = { id: 'demo-user-123', email, user_metadata: { display_name: displayName || 'Demo User' } } as unknown as User;
      setUser(mockUser);
      setSession({ user: mockUser, access_token: 'mock-token', refresh_token: 'mock-refresh' } as any);
      return { error: null };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    if (import.meta.env.VITE_SUPABASE_URL === 'https://your-project-id.supabase.co') {
      const mockUser = { id: 'demo-user-123', email, user_metadata: { display_name: 'Demo User' } } as unknown as User;
      setUser(mockUser);
      setSession({ user: mockUser, access_token: 'mock-token', refresh_token: 'mock-refresh' } as any);
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    if (import.meta.env.VITE_SUPABASE_URL === 'https://your-project-id.supabase.co') {
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
