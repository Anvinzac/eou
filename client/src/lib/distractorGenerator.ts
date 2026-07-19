/**
 * Generates confusing distractors from a correct answer.
 * Supports both English and Vietnamese.
 */

const ANTONYMS_EN: Record<string, string> = {
  yes: 'no', no: 'yes', true: 'false', false: 'true',
  always: 'never', never: 'always', more: 'less', less: 'more',
  before: 'after', after: 'before', first: 'last', last: 'first',
  big: 'small', small: 'big', fast: 'slow', slow: 'fast',
  hot: 'cold', cold: 'hot', good: 'bad', bad: 'good',
  up: 'down', down: 'up', left: 'right', right: 'left',
  old: 'new', new: 'old', happy: 'sad', sad: 'happy',
  love: 'hate', hate: 'love', strong: 'weak', weak: 'strong',
};

const ANTONYMS_VI: Record<string, string> = {
  'đúng': 'sai', 'sai': 'đúng',
  'có': 'không', 'không': 'có',
  'luôn': 'không bao giờ', 'không bao giờ': 'luôn',
  'nhiều': 'ít', 'ít': 'nhiều',
  'trước': 'sau', 'sau': 'trước',
  'đầu tiên': 'cuối cùng', 'cuối cùng': 'đầu tiên',
  'lớn': 'nhỏ', 'nhỏ': 'lớn',
  'nhanh': 'chậm', 'chậm': 'nhanh',
  'nóng': 'lạnh', 'lạnh': 'nóng',
  'tốt': 'xấu', 'xấu': 'tốt',
  'trên': 'dưới', 'dưới': 'trên',
  'trái': 'phải', 'phải': 'trái',
  'cũ': 'mới', 'mới': 'cũ',
  'vui': 'buồn', 'buồn': 'vui',
  'yêu': 'ghét', 'ghét': 'yêu',
  'mạnh': 'yếu', 'yếu': 'mạnh',
  'cao': 'thấp', 'thấp': 'cao',
  'dài': 'ngắn', 'ngắn': 'dài',
  'rộng': 'hẹp', 'hẹp': 'rộng',
  'sáng': 'tối', 'tối': 'sáng',
  'giàu': 'nghèo', 'nghèo': 'giàu',
  'đẹp': 'xấu xí', 'xấu xí': 'đẹp',
  'khó': 'dễ', 'dễ': 'khó',
  'nặng': 'nhẹ', 'nhẹ': 'nặng',
  'già': 'trẻ', 'trẻ': 'già',
  'đầy': 'trống', 'trống': 'đầy',
  'gần': 'xa', 'xa': 'gần',
  'sớm': 'muộn', 'muộn': 'sớm',
  'thắng': 'thua', 'thua': 'thắng',
  'bắt đầu': 'kết thúc', 'kết thúc': 'bắt đầu',
};

const FILLER_WORDS_EN = ['actually', 'basically', 'mostly', 'sometimes', 'usually', 'perhaps', 'rarely', 'often'];
const FILLER_WORDS_VI = ['thực ra', 'cơ bản là', 'phần lớn', 'đôi khi', 'thường', 'có lẽ', 'hiếm khi', 'hay'];

const NEGATIONS_EN = ['not', 'never', "don't", "doesn't", "isn't", "aren't", "won't"];
const NEGATIONS_VI = ['không', 'không phải', 'chưa', 'chẳng', 'không bao giờ', 'chưa bao giờ'];

const SIMILAR_VI: Record<string, string[]> = {
  'một': ['hai', 'ba', 'bốn'],
  'hai': ['một', 'ba', 'bốn'],
  'ba': ['hai', 'bốn', 'năm'],
  'bốn': ['ba', 'năm', 'sáu'],
  'năm': ['bốn', 'sáu', 'bảy'],
  'sáu': ['năm', 'bảy', 'tám'],
  'bảy': ['sáu', 'tám', 'chín'],
  'tám': ['bảy', 'chín', 'mười'],
  'chín': ['tám', 'mười', 'bảy'],
  'mười': ['chín', 'mười một', 'tám'],
  'thứ nhất': ['thứ hai', 'thứ ba'],
  'thứ hai': ['thứ nhất', 'thứ ba'],
  'thứ ba': ['thứ hai', 'thứ tư'],
};

