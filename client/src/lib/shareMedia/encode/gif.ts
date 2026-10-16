import type { ShareFormat } from '../formats';
import { drawFrame } from '../render';
import { GIF_FRAME_MS, type Timeline } from '../timeline';
import type { ShareQuiz } from '../types';
import type { GifWorkerRequest, GifWorkerResponse } from './gif.worker';
import { createCanvas } from './png';

export type EncodeOptions = {
  quiz: ShareQuiz;
  timeline: Timeline;
  format: ShareFormat;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
};

const SAMPLE_EVERY_FRAME = 6;
const SAMPLE_EVERY_PIXEL = 4;

function abortError() {
  return new DOMException('Export cancelled', 'AbortError');
}

function startWorker(signal?: AbortSignal) {
  const worker = new Worker(new URL('./gif.worker.ts', import.meta.url), { type: 'module' });
  let reject: ((error: unknown) => void) | null = null;
  const onAbort = () => {
    worker.terminate();
    reject?.(abortError());
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const call = (message: GifWorkerRequest, transfer: Transferable[] = []) =>
    new Promise<GifWorkerResponse>((resolve, rejectCall) => {
      if (signal?.aborted) return rejectCall(abortError());
      reject = rejectCall;
      worker.onmessage = ({ data }: MessageEvent<GifWorkerResponse>) => {
        if (data.type === 'error') rejectCall(new Error(data.message));
        else resolve(data);
      };
      worker.onerror = (event) => rejectCall(event.error ?? new Error(event.message));
      worker.postMessage(message, transfer);
    });

  const stop = () => {
    signal?.removeEventListener('abort', onAbort);
    worker.terminate();
  };
  return { call, stop };
}

/** Renders the timeline into a looping GIF. Quantizing and LZW encoding happen in a worker. */
export async function encodeGif({ quiz, timeline, format, signal, onProgress }: EncodeOptions, frameMs = GIF_FRAME_MS) {
  const canvas = createCanvas(format);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available');
  const frames = Math.max(1, Math.round((timeline.duration * 1000) / frameMs));
  const at = (i: number) => (i * frameMs) / 1000;
  const grab = () => ctx.getImageData(0, 0, format.width, format.height).data;
  const worker = startWorker(signal);

  try {
    // Pass 1: one global palette from pixels sampled across the whole animation.
    const sampled: number[] = [];
    for (let i = 0; i < frames; i += SAMPLE_EVERY_FRAME) {
      drawFrame(ctx, quiz, timeline, at(i), format);
      const rgba = grab();
      for (let p = 0; p < rgba.length; p += 4 * SAMPLE_EVERY_PIXEL) sampled.push(rgba[p], rgba[p + 1], rgba[p + 2], 255);
    }
    const samples = new Uint8ClampedArray(sampled);
    await worker.call({ type: 'palette', samples }, [samples.buffer]);

    // Pass 2: every frame, mapped to that palette.
    for (let i = 0; i < frames; i += 1) {
      if (signal?.aborted) throw abortError();
      drawFrame(ctx, quiz, timeline, at(i), format);
      const rgba = grab();
      await worker.call({ type: 'frame', rgba, width: format.width, height: format.height, delay: frameMs }, [rgba.buffer]);
      onProgress?.((i + 1) / frames);
    }
    const result = await worker.call({ type: 'finish' });
    if (result.type !== 'done') throw new Error('GIF encoder did not finish');
    return new Blob([result.bytes], { type: 'image/gif' });
  } finally {
    worker.stop();
  }
}
