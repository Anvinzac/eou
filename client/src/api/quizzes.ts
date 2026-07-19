import { apiRequest } from './client';

export type QuizQuestionInput = {
  questionId: number;
  category: string;
  text: string;
  orderNumber: number;
  correctAnswer?: string;
  distractors?: string[];
  isCustom?: boolean;
};

export const quizzesApi = {
  create(title: string, questions: QuizQuestionInput[]) {
    return apiRequest<{ quiz: { id: string }; questions: unknown[] }>('/quizzes', {
      method: 'POST',
      body: JSON.stringify({ title, questions }),
    });
  },

  createDraft(title: string, questions: QuizQuestionInput[]) {
    return apiRequest<{ quiz: { id: string }; draftToken: string }>('/quizzes/drafts', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ title, questions }),
    });
  },

  listMine() {
    return apiRequest<{ quizzes: any[] }>('/quizzes/mine');
  },

  getTake(id: string) {
    return apiRequest<{
      quiz: any;
      questions: Array<{
        id: string;
        category: string;
        question_text: string;
        order_number: number;
        choices: string[];
        distractor_answers: string[];
      }>;
    }>(`/quizzes/${id}`, { auth: false });
  },

  patch(id: string, patch: { title?: string; is_open?: boolean }) {
    return apiRequest<{ quiz: any }>(`/quizzes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  createVersus(category: string, difficulty: string) {
    return apiRequest<{ quiz: any; invitation: any }>('/quizzes/versus', {
      method: 'POST',
      body: JSON.stringify({ category, difficulty }),
    });
  },
};
