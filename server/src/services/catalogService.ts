import { createRequire } from 'module';

const require = createRequire(import.meta.url);
type PreferenceQuestion = { id: number; category: string; text: string; options: string[] };
const qna = require('../data/qna.json') as { version: string; questions: PreferenceQuestion[] };
const qnaVi = require('../data/qna.vi.json') as { version: string; questions: PreferenceQuestion[] };
const canonicalCategories = new Map(qna.questions.map(question => [question.id, question.category]));
const academic = require('../data/academic.json') as {
  version: string;
  questions: Array<{
    id: number;
    category: string;
    difficulty: string;
    text: string;
    options: string[];
    correctAnswer: string;
  }>;
};

export const CatalogService = {
  getPreferenceQuestions(locale?: string) {
    if (locale?.toLowerCase().startsWith('vi')) {
      // Category identifiers stay stable; only display labels are translated by the client.
      return {
        ...qnaVi,
        questions: qnaVi.questions.map(question => ({
          ...question,
          category: canonicalCategories.get(question.id) ?? question.category,
        })),
      };
    }
    return qna;
  },

  getAcademicQuestions(filters?: { category?: string; difficulty?: string }) {
    let questions = academic.questions;
    if (filters?.category) {
      questions = questions.filter((q) => q.category === filters.category);
    }
    if (filters?.difficulty) {
      questions = questions.filter((q) => q.difficulty === filters.difficulty);
    }
    return { ...academic, questions };
  },

  previewVersus(category: string) {
    const pool = academic.questions.filter((q) => q.category === category);
    const pick = (difficulty: string) =>
      pool.filter((q) => q.difficulty === difficulty).sort(() => Math.random() - 0.5)[0];
    return [pick('Easy'), pick('Medium'), pick('Hard')].filter(Boolean);
  },
};
