import { apiRequest } from './client';

export const attemptsApi = {
  submit(
    quizId: string,
    body: {
      answers: Record<string, string | null>;
      respondentName?: string | null;
      invitationId?: string | null;
      invitationCode?: string | null;
      coupleSessionCode?: string | null;
      coupleSlot?: 'first' | 'second' | null;
      versusFlags?: { timedOut?: boolean; cheated?: boolean };
    },
  ) {
    return apiRequest<{
      attempt: { id: string };
      coupleSession: any | null;
      redirectTo: string;
    }>(`/quizzes/${quizId}/attempts`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify(body),
    });
  },

  get(attemptId: string) {
    return apiRequest<{ attempt: any; quiz: any }>(`/attempts/${attemptId}`, { auth: false });
  },

  listForQuiz(quizId: string) {
    return apiRequest<{ attempts: any[] }>(`/quizzes/${quizId}/attempts`);
  },

  leaderboard(quizId: string) {
    return apiRequest<{ attempts: any[] }>(`/quizzes/${quizId}/leaderboard`, { auth: false });
  },
};
