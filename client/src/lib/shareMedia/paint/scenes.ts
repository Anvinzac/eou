import type { Rect, ShareFormat } from '../formats';
import type { Segment } from '../timeline';
import type { ShareQuiz } from '../types';
import { displayUrl, drawBrand, drawChoice, drawEmoji, drawPill, drawQr, drawQuestionHeader } from './elements';
import { withAlpha, type Look } from './look';
import { cssFont, drawLabel, drawLines, fitText, type Ctx, type FittedText, type FontSpec } from './text';

export type Scene = {
  ctx: Ctx;
  quiz: ShareQuiz;
  look: Look;
  format: ShareFormat;
  area: Rect;
  /** Size multiplier relative to the 1080px square layout. */
  s: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p: number) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2);

/** Eased 0→1 progress of an animation starting `delay` seconds into the segment. Still images pass Infinity. */
function progress(local: number, delay: number, duration: number) {
  return easeOutCubic(clamp01((local - delay) / duration));
}

function fadeUp(ctx: Ctx, p: number, distance: number, draw: () => void) {
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(0, distance * (1 - p));
  draw();
  ctx.restore();
}

function scaled(ctx: Ctx, scale: number, cx: number, cy: number, draw: () => void) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

function fitCentered(scene: Scene, text: string, font: FontSpec, box: Rect, sizes: { max: number; min: number; lines: number; lineHeight: number }) {
  const fitted = fitText(scene.ctx, text, {
    font, maxSize: sizes.max * scene.s, minSize: sizes.min * scene.s, maxLines: sizes.lines,
    lineHeight: sizes.lineHeight, width: box.w, height: box.h,
  });
  return { fitted, top: box.y + (box.h - fitted.height) / 2 };
}

function drawFooter(scene: Scene) {
  const { ctx, look, area, s, quiz } = scene;
  const y = area.y + area.h - 26 * s;
  drawBrand(ctx, look, area.x, y, 36 * s, 'left');
  ctx.font = cssFont(look.label, 24 * s);
  ctx.fillStyle = withAlpha(look.ink, 0.8);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayUrl(quiz.shareUrl), area.x + area.w, y, area.w * 0.6);
}

function paintHook(scene: Scene, local: number) {
  const { ctx, quiz, look, area, s } = scene;
  const cx = area.x + area.w / 2;
  const settle = 0.97 + 0.03 * progress(local, 0, 2);

  scaled(ctx, 0.6 + 0.4 * easeOutBack(clamp01(local / 0.6)), cx, area.y + 70 * s, () => {
    drawEmoji(ctx, look.themeEmoji, cx, area.y + 70 * s, 110 * s);
  });
  fadeUp(ctx, progress(local, 0.3, 0.6), 12 * s, () => {
    drawLabel(ctx, quiz.labels.eyebrow, look.label, 26 * s, {
      x: cx, y: area.y + 168 * s, align: 'center', color: withAlpha(look.ink, 0.8), tracking: 0.2, maxWidth: area.w,
    });
  });
  const box = { x: area.x, y: area.y + 210 * s, w: area.w, h: area.h - 420 * s };
  const { fitted, top } = fitCentered(scene, quiz.hero, look.display, box, { max: 124, min: 52, lines: 4, lineHeight: 1.1 });
  scaled(ctx, settle, cx, top + fitted.height / 2, () => {
    drawLines(ctx, fitted, look.display, { x: box.x, y: top, width: box.w, align: 'center', color: look.ink });
  });
  fadeUp(ctx, progress(local, 0.5, 0.6), 12 * s, () => {
    ctx.font = cssFont(look.ui, 34 * s);
    ctx.fillStyle = look.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Generic link-preview cards have no questions to count.
    if (quiz.questions.length) ctx.fillText(quiz.labels.questionCount(quiz.questions.length), cx, area.y + area.h - 140 * s, area.w);
    drawBrand(ctx, look, cx, area.y + area.h - 40 * s, 40 * s);
  });
}

