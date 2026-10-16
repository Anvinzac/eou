import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { QUIZ_STYLES, QUIZ_THEMES, type QuizAppearance } from '@/lib/quizAppearance';
import { SHARE_FIXTURES } from '@/lib/shareMedia/fixtures';
import { getFormat, type FormatId } from '@/lib/shareMedia/formats';
import { ensureExportFonts } from '@/lib/shareMedia/fonts';
import { drawFrame, drawStill } from '@/lib/shareMedia/render';
import { buildTimeline, type MediaKind } from '@/lib/shareMedia/timeline';
import type { ShareQuiz } from '@/lib/shareMedia/types';
import { renderStills } from '@/lib/shareMedia/encode/png';
import { encodeGif } from '@/lib/shareMedia/encode/gif';
import { encodeMp4 } from '@/lib/shareMedia/encode/mp4';
import { pickVideoScale } from '@/lib/shareMedia/encode/support';
import { downloadFiles } from '@/lib/shareMedia/share';

type Scene = 'poster' | 'cover' | 'card' | 'gif' | 'video';

const kindFor: Record<Scene, MediaKind> = { poster: 'poster', cover: 'carousel', card: 'carousel', gif: 'gif', video: 'video' };

function paint(canvas: HTMLCanvasElement, quiz: ShareQuiz, scene: Scene, formatId: FormatId, t: number, scale: number) {
  const format = getFormat(formatId, scale);
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const timeline = buildTimeline(kindFor[scene], quiz.questions.length);
  if (scene === 'gif' || scene === 'video') drawFrame(ctx, quiz, timeline, t, format);
  else drawStill(ctx, quiz, timeline.segments[scene === 'card' ? 1 : 0], format);
}

function Thumb({ quiz, scene, formatId, t }: { quiz: ShareQuiz; scene: Scene; formatId: FormatId; t: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paint(ref.current, quiz, scene, formatId, t, 0.25);
  }, [quiz, scene, formatId, t]);
  return <canvas ref={ref} className="w-full rounded border" />;
}

