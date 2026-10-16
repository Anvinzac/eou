import { getQuizStyle, getQuizTheme, type QuizAppearance } from '@/lib/quizAppearance';
import type { FontSpec } from './text';

export type Look = {
  themeId: QuizAppearance['theme'];
  styleId: QuizAppearance['style'];
  themeEmoji: string;
  gradient: string;
  ink: string;
  accent: string;
  /** Matches QuestionStage: choices sit on a translucent white card. */
  choiceFill: string;
  choiceInk: string;
  display: FontSpec;
  ui: FontSpec;
  label: FontSpec;
  brand: FontSpec;
  /** Corner radius for cards and choices, at 1080px scale. */
  radius: number;
};

const QUICKSAND = '"Quicksand", "Segoe UI", sans-serif';
const SPACE_GROTESK = '"Space Grotesk", "Segoe UI", sans-serif';
// Georgia is not available on Android, so exports ship their own serif with Vietnamese glyphs.
const LORA = '"Lora", Georgia, serif';

const DISPLAY_FONTS: Record<QuizAppearance['style'], FontSpec> = {
  playful: { family: QUICKSAND, weight: 700 },
  editorial: { family: LORA, weight: 500, italic: true },
  minimal: { family: SPACE_GROTESK, weight: 700 },
};

export function getLook(appearance: QuizAppearance): Look {
  const theme = getQuizTheme(appearance);
  const style = getQuizStyle(appearance);
  return {
    themeId: theme.id,
    styleId: style.id,
    themeEmoji: theme.emoji,
    gradient: theme.gradient,
    ink: theme.ink,
    accent: theme.accent,
    choiceFill: 'rgba(255,255,255,0.65)',
    choiceInk: theme.id === 'midnight' ? '#302e52' : theme.ink,
    display: DISPLAY_FONTS[style.id],
    ui: { family: QUICKSAND, weight: 600 },
    label: { family: QUICKSAND, weight: 700 },
    brand: { family: SPACE_GROTESK, weight: 700 },
    radius: style.id === 'minimal' ? 18 : 32,
  };
}

/** Every font a share export draws with, for preloading. */
export function exportFonts(look: Look): FontSpec[] {
  return [look.display, look.ui, look.label, look.brand];
}

/** `#rrggbb` → `rgba(r,g,b,a)`. */
export function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