function paintQuestion(scene: Scene, index: number, local: number) {
  const { ctx, quiz, look, area, s } = scene;
  const question = quiz.questions[index];
  const cx = area.x + area.w / 2;

  fadeUp(ctx, progress(local, 0, 0.3), 0, () => {
    drawQuestionHeader(ctx, look, area, question.category, quiz.labels.counter(index + 1, quiz.questions.length), s);
  });
  if (question.emoji) {
    const pop = clamp01((local - 0.1) / 0.5);
    if (pop > 0) {
      scaled(ctx, 0.6 + 0.4 * easeOutBack(pop), cx, area.y + 150 * s, () => {
        ctx.save();
        ctx.globalAlpha *= clamp01(pop * 3);
        drawEmoji(ctx, question.emoji, cx, area.y + 150 * s, 116 * s);
        ctx.restore();
      });
    }
  }

  const rowHeight = 92 * s;
  const gap = 16 * s;
  const rows = question.choices.length;
  const blockHeight = rows * rowHeight + Math.max(0, rows - 1) * gap;
  const choicesTop = area.y + area.h - blockHeight;
  const textTop = area.y + (question.emoji ? 226 : 96) * s;
  const box = { x: area.x + 20 * s, y: textTop, w: area.w - 40 * s, h: choicesTop - 32 * s - textTop };
  const { fitted, top } = fitCentered(scene, question.text, look.display, box, { max: 66, min: 30, lines: 4, lineHeight: 1.18 });
  fadeUp(ctx, progress(local, 0.2, 0.5), 24 * s, () => {
    drawLines(ctx, fitted, look.display, { x: box.x, y: top, width: box.w, align: 'center', color: look.ink });
  });

  question.choices.forEach((choice, i) => {
    const p = progress(local, 0.75 + i * 0.15, 0.35);
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha *= p;
    ctx.translate(-30 * s * (1 - p), 0);
    drawChoice(ctx, look, { x: area.x, y: choicesTop + i * (rowHeight + gap), w: area.w, h: rowHeight }, String.fromCharCode(65 + i), choice, s);
    ctx.restore();
  });
}

function paintMontage(scene: Scene, indexes: number[], local: number, duration: number) {
  const { ctx, quiz, look, area, s } = scene;
  const cx = area.x + area.w / 2;
  drawPill(ctx, look, quiz.labels.more(indexes.length), cx, area.y + 60 * s, 28 * s, s);

  const per = duration / indexes.length;
  const slot = Math.min(indexes.length - 1, Math.floor(local / per));
  const index = indexes[slot];
  const flash = clamp01((local - slot * per) / Math.min(0.08, per * 0.3));
  const box = { x: area.x + 20 * s, y: area.y + 150 * s, w: area.w - 40 * s, h: area.h - 300 * s };
  const { fitted, top } = fitCentered(scene, quiz.questions[index].text, look.display, box, { max: 76, min: 30, lines: 5, lineHeight: 1.15 });
  ctx.save();
  ctx.globalAlpha *= Number.isFinite(local) ? flash : 1;
  drawLines(ctx, fitted, look.display, { x: box.x, y: top, width: box.w, align: 'center', color: look.ink });
  drawLabel(ctx, quiz.labels.counter(index + 1, quiz.questions.length), look.label, 24 * s, {
    x: cx, y: area.y + area.h - 60 * s, align: 'center', color: withAlpha(look.ink, 0.8), tracking: 0.16,
  });
  ctx.restore();
}

function paintCta(scene: Scene, local: number) {
  const { ctx, quiz, look, area, s } = scene;
  const cx = area.x + area.w / 2;
  const titleBox = { x: area.x, y: area.y, w: area.w, h: 190 * s };
  const { fitted, top } = fitCentered(scene, quiz.labels.ctaTitle, look.display, titleBox, { max: 96, min: 44, lines: 2, lineHeight: 1.1 });
  fadeUp(ctx, progress(local, 0, 0.4), 20 * s, () => {
    drawLines(ctx, fitted, look.display, { x: titleBox.x, y: top, width: titleBox.w, align: 'center', color: look.ink });
  });

  const qrSize = Math.min(area.w * 0.46, area.h * 0.42);
  const qrTop = area.y + 220 * s;
  const pop = clamp01((local - 0.2) / 0.5);
  if (pop > 0) {
    scaled(ctx, 0.7 + 0.3 * easeOutBack(pop), cx, qrTop + qrSize / 2, () => {
      ctx.save();
      ctx.globalAlpha *= clamp01(pop * 2);
      drawQr(ctx, look, quiz.shareUrl, cx - qrSize / 2, qrTop, qrSize, s);
      ctx.restore();
    });
  }
  fadeUp(ctx, progress(local, 0.5, 0.4), 12 * s, () => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = cssFont(look.ui, 32 * s);
    ctx.fillStyle = look.ink;
    ctx.fillText(quiz.labels.ctaSubtitle, cx, qrTop + qrSize + 52 * s, area.w);
    ctx.font = cssFont(look.label, 30 * s);
    ctx.fillStyle = look.themeId === 'midnight' ? look.accent : look.ink;
    ctx.fillText(displayUrl(quiz.shareUrl), cx, qrTop + qrSize + 100 * s, area.w);
  });
  fadeUp(ctx, progress(local, 0.6, 0.4), 0, () => drawBrand(ctx, look, cx, area.y + area.h - 40 * s, 40 * s));
}

