import { resolveQuizAppearance, type QuizAppearance } from '@/lib/quizAppearance';

export type ShareQuestion = {
  text: string;
  emoji: string;
  /** Already-translated category label. */
  category: string;
  choices: string[];
};

/** Localized strings the renderer needs; it never calls i18n itself. */
export type ShareLabels = {
  eyebrow: string;
  questionCount: (count: number) => string;
  counter: (current: number, total: number) => string;
  more: (count: number) => string;
  ctaTitle: string;
  ctaSubtitle: string;
  posterFooter: string;
};

/** Everything a share image, GIF or video can show. Deliberately has no answer fields. */
export type ShareQuiz = {
  id: string;
  title: string;
  hero: string;
  appearance: QuizAppearance;
  questions: ShareQuestion[];
  shareUrl: string;
  labels: ShareLabels;
};

type TakePayload = {
  quiz: { id: string; title: string; appearance?: unknown };
  questions: Array<{ question_text: string; emoji?: string | null; category?: string | null; choices?: string[] | null }>;
};

/**
 * Builds the renderer input from the public take payload, copying only the fields
 * it needs — so answer data can never reach an exported image or video.
 */
export function toShareQuiz(
  payload: TakePayload,
  options: { hero?: string; shareUrl: string; labels: ShareLabels; categoryLabel: (category: string) => string },
): ShareQuiz {
  const { quiz } = payload;
  const hero = options.hero?.trim() || quiz.title;
  return {
    id: quiz.id,
    title: quiz.title,
    hero,
    appearance: resolveQuizAppearance(quiz.appearance as Partial<QuizAppearance> | null),
    questions: payload.questions.map((q) => ({
      text: q.question_text,
      emoji: q.emoji || '',
      category: options.categoryLabel(q.category || ''),
      choices: [...(q.choices || [])],
    })),
    shareUrl: options.shareUrl,
    labels: options.labels,
  };
}
