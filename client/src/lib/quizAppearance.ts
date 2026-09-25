export type QuizAppearance = {
  theme: 'peach' | 'lavender' | 'mint' | 'sunshine' | 'midnight' | 'rose';
  style: 'playful' | 'editorial' | 'minimal';
};

export const DEFAULT_QUIZ_APPEARANCE: QuizAppearance = { theme: 'lavender', style: 'playful' };

export const QUIZ_THEMES = [
  { id: 'lavender', name: 'Lavender daydream', emoji: '🦋', description: 'A little dreamy', background: '#eee8fc', ink: '#40305e', accent: '#7953b6', wash: '#f7f3fc', gradient: 'linear-gradient(145deg, #f0e8ff, #d9c5f4 60%, #efcde3)' },
  { id: 'peach', name: 'Peach, please', emoji: '🍑', description: 'Warm & fuzzy', background: '#ffeadf', ink: '#713e31', accent: '#b8563c', wash: '#fff6ee', gradient: 'linear-gradient(145deg, #fff1d9, #ffcdb5 60%, #f2b8bc)' },
  { id: 'mint', name: 'Mint to be', emoji: '🌱', description: 'Fresh little energy', background: '#dfefe3', ink: '#254b3f', accent: '#317959', wash: '#f1f8ef', gradient: 'linear-gradient(145deg, #edfad6, #bce3d1 60%, #c1dfdf)' },
  { id: 'sunshine', name: 'Pocket sunshine', emoji: '🌞', description: 'Good vibes only', background: '#fff0c4', ink: '#624817', accent: '#916020', wash: '#fffbeb', gradient: 'linear-gradient(145deg, #fff6cb, #f8dc84 60%, #f7be98)' },
  { id: 'midnight', name: 'After hours', emoji: '🌙', description: 'For the deep talks', background: '#302e52', ink: '#f4edff', accent: '#d6baff', wash: '#eeedf6', gradient: 'linear-gradient(145deg, #252640, #41406a 60%, #64507f)' },
  { id: 'rose', name: 'Love letters', emoji: '💌', description: 'Straight from the heart', background: '#f9e1e8', ink: '#74354f', accent: '#a3476e', wash: '#fff4f7', gradient: 'linear-gradient(145deg, #ffe9f0, #f3bfd3 60%, #e5c3e7)' },
] as const;

export const QUIZ_STYLES = [
  { id: 'playful', name: 'Playful', sample: 'Hey, you!', description: 'Bouncy & bubbly', font: 'Quicksand, sans-serif' },
  { id: 'editorial', name: 'Storybook', sample: 'Dear you.', description: 'A personal little story', font: 'Georgia, serif' },
  { id: 'minimal', name: 'Keep it simple', sample: 'Just us.', description: 'Clean & calm', font: 'Space Grotesk, sans-serif' },
] as const;

export const QUESTION_EMOJIS = [
  ['💖', 'Sparkling heart'], ['🦋', 'Butterfly'], ['🌷', 'Tulip'], ['🍓', 'Strawberry'],
  ['🧸', 'Teddy bear'], ['✨', 'Sparkles'], ['🥹', 'Touched face'], ['🐱', 'Cat'],
  ['🌈', 'Rainbow'], ['🍒', 'Cherries'], ['🪩', 'Disco ball'], ['🌙', 'Moon'],
  ['🍕', 'Pizza'], ['🎧', 'Headphones'], ['✈️', 'Airplane'], ['☕', 'Coffee'],
  ['🌱', 'Seedling'], ['🎬', 'Movie'], ['💌', 'Love letter'], ['🎮', 'Game controller'],
  ['🐶', 'Puppy'], ['🌞', 'Sun'], ['💭', 'Thought bubble'], ['🎀', 'Ribbon'],
] as const;

export function resolveQuizAppearance(value?: Partial<QuizAppearance> | null): QuizAppearance {
  return {
    theme: QUIZ_THEMES.find(theme => theme.id === value?.theme)?.id ?? DEFAULT_QUIZ_APPEARANCE.theme,
    style: QUIZ_STYLES.find(style => style.id === value?.style)?.id ?? DEFAULT_QUIZ_APPEARANCE.style,
  };
}

export function getQuizTheme(value?: Partial<QuizAppearance> | null) {
  return QUIZ_THEMES.find(theme => theme.id === resolveQuizAppearance(value).theme)!;
}

export function getQuizStyle(value?: Partial<QuizAppearance> | null) {
  return QUIZ_STYLES.find(style => style.id === resolveQuizAppearance(value).style)!;
}