const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/** Dev-only workbench for the share renderer and encoders. Not routed in production builds. */
export default function ShareMediaGallery() {
  // ?fixture=vi-long&look=rose:editorial&scene=video&format=story&t=4 opens a specific frame.
  const params = new URLSearchParams(window.location.search);
  const [fixtureId, setFixtureId] = useState(params.get('fixture') ?? SHARE_FIXTURES[0].id);
  const [appearance, setAppearance] = useState<QuizAppearance | null>(() => {
    const [theme, style] = (params.get('look') ?? '').split(':');
    return theme && style ? ({ theme, style } as QuizAppearance) : null;
  });
  const [scene, setScene] = useState<Scene>((params.get('scene') as Scene) ?? 'video');
  const [formatId, setFormatId] = useState<FormatId>((params.get('format') as FormatId) ?? 'story');
  const [t, setT] = useState(Number(params.get('t') ?? 4));
  const [playing, setPlaying] = useState(false);
  const [fontsReady, setFontsReady] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<{ url: string; type: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const quiz = useMemo(() => {
    const base = SHARE_FIXTURES.find((f) => f.id === fixtureId)!.quiz;
    return appearance ? { ...base, appearance } : base;
  }, [fixtureId, appearance]);
  const timeline = useMemo(() => buildTimeline(kindFor[scene], quiz.questions.length), [scene, quiz]);

  useEffect(() => {
    void ensureExportFonts(quiz).then(() => setFontsReady((n) => n + 1));
  }, [quiz]);

  useEffect(() => {
    if (canvasRef.current) paint(canvasRef.current, quiz, scene, formatId, t, 1);
  }, [quiz, scene, formatId, t, fontsReady]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const started = performance.now() - t * 1000;
    const tick = (now: number) => {
      setT(((now - started) / 1000) % Math.max(0.1, timeline.duration));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Restarting from the current time only when play toggles is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timeline]);

  const note = (line: string) => setLog((lines) => [`${new Date().toLocaleTimeString()}  ${line}`, ...lines].slice(0, 30));

  async function run(kind: MediaKind) {
    setBusy(true);
    setProgress(0);
    setResult(null);
    const started = performance.now();
    try {
      await ensureExportFonts(quiz);
      const exportTimeline = buildTimeline(kind, quiz.questions.length);
      let blob: Blob;
      let extra = '';
      if (kind === 'poster' || kind === 'carousel') {
        const blobs = await renderStills(quiz, exportTimeline, getFormat(formatId));
        blob = blobs[0];
        extra = `${blobs.length} image(s), total ${formatBytes(blobs.reduce((sum, b) => sum + b.size, 0))}`;
      } else if (kind === 'gif') {
        blob = await encodeGif({ quiz, timeline: exportTimeline, format: getFormat(formatId, 0.5), onProgress: setProgress });
      } else {
        const scale = await pickVideoScale(getFormat(formatId));
        if (scale === null) throw new Error('This browser cannot encode H.264 MP4');
        blob = await encodeMp4({ quiz, timeline: exportTimeline, format: getFormat(formatId, scale), onProgress: setProgress });
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
        const video = await input.getPrimaryVideoTrack();
        const audio = await input.getPrimaryAudioTrack();
        const stats = video ? await video.computePacketStats() : null;
        extra = `self-check: ${video?.displayWidth}×${video?.displayHeight} ${video?.codec}, ${(await input.computeDuration()).toFixed(2)} s (timeline ${exportTimeline.duration} s), ${stats?.averagePacketRate.toFixed(1)} fps, audio ${audio?.codec ?? 'none'}`;
      }
      note(`${kind} ${formatId}: ${formatBytes(blob.size)} in ${((performance.now() - started) / 1000).toFixed(1)} s ${extra}`);
      setResult({ url: URL.createObjectURL(blob), type: blob.type });
    } catch (error) {
      note(`${kind} failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPreviewCards() {
    const format = getFormat('link');
    const files: File[] = [];
    for (const theme of QUIZ_THEMES) {
      const card: ShareQuiz = { ...quiz, hero: 'Bạn hiểu mình đến đâu? · How well do you know me?', appearance: { theme: theme.id, style: 'playful' } };
      await ensureExportFonts(card);
      const [blob] = await renderStills(card, buildTimeline('carousel', 0), format);
      files.push(new File([blob], `${theme.id}.png`, { type: 'image/png' }));
    }
    await downloadFiles(files, 'og-cards.zip');
    note(`preview cards: ${files.length} × ${format.width}×${format.height}`);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-sm">
      <h1 className="text-xl font-bold">Share media workbench</h1>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">Fixture
          <select className="rounded border p-1" value={fixtureId} onChange={(e) => setFixtureId(e.target.value)}>
            {SHARE_FIXTURES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Theme / style
          <select className="rounded border p-1" value={appearance ? `${appearance.theme}:${appearance.style}` : ''} onChange={(e) => {
            const [theme, style] = e.target.value.split(':');
            setAppearance(e.target.value ? { theme, style } as QuizAppearance : null);
          }}>
            <option value="">Fixture default</option>
            {QUIZ_THEMES.flatMap((theme) => QUIZ_STYLES.map((style) => (
              <option key={`${theme.id}:${style.id}`} value={`${theme.id}:${style.id}`}>{theme.id} · {style.id}</option>
            )))}
          </select>
        </label>
        <label className="grid gap-1">Scene
          <select className="rounded border p-1" value={scene} onChange={(e) => setScene(e.target.value as Scene)}>
            {(['poster', 'cover', 'card', 'gif', 'video'] as Scene[]).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Format
          <select className="rounded border p-1" value={formatId} onChange={(e) => setFormatId(e.target.value as FormatId)}>
            {(['square', 'story', 'link'] as FormatId[]).map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        {(scene === 'gif' || scene === 'video') && (
          <label className="grid min-w-64 flex-1 gap-1">Time {t.toFixed(2)} s / {timeline.duration} s
            <input type="range" min={0} max={timeline.duration} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} />
          </label>
        )}
        <button className="rounded border px-3 py-1" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,360px)_1fr]">
        <div className="space-y-2">
          <canvas ref={canvasRef} data-testid="share-preview" className="w-full rounded border" />
          {formatId === 'story' && <p className="text-xs text-muted-foreground">Story safe zone: top 14%, bottom 35%, sides 6%.</p>}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['poster', 'carousel', 'gif', 'video'] as MediaKind[]).map((kind) => (
              <button key={kind} disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => run(kind)}>Export {kind}</button>
            ))}
            <button disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={downloadPreviewCards}>Download preview cards</button>
          </div>
          {busy && <progress className="w-full" value={progress} max={1} />}
          {result && (result.type.startsWith('video')
            ? <video data-testid="export-result" src={result.url} controls className="max-h-80 rounded border" />
            : <img data-testid="export-result" src={result.url} alt="Export result" className="max-h-80 rounded border" />)}
          <pre data-testid="export-log" className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{log.join('\n')}</pre>
        </div>
      </div>

      <section className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {QUIZ_STYLES.flatMap((style) => QUIZ_THEMES.map((theme) => (
          <figure key={`${theme.id}:${style.id}`} className="space-y-1">
            <Thumb quiz={{ ...quiz, appearance: { theme: theme.id, style: style.id } }} scene={scene} formatId={formatId} t={t} />
            <figcaption className="text-xs">{theme.id} · {style.id}</figcaption>
          </figure>
        )))}
      </section>
    </main>
  );
}
