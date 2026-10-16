import { startGif, writeGifFrame, type GifState } from './gifCore';

export type GifWorkerRequest =
  | { type: 'palette'; samples: Uint8ClampedArray }
  | { type: 'frame'; rgba: Uint8ClampedArray; width: number; height: number; delay: number }
  | { type: 'finish' };

export type GifWorkerResponse =
  | { type: 'ok' }
  | { type: 'done'; bytes: Uint8Array }
  | { type: 'error'; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<GifWorkerRequest>) => void) | null;
  postMessage(message: GifWorkerResponse, transfer?: Transferable[]): void;
};

let state: GifState | null = null;

scope.onmessage = ({ data }) => {
  try {
    if (data.type === 'palette') {
      state = startGif(data.samples);
      scope.postMessage({ type: 'ok' });
    } else if (data.type === 'frame') {
      if (!state) throw new Error('Palette must be set before frames');
      writeGifFrame(state, data);
      scope.postMessage({ type: 'ok' });
    } else {
      if (!state?.previous) throw new Error('No frames were written');
      state.gif.finish();
      const bytes = state.gif.bytes();
      scope.postMessage({ type: 'done', bytes }, [bytes.buffer]);
    }
  } catch (error) {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
