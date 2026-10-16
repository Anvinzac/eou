import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';
import { drawFrame } from '../render';
import { frameCount } from '../timeline';
import type { EncodeOptions } from './gif';
import { createCanvas } from './png';
import { AUDIO_BITRATE, VIDEO_BITRATE } from './support';

export type Mp4Options = EncodeOptions & {
  /** Background music, already trimmed and faded to the video's length. */
  music?: AudioBuffer | null;
  bitrate?: number;
};

const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Renders the timeline into an H.264 MP4 with the index at the front, so it plays while uploading. */
export async function encodeMp4({ quiz, timeline, format, music, bitrate = VIDEO_BITRATE, signal, onProgress }: Mp4Options) {
  const canvas = createCanvas(format);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const video = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate }), keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: timeline.fps });
  const audio = music ? new AudioBufferSource({ codec: 'aac', quality: new Quality({ bitrate: AUDIO_BITRATE }) }) : null;
  if (audio) output.addAudioTrack(audio);

  await output.start();
  try {
    if (audio && music) await audio.add(music);
    const frames = frameCount(timeline);
    const step = 1 / timeline.fps;
    for (let i = 0; i < frames; i += 1) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      drawFrame(ctx, quiz, timeline, i * step, format);
      await video.add(i * step, step);
      onProgress?.((i + 1) / frames);
      // Let the progress bar repaint; encoding itself runs off the main thread.
      if (i % 8 === 7) await yieldToBrowser();
    }
    await output.finalize();
  } catch (error) {
    if (output.state !== 'finalized') await output.cancel().catch(() => undefined);
    throw error;
  }
  if (!target.buffer) throw new Error('Video encoder produced no data');
  return new Blob([target.buffer], { type: 'video/mp4' });
}
