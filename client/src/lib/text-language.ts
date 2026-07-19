// Text layout / language helpers for kinetic typography.
// Ported verbatim from KineMedia (self-contained, no external deps).

export const DEFAULT_TEXT_PAGE_WORD_LIMIT = 7;
export const VIETNAMESE_TEXT_PAGE_WORD_LIMIT = 10;

export type WordLine = {
  indentEm: number;
  segments: WordSegment[];
};

export type WordSegment = {
  key: string;
  words: Array<{ text: string; index: number }>;
};

const VIETNAMESE_LINE_INDENT_EM = [0, 0.22, 0.38, 0.5] as const;
const VIETNAMESE_MAX_LINE_CHARS = 9;
const VIETNAMESE_AVG_CHAR_WIDTH_EM = 0.58;
const VIETNAMESE_LINE_SIDE_PAD_EM = 0.12;
const VIETNAMESE_MIN_FIT_SCALE = 0.52;
const VIETNAMESE_MAX_CONSECUTIVE_SOLO_LINES = 3;
const VIETNAMESE_PAIR_RELAX_CHARS = 3;
const VIETNAMESE_PAIR_FORCE_CHARS = 6;
const VIETNAMESE_BOUND_PHRASES = [
  "ý tưởng",
  "y tuong",
  "lạnh lẽo",
  "lanh leo",
  "thông tin",
  "thong tin",
  "rõ ràng",
  "ro rang",
  "rơi nhịp",
  "roi nhip",
  "luận điểm",
  "luan diem",
  "hình ảnh",
  "hinh anh",
  "người đọc",
  "nguoi doc",
  "nội dung",
  "noi dung",
  "cảm xúc",
  "cam xuc",
  "khoảng thở",
  "khoang tho",
  "màn hình",
  "man hinh",
  "bài thử",
  "bai thu",
  "Hà Nội",
  "ha noi",
  "buổi sáng",
  "buoi sang",
  "hơi sương",
  "hoi suong",
  "Ao thu",
  "ao thu",
  "trong veo",
  "thuyền câu",
  "thuyen cau",
  "tẻo teo",
  "teo teo",
  "sóng biếc",
  "song biec",
  "lá vàng",
  "la vang",
  "tầng mây",
  "tang may",
  "xanh ngắt",
  "xanh ngat",
  "ngõ trúc",
  "ngo truc",
  "tựa gối",
  "tua goi",
  "im lặng",
  "im lang",
] as const;
const VIETNAMESE_POETIC_EMPHASIS_PHRASES = [
  "lơ lửng",
  "lo lung",
  "tẻo teo",
  "teo teo",
  "lạnh lẽo",
  "lanh leo",
  "trong veo",
  "sóng biếc",
  "song biec",
  "hơi gợn",
  "hoi gon",
  "lá vàng",
  "la vang",
  "khẽ đưa",
  "khe dua",
  "xanh ngắt",
  "xanh ngat",
  "vắng teo",
  "vang teo",
  "chân bèo",
  "chan beo",
  "hơi sương",
  "hoi suong",
  "khoảng thở",
  "khoang tho",
  "cảm xúc",
  "cam xuc",
] as const;
const VIETNAMESE_BOUND_PHRASE_KEYS = VIETNAMESE_BOUND_PHRASES.map((phrase) =>
  phrase.split(/\s+/).map(normalizeVietnameseToken),
);
const VIETNAMESE_POETIC_EMPHASIS_KEYS = VIETNAMESE_POETIC_EMPHASIS_PHRASES.map((phrase) =>
  phrase.split(/\s+/).map(normalizeVietnameseToken),
);
const LONGEST_VIETNAMESE_BOUND_PHRASE = Math.max(
  ...VIETNAMESE_BOUND_PHRASE_KEYS.map((phrase) => phrase.length),
);

export function getTextPageWordLimit(text: string) {
  return isLikelyVietnameseText(text)
    ? VIETNAMESE_TEXT_PAGE_WORD_LIMIT
    : DEFAULT_TEXT_PAGE_WORD_LIMIT;
}

