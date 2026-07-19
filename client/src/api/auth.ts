import { apiRequest, setAccessToken } from './client';

export type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { display_name?: string };
};

export type AuthSession = {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
};

export const authApi = {
  async signup(email: string, password: string, displayName?: string) {
    const data = await apiRequest<{ user: AuthUser; session: AuthSession | null }>('/auth/signup', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, displayName }),
    });
    if (data.session?.access_token) setAccessToken(data.session.access_token);
    return data;
  },

  async signin(email: string, password: string) {
    const data = await apiRequest<{ user: AuthUser; session: AuthSession }>('/auth/signin', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    if (data.session?.access_token) setAccessToken(data.session.access_token);
    return data;
  },

  async me() {
    return apiRequest<{ user: AuthUser; roles: { admin: boolean } }>('/auth/me');
  },

  async claimDraft(quizId: string, draftToken: string) {
    return apiRequest<{ quiz: unknown }>('/auth/drafts/claim', {
      method: 'POST',
      body: JSON.stringify({ quizId, draftToken }),
    });
  },

  signOut() {
    setAccessToken(null);
  },
};
