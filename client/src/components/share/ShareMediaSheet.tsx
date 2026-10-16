import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Download, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminTelemetryApi, quizzesApi } from '@/api';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ensureExportFonts } from '@/lib/shareMedia/fonts';
import { getFormat } from '@/lib/shareMedia/formats';
import { buildShareLabels, categoryLabeler } from '@/lib/shareMedia/labels';
import { canShareFiles, downloadFiles, shareFiles, slugify } from '@/lib/shareMedia/share';
import { buildTimeline, type MediaKind } from '@/lib/shareMedia/timeline';
import { toShareQuiz } from '@/lib/shareMedia/types';
import { SharePreview } from './SharePreview';

type Aspect = 'square' | 'story';
type Status = 'idle' | 'working' | 'done' | 'error';
type TakePayload = Awaited<ReturnType<typeof quizzesApi.getTake>>;

const KINDS: MediaKind[] = ['poster', 'carousel', 'gif', 'video'];
const ASPECTS: Aspect[] = ['square', 'story'];
// Chat apps start refusing or recompressing GIFs around this size.
const GIF_MAX_BYTES = 8 * 1024 * 1024;

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Reports at most once per browser session, e.g. "this browser can't make videos". */
function reportOncePerSession(key: string, payload: Parameters<typeof adminTelemetryApi.reportClientError>[0]) {
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Without storage we may report twice; that's fine.
  }
  void adminTelemetryApi.reportClientError(payload).catch(() => undefined);
}

