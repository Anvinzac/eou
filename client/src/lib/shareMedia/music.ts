export type MusicTrack = {
  id: string;
  title: string;
  /** File name in client/public/music/. */
  file: string;
  author: string;
  /** Only public-domain (CC0) tracks are bundled, so exported videos need no credit line. */
  license: 'CC0-1.0';
  sourceUrl: string;
};

/** Background music for promo videos. Provenance for each file is recorded in client/public/music/LICENSES.md. */
export const MUSIC_TRACKS: MusicTrack[] = [];

export function musicUrl(track: MusicTrack) {
  return `/music/${track.file}`;
}
