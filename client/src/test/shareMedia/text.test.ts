import { describe, expect, it } from 'vitest';
import { fitText, graphemes, wrapLines } from '@/lib/shareMedia/paint/text';
import { slugify } from '@/lib/shareMedia/share';
import { createRecordingContext } from './recordingContext';

const font = { family: 'Quicksand', weight: 600 };

describe('text layout', () => {
  it('keeps Vietnamese letters with stacked marks and emoji sequences whole', () => {
    expect(graphemes('Người ấy')).toEqual(['N', 'g', 'ư', 'ờ', 'i', ' ', 'ấ', 'y']);
    expect(graphemes('👩‍❤️‍👨!')).toEqual(['👩‍❤️‍👨', '!']);
  });

  it('wraps on spaces and breaks words that are wider than a line', () => {
    const { ctx } = createRecordingContext();
    ctx.font = '600 20px Quicksand';
    const text = 'Người ấy thích làm gì nhất Supercalifragilisticexpialidocious';
    const lines = wrapLines(ctx, text, 120);
    for (const line of lines) expect(ctx.measureText(line).width).toBeLessThanOrEqual(120);
    expect(lines.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
    expect(lines.length).toBeGreaterThan(3);
  });

  it('picks the largest size that fits the box and line limit', () => {
    const { ctx } = createRecordingContext();
    const fitted = fitText(ctx, 'How well do you know me?', { font, maxSize: 120, minSize: 20, maxLines: 2, lineHeight: 1.2, width: 600, height: 300 });
    expect(fitted.lines.length).toBeLessThanOrEqual(2);
    expect(fitted.height).toBeLessThanOrEqual(300);
    const bigger = fitText(ctx, 'How well do you know me?', { font, maxSize: fitted.size + 1, minSize: fitted.size + 1, maxLines: 2, lineHeight: 1.2, width: 600, height: 300 });
    expect(bigger.lines.length > 2 || bigger.height > 300 || bigger.lines.at(-1)!.endsWith('…')).toBe(true);
  });

  it('truncates with an ellipsis when even the smallest size does not fit', () => {
    const { ctx } = createRecordingContext();
    const long = 'Người ấy thích làm gì nhất lúc rảnh rỗi '.repeat(10);
    const fitted = fitText(ctx, long, { font, maxSize: 40, minSize: 30, maxLines: 2, lineHeight: 1.2, width: 300, height: 1000 });
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.lines[1].endsWith('…')).toBe(true);
    expect(ctx.measureText(fitted.lines[1]).width).toBeLessThanOrEqual(300);
  });
});

describe('file names', () => {
  it('turns Vietnamese titles into ASCII slugs', () => {
    expect(slugify('Bạn hiểu mình đến đâu?')).toBe('ban-hieu-minh-den-dau');
    expect(slugify('💖💖')).toBe('quiz');
  });
});
