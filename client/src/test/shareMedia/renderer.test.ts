import { describe, expect, it } from 'vitest';
import { SHARE_FIXTURES, TEST_LABELS } from '@/lib/shareMedia/fixtures';
import { getFormat, type FormatId } from '@/lib/shareMedia/formats';
import { drawFrame, drawStill } from '@/lib/shareMedia/render';
import { parseGradient, SPARKLE } from '@/lib/shareMedia/paint/background';
import { buildTimeline, segmentAt, type MediaKind } from '@/lib/shareMedia/timeline';
import { toShareQuiz, type ShareQuiz } from '@/lib/shareMedia/types';
import { createRecordingContext, type TextCall } from './recordingContext';

const DECORATIONS = new Set([SPARKLE, '✦']);
const TOLERANCE = 2;

function contentTexts(texts: TextCall[]) {
  return texts.filter((call) => !DECORATIONS.has(call.text) && call.alpha > 0);
}

/** Times worth checking: early, mid-animation and settled moments of every segment. */
function sampleTimes(kind: MediaKind, questions: number) {
  const timeline = buildTimeline(kind, questions);
  return timeline.segments.flatMap((segment) => [0.05, 0.4, 0.9, segment.duration - 0.05].map((offset) => segment.start + offset));
}

function renderAll(quiz: ShareQuiz, formatId: FormatId) {
  const format = getFormat(formatId);
  const frames: Array<{ label: string; texts: TextCall[] }> = [];
  for (const kind of ['poster', 'carousel'] as MediaKind[]) {
    for (const segment of buildTimeline(kind, quiz.questions.length).segments) {
      const { ctx, texts } = createRecordingContext();
      drawStill(ctx, quiz, segment, format);
      frames.push({ label: `${kind}:${segment.type}`, texts });
    }
  }
  for (const kind of ['gif', 'video'] as MediaKind[]) {
    const timeline = buildTimeline(kind, quiz.questions.length);
    for (const t of sampleTimes(kind, quiz.questions.length)) {
      const { ctx, texts } = createRecordingContext();
      drawFrame(ctx, quiz, timeline, t, format);
      frames.push({ label: `${kind}@${t.toFixed(2)}:${segmentAt(timeline, t).segment.type}`, texts });
    }
  }
  return { format, frames };
}

describe('toShareQuiz', () => {
  const payload = {
    quiz: { id: 'quiz-1', title: 'About us', appearance: { theme: 'mint', style: 'minimal' }, draft_token: 'secret-draft', user_id: 'owner-1' },
    questions: [{
      id: 'q1', question_text: 'Favorite dinner?', emoji: '🍕', category: 'Food', choices: ['Sushi', 'Pizza', 'Pho', 'Tacos'],
      correct_answers: ['Pizza'], distractor_answers: ['Sushi', 'Pho', 'Tacos'], is_custom: false,
    }],
  };

  it('copies only what the renderer needs, so answer data cannot reach an export', () => {
    const quiz = toShareQuiz(payload, { shareUrl: 'https://eou.app/s/ABC', labels: TEST_LABELS, categoryLabel: (c) => `#${c}` });
    const serialized = JSON.stringify(quiz);
    for (const secret of ['correct_answers', 'distractor_answers', 'draft_token', 'secret-draft', 'owner-1', 'is_custom']) {
      expect(serialized).not.toContain(secret);
    }
    expect(quiz.questions[0]).toEqual({ text: 'Favorite dinner?', emoji: '🍕', category: '#Food', choices: ['Sushi', 'Pizza', 'Pho', 'Tacos'] });
    expect(quiz.appearance).toEqual({ theme: 'mint', style: 'minimal' });
  });

  it('uses the edited headline, falling back to the quiz title', () => {
    const options = { shareUrl: 'u', labels: TEST_LABELS, categoryLabel: (c: string) => c };
    expect(toShareQuiz(payload, { ...options, hero: '  Guess me!  ' }).hero).toBe('Guess me!');
    expect(toShareQuiz(payload, { ...options, hero: '   ' }).hero).toBe('About us');
  });
});