/** Detect if text is likely Vietnamese */
function isVietnamese(text: string): boolean {
  const viChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  const viWords = ['là', 'của', 'và', 'có', 'được', 'trong', 'không', 'này', 'cho', 'với', 'các', 'một', 'những', 'đã', 'từ', 'để', 'theo', 'về', 'tại', 'khi'];
  const lower = text.toLowerCase();
  if (viChars.test(text)) return true;
  const words = lower.split(/\s+/);
  return words.some(w => viWords.includes(w));
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── English strategies ──

function antonymSwapEN(answer: string): string | null {
  const words = answer.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const lower = words[i].toLowerCase().replace(/[^a-zA-Z]/g, '');
    if (ANTONYMS_EN[lower]) {
      const replaced = [...words];
      replaced[i] = ANTONYMS_EN[lower];
      return replaced.join(' ');
    }
  }
  return null;
}

function negationFlipEN(answer: string): string {
  const lower = answer.toLowerCase();
  for (const neg of NEGATIONS_EN) {
    if (lower.includes(neg)) {
      return answer.replace(new RegExp(neg + '\\s*', 'i'), '');
    }
  }
  const words = answer.split(/\s+/);
  if (words.length >= 2) { words.splice(1, 0, 'not'); return words.join(' '); }
  return 'Not ' + answer.charAt(0).toLowerCase() + answer.slice(1);
}

function rephraseEN(answer: string): string {
  const prefixes = ['Approximately ', 'Around ', 'About ', 'Nearly ', 'Almost '];
  const suffixes = [' (approximately)', ' or so', ' in total', ', more or less'];
  if (Math.random() > 0.5) {
    return prefixes[Math.floor(Math.random() * prefixes.length)] + answer.charAt(0).toLowerCase() + answer.slice(1);
  }
  return answer + suffixes[Math.floor(Math.random() * suffixes.length)];
}

// ── Vietnamese strategies ──

function antonymSwapVI(answer: string): string | null {
  const lower = answer.toLowerCase();
  // Try multi-word antonyms first (longer keys first)
  const sorted = Object.keys(ANTONYMS_VI).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (lower.includes(key)) {
      return answer.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ANTONYMS_VI[key]);
    }
  }
  return null;
}

