export type MediaKind = 'poster' | 'carousel' | 'gif' | 'video';

export type Segment =
  | { type: 'hook'; start: number; duration: number }
  | { type: 'question'; start: number; duration: number; index: number }
  | { type: 'montage'; start: number; duration: number; indexes: number[] }
  | { type: 'cta'; start: number; duration: number }
  | { type: 'poster'; start: number; duration: number }
  | { type: 'cover'; start: number; duration: number }
  | { type: 'card'; start: number; duration: number; index: number };

export type Timeline = {
  kind: MediaKind;
  /** 0 for still images. */
  fps: number;
  duration: number;
  segments: Segment[];
};

export const VIDEO_FPS = 30;
// GIF delays are stored in hundredths of a second, so 80 ms frames keep timing exact.
export const GIF_FRAME_MS = 80;

const VIDEO = { hook: 2.5, question: 3, cta: 3 };
const GIF = { hook: 1.5, question: 3, montage: 2, cta: 1.5, samples: 2 };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type SegmentInput = DistributiveOmit<Segment, 'start'>;

function sequence(parts: SegmentInput[]): { segments: Segment[]; duration: number } {
  let start = 0;
  const segments = parts.map((part) => {
    const segment = { ...part, start } as Segment;
    start += part.duration;
    return segment;
  });
  return { segments, duration: start };
}

export function buildTimeline(kind: MediaKind, questionCount: number): Timeline {
  const indexes = Array.from({ length: questionCount }, (_, i) => i);

  if (kind === 'poster') {
    return { kind, fps: 0, duration: 0, segments: [{ type: 'poster', start: 0, duration: 0 }] };
  }

  if (kind === 'carousel') {
    const segments: Segment[] = [
      { type: 'cover', start: 0, duration: 0 },
      ...indexes.map((index) => ({ type: 'card' as const, start: 0, duration: 0, index })),
    ];
    return { kind, fps: 0, duration: 0, segments };
  }

  if (kind === 'gif') {
    const samples = indexes.slice(0, GIF.samples);
    const rest = indexes.slice(GIF.samples);
    const { segments, duration } = sequence([
      { type: 'hook', duration: GIF.hook },
      ...samples.map((index) => ({ type: 'question' as const, duration: GIF.question, index })),
      ...(rest.length ? [{ type: 'montage' as const, duration: GIF.montage, indexes: rest }] : []),
      { type: 'cta', duration: GIF.cta },
    ]);
    return { kind, fps: 1000 / GIF_FRAME_MS, duration, segments };
  }

  const { segments, duration } = sequence([
    { type: 'hook', duration: VIDEO.hook },
    ...indexes.map((index) => ({ type: 'question' as const, duration: VIDEO.question, index })),
    { type: 'cta', duration: VIDEO.cta },
  ]);
  return { kind, fps: VIDEO_FPS, duration, segments };
}

/** The segment playing at time `t`, and how far into it we are. */
export function segmentAt(timeline: Timeline, t: number): { segment: Segment; local: number } {
  const { segments } = timeline;
  for (const segment of segments) {
    if (t < segment.start + segment.duration) return { segment, local: Math.max(0, t - segment.start) };
  }
  const last = segments[segments.length - 1];
  return { segment: last, local: last.duration };
}

export function frameCount(timeline: Timeline) {
  return Math.max(1, Math.round(timeline.duration * timeline.fps));
}