function SharePanel({ quizId, title }: { quizId: string; title: string }) {
  const { t, i18n } = useTranslation();
  const [payload, setPayload] = useState<TakePayload | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [kind, setKind] = useState<MediaKind>('poster');
  const [aspect, setAspect] = useState<Aspect>('story');
  const [hero, setHero] = useState(title);
  const [page, setPage] = useState(0);
  const [fontsVersion, setFontsVersion] = useState(0);
  // undefined while checking, null when this browser can't encode MP4.
  const [videoScale, setVideoScale] = useState<number | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const job = useRef<AbortController | null>(null);
  const shareUrl = `${window.location.origin}/quiz/${quizId}`;

  useEffect(() => {
    let cancelled = false;
    quizzesApi.getTake(quizId)
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [quizId]);

  const quiz = useMemo(
    () => (payload
      ? toShareQuiz(payload, { hero, shareUrl, labels: buildShareLabels(t), categoryLabel: categoryLabeler(t) })
      : null),
    // `t` changes when the language does, so labels re-translate on a switch.
    [payload, hero, shareUrl, t],
  );

  useEffect(() => {
    if (!quiz) return;
    let cancelled = false;
    void ensureExportFonts(quiz).then(() => { if (!cancelled) setFontsVersion((v) => v + 1); });
    return () => { cancelled = true; };
  }, [quiz]);

  useEffect(() => {
    let cancelled = false;
    setVideoScale(undefined);
    import('@/lib/shareMedia/encode/support')
      .then(({ pickVideoScale }) => pickVideoScale(getFormat(aspect)))
      .then((scale) => {
        if (cancelled) return;
        setVideoScale(scale);
        if (scale === null) {
          reportOncePerSession('eou_share_video_unsupported', {
            message: 'Share video export unsupported in this browser',
            severity: 'info',
            metadata: { kind: 'share_video_unsupported', aspect, userAgent: navigator.userAgent },
          });
        }
      })
      .catch(() => { if (!cancelled) setVideoScale(null); });
    return () => { cancelled = true; };
  }, [aspect]);

  // A finished file no longer matches once the choices change.
  useEffect(() => {
    job.current?.abort();
    setStatus('idle');
    setFiles([]);
    setProgress(0);
  }, [kind, aspect, hero]);

  useEffect(() => setPage(0), [kind, aspect]);
  useEffect(() => () => job.current?.abort(), []);

  if (loadFailed) return <p role="alert" className="text-sm text-destructive">{t('share_media.load_failed')}</p>;
  if (!quiz) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t('share_media.loading')}
      </p>
    );
  }

  const shareQuiz = quiz;
  const slug = slugify(quiz.title);
  const pages = quiz.questions.length + 1;
  const videoUnavailable = kind === 'video' && videoScale === null;

  async function create() {
    const controller = new AbortController();
    job.current = controller;
    setStatus('working');
    setProgress(0);
    setFiles([]);
    const count = shareQuiz.questions.length;
    try {
      await ensureExportFonts(shareQuiz);
      let output: File[];
      if (kind === 'poster' || kind === 'carousel') {
        const { renderStills } = await import('@/lib/shareMedia/encode/png');
        const blobs = await renderStills(shareQuiz, buildTimeline(kind, count), getFormat(aspect), controller.signal);
        output = blobs.map((blob, i) => new File(
          [blob],
          kind === 'poster' ? `${slug}-${aspect}.png` : `${slug}-${aspect}-${String(i + 1).padStart(2, '0')}.png`,
          { type: 'image/png' },
        ));
      } else if (kind === 'gif') {
        const { encodeGif } = await import('@/lib/shareMedia/encode/gif');
        const options = { quiz: shareQuiz, timeline: buildTimeline('gif', count), signal: controller.signal, onProgress: setProgress };
        let blob = await encodeGif({ ...options, format: getFormat(aspect, 0.5) });
        if (blob.size > GIF_MAX_BYTES) {
          setProgress(0);
          blob = await encodeGif({ ...options, format: getFormat(aspect, 480 / 1080) }, 100);
        }
        output = [new File([blob], `${slug}-${aspect}.gif`, { type: 'image/gif' })];
      } else {
        if (!videoScale) throw new Error('Video export is not supported in this browser');
        const { encodeMp4 } = await import('@/lib/shareMedia/encode/mp4');
        const blob = await encodeMp4({
          quiz: shareQuiz, timeline: buildTimeline('video', count), format: getFormat(aspect, videoScale),
          signal: controller.signal, onProgress: setProgress,
        });
        output = [new File([blob], `${slug}-${aspect}.mp4`, { type: 'video/mp4' })];
      }
      if (controller.signal.aborted) return;
      setFiles(output);
      setStatus('done');
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return;
      console.error(error);
      setStatus('error');
      const message = error instanceof Error ? error.message : String(error);
      void adminTelemetryApi.reportClientError({
        message: `Share export failed: ${message}`.slice(0, 500),
        severity: 'error',
        metadata: { kind: 'share_media_failed', media: kind, aspect },
      }).catch(() => undefined);
    }
  }

  function cancel() {
    job.current?.abort();
    setStatus('idle');
    setProgress(0);
  }

  async function share() {
    try {
      await shareFiles(files, { title: shareQuiz.title, text: `${t('share_media.share_text')} ${shareUrl}` });
    } catch {
      toast.error(t('share_media.failed'));
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const sizeLabel = `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(totalBytes / 1024 / 1024)} MB`;
  const canShare = files.length > 0 && canShareFiles(files);

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.16em]">{t('share_media.kind_label')}</legend>
        <ToggleGroup type="single" value={kind} onValueChange={(value) => value && setKind(value as MediaKind)} className="grid grid-cols-4 gap-1">
          {KINDS.map((value) => (
            <ToggleGroupItem key={value} value={value} className="h-11 rounded-xl text-xs sm:text-sm">{t(`share_media.kind_${value}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.16em]">{t('share_media.aspect_label')}</legend>
        <ToggleGroup type="single" value={aspect} onValueChange={(value) => value && setAspect(value as Aspect)} className="grid grid-cols-2 gap-1">
          {ASPECTS.map((value) => (
            <ToggleGroupItem key={value} value={value} className="h-11 rounded-xl">{t(`share_media.aspect_${value}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="share-media-hero">{t('share_media.hero_label')}</Label>
        <Input id="share-media-hero" value={hero} maxLength={80} onChange={(event) => setHero(event.target.value)} />
      </div>

      <SharePreview quiz={quiz} kind={kind} aspect={aspect} page={page} fontsVersion={fontsVersion} />

      {kind === 'carousel' && (
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-3">
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={t('share_media.previous')} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-sm" aria-live="polite">{t('share_media.page', { current: page + 1, total: pages })}</span>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={t('share_media.next')} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('share_media.carousel_hint', { count: pages })}</p>
        </div>
      )}

      {videoUnavailable && <p role="status" className="rounded-xl bg-muted p-3 text-sm">{t('share_media.video_unsupported')}</p>}

      {status === 'working' ? (
        <div className="space-y-2">
          <Progress value={Math.round(progress * 100)} aria-label={t('share_media.generating', { percent: Math.round(progress * 100) })} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm" aria-live="polite">{t('share_media.generating', { percent: Math.round(progress * 100) })}</span>
            <Button type="button" variant="outline" className="rounded-full" onClick={cancel}>{t('share_media.cancel')}</Button>
          </div>
        </div>
      ) : status === 'done' ? (
        <div className="space-y-3">
          <p role="status" className="text-sm font-semibold">{t('share_media.ready', { size: sizeLabel })}</p>
          <div className={`grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {canShare && (
              <Button type="button" className="rounded-full" onClick={share}><Share2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t('share_media.share')}</Button>
            )}
            <Button type="button" variant={canShare ? 'outline' : 'default'} className="rounded-full" onClick={() => downloadFiles(files, `${slug}-${aspect}.zip`)}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" /> {t('share_media.download')}
            </Button>
          </div>
          <Button type="button" variant="ghost" className="w-full rounded-full" onClick={() => setStatus('idle')}>{t('share_media.again')}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {status === 'error' && <p role="alert" className="text-sm text-destructive">{t('share_media.failed')}</p>}
          <Button type="button" className="w-full rounded-full" disabled={kind === 'video' && !videoScale} onClick={create}>
            {kind === 'video' && videoScale === undefined && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t('share_media.generate')}
          </Button>
        </div>
      )}
    </div>
  );
}

type Props = { quizId: string; title: string; open: boolean; onOpenChange: (open: boolean) => void };

/** Bottom drawer on phones, side sheet on larger screens. Closing it cancels any export in progress. */
export default function ShareMediaSheet({ quizId, title, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[94vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{t('share_media.title')}</DrawerTitle>
            <DrawerDescription>{t('share_media.description')}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8">
            <SharePanel quizId={quizId} title={title} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('share_media.title')}</SheetTitle>
          <SheetDescription>{t('share_media.description')}</SheetDescription>
        </SheetHeader>
        <div className="mt-5">
          <SharePanel quizId={quizId} title={title} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