function negationFlipVI(answer: string): string {
  const lower = answer.toLowerCase();
  // Try removing negation (longer phrases first)
  const sorted = [...NEGATIONS_VI].sort((a, b) => b.length - a.length);
  for (const neg of sorted) {
    if (lower.includes(neg)) {
      return answer.replace(new RegExp(neg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').trim();
    }
  }
  // Add negation
  return 'Không ' + answer.charAt(0).toLowerCase() + answer.slice(1);
}

function similarWordSwapVI(answer: string): string | null {
  const words = answer.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const lower = words[i].toLowerCase();
    if (SIMILAR_VI[lower]) {
      const alts = SIMILAR_VI[lower];
      const replaced = [...words];
      replaced[i] = alts[Math.floor(Math.random() * alts.length)];
      return replaced.join(' ');
    }
  }
  return null;
}

function rephraseVI(answer: string): string {
  const prefixes = ['Khoảng ', 'Gần ', 'Chừng ', 'Tầm ', 'Xấp xỉ '];
  const suffixes = [' (xấp xỉ)', ' hoặc hơn', ' tổng cộng', ', ít nhiều'];
  if (Math.random() > 0.5) {
    return prefixes[Math.floor(Math.random() * prefixes.length)] + answer.charAt(0).toLowerCase() + answer.slice(1);
  }
  return answer + suffixes[Math.floor(Math.random() * suffixes.length)];
}

function fillerInsertVI(answer: string): string {
  const filler = FILLER_WORDS_VI[Math.floor(Math.random() * FILLER_WORDS_VI.length)];
  const words = answer.split(/\s+/);
  if (words.length >= 2) {
    const pos = Math.floor(Math.random() * (words.length - 1)) + 1;
    words.splice(pos, 0, filler);
    return words.join(' ');
  }
  return filler + ' ' + answer.charAt(0).toLowerCase() + answer.slice(1);
}

// ── Shared strategies ──

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

function wordShuffle(answer: string): string | null {
  const words = answer.split(/\s+/);
  if (words.length < 3) return null;
  const shuffled = shuffleArray(words);
  const result = shuffled.join(' ');
  if (result.toLowerCase() === answer.toLowerCase()) return null;
  return result;
}

function partialAnswer(answer: string): string | null {
  const words = answer.split(/\s+/);
  if (words.length >= 3) {
    const cutPoint = Math.max(1, Math.floor(words.length * 0.6));
    return words.slice(0, cutPoint).join(' ');
  }
  return null;
}

function fillerInsertEN(answer: string): string {
  const filler = FILLER_WORDS_EN[Math.floor(Math.random() * FILLER_WORDS_EN.length)];
  const words = answer.split(/\s+/);
  if (words.length >= 2) {
    const pos = Math.floor(Math.random() * (words.length - 1)) + 1;
    words.splice(pos, 0, filler);
    return words.join(' ');
  }
  return filler + ' ' + answer.charAt(0).toLowerCase() + answer.slice(1);
}

/**
 * Generate `count` confusing distractors for the given correct answer.
 * Auto-detects Vietnamese vs English.
 */
export function generateDistractors(correctAnswer: string, count = 3): string[] {
  const vi = isVietnamese(correctAnswer);

  const strategies = vi
    ? [
        () => antonymSwapVI(correctAnswer),
        () => negationFlipVI(correctAnswer),
        () => numberTweak(correctAnswer),
        () => wordShuffle(correctAnswer),
        () => fillerInsertVI(correctAnswer),
        () => partialAnswer(correctAnswer),
        () => rephraseVI(correctAnswer),
        () => similarWordSwapVI(correctAnswer),
      ]
    : [
        () => antonymSwapEN(correctAnswer),
        () => negationFlipEN(correctAnswer),
        () => numberTweak(correctAnswer),
        () => wordShuffle(correctAnswer),
        () => fillerInsertEN(correctAnswer),
        () => partialAnswer(correctAnswer),
        () => rephraseEN(correctAnswer),
      ];

  const results = new Set<string>();
  const shuffledStrategies = shuffleArray(strategies);

  for (const strategy of shuffledStrategies) {
    if (results.size >= count) break;
    const result = strategy();
    if (result && result.toLowerCase().trim() !== correctAnswer.toLowerCase().trim()) {
      results.add(result);
    }
  }

  let attempts = 0;
  while (results.size < count && attempts < 10) {
    attempts++;
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    const result = strategy();
    if (result && result.toLowerCase().trim() !== correctAnswer.toLowerCase().trim() && !results.has(result)) {
      results.add(result);
    }
    if (results.size < count) {
      const fallback = vi
        ? `Không phải ${correctAnswer.charAt(0).toLowerCase()}${correctAnswer.slice(1)}`
        : `Not ${correctAnswer.charAt(0).toLowerCase()}${correctAnswer.slice(1)}`;
      if (!results.has(fallback)) results.add(fallback);
    }
    if (results.size < count) {
      const fallback2 = vi ? `${correctAnswer} (không chính xác)` : `${correctAnswer} (incorrect)`;
      if (!results.has(fallback2)) results.add(fallback2);
    }
    if (results.size < count) {
      const fallback3 = vi ? 'Không có đáp án nào ở trên' : 'None of the above';
      if (!results.has(fallback3)) results.add(fallback3);
    }
  }

  return Array.from(results).slice(0, count);
}
