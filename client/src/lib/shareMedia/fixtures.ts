import enCatalog from '@/data/qna.json';
import viCatalog from '@/data/qna.vi.json';
import type { QuizAppearance } from '@/lib/quizAppearance';
import type { ShareLabels, ShareQuiz } from './types';

/** Plain English labels for tests; the app builds real ones with buildShareLabels(t). */
export const TEST_LABELS: ShareLabels = {
  eyebrow: 'A little quiz about me',
  questionCount: (count) => `${count} questions · How many can you get?`,
  counter: (current, total) => `${String(current).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
  more: (count) => `+${count} more questions`,
  ctaTitle: 'Think you know me?',
  ctaSubtitle: 'Scan to take the quiz',
  posterFooter: 'Play at',
};

const EMOJIS = ['🍓', '🎧', '', '✈️', '🧸', '☕', '', '🌙', '🎬', '💌'];

function fromCatalog(
  catalog: { questions: Array<{ text: string; category: string; options: string[] }> },
  start: number,
  count: number,
  extraLong = false,
) {
  return catalog.questions.slice(start, start + count).map((q, i) => ({
    text: extraLong && i % 3 === 0 ? `${q.text} ${q.text}` : q.text,
    emoji: EMOJIS[i % EMOJIS.length],
    category: q.category,
    choices: q.options.slice(0, 4).map((option, j) => (extraLong && j === 3 ? `${option} — ${q.options[4] ?? option}` : option)),
  }));
}

export type ShareFixture = { id: string; name: string; quiz: ShareQuiz };

function fixture(id: string, name: string, appearance: QuizAppearance, hero: string, questions: ShareQuiz['questions']): ShareFixture {
  return {
    id,
    name,
    quiz: {
      id: `fixture-${id}`,
      title: hero,
      hero,
      appearance,
      questions,
      shareUrl: 'https://eou.app/s/K7Q2XPA',
      labels: TEST_LABELS,
    },
  };
}

export const SHARE_FIXTURES: ShareFixture[] = [
  fixture('en-short', 'English, 5 questions', { theme: 'lavender', style: 'playful' }, 'How well do you know me?', fromCatalog(enCatalog, 0, 5)),
  fixture('vi-long', 'Vietnamese, 10 long questions', { theme: 'rose', style: 'editorial' }, 'Bạn hiểu mình đến đâu? Thử xem nào, người thương ơi!', fromCatalog(viCatalog, 20, 10, true)),
  fixture('vi-ten', 'Vietnamese, 10 questions', { theme: 'midnight', style: 'minimal' }, 'Bạn hiểu mình đến đâu?', fromCatalog(viCatalog, 40, 10)),
];