describe('timeline', () => {
  it.each([1, 5, 10])('video shows every question once in %i-question quizzes', (count) => {
    const timeline = buildTimeline('video', count);
    expect(timeline.duration).toBeCloseTo(2.5 + 3 * count + 3);
    expect(timeline.fps).toBe(30);
    const shown = timeline.segments.flatMap((s) => (s.type === 'question' ? [s.index] : []));
    expect(shown).toEqual(Array.from({ length: count }, (_, i) => i));
  });

  it.each([5, 6, 8, 10])('GIF samples two questions and flashes the other %i − 2', (count) => {
    const timeline = buildTimeline('gif', count);
    expect(timeline.segments.map((s) => s.type)).toEqual(['hook', 'question', 'question', 'montage', 'cta']);
    const montage = timeline.segments.find((s) => s.type === 'montage');
    expect(montage?.type === 'montage' && montage.indexes).toEqual(Array.from({ length: count - 2 }, (_, i) => i + 2));
    expect(timeline.duration).toBeCloseTo(1.5 + 6 + 2 + 1.5);
  });

  it('skips the montage when there is nothing left to flash', () => {
    expect(buildTimeline('gif', 2).segments.map((s) => s.type)).toEqual(['hook', 'question', 'question', 'cta']);
  });

  it('makes one poster and a carousel of a cover plus one card per question', () => {
    expect(buildTimeline('poster', 7).segments).toHaveLength(1);
    const carousel = buildTimeline('carousel', 7).segments;
    expect(carousel.map((s) => s.type)).toEqual(['cover', ...Array(7).fill('card')]);
  });

  it('finds the playing segment at boundaries and clamps past the end', () => {
    const timeline = buildTimeline('video', 3);
    expect(segmentAt(timeline, 0).segment.type).toBe('hook');
    expect(segmentAt(timeline, 2.5)).toMatchObject({ segment: { type: 'question', index: 0 }, local: 0 });
    expect(segmentAt(timeline, 999).segment.type).toBe('cta');
  });
});

describe('layout', () => {
  it.each(SHARE_FIXTURES.flatMap((fixture) => (['square', 'story'] as FormatId[]).map((format) => [fixture.id, format] as const)))(
    'keeps all text of %s inside the %s safe zone',
    (fixtureId, formatId) => {
      const quiz = SHARE_FIXTURES.find((f) => f.id === fixtureId)!.quiz;
      const { format, frames } = renderAll(quiz, formatId);
      const { safe } = format;
      for (const frame of frames) {
        for (const { text, box } of contentTexts(frame.texts)) {
          const where = `${frame.label} "${text}"`;
          expect(box.left, where).toBeGreaterThanOrEqual(safe.x - TOLERANCE);
          expect(box.right, where).toBeLessThanOrEqual(safe.x + safe.w + TOLERANCE);
          expect(box.top, where).toBeGreaterThanOrEqual(safe.y - TOLERANCE);
          expect(box.bottom, where).toBeLessThanOrEqual(safe.y + safe.h + TOLERANCE);
        }
      }
    },
  );

  it('draws every choice the same way, never singling one out', () => {
    const quiz = SHARE_FIXTURES[0].quiz;
    const timeline = buildTimeline('video', quiz.questions.length);
    const { ctx, calls } = createRecordingContext();
    drawFrame(ctx, quiz, timeline, 2.5 + 2.9, getFormat('square'));
    const choiceFills = calls.filter((call) => call.op === 'fill' && call.fillStyle === 'rgba(255,255,255,0.65)');
    expect(choiceFills).toHaveLength(quiz.questions[0].choices.length);
    expect(new Set(calls.filter((c) => c.op === 'fill').map((c) => String(c.fillStyle)))).toEqual(new Set(['rgba(255,255,255,0.65)']));
  });

  it('shows the question, every choice and the counter once a question has settled', () => {
    const quiz = SHARE_FIXTURES[0].quiz;
    const timeline = buildTimeline('video', quiz.questions.length);
    const { ctx, texts } = createRecordingContext();
    drawFrame(ctx, quiz, timeline, 2.5 + 2.5, getFormat('story'));
    const drawn = texts.map((call) => call.text).join(' ');
    for (const choice of quiz.questions[0].choices) expect(drawn).toContain(choice);
    expect(drawn).toContain('01 / 05');
  });

  it('renders the same frame identically every time', () => {
    const quiz = SHARE_FIXTURES[1].quiz;
    const timeline = buildTimeline('video', quiz.questions.length);
    const first = createRecordingContext();
    const second = createRecordingContext();
    drawFrame(first.ctx, quiz, timeline, 7.3, getFormat('story'));
    drawFrame(second.ctx, quiz, timeline, 7.3, getFormat('story'));
    // Gradient objects hold fresh closures, so compare the serialized call log.
    expect(JSON.stringify(second.calls)).toBe(JSON.stringify(first.calls));
  });

  it('opens on a fully visible headline, so the first frame works as a thumbnail', () => {
    const quiz = SHARE_FIXTURES[0].quiz;
    const { ctx, texts } = createRecordingContext();
    drawFrame(ctx, quiz, buildTimeline('video', 5), 0, getFormat('story'));
    const hero = texts.filter((call) => quiz.hero.includes(call.text));
    expect(hero.length).toBeGreaterThan(0);
    expect(hero.every((call) => call.alpha === 1)).toBe(true);
  });
});

describe('theme gradients', () => {
  it('parses angle and stop positions from the CSS used by the app', () => {
    expect(parseGradient('linear-gradient(145deg, #f0e8ff, #d9c5f4 60%, #efcde3)')).toEqual({
      angle: 145,
      stops: [{ color: '#f0e8ff', at: 0 }, { color: '#d9c5f4', at: 0.6 }, { color: '#efcde3', at: 1 }],
    });
  });
});
