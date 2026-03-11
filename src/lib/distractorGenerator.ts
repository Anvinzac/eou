/**
 * Generates confusing distractors from a correct answer.
 * Uses multiple strategies to create plausible-but-wrong alternatives.
 */

const ANTONYMS: Record<string, string> = {
  yes: 'no', no: 'yes', true: 'false', false: 'true',
  always: 'never', never: 'always', more: 'less', less: 'more',
  before: 'after', after: 'before', first: 'last', last: 'first',
  big: 'small', small: 'big', fast: 'slow', slow: 'fast',
  hot: 'cold', cold: 'hot', good: 'bad', bad: 'good',
  up: 'down', down: 'up', left: 'right', right: 'left',
  old: 'new', new: 'old', happy: 'sad', sad: 'happy',
  love: 'hate', hate: 'love', strong: 'weak', weak: 'strong',
};

const FILLER_WORDS = ['actually', 'basically', 'mostly', 'sometimes', 'usually', 'perhaps', 'rarely', 'often'];
const NEGATIONS = ['not', 'never', "don't", "doesn't", "isn't", "aren't", "won't"];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Strategy 1: Swap a word with its antonym */
function antonymSwap(answer: string): string | null {
  const words = answer.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const lower = words[i].toLowerCase().replace(/[^a-zA-Z]/g, '');
    if (ANTONYMS[lower]) {
      const replaced = [...words];
      replaced[i] = ANTONYMS[lower];
      return replaced.join(' ');
    }
  }
  return null;
}

/** Strategy 2: Add or remove negation */
function negationFlip(answer: string): string {
  const lower = answer.toLowerCase();
  for (const neg of NEGATIONS) {
    if (lower.includes(neg)) {
      return answer.replace(new RegExp(neg + '\\s*', 'i'), '');
    }
  }
  const words = answer.split(/\s+/);
  if (words.length >= 2) {
    words.splice(1, 0, 'not');
    return words.join(' ');
  }
  return 'Not ' + answer.charAt(0).toLowerCase() + answer.slice(1);
}

/** Strategy 3: Modify numbers */
function numberTweak(answer: string): string | null {
  const numMatch = answer.match(/\d+/);
  if (!numMatch) return null;
  const num = parseInt(numMatch[0]);
  const offsets = [1, -1, 2, -2, 5, -5, 10, -10];
  const offset = offsets[Math.floor(Math.random() * offsets.length)];
  const newNum = Math.max(0, num + offset);
  if (newNum === num) return null;
  return answer.replace(numMatch[0], String(newNum));
}

/** Strategy 4: Rearrange words */
function wordShuffle(answer: string): string | null {
  const words = answer.split(/\s+/);
  if (words.length < 3) return null;
  const shuffled = shuffleArray(words);
  const result = shuffled.join(' ');
  if (result.toLowerCase() === answer.toLowerCase()) return null;
  return result;
}

/** Strategy 5: Replace with a filler variation */
function fillerInsert(answer: string): string {
  const filler = FILLER_WORDS[Math.floor(Math.random() * FILLER_WORDS.length)];
  const words = answer.split(/\s+/);
  if (words.length >= 2) {
    const pos = Math.floor(Math.random() * (words.length - 1)) + 1;
    words.splice(pos, 0, filler);
    return words.join(' ');
  }
  return filler + ' ' + answer.charAt(0).toLowerCase() + answer.slice(1);
}

/** Strategy 6: Partial answer (truncate or extend) */
function partialAnswer(answer: string): string | null {
  const words = answer.split(/\s+/);
  if (words.length >= 3) {
    const cutPoint = Math.max(1, Math.floor(words.length * 0.6));
    return words.slice(0, cutPoint).join(' ');
  }
  return null;
}

/** Strategy 7: Similar but different phrasing */
function rephrase(answer: string): string {
  const prefixes = ['Approximately ', 'Around ', 'About ', 'Nearly ', 'Almost '];
  const suffixes = [' (approximately)', ' or so', ' in total', ', more or less'];
  if (Math.random() > 0.5) {
    return prefixes[Math.floor(Math.random() * prefixes.length)] +
      answer.charAt(0).toLowerCase() + answer.slice(1);
  }
  return answer + suffixes[Math.floor(Math.random() * suffixes.length)];
}

/**
 * Generate `count` confusing distractors for the given correct answer.
 */
export function generateDistractors(correctAnswer: string, count = 3): string[] {
  const strategies = [
    () => antonymSwap(correctAnswer),
    () => negationFlip(correctAnswer),
    () => numberTweak(correctAnswer),
    () => wordShuffle(correctAnswer),
    () => fillerInsert(correctAnswer),
    () => partialAnswer(correctAnswer),
    () => rephrase(correctAnswer),
  ];

  const results = new Set<string>();
  const shuffledStrategies = shuffleArray(strategies);

  // Try each strategy
  for (const strategy of shuffledStrategies) {
    if (results.size >= count) break;
    const result = strategy();
    if (result && result.toLowerCase().trim() !== correctAnswer.toLowerCase().trim()) {
      results.add(result);
    }
  }

  // If still not enough, apply strategies again with slight variations
  let attempts = 0;
  while (results.size < count && attempts < 10) {
    attempts++;
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    const result = strategy();
    if (result && result.toLowerCase().trim() !== correctAnswer.toLowerCase().trim() && !results.has(result)) {
      results.add(result);
    }
    // Fallback: prefix with "Not"
    if (results.size < count) {
      const fallback = `Not ${correctAnswer.charAt(0).toLowerCase()}${correctAnswer.slice(1)}`;
      if (!results.has(fallback)) results.add(fallback);
    }
    if (results.size < count) {
      const fallback2 = `${correctAnswer} (incorrect)`;
      if (!results.has(fallback2)) results.add(fallback2);
    }
    if (results.size < count) {
      const fallback3 = `None of the above`;
      if (!results.has(fallback3)) results.add(fallback3);
    }
  }

  return Array.from(results).slice(0, count);
}
