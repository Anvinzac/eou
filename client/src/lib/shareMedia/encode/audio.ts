export const MUSIC_SAMPLE_RATE = 48_000;
/** Headroom so looped or faded music never clips. */
export const MUSIC_PEAK = 0.8;
/** Tracks differ a lot in loudness; beds are levelled to this RMS (unless that would clip). */
export const MUSIC_TARGET_RMS = 0.12;

/** Gain that brings a bed to the target loudness without its peak exceeding MUSIC_PEAK. */
export function loudnessGain(rms: number, peak: number) {
  if (rms <= 0 || peak <= 0) return 1;
  return Math.min(MUSIC_TARGET_RMS / rms, MUSIC_PEAK / peak);
}

function normalize(buffer: AudioBuffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  let sum = 0;
  let peak = 0;
  for (const data of channels) {
    for (let i = 0; i < data.length; i += 1) {
      sum += data[i] * data[i];
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  const gain = loudnessGain(Math.sqrt(sum / (channels.length * buffer.length)), peak);
  for (const data of channels) {
    for (let i = 0; i < data.length; i += 1) data[i] *= gain;
  }
  return buffer;
}

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

/** Decodes a track and renders it to exactly `duration` seconds, looping short tracks, with fades and levelled loudness. */
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
  return normalize(await context.startRendering());
}
