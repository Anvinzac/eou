import { apiRequest } from './client';

export const distractorsApi = {
  generate(answer: string, opts?: { questionText?: string; category?: string; count?: number }) {
    return apiRequest<{ distractors: string[]; source: 'llm' | 'fallback' }>('/distractors/generate', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({
        answer,
        questionText: opts?.questionText || '',
        category: opts?.category || '',
        count: opts?.count ?? 3,
      }),
    });
  },
};
