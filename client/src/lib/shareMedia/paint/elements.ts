import { create as createQr } from 'qrcode';
import type { Rect } from '../formats';
import { SPARKLE } from './background';
import { withAlpha, type Look } from './look';
import { cssFont, drawLabel, drawLines, fitText, type Ctx } from './text';

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawEmoji(ctx: Ctx, emoji: string, cx: number, cy: number, size: number) {
  ctx.font = cssFont({ family: 'sans-serif', weight: 400 }, size);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy);
}

/** "✳ eou." wordmark, as on the landing page. */
export function drawBrand(ctx: Ctx, look: Look, cx: number, cy: number, size: number, align: 'center' | 'left' = 'center') {
  ctx.font = cssFont(look.brand, size);
  ctx.textBaseline = 'middle';
  const mark = `${SPARKLE} `;
  const word = 'eou';
  const markWidth = ctx.measureText(mark).width;
  const wordWidth = ctx.measureText(word).width;
  const dotWidth = ctx.measureText('.').width;
  let x = align === 'center' ? cx - (markWidth + wordWidth + dotWidth) / 2 : cx;
  ctx.textAlign = 'left';
  ctx.fillStyle = look.accent;
  ctx.fillText(mark, x, cy);
  x += markWidth;
  ctx.fillStyle = look.ink;
  ctx.fillText(word, x, cy);
  x += wordWidth;
  ctx.fillStyle = look.accent;
  ctx.fillText('.', x, cy);
}

/** Category on the left, "03 / 10" pill on the right — the QuestionStage header. */
export function drawQuestionHeader(ctx: Ctx, look: Look, area: Rect, category: string, counter: string, s: number) {
  const size = 27 * s;
  const cy = area.y + 28 * s;
  ctx.font = cssFont(look.label, size);
  const pillText = counter;
  const pillWidth = ctx.measureText(pillText).width + 48 * s;
  const pillHeight = 56 * s;
  drawLabel(ctx, category, look.label, size, {
    x: area.x, y: cy, align: 'left', color: look.ink, tracking: 0.16, maxWidth: area.w - pillWidth - 24 * s,
  });
  roundRect(ctx, area.x + area.w - pillWidth, cy - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
  ctx.lineWidth = 2 * s;
  ctx.strokeStyle = withAlpha(look.ink, 0.25);
  ctx.stroke();
  ctx.font = cssFont(look.label, size);
  ctx.fillStyle = look.ink;
  ctx.textAlign = 'center';
  ctx.fillText(pillText, area.x + area.w - pillWidth / 2, cy);
}

/** One answer option: translucent card, lettered badge, wrapped text. Never marks a correct answer. */
export function drawChoice(ctx: Ctx, look: Look, rect: Rect, letter: string, text: string, s: number) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, look.radius * s * 0.8);
  ctx.fillStyle = look.choiceFill;
  ctx.fill();

  const badgeRadius = Math.min(24 * s, rect.h * 0.3);
  const badgeX = rect.x + 28 * s + badgeRadius;
  const cy = rect.y + rect.h / 2;
  ctx.beginPath();
  ctx.arc(badgeX, cy, badgeRadius, 0, Math.PI * 2);
  ctx.lineWidth = 2 * s;
  ctx.strokeStyle = withAlpha(look.choiceInk, 0.25);
  ctx.stroke();
  ctx.font = cssFont(look.label, badgeRadius * 0.95);
  ctx.fillStyle = look.choiceInk;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, badgeX, cy);

  const textX = badgeX + badgeRadius + 22 * s;
  const textWidth = rect.x + rect.w - 28 * s - textX;
  const fitted = fitText(ctx, text, {
    font: look.ui, maxSize: 38 * s, minSize: 24 * s, maxLines: 2, lineHeight: 1.2, width: textWidth, height: rect.h - 16 * s,
  });
  drawLines(ctx, fitted, look.ui, { x: textX, y: cy - fitted.height / 2, width: textWidth, align: 'left', color: look.choiceInk });
}

/** A rounded pill with centred text, e.g. "+8 more questions". */
export function drawPill(ctx: Ctx, look: Look, text: string, cx: number, cy: number, size: number, s: number) {
  ctx.font = cssFont(look.label, size);
  const width = ctx.measureText(text).width + 56 * s;
  const height = size * 2.2;
  roundRect(ctx, cx - width / 2, cy - height / 2, width, height, height / 2);
  ctx.fillStyle = look.ink;
  ctx.fill();
  ctx.fillStyle = look.themeId === 'midnight' ? '#302e52' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

const qrCache = new Map<string, { size: number; data: Uint8Array }>();

function qrModules(text: string) {
  let modules = qrCache.get(text);
  if (!modules) {
    const qr = createQr(text, { errorCorrectionLevel: 'M' });
    modules = { size: qr.modules.size, data: qr.modules.data };
    qrCache.set(text, modules);
  }
  return modules;
}

/** QR code on a white rounded tile; `size` is the tile's edge length. */
export function drawQr(ctx: Ctx, look: Look, text: string, x: number, y: number, size: number, s: number) {
  roundRect(ctx, x, y, size, size, 28 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const modules = qrModules(text);
  const quiet = 2;
  const cell = size / (modules.size + quiet * 2);
  ctx.fillStyle = look.themeId === 'midnight' ? '#252640' : look.ink;
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.data[row * modules.size + col]) {
        // Slight overlap avoids hairline gaps between modules after anti-aliasing.
        ctx.fillRect(x + (col + quiet) * cell, y + (row + quiet) * cell, cell + 0.5, cell + 0.5);
      }
    }
  }
}

export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