export function isLikelyVietnameseText(text: string) {
  if (
    /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(text) ||
    /[\u0300\u0301\u0303\u0309\u0323]/.test(text.normalize("NFD"))
  ) {
    return true;
  }

  const tokens = text.match(/\S+/g)?.map(normalizeVietnameseToken) ?? [];
  return VIETNAMESE_BOUND_PHRASE_KEYS.some((phrase) =>
    tokens.some(
      (_, index) =>
        index + phrase.length <= tokens.length &&
        phrase.every((token, phraseIndex) => token === tokens[index + phraseIndex]),
    ),
  );
}

export function getVietnameseCanvasInnerWidth(canvasWidthPx: number) {
  return Math.max(200, canvasWidthPx * 0.92 - 32);
}

export function getVietnameseCharBudgetForLine(
  lineIndex: number,
  canvasInnerWidthPx: number,
  fontSizePx: number,
) {
  const indentEm = getVietnameseLineIndentEm(lineIndex);
  const availablePx =
    canvasInnerWidthPx -
    indentEm * fontSizePx -
    fontSizePx * VIETNAMESE_LINE_SIDE_PAD_EM;
  const charWidthPx = Math.max(fontSizePx * VIETNAMESE_AVG_CHAR_WIDTH_EM, 1);
  return Math.max(4, Math.floor(availablePx / charWidthPx));
}

export type VietnameseLineLayoutOptions = {
  getLineCapacity?: (lineIndex: number) => number;
};

export type VietnameseLayoutMetrics = {
  lines: WordLine[];
  suggestedFitScale: number;
};

export function getVietnameseLayoutMetrics(
  words: string[],
  canvasWidthPx: number,
  fontSizePx: number,
  visualScaleGuard = 1,
): VietnameseLayoutMetrics {
  const innerWidth = getVietnameseCanvasInnerWidth(canvasWidthPx);
  const getLineCapacity = (lineIndex: number) =>
    getVietnameseCharBudgetForLine(lineIndex, innerWidth, fontSizePx);
  const lines = getVietnameseWordLines(words, { getLineCapacity });
  let suggestedFitScale = 1;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const visibleChars =
      line.segments.reduce((total, segment) => total + getSegmentVisibleLength(segment), 0) +
      Math.max(0, line.segments.length - 1);
    const capacity = getLineCapacity(lineIndex);
    const neededChars = visibleChars * Math.max(visualScaleGuard, 1);
    if (neededChars > capacity) {
      suggestedFitScale = Math.min(suggestedFitScale, (capacity / neededChars) * 0.96);
    }
  }

  return {
    lines,
    suggestedFitScale: Math.max(VIETNAMESE_MIN_FIT_SCALE, suggestedFitScale),
  };
}

export function getVietnameseWordLines(
  words: string[],
  options?: VietnameseLineLayoutOptions,
): WordLine[] {
  if (words.length === 0) return [];

  const segments = getVietnameseWordSegments(words);
  const lines: WordLine[] = [];
  let index = 0;
  let consecutiveSolo = 0;

  while (index < segments.length) {
    const capacity =
      options?.getLineCapacity?.(lines.length) ?? getVietnameseLineCapacity(lines.length);
    const forcePair = consecutiveSolo >= VIETNAMESE_MAX_CONSECUTIVE_SOLO_LINES;

    const lineSegments: WordSegment[] = [];
    let lineLength = 0;
    let lineWords = 0;

    while (index < segments.length) {
      const segment = segments[index];
      const segmentLength = getSegmentVisibleLength(segment);
      const segmentWords = segment.words.length;
      const projected = lineLength + (lineSegments.length > 0 ? 1 : 0) + segmentLength;

      if (lineSegments.length === 0) {
        lineSegments.push(segment);
        lineLength = segmentLength;
        lineWords = segmentWords;
        index += 1;
        continue;
      }

      if (projected <= capacity) {
        lineSegments.push(segment);
        lineLength = projected;
        lineWords += segmentWords;
        index += 1;
        continue;
      }

      if (lineWords === 1) {
        const reach = capacity + (forcePair ? VIETNAMESE_PAIR_FORCE_CHARS : VIETNAMESE_PAIR_RELAX_CHARS);
        if (forcePair || projected <= reach) {
          lineSegments.push(segment);
          lineLength = projected;
          lineWords += segmentWords;
          index += 1;
        }
      }
      break;
    }

    lines.push({
      indentEm: getVietnameseLineIndentEm(lines.length),
      segments: lineSegments,
    });
    consecutiveSolo = lineWords === 1 ? consecutiveSolo + 1 : 0;
  }

  return lines;
}

