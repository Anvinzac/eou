import { graphemes } from '@/lib/shareMedia/paint/text';

type Matrix = [number, number, number, number, number, number];

type State = {
  font: string;
  fillStyle: unknown;
  strokeStyle: unknown;
  globalAlpha: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  lineWidth: number;
  letterSpacing: string;
  matrix: Matrix;
};

export type TextCall = {
  text: string;
  font: string;
  fillStyle: unknown;
  alpha: number;
  /** Approximate bounds in canvas pixels, after transforms. */
  box: { left: number; right: number; top: number; bottom: number };
};

export type RecordedCall = { op: string; args: unknown[]; fillStyle: unknown; alpha: number };

/** Glyph width as a fraction of font size; a deliberately generous estimate. */
const CHAR_WIDTH = 0.55;

function fontSize(font: string) {
  const match = font.match(/([\d.]+)px/);
  return match ? parseFloat(match[1]) : 10;
}

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/**
 * A minimal CanvasRenderingContext2D stand-in (jsdom has no canvas) that records every call,
 * measures text with a fixed per-character width, and tracks transforms so text bounds
 * can be checked against the frame and the story safe zone.
 */
export function createRecordingContext() {
  let state: State = {
    font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, textAlign: 'start',
    textBaseline: 'alphabetic', lineWidth: 1, letterSpacing: '0px', matrix: [1, 0, 0, 1, 0, 0],
  };
  const stack: State[] = [];
  const calls: RecordedCall[] = [];
  const texts: TextCall[] = [];
  const record = (op: string, args: unknown[]) => calls.push({ op, args, fillStyle: state.fillStyle, alpha: state.globalAlpha });
  const measure = (text: string) => graphemes(text).length * fontSize(state.font) * CHAR_WIDTH;

  const ctx = {
    get font() { return state.font; },
    set font(value: string) { state.font = value; },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(value: unknown) { state.fillStyle = value; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(value: unknown) { state.strokeStyle = value; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(value: number) { state.globalAlpha = value; },
    get textAlign() { return state.textAlign; },
    set textAlign(value: CanvasTextAlign) { state.textAlign = value; },
    get textBaseline() { return state.textBaseline; },
    set textBaseline(value: CanvasTextBaseline) { state.textBaseline = value; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(value: number) { state.lineWidth = value; },
    get letterSpacing() { return state.letterSpacing; },
    set letterSpacing(value: string) { state.letterSpacing = value; },
    save() { stack.push({ ...state, matrix: [...state.matrix] as Matrix }); },
    restore() { if (stack.length) state = stack.pop()!; },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { state.matrix = [a, b, c, d, e, f]; },
    translate(x: number, y: number) { state.matrix = multiply(state.matrix, [1, 0, 0, 1, x, y]); },
    scale(x: number, y: number) { state.matrix = multiply(state.matrix, [x, 0, 0, y, 0, 0]); },
    measureText(text: string) { return { width: measure(text) } as TextMetrics; },
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      record('fillText', [text, x, y]);
      const width = Math.min(measure(text), maxWidth ?? Infinity);
      const size = fontSize(state.font);
      const align = state.textAlign;
      const left = align === 'center' ? x - width / 2 : align === 'right' || align === 'end' ? x - width : x;
      const [a, , , d, e, f] = state.matrix;
      texts.push({
        text, font: state.font, fillStyle: state.fillStyle, alpha: state.globalAlpha,
        box: { left: a * left + e, right: a * (left + width) + e, top: d * (y - size / 2) + f, bottom: d * (y + size / 2) + f },
      });
    },
    createLinearGradient(...args: number[]) {
      record('createLinearGradient', args);
      return { addColorStop: (...stop: unknown[]) => record('addColorStop', stop) };
    },
  } as Record<string, unknown>;

  for (const op of ['fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'closePath', 'fill', 'stroke', 'clearRect']) {
    ctx[op] = (...args: unknown[]) => record(op, args);
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, texts };
}