/** Every question, numbered, sized together so the longest list still fits. */
function paintPoster(scene: Scene) {
  const { ctx, quiz, look, area, s } = scene;
  const cx = area.x + area.w / 2;
  drawLabel(ctx, `${look.themeEmoji}  ${quiz.labels.eyebrow}`, look.label, 24 * s, {
    x: cx, y: area.y + 20 * s, align: 'center', color: withAlpha(look.ink, 0.8), tracking: 0.18, maxWidth: area.w,
  });
  const heroBox = { x: area.x, y: area.y + 54 * s, w: area.w, h: area.h * 0.24 };
  const hero = fitText(ctx, quiz.hero, {
    font: look.display, maxSize: 100 * s, minSize: 44 * s, maxLines: 3, lineHeight: 1.08, width: heroBox.w, height: heroBox.h,
  });
  drawLines(ctx, hero, look.display, { x: heroBox.x, y: heroBox.y + (heroBox.h - hero.height) / 2, width: heroBox.w, align: 'center', color: look.ink });

  const listTop = heroBox.y + heroBox.h + 28 * s;
  const listBottom = area.y + area.h - 80 * s;
  const numberWidth = 64 * s;
  const textWidth = area.w - numberWidth;
  const layoutAt = (size: number) => {
    const items = quiz.questions.map((q) => fitText(ctx, q.text, {
      font: look.ui, maxSize: size, minSize: size, maxLines: 2, lineHeight: 1.22, width: textWidth, height: Infinity,
    }));
    const gap = size * 0.62;
    const total = items.reduce((sum, item) => sum + item.height, 0) + gap * Math.max(0, items.length - 1);
    return { items, gap, total };
  };
  let size = 44 * s;
  let layout = layoutAt(size);
  while (layout.total > listBottom - listTop && size > 18 * s) {
    size -= 1 * s;
    layout = layoutAt(size);
  }
  let y = listTop + Math.max(0, (listBottom - listTop - layout.total) / 2);
  layout.items.forEach((item: FittedText, i) => {
    ctx.font = cssFont(look.label, size * 0.82);
    ctx.fillStyle = look.themeId === 'midnight' ? look.accent : withAlpha(look.ink, 0.55);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1).padStart(2, '0'), area.x, y + item.lineHeight / 2);
    drawLines(ctx, item, look.ui, { x: area.x + numberWidth, y, width: textWidth, align: 'left', color: look.ink });
    y += item.height + layout.gap;
  });

  const footerY = area.y + area.h - 26 * s;
  drawBrand(ctx, look, area.x, footerY, 36 * s, 'left');
  ctx.font = cssFont(look.label, 24 * s);
  ctx.fillStyle = look.ink;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${quiz.labels.posterFooter} ${displayUrl(quiz.shareUrl)}`, area.x + area.w, footerY, area.w * 0.68);
}

/** Carousel page for one question: no choices, big type. */
function paintCard(scene: Scene, index: number) {
  const { ctx, quiz, look, area, s } = scene;
  const question = quiz.questions[index];
  const cx = area.x + area.w / 2;
  drawQuestionHeader(ctx, look, area, question.category, quiz.labels.counter(index + 1, quiz.questions.length), s);
  if (question.emoji) drawEmoji(ctx, question.emoji, cx, area.y + 190 * s, 160 * s);
  const top = area.y + (question.emoji ? 300 : 110) * s;
  const box = { x: area.x + 20 * s, y: top, w: area.w - 40 * s, h: area.y + area.h - 100 * s - top };
  const { fitted, top: textTop } = fitCentered(scene, question.text, look.display, box, { max: 92, min: 40, lines: 7, lineHeight: 1.15 });
  drawLines(ctx, fitted, look.display, { x: box.x, y: textTop, width: box.w, align: 'center', color: look.ink });
  drawFooter(scene);
}

export function paintSegment(scene: Scene, segment: Segment, local: number) {
  switch (segment.type) {
    case 'hook':
    case 'cover':
      return paintHook(scene, local);
    case 'question':
      return paintQuestion(scene, segment.index, local);
    case 'montage':
      return paintMontage(scene, segment.indexes, local, segment.duration);
    case 'cta':
      return paintCta(scene, local);
    case 'poster':
      return paintPoster(scene);
    case 'card':
      return paintCard(scene, segment.index);
  }
}
