import { canEncodeAudio, canEncodeVideo, Quality } from 'mediabunny';

export const VIDEO_BITRATE = 5_000_000;
export const AUDIO_BITRATE = 128_000;

const cache = new Map<string, Promise<boolean>>();

function cached(key: string, check: () => Promise<boolean>) {
  let result = cache.get(key);
  if (!result) {
    result = check().catch(() => false);
    cache.set(key, result);
  }
  return result;
}

/** H.264 in MP4 is what Instagram and TikTok accept; WebM is not offered as a fallback. */
export function canEncodeMp4(width: number, height: number) {
  if (typeof VideoEncoder === 'undefined') return Promise.resolve(false);
  return cached(`avc:${width}x${height}`, () =>
    canEncodeVideo('avc', { width, height, frameRate: 30, quality: new Quality({ bitrate: VIDEO_BITRATE }) }),
  );
}

export function canEncodeAac() {
  if (typeof AudioEncoder === 'undefined') return Promise.resolve(false);
  return cached('aac', () =>
    canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48_000, quality: new Quality({ bitrate: AUDIO_BITRATE }) }),
  );
}

/** Largest supported video scale (1 = 1080 wide, then 720), or null when MP4 can't be made here. */
export async function pickVideoScale(size: { width: number; height: number }) {
  for (const scale of [1, 2 / 3]) {
    const width = Math.round((size.width * scale) / 2) * 2;
    const height = Math.round((size.height * scale) / 2) * 2;
    if (await canEncodeMp4(width, height)) return scale;
  }
  return null;
}
