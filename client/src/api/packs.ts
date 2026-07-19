import { apiRequest } from './client';

export const packsApi = {
  list() {
    return apiRequest<{ packs: any[] }>('/question-packs');
  },

  listMine() {
    return apiRequest<{ packs: any[] }>('/question-packs/mine');
  },

  create(body: {
    title: string;
    description?: string;
    emoji?: string;
    questions: Array<{ text: string; category?: string; options?: string[] }>;
  }) {
    return apiRequest<{ pack: any }>('/question-packs', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  update(
    id: string,
    body: {
      title: string;
      description?: string;
      emoji?: string;
      questions: Array<{ text: string; category?: string; options?: string[] }>;
    },
  ) {
    return apiRequest<{ pack: any }>(`/question-packs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  remove(id: string) {
    return apiRequest<void>(`/question-packs/${id}`, { method: 'DELETE' });
  },
};
