import { apiRequest } from './client';

export const catalogApi = {
  preferenceQuestions(locale?: string) {
    const q = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    return apiRequest<{ questions: any[] }>(`/catalog/preference-questions${q}`, { auth: false });
  },

  academicQuestions(filters?: { category?: string; difficulty?: string }) {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.difficulty) params.set('difficulty', filters.difficulty);
    const q = params.toString() ? `?${params}` : '';
    return apiRequest<{ questions: any[] }>(`/catalog/academic-questions${q}`, { auth: false });
  },

  versusPreview(category: string) {
    return apiRequest<{ questions: any[] }>(
      `/catalog/versus-preview?category=${encodeURIComponent(category)}`,
      { auth: false },
    );
  },
};
