export type FormatId = 'square' | 'story' | 'link';

export type Rect = { x: number; y: number; w: number; h: number };

export type ShareFormat = {
  id: FormatId;
  width: number;
  height: number;
  /** Where text and calls to action may go. */
  safe: Rect;
};

// Story margins follow Meta's guidance: keep 14% top, 35% bottom and 6% per side
// clear of text, where the app's own UI sits on top of the story.
const MARGINS: Record<FormatId, { top: number; bottom: number; side: number }> = {
  square: { top: 0.07, bottom: 0.07, side: 0.07 },
  story: { top: 0.14, bottom: 0.35, side: 0.06 },
  link: { top: 0.08, bottom: 0.08, side: 0.06 },
};

const SIZES: Record<FormatId, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  link: { width: 1200, height: 630 },
};

/** Video encoders need even dimensions. */
function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

export function getFormat(id: FormatId, scale = 1): ShareFormat {
  const width = even(SIZES[id].width * scale);
  const height = even(SIZES[id].height * scale);
  const margin = MARGINS[id];
  const x = Math.round(width * margin.side);
  const y = Math.round(height * margin.top);
  return {
    id,
    width,
    height,
    safe: { x, y, w: width - 2 * x, h: Math.round(height * (1 - margin.top - margin.bottom)) },
  };
}

export function insetRect(rect: Rect, dx: number, dy = dx): Rect {
  return { x: rect.x + dx, y: rect.y + dy, w: rect.w - 2 * dx, h: rect.h - 2 * dy };
}
