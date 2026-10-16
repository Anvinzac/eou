import type { ShareFormat } from './formats';
import { paintBackground } from './paint/background';
import { getLook } from './paint/look';
import { paintSegment, type Scene } from './paint/scenes';
import type { Ctx } from './paint/text';
import { segmentAt, type Segment, type Timeline } from './timeline';
import type { ShareQuiz } from './types';

const FADE_IN = 0.25;
const FADE_OUT = 0.2;

function sceneFor(ctx: Ctx, quiz: ShareQuiz, format: ShareFormat): Scene {
  const area = format.safe;
  return { ctx, quiz, look: getLook(quiz.appearance), format, area, s: Math.min(area.w, area.h) / 928 };
}

/**
 * Draws the frame at time `t` (seconds). Pure and deterministic: the live preview,
 * GIF and video all call this, so what you preview is exactly what gets exported.
 */
export function drawFrame(ctx: Ctx, quiz: ShareQuiz, timeline: Timeline, t: number, format: ShareFormat) {
  const scene = sceneFor(ctx, quiz, format);
  const { segment, local } = segmentAt(timeline, t);
  const position = timeline.segments.indexOf(segment);
  // The first frame doubles as the thumbnail, so the opening never fades in; a GIF's last frame cuts back to it.
  const fadeIn = position === 0 ? 1 : local / FADE_IN;
  const fadeOut = position === timeline.segments.length - 1 ? 1 : (segment.duration - local) / FADE_OUT;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  paintBackground(ctx, format, scene.look, t);
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, Math.min(fadeIn, fadeOut)));
  paintSegment(scene, segment, local);
  ctx.restore();
}

/** Draws a still image (poster, carousel page or link card) in its settled state. */
export function drawStill(ctx: Ctx, quiz: ShareQuiz, segment: Segment, format: ShareFormat) {
  const scene = sceneFor(ctx, quiz, format);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  paintBackground(ctx, format, scene.look, 0);
  paintSegment(scene, segment, Number.POSITIVE_INFINITY);
}
