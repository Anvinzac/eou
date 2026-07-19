import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { authApi, getAccessToken, setAccessToken, type AuthUser } from '@/api';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  /** Sync a Supabase access token (e.g. after Lovable OAuth) into the API client. */
  adoptAccessToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PLACEHOLDER_URL = 'https://your-project-id.supabase.co';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadMe = async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsAdmin(false);
      return;
    }
    if (token === 'mock-token') {
      setUser({
        id: 'demo-user-123',
        email: 'demo@example.com',
        user_metadata: { display_name: 'Demo User' },
      });
      setIsAdmin(false);
      return;
    }
    try {
      const data = await authApi.me();
      setUser(data.user);
      setIsAdmin(!!data.roles?.admin);
    } catch {
      setAccessToken(null);
      setUser(null);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    if (import.meta.env.VITE_SUPABASE_URL === PLACEHOLDER_URL) {
      setAccessToken('mock-token');
      setUser({
        id: 'demo-user-123',
        email: 'demo@example.com',
        user_metadata: { display_name: 'Demo User' },
      });
      setLoading(false);
      return;
    }

    (async () => {
      // Prefer API token; also adopt an existing Supabase session (OAuth).
      const existing = getAccessToken();
      if (!existing) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          setAccessToken(data.session.access_token);
        }
      }
      await loadMe();
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        setAccessToken(session.access_token);
        await loadMe();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (import.meta.env.VITE_SUPABASE_URL === PLACEHOLDER_URL) {
      setAccessToken('mock-token');
      setUser({ id: 'demo-user-123', email, user_metadata: { display_name: displayName || 'Demo User' } });
      return { error: null };
    }
    try {
      const data = await authApi.signup(email, password, displayName);
      setUser(data.user);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (import.meta.env.VITE_SUPABASE_URL === PLACEHOLDER_URL) {
      setAccessToken('mock-token');
      setUser({ id: 'demo-user-123', email, user_metadata: { display_name: 'Demo User' } });
      return { error: null };
    }
    try {
      const data = await authApi.signin(email, password);
      setUser(data.user);
      const me = await authApi.me().catch(() => null);
      setIsAdmin(!!me?.roles?.admin);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    authApi.signOut();
    setUser(null);
    setIsAdmin(false);
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  };

  const adoptAccessToken = async (token: string) => {
    setAccessToken(token);
    await loadMe();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, signUp, signIn, signOut, adoptAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
