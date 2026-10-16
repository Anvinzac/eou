import type { ShareFormat } from '../formats';
import { drawStill } from '../render';
import type { Timeline } from '../timeline';
import type { ShareQuiz } from '../types';

export function createCanvas(format: ShareFormat) {
  const canvas = document.createElement('canvas');
  canvas.width = format.width;
  canvas.height = format.height;
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image'))), type, quality);
  });
}

/** One PNG per still segment: a poster is one image, a carousel is a cover plus one card per question. */
export async function renderStills(quiz: ShareQuiz, timeline: Timeline, format: ShareFormat, signal?: AbortSignal) {
  const canvas = createCanvas(format);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  const blobs: Blob[] = [];
  for (const segment of timeline.segments) {
    signal?.throwIfAborted();
    drawStill(ctx, quiz, segment, format);
    blobs.push(await canvasToBlob(canvas));
  }
  return blobs;
}
