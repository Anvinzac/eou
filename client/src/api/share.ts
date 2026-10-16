import { apiRequest } from './client';

export const shareApi = {
  /** The quiz's short link (e.g. https://…/s/K7Q2XPA), created on first use. Owner only. */
  createLink(quizId: string) {
    return apiRequest<{ code: string; url: string }>(`/quizzes/${quizId}/share-link`, { method: 'POST' });
  },
};
