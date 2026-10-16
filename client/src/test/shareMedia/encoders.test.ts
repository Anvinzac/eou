import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deltaFrame, orderedDither, startGif, writeGifFrame } from '@/lib/shareMedia/encode/gifCore';
import { SHARE_FIXTURES } from '@/lib/shareMedia/fixtures';
import { getFormat } from '@/lib/shareMedia/formats';
import { buildTimeline } from '@/lib/shareMedia/timeline';
import { createRecordingContext } from './recordingContext';

const media = vi.hoisted(() => ({
  added: [] as Array<[number, number]>,
  audio: [] as unknown[],
  finalize: vi.fn(),
  cancel: vi.fn(),
  canEncodeVideo: vi.fn(),
  canEncodeAudio: vi.fn(),
  state: 'pending',
}));

vi.mock('mediabunny', () => {
  class Output {
    target: { buffer: ArrayBuffer | null };
    constructor(options: { target: { buffer: ArrayBuffer | null } }) { this.target = options.target; }
    get state() { return media.state; }
    addVideoTrack() {}
    addAudioTrack() {}
    async start() { media.state = 'started'; }
    async finalize() { media.finalize(); media.state = 'finalized'; this.target.buffer = new ArrayBuffer(16); }
    async cancel() { media.cancel(); media.state = 'canceled'; }
  }
  return {
    Output,
    BufferTarget: class { buffer: ArrayBuffer | null = null; },
    Mp4OutputFormat: class {},
    Quality: class { constructor(public options: unknown) {} },
    CanvasSource: class { async add(timestamp: number, duration: number) { media.added.push([timestamp, duration]); } },
    AudioBufferSource: class { async add(buffer: unknown) { media.audio.push(buffer); } },
    canEncodeVideo: media.canEncodeVideo,
    canEncodeAudio: media.canEncodeAudio,
  };
});

vi.mock('@/lib/shareMedia/encode/png', () => ({
  createCanvas: () => ({ getContext: () => createRecordingContext().ctx }),
}));

function solid(width: number, height: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([...rgb, 255], i);
  return data;
}

describe('GIF encoding', () => {
  it('dithers by position only, so identical pixels stay identical across frames', () => {
    const frame = solid(8, 8, [200, 180, 240]);
    const once = orderedDither(frame, 8, 8);
    expect(orderedDither(frame, 8, 8)).toEqual(once);
    for (let i = 0; i < once.length; i += 4) expect(Math.abs(once[i] - 200)).toBeLessThanOrEqual(3);
  });

  it('marks unchanged pixels transparent in later frames', () => {
    expect(Array.from(deltaFrame(Uint8Array.from([1, 2, 3, 4]), Uint8Array.from([1, 9, 3, 9]), 255))).toEqual([255, 2, 255, 4]);
  });

  it('writes a looping GIF with a reserved "unchanged" colour', () => {
    const width = 16;
    const height = 16;
    const a = solid(width, height, [240, 232, 255]);
    const b = solid(width, height, [64, 48, 94]);
    const state = startGif(new Uint8ClampedArray([...a, ...b]));
    expect(state.table).toHaveLength(state.palette.length + 1);
    for (const rgba of [a, a, b]) writeGifFrame(state, { rgba, width, height, delay: 80 });
    state.gif.finish();
    const bytes = state.gif.bytes();
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('GIF89a')).toBe(true);
    expect(text).toContain('NETSCAPE2.0');
    expect(bytes[bytes.length - 1]).toBe(0x3b);
  });
});