export function getSpecialPoeticWordIndexes(words: string[]) {
  const selected = new Set<number>();
  const normalizedWords = words.map(normalizeVietnameseToken);

  for (const phrase of VIETNAMESE_POETIC_EMPHASIS_KEYS) {
    for (let index = 0; index + phrase.length <= normalizedWords.length; index += 1) {
      if (phrase.every((token, offset) => token === normalizedWords[index + offset])) {
        for (let offset = 0; offset < phrase.length; offset += 1) {
          selected.add(index + offset);
        }
        return selected;
      }
    }
  }

  return selected;
}

export function expandEmphasisToBoundPhrases(words: string[], selected: Iterable<number>) {
  const expanded = new Set<number>();

  for (const index of selected) {
    let matchedPhrase = false;
    for (let start = 0; start <= index; start += 1) {
      const length = getBoundPhraseLength(words, start);
      if (length > 1 && start <= index && index < start + length) {
        for (let offset = 0; offset < length; offset += 1) {
          expanded.add(start + offset);
        }
        matchedPhrase = true;
        break;
      }
    }
    if (!matchedPhrase) expanded.add(index);
  }

  return expanded;
}

export function getBoundPhraseStartIndex(words: string[], index: number) {
  for (let start = 0; start <= index; start += 1) {
    const length = getBoundPhraseLength(words, start);
    if (length > 1 && start <= index && index < start + length) {
      return start;
    }
  }
  return index;
}

export function getBoundPhraseEmphasisSeed(words: string[], index: number) {
  const start = getBoundPhraseStartIndex(words, index);
  const length = getBoundPhraseLength(words, start);
  if (length > 1) {
    return words.slice(start, start + length).join(" ");
  }
  return words[index] ?? "";
}

function getVietnameseWordSegments(words: string[]): WordSegment[] {
  const segments: WordSegment[] = [];

  for (let index = 0; index < words.length; ) {
    const phraseLength = getBoundPhraseLength(words, index);
    const segmentWords = words.slice(index, index + phraseLength).map((text, offset) => ({
      text,
      index: index + offset,
    }));

    segments.push({
      key: segmentWords.map((word) => `${word.index}-${word.text}`).join("|"),
      words: segmentWords,
    });
    index += phraseLength;
  }

  return segments;
}

function getBoundPhraseLength(words: string[], startIndex: number) {
  const remaining = words.length - startIndex;
  const maxLength = Math.min(LONGEST_VIETNAMESE_BOUND_PHRASE, remaining);

  for (let length = maxLength; length > 1; length -= 1) {
    const candidate = words.slice(startIndex, startIndex + length).map(normalizeVietnameseToken);

    if (
      VIETNAMESE_BOUND_PHRASE_KEYS.some(
        (phrase) =>
          phrase.length === length && phrase.every((token, index) => token === candidate[index]),
      )
    ) {
      return length;
    }
  }

  return 1;
}

function getVietnameseLineIndentEm(lineIndex: number) {
  return VIETNAMESE_LINE_INDENT_EM[Math.min(lineIndex, VIETNAMESE_LINE_INDENT_EM.length - 1)];
}

function getVietnameseLineCapacity(lineIndex: number) {
  const step = Math.min(lineIndex, VIETNAMESE_LINE_INDENT_EM.length - 1);
  const indentEm = getVietnameseLineIndentEm(lineIndex);
  const indentCharCost = Math.round(indentEm * 4.8);
  return Math.max(4, VIETNAMESE_MAX_LINE_CHARS - step - indentCharCost);
}

function getVisibleWordLength(word: string) {
  return Array.from(word.normalize("NFC")).length;
}

function getSegmentVisibleLength(segment: WordSegment) {
  return segment.words.reduce(
    (total, word, index) => total + getVisibleWordLength(word.text) + (index > 0 ? 1 : 0),
    0,
  );
}

function normalizeVietnameseToken(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (letter) => (letter === "Đ" ? "D" : "d"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
