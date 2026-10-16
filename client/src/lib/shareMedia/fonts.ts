import { exportFonts, getLook } from './paint/look';
import { cssFont, graphemes } from './paint/text';
import type { ShareQuiz } from './types';

/** Every distinct character an export of this quiz will draw. */
export function exportCharacters(quiz: ShareQuiz) {
  const { labels } = quiz;
  const text = [
    quiz.hero, quiz.title, quiz.shareUrl, labels.eyebrow, labels.ctaTitle, labels.ctaSubtitle, labels.posterFooter,
    labels.questionCount(quiz.questions.length), labels.more(quiz.questions.length), labels.counter(10, 10), 'eou.✳0123456789ABCD',
    ...quiz.questions.flatMap((q) => [q.text, q.category, ...q.choices]),
  ].join(' ');
  return Array.from(new Set(graphemes(text))).join('');
}

/**
 * Google Fonts ships Vietnamese glyphs as a separate file that only downloads once the page
 * uses them, and drawing on a canvas doesn't trigger that. Load the exact characters first.
 */
export async function ensureExportFonts(quiz: ShareQuiz) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = exportCharacters(quiz);
  const look = getLook(quiz.appearance);
  await Promise.all(exportFonts(look).map((font) => document.fonts.load(cssFont(font, 48), sample).catch(() => [])));
}
