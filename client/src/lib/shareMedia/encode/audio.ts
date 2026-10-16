export const MUSIC_SAMPLE_RATE = 48_000;
/** Headroom so looped or faded music never clips. */
export const MUSIC_PEAK = 0.8;

/**
 * Gain keyframes [time, gain] for a music bed of `duration` seconds: a short fade-in, a longer
 * fade-out so the video doesn't end on a cut. Fades shrink for very short videos.
 */
export function fadeSchedule(duration: number): Array<[number, number]> {
  const fadeIn = Math.min(0.5, duration / 4);
  const fadeOut = Math.min(1, duration / 4);
  return [
    [0, 0],
    [fadeIn, MUSIC_PEAK],
    [duration - fadeOut, MUSIC_PEAK],
    [duration, 0],
  ];
}

/** Decodes a track and renders it to exactly `duration` seconds, looping short tracks, with fades. */
export async function renderMusicBed(url: string, duration: number, signal?: AbortSignal): Promise<AudioBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load music (${response.status})`);
  const data = await response.arrayBuffer();

  const context = new OfflineAudioContext(2, Math.ceil(duration * MUSIC_SAMPLE_RATE), MUSIC_SAMPLE_RATE);
  const decoded = await context.decodeAudioData(data);
  const source = context.createBufferSource();
  source.buffer = decoded;
  source.loop = decoded.duration < duration;

  const gain = context.createGain();
  const [[startTime, startGain], ...ramps] = fadeSchedule(duration);
  gain.gain.setValueAtTime(startGain, startTime);
  for (const [time, value] of ramps) gain.gain.linearRampToValueAtTime(value, time);

  source.connect(gain).connect(context.destination);
  source.start(0);
  signal?.throwIfAborted();
  return context.startRendering();
}
