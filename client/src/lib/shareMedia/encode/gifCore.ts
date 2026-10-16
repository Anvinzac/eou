import { applyPalette, GIFEncoder, quantize, type GIFStream, type Palette } from 'gifenc';

// 4×4 Bayer matrix, as thresholds in 0..15.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// GIF frame disposal 1 = "leave in place", so a later frame only has to paint what changed.
const KEEP_PREVIOUS = 1;

/**
 * Ordered dithering: nudges each pixel by a small, position-dependent amount before it is
 * snapped to the palette, which breaks up banding in the pastel gradients. Being position-based
 * (not error diffusion), unchanged pixels stay identical between frames, so deltas stay small.
 */
export function orderedDither(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, strength = 6) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * strength;
      const i = (y * width + x) * 4;
      out[i] = rgba[i] + offset;
      out[i + 1] = rgba[i + 1] + offset;
      out[i + 2] = rgba[i + 2] + offset;
      out[i + 3] = 255;
    }
  }
  return out;
}

export type GifState = {
  gif: GIFStream;
  /** Colours frames are mapped to (at most 255). */
  palette: Palette;
  /** The same plus one reserved slot that marks "unchanged since the previous frame". */
  table: Palette;
  unchanged: number;
  previous: Uint8Array | null;
};

/** One palette shared by every frame, built from pixels sampled across the animation. */
export function startGif(samples: Uint8Array | Uint8ClampedArray): GifState {
  const palette = quantize(samples, 255);
  return { gif: GIFEncoder(), palette, table: [...palette, [0, 0, 0]], unchanged: palette.length, previous: null };
}

/** Marks pixels that match the previous frame as transparent, so static parts cost almost nothing. */
export function deltaFrame(current: Uint8Array, previous: Uint8Array, unchanged: number) {
  const out = new Uint8Array(current.length);
  for (let i = 0; i < current.length; i += 1) out[i] = current[i] === previous[i] ? unchanged : current[i];
  return out;
}

export function writeGifFrame(
  state: GifState,
  frame: { rgba: Uint8Array | Uint8ClampedArray; width: number; height: number; delay: number },
) {
  const index = applyPalette(orderedDither(frame.rgba, frame.width, frame.height), state.palette);
  if (!state.previous) {
    // The first frame carries the global colour table and loops the GIF forever.
    state.gif.writeFrame(index, frame.width, frame.height, {
      palette: state.table, delay: frame.delay, repeat: 0, dispose: KEEP_PREVIOUS,
    });
  } else {
    state.gif.writeFrame(deltaFrame(index, state.previous, state.unchanged), frame.width, frame.height, {
      delay: frame.delay, transparent: true, transparentIndex: state.unchanged, dispose: KEEP_PREVIOUS,
    });
  }
  state.previous = index;
}
