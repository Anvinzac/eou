export type Ctx = CanvasRenderingContext2D;

export type FontSpec = { family: string; weight: number; italic?: boolean };

export type FittedText = { size: number; lines: string[]; lineHeight: number; height: number };

export type FitOptions = {
  font: FontSpec;
  maxSize: number;
  minSize: number;
  maxLines: number;
  /** Line height as a multiple of the font size. */
  lineHeight: number;
  width: number;
  height: number;
};

const EMOJI_FALLBACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';

export function cssFont(font: FontSpec, size: number) {
  return `${font.italic ? 'italic ' : ''}${font.weight} ${Math.round(size * 100) / 100}px ${font.family}, ${EMOJI_FALLBACK}`;
}

type GraphemeSegmenter = { segment(text: string): Iterable<{ segment: string }> };
const Segmenter = (Intl as unknown as {
  Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => GraphemeSegmenter;
}).Segmenter;
const graphemeSegmenter = Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** Splits text into user-perceived characters, so emoji and Vietnamese diacritics stay whole. */
export function graphemes(text: string): string[] {
  return graphemeSegmenter ? Array.from(graphemeSegmenter.segment(text), (part) => part.segment) : Array.from(text);
}

/** Breaks text into lines no wider than `maxWidth`, using the context's current font. */
export function wrapLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }
    // A single word wider than the line is broken between characters.
    let piece = '';
    for (const part of graphemes(word)) {
      if (piece && ctx.measureText(piece + part).width > maxWidth) {
        lines.push(piece);
        piece = part;
      } else {
        piece += part;
      }
    }
    line = piece;
  }
  if (line) lines.push(line);
  return lines;
}

function layoutAt(ctx: Ctx, text: string, size: number, options: FitOptions): FittedText {
  ctx.font = cssFont(options.font, size);
  const lines = wrapLines(ctx, text, options.width);
  const lineHeight = size * options.lineHeight;
  return { size, lines, lineHeight, height: lines.length * lineHeight };
}

function truncate(ctx: Ctx, fitted: FittedText, options: FitOptions): FittedText {
  const maxLines = Math.max(1, Math.min(options.maxLines, Math.floor(options.height / fitted.lineHeight)));
  if (fitted.lines.length <= maxLines) return fitted;
  const lines = fitted.lines.slice(0, maxLines);
  const last = graphemes(lines[maxLines - 1]);
  while (last.length > 1 && ctx.measureText(`${last.join('')}…`).width > options.width) last.pop();
  lines[maxLines - 1] = `${last.join('').trimEnd()}…`;
  return { ...fitted, lines, height: lines.length * fitted.lineHeight };
}

/** Largest font size (within bounds) at which the text fits the box; truncates with an ellipsis as a last resort. */
export function fitText(ctx: Ctx, text: string, options: FitOptions): FittedText {
  let low = Math.floor(options.minSize);
  let high = Math.ceil(options.maxSize);
  let best: FittedText | null = null;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const attempt = layoutAt(ctx, text, mid, options);
    if (attempt.lines.length <= options.maxLines && attempt.height <= options.height) {
      best = attempt;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (best) {
    ctx.font = cssFont(options.font, best.size);
    return best;
  }
  return truncate(ctx, layoutAt(ctx, text, options.minSize, options), options);
}

export type DrawTextOptions = {
  x: number;
  y: number;
  width: number;
  align: 'left' | 'center';
  color: string;
};

/** Draws fitted lines with their top edge at `y`. */
export function drawLines(ctx: Ctx, fitted: FittedText, font: FontSpec, options: DrawTextOptions) {
  ctx.font = cssFont(font, fitted.size);
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align;
  ctx.textBaseline = 'middle';
  const x = options.align === 'center' ? options.x + options.width / 2 : options.x;
  fitted.lines.forEach((line, index) => {
    ctx.fillText(line, x, options.y + fitted.lineHeight * (index + 0.5));
  });
}

/** Small uppercase label with tracking, falling back gracefully where letterSpacing is unsupported. */
export function drawLabel(
  ctx: Ctx,
  text: string,
  font: FontSpec,
  size: number,
  options: { x: number; y: number; align: CanvasTextAlign; color: string; tracking?: number; maxWidth?: number },
) {
  ctx.font = cssFont(font, size);
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align;
  ctx.textBaseline = 'middle';
  const spaced = ctx as Ctx & { letterSpacing?: string };
  const previous = spaced.letterSpacing;
  if (options.tracking && previous !== undefined) spaced.letterSpacing = `${options.tracking * size}px`;
  ctx.fillText(text.toLocaleUpperCase(), options.x, options.y, options.maxWidth);
  if (previous !== undefined) spaced.letterSpacing = previous;
}
