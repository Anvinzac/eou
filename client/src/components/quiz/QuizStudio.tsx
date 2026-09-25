import { useTranslation } from 'react-i18next';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy, Eye, Heart, Lock, Shuffle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { SelectedQuestion } from '@/types/quiz';
import { getQuizTheme, QUIZ_THEMES, QUIZ_STYLES, QUESTION_EMOJIS, type QuizAppearance } from '@/lib/quizAppearance';
import QuestionStage from './QuestionStage';

export function StudioActions({ children, className = '' }: { children: ReactNode; className?: string }) {
  const mobile = useIsMobile();
  const { t } = useTranslation();
  if (!mobile) return <div className={className}>{children}</div>;
  return createPortal(
    <div className="quiz-studio studio-mobile-actions" role="region" aria-label={t('studio.navigation')}>
      <div className={className}>{children}</div>
    </div>,
    document.body,
  );
}

export function VibeStep({ appearance, onChange, title, onTitleChange, onNext }: {
  appearance: QuizAppearance;
  onChange: (value: QuizAppearance) => void;
  title: string;
  onTitleChange: (value: string) => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="studio-intro mb-8">
        <div className="studio-eyebrow mb-4"><span className="h-1.5 w-1.5 rounded-full bg-[#7b9368]" /> {t('studio.eyebrow')}</div>
        <h1 className="studio-title">{t('studio.title_first')}<br />{t('studio.title_second')} <span className="italic text-[#9367aa]">{t('studio.title_highlight')}</span><span className="ml-3 inline-block -rotate-12 text-4xl" aria-hidden="true">✳</span></h1>
        <p className="mt-4 max-w-md text-sm leading-7 text-[#827788]">{t('studio.intro')}</p>
      </div>
      <div className="mb-7">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="studio-label"><span>01</span> {t('studio.mood')}</h2>
          <button type="button" className="flex items-center gap-1.5 text-xs text-[#827788] hover:text-[#44394d]" onClick={() => {
            const others = QUIZ_THEMES.filter(theme => theme.id !== appearance.theme);
            onChange({ ...appearance, theme: others[Math.floor(Math.random() * others.length)].id });
          }}><Shuffle className="h-3 w-3" /> {t('studio.surprise')}</button>
        </div>
        <div className="studio-theme-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
          {QUIZ_THEMES.map(theme => (
            <button key={theme.id} type="button" aria-pressed={appearance.theme === theme.id} onClick={() => onChange({ ...appearance, theme: theme.id })} className={`studio-theme group ${appearance.theme === theme.id ? 'is-selected' : ''}`}>
              <div className="relative mb-2.5 flex h-[70px] items-center justify-center overflow-hidden rounded-xl" style={{ background: theme.gradient }}>
                <span className="absolute -right-3 -top-5 h-20 w-20 rounded-full border-[12px] border-white/20" />
                <span className="relative text-3xl transition-transform group-hover:scale-110 group-hover:-rotate-6" aria-hidden="true">{theme.emoji}</span>
                {appearance.theme === theme.id && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#594166]"><Check className="h-3 w-3" /></span>}
              </div>
              <span className="block text-[11px] font-bold sm:text-xs">{t(`studio.themes.${theme.id}.name`)}</span>
              <span className="mt-0.5 block text-[10px] text-[#827788]">{t(`studio.themes.${theme.id}.description`)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-7">
        <h2 className="studio-label mb-3"><span>02</span> {t('studio.style')}</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {QUIZ_STYLES.map(style => (
            <button key={style.id} type="button" aria-pressed={appearance.style === style.id} onClick={() => onChange({ ...appearance, style: style.id })} className={`studio-style ${appearance.style === style.id ? 'is-selected' : ''}`}>
              <span className={`mb-2 block text-lg sm:text-xl ${style.id === 'editorial' ? 'italic' : 'font-bold'}`} style={{ fontFamily: style.font }}>{t(`studio.styles.${style.id}.sample`)}</span>
              <span className="block text-[10px] font-semibold sm:text-xs">{t(`studio.styles.${style.id}.name`)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-7">
        <label className="studio-label mb-3" htmlFor="studio-title"><span>03</span> {t('studio.give_name')}</label>
        <Input id="studio-title" value={title} onChange={event => onTitleChange(event.target.value)} maxLength={80} placeholder={t('studio.default_title')} className="h-12 rounded-xl border-[#e3dce6] bg-white/70 text-sm" />
      </div>
      <StudioActions className="studio-vibe-actions flex flex-wrap items-center gap-4">
        <Button onClick={onNext} disabled={!title.trim()} className="studio-primary h-12 rounded-full px-7">{t('studio.pick_questions')} <ArrowRight className="ml-3 h-4 w-4" /></Button>
        <span className="hidden text-[11px] text-[#827788] md:inline">{t('studio.time_hint')}</span>
      </StudioActions>
    </motion.div>
  );
}

export function EmojiPicker({ value, onChange, label }: { value?: string; onChange: (value: string) => void; label?: string }) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label || t('studio.choose_sticker')} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-[#c9b5d6] bg-[#f7f0fa] px-3 py-1.5 text-xs font-semibold text-[#705482]">
          <span className="text-lg" aria-hidden="true">{value || '☺'}</span>{value ? t('studio.change_sticker') : t('studio.add_sticker')}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-24px))] max-h-[70dvh] overflow-y-auto rounded-2xl p-4" align="start" collisionPadding={12}>
        <p className="mb-1 text-sm font-bold">{t('studio.sticker_title')}</p>
        <p className="mb-3 text-xs text-muted-foreground">{t('studio.sticker_hint')}</p>
        <div className="grid grid-cols-5 gap-1 sm:grid-cols-6">
          {QUESTION_EMOJIS.map(([emoji], index) => <button key={emoji} type="button" aria-label={t(`studio.emojis.${index}`)} aria-pressed={value === emoji} onClick={() => onChange(emoji)} className={`min-h-11 rounded-xl text-2xl transition-transform hover:scale-110 hover:bg-muted ${value === emoji ? 'bg-purple-100 ring-2 ring-purple-300' : ''}`}>{emoji}</button>)}
        </div>
        <button type="button" onClick={() => onChange('')} className="mt-3 min-h-11 text-sm text-muted-foreground underline">{t('studio.remove_sticker')}</button>
      </PopoverContent>
    </Popover>
  );
}

function PreviewPlayer({ selected, appearance, title, expanded = false, focusId }: {
  selected: SelectedQuestion[]; appearance: QuizAppearance; title: string; expanded?: boolean; focusId?: number;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const focusedIndex = selected.findIndex(question => question.questionId === focusId);
  const currentIndex = Math.min(focusedIndex >= 0 && !expanded ? focusedIndex : index, Math.max(0, selected.length - 1));
  const question = selected[currentIndex] || {
    questionId: -1, text: t('studio.sample_text'), category: t('studio.sample_category'),
    options: t('studio.sample_options', { returnObjects: true }) as string[],
    emoji: '☕', correctAnswer: '', distractors: [],
  };
  const choices = question.correctAnswer && question.distractors.length === 3
    ? [question.distractors[0], question.correctAnswer, ...question.distractors.slice(1)]
    : question.options.length ? question.options.slice(0, 4) : t('studio.placeholder_options', { returnObjects: true }) as string[];
  const theme = getQuizTheme(appearance);
  return (
    <div className={expanded ? '' : 'studio-phone'}>
      {!expanded && <div className="mx-auto mb-4 mt-1 h-1.5 w-12 rounded-full bg-[#ded9e3]" aria-hidden="true" />}
      <div className="mb-3 flex items-center justify-between gap-3 px-2 text-[10px] font-semibold text-[#827788]">
        <span className="truncate">{title || t('studio.untitled')}</span><Heart className="h-3.5 w-3.5 shrink-0" />
      </div>
      {finished ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] p-8 text-center" style={{ background: theme.gradient, color: theme.ink }}>
          <span className="text-6xl">🎉</span><h3 className="mb-2 mt-6 text-2xl font-bold">{t('studio.preview_done')}</h3>
          <p className="text-sm">{t('studio.preview_safe')}</p>
          <Button className="mt-6 rounded-full" variant="outline" onClick={() => { setFinished(false); setIndex(0); setAnswers({}); }}>{t('studio.play_again')}</Button>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={question.questionId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <QuestionStage appearance={appearance} text={question.text} emoji={question.emoji} category={question.category} choices={choices} selectedAnswer={answers[question.questionId]} onAnswer={answer => setAnswers(prev => ({ ...prev, [question.questionId]: answer }))} questionNumber={currentIndex + 1} total={selected.length || 1} compact={!expanded} />
          </motion.div>
        </AnimatePresence>
      )}
      {!finished && (expanded || focusId === undefined) && (
        <div className="studio-preview-navigation mt-3 flex items-center justify-between px-2">
          <button type="button" aria-label={t('studio.preview_previous')} onClick={() => setIndex(currentIndex - 1)} disabled={currentIndex === 0} className="flex h-11 w-11 items-center justify-center rounded-full p-2 text-[#594166] disabled:opacity-25"><ArrowLeft className="h-4 w-4" /></button>
          <span className="text-[10px] text-[#827788]">{selected.length ? t('studio.preview_count', { current: currentIndex + 1, total: selected.length }) : t('studio.sample_label')}</span>
          <button type="button" aria-label={currentIndex >= selected.length - 1 ? t('studio.preview_finish') : t('studio.preview_next')} onClick={() => currentIndex >= selected.length - 1 ? setFinished(true) : setIndex(currentIndex + 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eee5f4] p-2 text-[#594166]"><ArrowRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

export function StudioPreview({ selected, appearance, title, focusId }: { selected: SelectedQuestion[]; appearance: QuizAppearance; title: string; focusId?: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const theme = getQuizTheme(appearance);
  return (
    <aside className="studio-preview-wrap">
      {!mobile && <>
      <div className="mb-6 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#827788]"><span className="h-1.5 w-1.5 rounded-full bg-[#7b9368]" /> {t('studio.sneak_peek')}</div>
      <div className="relative mx-auto max-w-[330px]">
        <div className="absolute -inset-9 -z-10 rounded-full opacity-70 blur-3xl" style={{ background: theme.gradient }} />
        <span aria-hidden="true" className="absolute -right-5 top-9 z-10 rotate-12 rounded-xl bg-[#f7edc9] px-3 py-2 text-[11px] font-bold text-[#7b653c] shadow-sm">{t('studio.you_badge')}</span>
        <PreviewPlayer selected={selected} appearance={appearance} title={title} focusId={focusId} />
      </div>
      </>}
      <div className={mobile ? '' : 'mt-6 text-center'}>
        {!mobile && <p className="text-xs text-[#827788]">{t('studio.preview_hint')}</p>}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className={mobile ? 'studio-mobile-preview-trigger' : 'mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#ded5e4] bg-white/70 px-5 py-2.5 text-xs font-semibold text-[#594166]'}>
              {mobile && <><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: theme.gradient }} aria-hidden="true">{theme.emoji}</span><span className="min-w-0 flex-1 truncate text-left text-xs font-semibold">{t(`studio.themes.${theme.id}.name`)}</span></>}
              <Eye className="h-4 w-4 shrink-0" /><span className="shrink-0">{t(mobile ? 'studio.preview_mobile' : 'studio.preview_open')}</span>
            </button>
          </DialogTrigger>
          <DialogContent className="studio-preview-dialog max-h-[90dvh] max-w-lg overflow-y-auto rounded-3xl">
            <DialogHeader className="pr-9 text-left"><DialogTitle>{t('studio.preview_title')}</DialogTitle><DialogDescription>{t('studio.preview_description')}</DialogDescription></DialogHeader>
            {open && <PreviewPlayer selected={selected} appearance={appearance} title={title} expanded />}
          </DialogContent>
        </Dialog>
      </div>
      {!mobile && <p className="mt-7 text-center font-serif text-sm italic text-[#a294aa]">{t('studio.preview_quote')}</p>}
    </aside>
  );
}

export function PublishSettings({ isOpen, onChange, onEdit, appearance }: { isOpen: boolean; onChange: (value: boolean) => void; onEdit: () => void; appearance: QuizAppearance }) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 rounded-2xl border border-[#e4dce8] bg-white/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{t('studio.invite_title')}</h3><button onClick={onEdit} className="min-h-11 shrink-0 text-xs text-[#7953b6] underline">{t('studio.edit_look')}</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[{ value: false, title: t('studio.private_title'), text: t('studio.private_hint'), icon: Lock }, { value: true, title: t('studio.public_title'), text: t('studio.public_hint'), icon: Heart }].map(option => (
          <button key={option.title} type="button" aria-pressed={isOpen === option.value} onClick={() => onChange(option.value)} className={`rounded-xl border p-3 text-left ${isOpen === option.value ? 'border-[#9d7eb2] bg-[#f2eaf8]' : 'border-[#e4dce8]'}`}>
            <option.icon className="mb-2 h-4 w-4 text-[#7953b6]" /><span className="block text-xs font-bold">{option.title}</span><span className="mt-1 block text-[11px] leading-5 text-[#827788]">{option.text}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-[#827788]">{getQuizTheme(appearance).emoji} {t(`studio.themes.${appearance.theme}.name`)} · {t('studio.included')}</p>
    </div>
  );
}

export function PublishedQuiz({ id, title, isOpen, appearance, onDashboard }: { id: string; title: string; isOpen: boolean; appearance: QuizAppearance; onDashboard: () => void }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const theme = getQuizTheme(appearance);
  const url = `${window.location.origin}/quiz/${id}`;
  return (
    <motion.div initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative mx-auto max-w-xl overflow-hidden rounded-[2rem] border border-white p-5 text-center shadow-soft sm:p-12" style={{ background: theme.gradient, color: theme.ink }}>
      {!reduce && <div className="pointer-events-none absolute inset-0" aria-hidden="true">{['✨', '💖', '🎉', '🦋', '🌷', '✨'].map((emoji, i) => <motion.span key={i} className="absolute text-2xl" style={{ left: `${8 + i * 16}%`, top: -35 }} animate={{ y: [0, 580], rotate: [0, i % 2 ? 120 : -120], opacity: [0, 1, 1, 0] }} transition={{ duration: 3.5, delay: i * 0.15 }}>{emoji}</motion.span>)}</div>}
      <span className="text-6xl">💌</span>
      <p className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-[0.2em]">{t('studio.published_eyebrow')}</p>
      <h1 className="font-serif text-4xl">{t('studio.published_title')}</h1>
      <p className="mt-4 break-words text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6">{isOpen ? t('studio.published_public') : t('studio.published_private')}</p>
      {isOpen && <div className="mt-7 flex flex-col gap-3"><Input aria-label={t('studio.share_link')} value={url} readOnly className="bg-white/80 text-[#44394d]" onFocus={event => event.target.select()} /><Button className="studio-primary rounded-full" onClick={async () => {
        try { await navigator.clipboard.writeText(url); toast.success(t('studio.link_copied')); }
        catch { toast.error(t('studio.copy_failed')); }
      }}><Copy className="mr-2 h-4 w-4" /> {t('studio.copy_link')}</Button></div>}
      <Button onClick={onDashboard} variant="outline" className="mt-4 rounded-full border-current bg-transparent">{isOpen ? t('studio.dashboard') : t('studio.invitations')}<ArrowRight className="ml-2 h-4 w-4" /></Button>
    </motion.div>
  );
}
