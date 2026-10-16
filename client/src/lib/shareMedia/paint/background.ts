import type { ShareFormat } from '../formats';
import { withAlpha, type Look } from './look';
import { cssFont, type Ctx } from './text';

/** U+2733 with a text-presentation selector, so it isn't drawn as a colour emoji. */
export const SPARKLE = '\u2733\uFE0E';

export type GradientStop = { color: string; at: number };

/** Parses the theme gradients in quizAppearance.ts, e.g. `linear-gradient(145deg, #f0e8ff, #d9c5f4 60%, #efcde3)`. */
export function parseGradient(css: string): { angle: number; stops: GradientStop[] } {
  const match = css.match(/linear-gradient\(\s*([-\d.]+)deg\s*,(.+)\)\s*$/);
  if (!match) return { angle: 180, stops: [{ color: '#ffffff', at: 0 }, { color: '#ffffff', at: 1 }] };
  const parts = match[2].split(',').map((part) => part.trim());
  const stops = parts.map((part, index) => {
    const [color, position] = part.split(/\s+/);
    const at = position?.endsWith('%') ? parseFloat(position) / 100 : index / Math.max(1, parts.length - 1);
    return { color, at };
  });
  return { angle: parseFloat(match[1]), stops };
}

/** Same geometry as a CSS linear-gradient: 0deg points up, angles turn clockwise. */
function fillCssGradient(ctx: Ctx, css: string, width: number, height: number) {
  const { angle, stops } = parseGradient(css);
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const gradient = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  for (const stop of stops) gradient.addColorStop(stop.at, stop.color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function ring(ctx: Ctx, x: number, y: number, radius: number, lineWidth: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function glyph(ctx: Ctx, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = cssFont({ family: 'sans-serif', weight: 400 }, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** Theme gradient plus the style's decorations, drifting gently with `t` (seconds). */
export function paintBackground(ctx: Ctx, format: ShareFormat, look: Look, t: number) {
  const { width: w, height: h } = format;
  const unit = Math.min(w, h);
  const drift = Math.sin(t * 0.9) * unit * 0.012;
  fillCssGradient(ctx, look.gradient, w, h);

  if (look.styleId === 'playful') {
    ring(ctx, w - unit * 0.08, unit * 0.08 + drift, unit * 0.2, unit * 0.05, 'rgba(255,255,255,0.2)');
    ring(ctx, unit * 0.06, h - unit * 0.06 - drift, unit * 0.24, Math.max(1, unit * 0.003), withAlpha(look.ink, 0.1));
    // Sparkles live in the side margins so they never sit on top of text.
    const { safe } = format;
    const sparkle = Math.min(unit * 0.06, safe.x * 0.9);
    glyph(ctx, SPARKLE, w - safe.x / 2, safe.y + safe.h * 0.3 - drift, sparkle, withAlpha(look.ink, 0.3));
    glyph(ctx, '✦', safe.x / 2, safe.y + safe.h * 0.42 + drift, sparkle * 0.7, withAlpha(look.ink, 0.3));
  } else if (look.styleId === 'editorial') {
    const inset = unit * 0.035;
    ctx.lineWidth = Math.max(1, unit * 0.002);
    ctx.strokeStyle = withAlpha(look.ink, 0.16);
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    ctx.strokeStyle = withAlpha(look.ink, 0.08);
    ctx.strokeRect(inset * 1.3, inset * 1.3, w - inset * 2.6, h - inset * 2.6);
  }
}