describe('MP4 encoding', () => {
  const quiz = SHARE_FIXTURES[0].quiz;

  beforeEach(() => {
    media.added.length = 0;
    media.audio.length = 0;
    media.state = 'pending';
    media.finalize.mockClear();
    media.cancel.mockClear();
  });

  it('adds one frame per 1/30 s with increasing timestamps, then finalizes', async () => {
    const { encodeMp4 } = await import('@/lib/shareMedia/encode/mp4');
    const timeline = buildTimeline('video', 1);
    const progress = vi.fn();
    const blob = await encodeMp4({ quiz, timeline, format: getFormat('square', 0.25), onProgress: progress });
    expect(media.added).toHaveLength(Math.round(timeline.duration * 30));
    media.added.forEach(([timestamp, duration], i) => {
      expect(timestamp).toBeCloseTo(i / 30);
      expect(duration).toBeCloseTo(1 / 30);
    });
    expect(media.finalize).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(1);
    expect(blob.type).toBe('video/mp4');
  });

  it('adds the music bed when one is given', async () => {
    const { encodeMp4 } = await import('@/lib/shareMedia/encode/mp4');
    const music = { duration: 8.5 } as AudioBuffer;
    await encodeMp4({ quiz, timeline: buildTimeline('video', 1), format: getFormat('square', 0.25), music });
    expect(media.audio).toEqual([music]);
  });

  it('cancels the output and never finalizes when the user cancels', async () => {
    const { encodeMp4 } = await import('@/lib/shareMedia/encode/mp4');
    const controller = new AbortController();
    const onProgress = (fraction: number) => { if (fraction > 0.2) controller.abort(); };
    await expect(encodeMp4({ quiz, timeline: buildTimeline('video', 2), format: getFormat('square', 0.25), signal: controller.signal, onProgress }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(media.cancel).toHaveBeenCalledOnce();
    expect(media.finalize).not.toHaveBeenCalled();
  });
});

describe('encoder support', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reports no MP4 support when the browser has no WebCodecs', async () => {
    vi.stubGlobal('VideoEncoder', undefined);
    const { canEncodeMp4, pickVideoScale } = await import('@/lib/shareMedia/encode/support');
    expect(await canEncodeMp4(1080, 1920)).toBe(false);
    expect(await pickVideoScale({ width: 1080, height: 1920 })).toBeNull();
  });

  it('falls back to 720p when 1080p H.264 is not available', async () => {
    vi.stubGlobal('VideoEncoder', class {});
    media.canEncodeVideo.mockImplementation(async (_codec: string, options: { width: number }) => options.width <= 720);
    const { pickVideoScale } = await import('@/lib/shareMedia/encode/support');
    expect(await pickVideoScale({ width: 1080, height: 1920 })).toBeCloseTo(2 / 3);
  });

  it('treats a failing capability check as unsupported', async () => {
    vi.stubGlobal('AudioEncoder', class {});
    media.canEncodeAudio.mockRejectedValue(new Error('boom'));
    const { canEncodeAac } = await import('@/lib/shareMedia/encode/support');
    expect(await canEncodeAac()).toBe(false);
  });
});

describe('music bed', () => {
  it('fades in quickly and out slowly, peaking below full scale', async () => {
    const { fadeSchedule, MUSIC_PEAK } = await import('@/lib/shareMedia/encode/audio');
    expect(MUSIC_PEAK).toBeLessThan(1);
    expect(fadeSchedule(35.5)).toEqual([[0, 0], [0.5, MUSIC_PEAK], [34.5, MUSIC_PEAK], [35.5, 0]]);
  });

  it('levels quiet and loud tracks to the same loudness without clipping', async () => {
    const { loudnessGain, MUSIC_PEAK, MUSIC_TARGET_RMS } = await import('@/lib/shareMedia/encode/audio');
    expect(0.04 * loudnessGain(0.04, 0.22)).toBeCloseTo(MUSIC_TARGET_RMS);
    expect(0.2 * loudnessGain(0.2, 0.75)).toBeCloseTo(MUSIC_TARGET_RMS);
    expect(0.8 * loudnessGain(0.09, 0.8)).toBeLessThanOrEqual(MUSIC_PEAK);
    expect(loudnessGain(0, 0)).toBe(1);
  });

  it('shrinks the fades for very short videos so they never overlap', async () => {
    const { fadeSchedule } = await import('@/lib/shareMedia/encode/audio');
    const times = fadeSchedule(1).map(([time]) => time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.at(-1)).toBe(1);
  });
});

describe('bundled music', () => {
  it('only ships CC0 tracks whose files and provenance are recorded', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { MUSIC_TRACKS } = await import('@/lib/shareMedia/music');
    // Tests run from the client folder; jsdom's import.meta.url isn't a file URL.
    const musicDir = resolve(process.cwd(), 'public/music');
    const licenses = readFileSync(resolve(musicDir, 'LICENSES.md'), 'utf8');
    expect(MUSIC_TRACKS.length).toBeGreaterThan(0);
    for (const track of MUSIC_TRACKS) {
      expect(track.license).toBe('CC0-1.0');
      expect(existsSync(resolve(musicDir, track.file)), track.file).toBe(true);
      expect(licenses, track.file).toContain(`\`${track.file}\``);
      expect(licenses, track.file).toContain(track.sourceUrl);
    }
  });
});
