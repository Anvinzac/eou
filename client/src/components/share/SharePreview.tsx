import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getFormat, type FormatId } from '@/lib/shareMedia/formats';
import { drawFrame, drawStill } from '@/lib/shareMedia/render';
import { buildTimeline, type MediaKind } from '@/lib/shareMedia/timeline';
import type { ShareQuiz } from '@/lib/shareMedia/types';

// Half resolution is plenty for an on-screen preview and keeps animation smooth on phones.
const PREVIEW_SCALE = 0.5;

type Props = {
  quiz: ShareQuiz;
  kind: MediaKind;
  aspect: FormatId;
  /** Carousel page to show. */
  page: number;
  /** Bumped when fonts finish loading, to redraw with them. */
  fontsVersion: number;
};

/** Draws exactly what will be exported, using the same renderer. */
export function SharePreview({ quiz, kind, aspect, page, fontsVersion }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const format = getFormat(aspect, PREVIEW_SCALE);
    canvas.width = format.width;
    canvas.height = format.height;
    const timeline = buildTimeline(kind, quiz.questions.length);

    if (kind === 'poster' || kind === 'carousel') {
      drawStill(ctx, quiz, timeline.segments[Math.min(page, timeline.segments.length - 1)], format);
      return;
    }
    if (reduceMotion) {
      // A settled first question says the most about the animation in one frame.
      drawFrame(ctx, quiz, timeline, timeline.segments[1].start + timeline.segments[1].duration - 0.3, format);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      drawFrame(ctx, quiz, timeline, ((now - started) / 1000) % timeline.duration, format);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [quiz, kind, aspect, page, fontsVersion, reduceMotion]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={t('share_media.preview_label')}
      className={`mx-auto block h-auto rounded-2xl shadow-soft ${aspect === 'story' ? 'max-h-[52vh] w-auto max-w-full' : 'w-full max-w-[22rem]'}`}
    />
  );
}
