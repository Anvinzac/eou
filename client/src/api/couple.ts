import { apiRequest } from './client';

export const coupleApi = {
  create(quizId: string, name: string) {
    return apiRequest<{ session: any; slot: 'first' }>(`/quizzes/${quizId}/couple-sessions`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ name }),
    });
  },

  join(quizId: string, code: string, name: string) {
    return apiRequest<{ session: any; slot: 'second' }>('/couple-sessions/join', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ quizId, code, name }),
    });
  },

  getByCode(code: string) {
    return apiRequest<{ session: any; quiz: any }>(`/couple-sessions/${code}`, { auth: false });
  },

  listForQuiz(quizId: string) {
    return apiRequest<{ sessions: any[] }>(`/quizzes/${quizId}/couple-sessions`);
  },
};
