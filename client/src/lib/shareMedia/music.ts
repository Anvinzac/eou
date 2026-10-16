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
export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'happy-vibes', title: 'Happy Vibes', file: 'happy-vibes.mp3', author: 'Ruskerdax', license: 'CC0-1.0', sourceUrl: 'https://opengameart.org/node/160228' },
  { id: 'happy-adventure', title: 'Happy Adventure', file: 'happy-adventure.mp3', author: 'TinyWorlds', license: 'CC0-1.0', sourceUrl: 'https://opengameart.org/content/happy-adventure-loop' },
  { id: 'jrpg-piano', title: 'JRPG Piano', file: 'jrpg-piano.mp3', author: 'Joth', license: 'CC0-1.0', sourceUrl: 'https://opengameart.org/content/jrpg-piano' },
  { id: 'yuin', title: 'Yuin', file: 'yuin.mp3', author: 'James Gargette', license: 'CC0-1.0', sourceUrl: 'https://opengameart.org/content/yuin' },
];

export function musicUrl(track: MusicTrack) {
  return `/music/${track.file}`;
}
