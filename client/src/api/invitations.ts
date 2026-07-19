import { apiRequest } from './client';

export const invitationsApi = {
  create(quizId: string, labels: string[]) {
    return apiRequest<{ invitations: any[] }>(`/quizzes/${quizId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ labels }),
    });
  },

  list(quizId: string) {
    return apiRequest<{ invitations: any[] }>(`/quizzes/${quizId}/invitations`);
  },

  verify(quizId: string, code = '') {
    return apiRequest<{ verified: boolean; invitation: any | null; quiz: any }>(
      '/invitations/verify',
      {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ quizId, code }),
      },
    );
  },
};
