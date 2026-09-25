import { useTranslation } from 'react-i18next';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, Trash2, ArrowUp, ArrowDown, Pencil, X, Shuffle, Plus,
  Package, ListChecks, Sparkles, Wand2, Heart, PartyPopper,
  Loader2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { authApi, catalogApi, distractorsApi, quizzesApi } from '@/api';
import { containsProfanity } from '@/lib/profanity';
import { CATEGORIES, getCategoryMeta } from '@/lib/categories';
import type { QuestionData, SelectedQuestion } from '@/types/quiz';
import PacksStep from '@/components/quiz/PacksStep';
import { VibeStep, StudioPreview, StudioActions, EmojiPicker, PublishSettings, PublishedQuiz } from '@/components/quiz/QuizStudio';
import { QUIZ_THEMES, QUIZ_STYLES, resolveQuizAppearance, type QuizAppearance } from '@/lib/quizAppearance';

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;
type Step = 'vibe' | 'packs' | 'select' | 'reorder' | 'answers' | 'review';
const STUDIO_PHASES = [
  { step: 'vibe' },
  { step: 'select' },
  { step: 'answers' },
  { step: 'review' },
] as const;

const DRAFT_TOKEN_KEY = 'quiz_draft_token';
const DRAFT_QUIZ_ID_KEY = 'quiz_draft_id';

export default function CreateQuiz() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('vibe');
  const [appearance, setAppearance] = useState<QuizAppearance>(() => resolveQuizAppearance({
    theme: QUIZ_THEMES.find(theme => theme.id === searchParams.get('theme'))?.id,
    style: QUIZ_STYLES.find(style => style.id === searchParams.get('style'))?.id,
  }));
  const [isOpen, setIsOpen] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<number>();
  const savingRef = useRef(false);
  const stepHeading = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<SelectedQuestion[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionData[]>([]);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [customTitle, setQuizTitle] = useState<string | null>(null);
  const quizTitle = customTitle ?? t('studio.default_title');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const locale = i18n.resolvedLanguage === 'en' ? 'en' : 'vi';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    stepHeading.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(false);
    setAllQuestions([]);
    catalogApi.preferenceQuestions(locale).then((data) => {
      if (!cancelled) setAllQuestions((data.questions || []) as QuestionData[]);
    }).catch(() => {
      if (!cancelled) {
        setCatalogError(true);
        toast.error(t('studio.catalog_failed'));
      }
    }).finally(() => {
      if (!cancelled) setCatalogLoading(false);
    });
    return () => { cancelled = true; };
  }, [locale, catalogRetry, t]);

  const questionsByCategory = useMemo(() => {
    const map: Record<string, QuestionData[]> = {};
    CATEGORIES.forEach(c => { map[c.key] = []; });
    allQuestions.forEach(q => {
      if (map[q.category]) map[q.category].push(q);
    });
    return map;
  }, [allQuestions]);

  const selectedIds = useMemo(() => new Set(selected.map(s => s.questionId)), [selected]);
  const remaining = MAX_QUESTIONS - selected.length;
  const customIdCounter = useRef(90000);

  const addCustomQuestion = useCallback((text: string) => {
    setSelected(prev => {
      if (prev.length >= MAX_QUESTIONS) {
        toast.error(t('studio.max_questions', { count: MAX_QUESTIONS }));
        return prev;
      }
      customIdCounter.current += 1;
      return [...prev, {
        questionId: customIdCounter.current,
        category: 'Custom',
        text,
        options: [],
        orderNumber: prev.length + 1,
        correctAnswer: '',
        distractors: [],
        isCustom: true,
      }];
    });
  }, [t]);

  // Link draft quiz to user after login
  useEffect(() => {
    if (!user) return;
    const draftToken = localStorage.getItem(DRAFT_TOKEN_KEY);
    const draftQuizId = localStorage.getItem(DRAFT_QUIZ_ID_KEY);
    if (draftToken && draftQuizId) {
      authApi.claimDraft(draftQuizId, draftToken)
        .then(() => {
          localStorage.removeItem(DRAFT_TOKEN_KEY);
          localStorage.removeItem(DRAFT_QUIZ_ID_KEY);
        })
        .catch(() => { /* already claimed or invalid */ });
    }
  }, [user]);

  const toggleQuestion = useCallback((q: QuestionData) => {
    setSelected(prev => {
      const exists = prev.find(s => s.questionId === q.id);
      if (exists) {
        return prev.filter(s => s.questionId !== q.id).map((question, i) => ({ ...question, orderNumber: i + 1 }));
      }
      if (prev.length >= MAX_QUESTIONS) {
        toast.error(t('studio.max_questions', { count: MAX_QUESTIONS }));
        return prev;
      }
      return [...prev, {
        questionId: q.id,
        category: q.category,
        text: q.text,
        options: q.options,
        orderNumber: prev.length + 1,
        correctAnswer: '',
        distractors: [],
        isCustom: false,
      }];
    });
  }, [t]);

  const fillRandomQuestions = useCallback(() => {
    setSelected(prev => {
      if (prev.length >= MIN_QUESTIONS) return prev;
      const usedIds = new Set(prev.map(s => s.questionId));
      const available = allQuestions.filter(q => !usedIds.has(q.id));
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const needed = MIN_QUESTIONS - prev.length;
      const toAdd = shuffled.slice(0, needed).map((q, i) => ({
        questionId: q.id,
        category: q.category,
        text: q.text,
        options: q.options,
        orderNumber: prev.length + i + 1,
        correctAnswer: '',
        distractors: [],
        isCustom: false,
      }));
      return [...prev, ...toAdd];
    });
  }, [allQuestions]);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSelected(prev => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr.map((q, i) => ({ ...q, orderNumber: i + 1 }));
    });
  };

  const moveDown = (idx: number) => {
    setSelected(prev => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr.map((q, i) => ({ ...q, orderNumber: i + 1 }));
    });
  };

  const deleteQuestion = (idx: number) => {
    const q = selected[idx];
    setSelected(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, orderNumber: i + 1 })));
    const catIdx = CATEGORIES.findIndex(c => c.key === q.category);
    if (catIdx >= 0) setActiveCategoryIdx(catIdx);
    setStep('select');
    toast.info(t('studio.removed', { text: q.text.slice(0, 40) }));
  };

  const handleNextToReorder = () => {
    if (selected.length < MIN_QUESTIONS) {
      toast.info(t('studio.min_questions', { count: MIN_QUESTIONS }));
      return;
    }
    setStep('reorder');
  };

  const handleSelectPack = (questions: SelectedQuestion[]) => {
    setSelected(questions.slice(0, MAX_QUESTIONS));
    setPreviewId(undefined);
    setStep('select');
    toast.success(t('studio.pack_loaded'));
  };

  const toApiQuestions = () =>
    selected.map((q, index) => ({
      questionId: q.questionId,
      category: q.category,
      text: q.text,
      orderNumber: index + 1,
      emoji: q.emoji || '',
      correctAnswer: q.isCustom && q.customCorrect ? q.customCorrect : q.correctAnswer,
      distractors: q.isCustom && q.customDistractors?.length === 3 ? q.customDistractors : q.distractors,
      isCustom: q.isCustom,
    }));

  const saveQuiz = async () => {
    if (savingRef.current) return;
    if (!quizTitle.trim() || selected.length < MIN_QUESTIONS || selected.some(q => !q.correctAnswer.trim() || q.distractors.filter(d => d.trim()).length !== 3)) {
      toast.error(t('studio.incomplete'));
      return;
    }
    savingRef.current = true;
    if (!user) {
      try {
        const { quiz, draftToken } = await quizzesApi.createDraft(quizTitle, toApiQuestions(), { appearance, isOpen });
        localStorage.setItem(DRAFT_TOKEN_KEY, draftToken);
        localStorage.setItem(DRAFT_QUIZ_ID_KEY, quiz.id);
        toast.success(t('create_quiz.toast.draft_saved'));
        navigate('/auth');
      } catch (err: any) {
        toast.error(t('create_quiz.toast.draft_failed'));
      } finally {
        savingRef.current = false;
      }
      return;
    }

    try {
      const { quiz } = await quizzesApi.create(quizTitle, toApiQuestions(), { appearance, isOpen });
      setPublishedId(quiz.id);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err: any) {
      toast.error(t('create_quiz.toast.save_failed'));
    } finally {
      savingRef.current = false;
    }
  };

  const phase = step === 'vibe' ? 0 : step === 'answers' ? 2 : step === 'review' ? 3 : 1;
  const answersReady = selected.length >= MIN_QUESTIONS && selected.every(q => q.correctAnswer.trim() && q.distractors.length === 3 && q.distractors.every(d => d.trim()));
  const handleBack = () => {
    if (step === 'vibe') navigate('/');
    else if (step === 'select') setStep('vibe');
    else if (step === 'packs' || step === 'reorder') setStep('select');
    else if (step === 'answers') setStep('reorder');
    else setStep('answers');
  };
  const updateEmoji = (questionId: number, emoji: string) => {
    setSelected(prev => prev.map(q => q.questionId === questionId ? { ...q, emoji } : q));
    setPreviewId(questionId);
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="quiz-studio min-h-screen">
      <header className="studio-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5" aria-label={t('common.home')}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8dcf2] text-xl">✳</span><span className="font-display text-xl font-bold tracking-tight">eou<span className="text-[#a17caf]">.</span></span><span className="ml-2 hidden border-l border-[#ded5e4] pl-4 text-xs text-[#827788] sm:block">{t('studio.name')}</span></button>
          <div className="flex items-center gap-4"><span className="hidden items-center gap-2 text-[11px] text-[#827788] lg:flex"><Heart className="h-3.5 w-3.5" /> {t('studio.tagline')}</span><LanguageSwitcher /></div>
        </div>
      </header>
      {publishedId ? <main className="px-4 py-8 sm:px-5 sm:py-16"><PublishedQuiz id={publishedId} title={quizTitle} appearance={appearance} isOpen={isOpen} onDashboard={() => navigate('/dashboard')} /></main> : <>
      <nav className="studio-nav" aria-label={t('studio.navigation')}>
        <div className="studio-nav-inner mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <button onClick={handleBack} className="studio-back flex min-h-11 min-w-11 items-center justify-center gap-1 py-5 text-xs text-[#827788]" aria-label={t('common.back')}><ArrowLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t('common.back')}</span></button>
          <div className="studio-phases flex flex-1 justify-center gap-3 sm:gap-8">
            {STUDIO_PHASES.map((item, index) => <button key={item.step} type="button" onClick={() => setStep(item.step)} aria-label={t(`studio.phases.${item.step}`)} aria-current={phase === index ? 'step' : undefined} disabled={(index > 0 && !quizTitle.trim()) || (index === 2 && selected.length < MIN_QUESTIONS) || (index === 3 && !answersReady)} className={`studio-nav-item ${phase === index ? 'is-active' : ''}`}><span className="studio-step-number">{index < phase ? <Check className="h-3 w-3" /> : `0${index + 1}`}</span><span className="hidden md:inline">{t(`studio.phases.${item.step}`)}</span><span className="md:hidden">{t(`studio.short_phases.${item.step}`)}</span></button>)}
          </div>
          <span className="hidden w-12 text-right text-[10px] text-[#a294aa] md:block">{phase + 1} / 4</span>
        </div>
      </nav>
      <main className="studio-layout">
        <div ref={stepHeading} tabIndex={-1} className="min-w-0 outline-none" aria-label={t(`studio.phases.${STUDIO_PHASES[phase].step}`)}>
        {step === 'select' && <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><button onClick={() => setStep('packs')} className="studio-tool"><Package className="h-3.5 w-3.5" /> {t('studio.pack_start')}</button><button onClick={fillRandomQuestions} disabled={selected.length >= MIN_QUESTIONS || allQuestions.length === 0} className="studio-tool disabled:opacity-40"><Shuffle className="h-3.5 w-3.5" /> {t('studio.random_five')}</button></div>}
        {step === 'select' && <>
          {selected.length > 0 && <p className="mb-4 text-xs leading-5 text-muted-foreground">{t('studio.selection_language')}</p>}
          {catalogLoading && <p role="status" className="mb-4 text-sm">{t('studio.catalog_loading')}</p>}
          {catalogError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm"><span>{t('studio.catalog_failed')}</span><Button variant="outline" onClick={() => setCatalogRetry(value => value + 1)}>{t('studio.retry')}</Button></div>}
        </>}
        <AnimatePresence mode="wait">
          {step === 'vibe' && <VibeStep key="vibe" appearance={appearance} onChange={setAppearance} title={quizTitle} onTitleChange={setQuizTitle} onNext={() => setStep('select')} />}
          {step === 'packs' && (
            <PacksStep
              key="packs"
              catalog={allQuestions}
              onSelectPack={handleSelectPack}
              onSkip={() => setStep('select')}
            />
          )}
          {step === 'select' && (
            <SelectStep
              key="select"
              questionsByCategory={questionsByCategory}
              catalogLoading={catalogLoading || catalogError}
              selectedIds={selectedIds}
              toggleQuestion={(q: QuestionData) => { toggleQuestion(q); setPreviewId(q.id); }}
              remaining={remaining}
              activeCategoryIdx={activeCategoryIdx}
              setActiveCategoryIdx={setActiveCategoryIdx}
              onNext={handleNextToReorder}
              addCustomQuestion={addCustomQuestion}
            />
          )}
          {step === 'reorder' && (
            <ReorderStep
              key="reorder"
              selected={selected}
              moveUp={moveUp}
              moveDown={moveDown}
              deleteQuestion={deleteQuestion}
              onEmojiChange={updateEmoji}
              onNext={() => setStep('answers')}
            />
          )}
          {step === 'answers' && (
            <AnswersStep
              key="answers"
              selected={selected}
              setSelected={setSelected}
              onFocusQuestion={setPreviewId}
              onEmojiChange={updateEmoji}
              onNext={() => { setPreviewId(undefined); setStep('review'); }}
            />
          )}
          {step === 'review' && (
            <ReviewStep
              key="review"
              selected={selected}
              onSave={saveQuiz}
              user={user}
              onLogin={saveQuiz}
              appearance={appearance}
              isOpen={isOpen}
              setIsOpen={setIsOpen}
              title={quizTitle}
              setTitle={setQuizTitle}
              onEditLook={() => setStep('vibe')}
            />
          )}
        </AnimatePresence>
        </div>
        <StudioPreview key={step} selected={selected} appearance={appearance} title={quizTitle} focusId={step === 'vibe' || step === 'review' ? undefined : previewId} />
      </main>
      <footer className="pb-7 text-center text-[10px] tracking-wide text-[#a294aa]">{t('studio.footer')}</footer>
      </>}
    </div>
    </MotionConfig>
  );
}

/* ============= SELECT STEP ============= */
function SelectStep({ questionsByCategory, selectedIds, toggleQuestion, remaining, activeCategoryIdx, setActiveCategoryIdx, onNext, addCustomQuestion, catalogLoading }: any) {
  const { t } = useTranslation();
  const activeCategory = CATEGORIES[activeCategoryIdx];
  const questions = questionsByCategory[activeCategory.key] || [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [customText, setCustomText] = useState('');
  const totalSelected = MAX_QUESTIONS - remaining;
  const minReached = totalSelected >= MIN_QUESTIONS;
  const progressPct = Math.min(100, (totalSelected / MAX_QUESTIONS) * 100);

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    if (trimmed.length < 5) {
      toast.error(t('studio.too_short'));
      return;
    }
    if (containsProfanity(trimmed)) {
      toast.error(t('create_quiz.toast.profanity'));
      return;
    }
    addCustomQuestion(trimmed);
    setCustomText('');
    toast.success(t('studio.custom_added'));
  };

  // Scroll active category into view
  useEffect(() => {
    const el = scrollRef.current?.children[activeCategoryIdx] as HTMLElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeCategoryIdx]);

  const ActiveIcon = activeCategory.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ========== Big animated counter + progress ring ========== */}
      <div className="relative mb-6 overflow-hidden rounded-3xl glass p-5 shadow-soft">
        <div className={`pointer-events-none absolute inset-0 ${activeCategory.colorClass} opacity-30 transition-colors duration-700`} />
        <div className="relative flex items-center gap-5">
          <div className="relative h-20 w-20 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="42" stroke="hsl(var(--muted))" strokeWidth="9" fill="none" />
              <motion.circle
                cx="50" cy="50" r="42"
                stroke="hsl(var(--coral))"
                strokeWidth="9"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 42}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - progressPct / 100) }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              />
              {/* Min marker tick */}
              <line
                x1="50" y1="4" x2="50" y2="13"
                stroke="hsl(var(--teal))"
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${(MIN_QUESTIONS / MAX_QUESTIONS) * 360} 50 50)`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={totalSelected}
                  initial={{ y: 12, opacity: 0, scale: 0.7 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -12, opacity: 0, scale: 0.7 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                  className="text-2xl font-bold font-display leading-none text-foreground"
                >
                  {totalSelected}
                </motion.span>
              </AnimatePresence>
              <span className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{t('studio.of_max', { count: MAX_QUESTIONS })}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t('studio.select_step')}</div>
            <h2 className="text-lg md:text-xl font-bold font-display leading-tight">
              {totalSelected === 0 && t('studio.select_empty')}
              {totalSelected > 0 && totalSelected < MIN_QUESTIONS && t('studio.more_minimum', { count: MIN_QUESTIONS - totalSelected })}
              {totalSelected >= MIN_QUESTIONS && totalSelected < MAX_QUESTIONS && t('studio.select_ready')}
              {totalSelected === MAX_QUESTIONS && (
                <span className="text-gradient-warm">{t('studio.select_full')}</span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('studio.select_hint', { min: MIN_QUESTIONS, max: MAX_QUESTIONS })}
            </p>
          </div>
        </div>
      </div>

      {/* ========== Custom question input ========== */}
      <div className="mb-5 relative">
        <div className="relative flex items-center gap-2 rounded-full glass p-1.5 pl-4 shadow-soft">
          <Wand2 className="h-4 w-4 text-primary flex-shrink-0" />
          <Input
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); }}
            placeholder={t('studio.custom_placeholder')}
            aria-label={t('studio.custom_placeholder')}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={200}
            disabled={remaining === 0}
          />
          <Button
            onClick={handleAddCustom}
            disabled={remaining === 0 || !customText.trim()}
            className="h-9 rounded-full gradient-coral text-primary-foreground text-xs px-4 shrink-0"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> {t('common.add')}
          </Button>
        </div>
      </div>

      {/* ========== Category strip with spotlight ========== */}
      <div className="-mx-4 mb-6 relative">
        <div ref={scrollRef} className="flex gap-2 overflow-x-auto py-3 px-4 hide-scrollbar">
          {CATEGORIES.map((cat, idx) => {
            const count = questionsByCategory[cat.key]?.filter((q: QuestionData) => selectedIds.has(q.id)).length || 0;
            const Icon = cat.icon;
            const isActive = idx === activeCategoryIdx;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategoryIdx(idx)}
                aria-pressed={isActive}
                className="relative flex flex-shrink-0 flex-col items-center gap-1 rounded-2xl px-4 py-3 transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="cat-spotlight"
                    className={`absolute inset-0 rounded-2xl ${cat.colorClass} border-2 border-current shadow-glow`}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  />
                )}
                <div className={`relative z-10 flex flex-col items-center gap-1 ${isActive ? '' : 'text-muted-foreground'}`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-semibold whitespace-nowrap">{t(`categories.${cat.key}`)}</span>
                </div>
                <AnimatePresence>
                  {count > 0 && (
                    <motion.span
                      key="cnt"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      className="absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full gradient-coral text-[10px] font-bold text-primary-foreground shadow-soft"
                    >
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== Active category label ========== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="mb-3 flex items-center gap-2"
        >
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${activeCategory.colorClass} border border-current`}>
            <ActiveIcon className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm font-bold font-display">{t(`categories.${activeCategory.key}`)}</h3>
          <span className="text-xs text-muted-foreground">· {t('common.questions', { count: questions.length })}</span>
        </motion.div>
      </AnimatePresence>

      {!catalogLoading && questions.length === 0 && <p className="py-6 text-sm text-muted-foreground">{t('studio.catalog_empty')}</p>}
      {/* ========== Questions grid ========== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory.key}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {questions.map((q: QuestionData, qi: number) => {
            const isSelected = selectedIds.has(q.id);
            return (
              <motion.button
                key={q.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qi * 0.03, type: 'spring', stiffness: 300, damping: 24 }}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleQuestion(q)}
                aria-pressed={isSelected}
                disabled={!isSelected && remaining === 0}
                className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-colors ${
                  isSelected
                    ? `${activeCategory.colorClass} border-current shadow-glow`
                    : 'border-border bg-card hover:border-primary/40 hover:shadow-soft disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {/* Gradient sweep on hover */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/[0.04] opacity-0 transition-opacity group-hover:opacity-100" />

                <AnimatePresence>
                  {isSelected && (
                    <>
                      <motion.div
                        key="ring"
                        initial={{ scale: 0.6, opacity: 0.6 }}
                        animate={{ scale: 2.4, opacity: 0 }}
                        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                        className="absolute right-3 top-3 h-6 w-6 rounded-full bg-primary/50"
                      />
                      <motion.div
                        key="check"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 16 }}
                        className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full gradient-coral text-primary-foreground shadow-soft"
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest opacity-60">{isSelected ? t('studio.in_collection') : t('studio.conversation_starter')}</span>
                <p className="relative pr-8 text-sm font-medium leading-relaxed">{q.text}</p>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ========== Sticky-feel bottom action ========== */}
      <StudioActions className="studio-selection-actions sticky bottom-4 z-10 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl glass p-3 shadow-soft">
        <div className="flex items-center gap-2 px-2">
          <div className="relative h-2 w-32 overflow-hidden rounded-full bg-muted sm:w-48">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-teal via-coral to-rose"
              animate={{ width: `${progressPct}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
            {/* Min marker */}
            <div
              className="absolute inset-y-0 w-0.5 bg-teal"
              style={{ left: `${(MIN_QUESTIONS / MAX_QUESTIONS) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums">
            {totalSelected}/{MAX_QUESTIONS}
          </span>
        </div>
        <motion.div whileTap={{ scale: 0.96 }}>
          <Button
            onClick={onNext}
            disabled={!minReached}
            className={`relative overflow-hidden rounded-full ${
              minReached
                ? 'shimmer-sweep gradient-coral text-primary-foreground shadow-glow'
                : ''
            }`}
            size="lg"
          >
            {minReached ? (
              <>{t('studio.make_yours')} <ArrowRight className="ml-1.5 h-4 w-4" /></>
            ) : (
              <>{t('studio.pick_more', { count: Math.max(0, MIN_QUESTIONS - totalSelected) })}</>
            )}
          </Button>
        </motion.div>
      </StudioActions>
    </motion.div>
  );
}

/* ============= REORDER STEP ============= */
function ReorderStep({ selected, moveUp, moveDown, deleteQuestion, onNext, onEmojiChange }: {
  selected: SelectedQuestion[];
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
  deleteQuestion: (index: number) => void;
  onNext: () => void;
  onEmojiChange: (questionId: number, emoji: string) => void;
}) {
  const { t } = useTranslation();
  // Build a category-distribution strip
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selected.forEach((s: SelectedQuestion) => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return counts;
  }, [selected]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ===== Header card ===== */}
      <div className="relative mb-5 overflow-hidden rounded-3xl glass p-5 shadow-soft">
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-lavender/40 via-rose/30 to-coral/30 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t('studio.reorder_step')}</div>
            <h2 className="text-xl md:text-2xl font-bold font-display leading-tight">
              {t('studio.reorder_title')} <span className="text-gradient-warm">{t('studio.personality')}</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('studio.reorder_hint')}
            </p>
          </div>
          <StudioActions className="studio-reorder-actions">
            <Button
              onClick={onNext}
              className="relative overflow-hidden shimmer-sweep gradient-coral text-primary-foreground rounded-full shadow-glow"
              size="lg"
            >
              {t('studio.set_answers')} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </StudioActions>
        </div>

        {/* Category distribution strip */}
        <div className="relative mt-4 flex h-2 overflow-hidden rounded-full bg-muted/60">
          {Object.entries(categoryCounts).map(([key, count]) => {
            const meta = getCategoryMeta(key);
            return (
              <motion.div
                key={key}
                layout
                initial={{ width: 0 }}
                animate={{ width: `${(count / selected.length) * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                className={meta.bgClass}
                title={`${t(`categories.${key}`, { defaultValue: key })}: ${count}`}
              />
            );
          })}
        </div>
      </div>

      {/* ===== Question list ===== */}
      <div className="space-y-2.5">
        {selected.map((q: SelectedQuestion, idx: number) => {
          const meta = getCategoryMeta(q.category);
          const Icon = meta.icon;
          return (
            <motion.div
              key={q.questionId}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-glow transition-shadow"
            >
              {/* Color stripe on the left */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.bgClass}`} />

              <div className="studio-reorder-card flex flex-wrap items-center gap-3 p-4 pl-5">
                {/* Animated number badge */}
                <div className="relative h-10 w-10 flex-shrink-0">
                  <div className={`absolute inset-0 rounded-xl ${meta.colorClass} border border-current`} />
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={idx}
                      initial={{ y: 14, opacity: 0, scale: 0.6 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: -14, opacity: 0, scale: 0.6 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                      className="absolute inset-0 flex items-center justify-center text-sm font-bold font-display"
                    >
                      {idx + 1}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{q.emoji && <span className="mr-2 text-xl">{q.emoji}</span>}{q.text}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Icon className="h-3 w-3 opacity-60" />
                    <span className="text-[11px] font-semibold opacity-70">{t(`categories.${q.category}`, { defaultValue: q.category })}</span>
                  </div>
                </div>

                <div className="studio-reorder-controls flex flex-wrap items-center gap-2">
                <EmojiPicker value={q.emoji} onChange={emoji => onEmojiChange(q.questionId, emoji)} label={t('studio.sticker_for', { number: idx + 1 })} />
                {/* Controls — pill cluster */}
                <div className="flex items-center gap-0.5 rounded-full bg-muted/60 p-1">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-card hover:shadow-soft disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t('studio.move_up')}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === selected.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-card hover:shadow-soft disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t('studio.move_down')}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteQuestion(idx)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-destructive transition-all hover:bg-destructive/10"
                    aria-label={t('common.remove')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ============= ANSWERS STEP ============= */
function AnswersStep({ selected, setSelected, onNext, onFocusQuestion, onEmojiChange }: any) {
  const { t } = useTranslation();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [customMode, setCustomMode] = useState(false);
  const [customCorrect, setCustomCorrect] = useState('');
  const [profanityWarning, setProfanityWarning] = useState('');
  const [autoRandomize, setAutoRandomize] = useState(true);
  const [customDistractorInputs, setCustomDistractorInputs] = useState<string[]>(['', '', '']);
  const [generating, setGenerating] = useState(false);
  const q = selected[currentIdx] as SelectedQuestion;
  const isFullyCustom = q.isCustom && q.options.length === 0;

  useEffect(() => {
    onFocusQuestion(q.questionId);
    setCustomMode(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [q.questionId, onFocusQuestion]);

  const selectCorrect = (opt: string) => {
    if (autoRandomize && opt) {
      const available = q.options.filter(o => o !== opt);
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const autoDistractors = shuffled.slice(0, 3);
      setSelected((prev: SelectedQuestion[]) => prev.map((s, i) =>
        i === currentIdx ? { ...s, correctAnswer: opt, distractors: autoDistractors, isCustom: false } : s
      ));
    } else {
      setSelected((prev: SelectedQuestion[]) => prev.map((s, i) =>
        i === currentIdx ? { ...s, correctAnswer: opt, isCustom: false } : s
      ));
    }
  };

  const toggleDistractor = (opt: string) => {
    setSelected((prev: SelectedQuestion[]) => prev.map((s, i) => {
      if (i !== currentIdx) return s;
      const distractors = s.distractors.includes(opt)
        ? s.distractors.filter(d => d !== opt)
        : s.distractors.length < 3 ? [...s.distractors, opt] : s.distractors;
      return { ...s, distractors, isCustom: false };
    }));
  };

  const validateAndSetCustomText = (text: string, setter: (v: string) => void) => {
    if (containsProfanity(text)) {
      setProfanityWarning(t('studio.profanity_cleared'));
      setter('');
      setTimeout(() => setProfanityWarning(''), 3000);
      return;
    }
    setter(text);
  };

  // For fully custom questions: set correct answer + auto-generate distractors
  const handleCustomAnswerSubmit = () => {
    const answer = customCorrect.trim();
    if (!answer) {
      toast.error(t('studio.enter_correct'));
      return;
    }
    setGenerating(true);
    distractorsApi.generate(answer, { questionText: q.text, category: q.category, count: 3 })
      .then(({ distractors, source }) => {
        setCustomDistractorInputs(distractors);
        setSelected((prev: SelectedQuestion[]) => prev.map((s, i) =>
          i === currentIdx ? {
            ...s,
            isCustom: true,
            customCorrect: answer,
            customDistractors: distractors,
            correctAnswer: answer,
            distractors,
          } : s
        ));
        toast.success(source === 'llm' ? t('studio.ai_ready') : t('studio.generated'));
      })
      .finally(() => setGenerating(false));
  };

  const handleRegenerateDistractors = () => {
    const answer = q.correctAnswer || customCorrect.trim();
    if (!answer) return;
    const selectedQuestion = q;
    setGenerating(true);
    distractorsApi.generate(answer, {
      questionText: selectedQuestion.text,
      category: selectedQuestion.category,
      count: 3,
    })
      .then(({ distractors, source }) => {
        setCustomDistractorInputs(distractors);
        setSelected((prev: SelectedQuestion[]) => prev.map((s, i) =>
          i === currentIdx ? {
            ...s,
            customDistractors: distractors,
            distractors,
          } : s
        ));
        toast.success(source === 'llm' ? t('studio.ai_ready') : t('studio.generated'));
      })
      .finally(() => setGenerating(false));
  };

  const updateCustomDistractor = (idx: number, value: string) => {
    const updated = [...customDistractorInputs];
    updated[idx] = value;
    setCustomDistractorInputs(updated);
    setSelected((prev: SelectedQuestion[]) => prev.map((s, i) =>
      i === currentIdx ? {
        ...s,
        customDistractors: updated,
        distractors: updated,
      } : s
    ));
  };

  // Sync custom distractor inputs when navigating
  useEffect(() => {
    if (isFullyCustom) {
      setCustomCorrect(q.correctAnswer || q.customCorrect || '');
      setCustomDistractorInputs(q.distractors.length === 3 ? [...q.distractors] : ['', '', '']);
    }
  }, [currentIdx]);

  const saveCustomCorrectOnly = () => {
    if (!customCorrect.trim()) {
      toast.error(t('studio.enter_correct'));
      return;
    }
    const available = q.options.filter(o => o.toLowerCase() !== customCorrect.trim().toLowerCase());
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const autoDistractors = shuffled.slice(0, 3);

    if (autoDistractors.length < 3) {
      toast.error(t('studio.not_enough_options'));
      return;
    }

    setSelected((prev: SelectedQuestion[]) => prev.map((s, i) =>
      i === currentIdx ? {
        ...s,
        isCustom: true,
        customCorrect: customCorrect.trim(),
        customDistractors: autoDistractors,
        correctAnswer: customCorrect.trim(),
        distractors: autoDistractors,
      } : s
    ));
    setCustomMode(false);
    toast.success(t('studio.custom_saved'));
  };

  const isComplete = q.correctAnswer && q.distractors.length === 3 && q.distractors.every((d: string) => d.trim());
  const catMeta = getCategoryMeta(q.category);
  const CatIcon = catMeta.icon;
  const completedCount = selected.filter((s: SelectedQuestion) => s.correctAnswer && s.distractors.length === 3 && s.distractors.every((d: string) => d.trim())).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ===== Header strip ===== */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t('studio.answers_step')}</div>
          <h2 className="text-lg md:text-xl font-bold font-display leading-tight">
            {t('studio.answered', { current: completedCount, total: selected.length })}
          </h2>
        </div>
        {!isFullyCustom && (
          <label className="flex items-center gap-2 cursor-pointer rounded-full glass px-3 py-1.5">
            <Checkbox
              checked={autoRandomize}
              onCheckedChange={(checked) => setAutoRandomize(!!checked)}
              className="h-4 w-4"
            />
            <span className="text-xs font-medium">{t('studio.auto_distractors')}</span>
          </label>
        )}
      </div>

      {/* ===== Animated question card with category gradient ===== */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={q.questionId}
          initial={{ opacity: 0, rotateY: 12, x: 40 }}
          animate={{ opacity: 1, rotateY: 0, x: 0 }}
          exit={{ opacity: 0, rotateY: -12, x: -40 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6"
          style={{ transformPerspective: 1000 }}
        >
          {/* Category color wash */}
          <div className={`pointer-events-none absolute inset-0 ${catMeta.colorClass} opacity-40`} />
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-coral/40 via-rose/30 to-lavender/30 blur-3xl" />

          <div className="relative">
            {/* Category pill */}
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-[11px] font-semibold">
              <CatIcon className="h-3.5 w-3.5" />
              {t(`categories.${q.category}`, { defaultValue: q.category })}
            </div>

            {/* Question text */}
            <p className="mb-4 text-xl md:text-2xl font-bold font-display leading-tight">{q.emoji && <span className="mr-2">{q.emoji}</span>}{q.text}</p>
            <div className="mb-5"><EmojiPicker value={q.emoji} onChange={emoji => onEmojiChange(q.questionId, emoji)} /></div>

            {profanityWarning && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive font-medium"
              >
                {profanityWarning}
              </motion.div>
            )}

        {isFullyCustom ? (
          /* === Fully custom question: type correct answer + auto-generate distractors === */
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-secondary mb-1 block">✅ {t('studio.correct_answer')}</label>
              <div className="flex gap-2">
                <Input
                  value={customCorrect}
                  onChange={e => validateAndSetCustomText(e.target.value, setCustomCorrect)}
                  className="rounded-xl border-secondary/30 flex-1"
                  placeholder={t('studio.type_answer')}
                  aria-label={t('studio.your_correct')}
                  maxLength={100}
                  onKeyDown={e => { if (e.key === 'Enter') handleCustomAnswerSubmit(); }}
                />
                <Button
                  size="sm"
                  className="gradient-teal text-secondary-foreground text-xs shrink-0"
                  onClick={handleCustomAnswerSubmit}
                  disabled={!customCorrect.trim() || generating}
                >
                  {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                  {generating ? t('studio.generating') : t('studio.set')}
                </Button>
              </div>
            </div>

            {q.correctAnswer && q.distractors.length === 3 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-primary">❌ {t('studio.wrong_answers')}</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={handleRegenerateDistractors}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
                    {generating ? t('studio.generating') : t('studio.regenerate')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {customDistractorInputs.map((d, idx) => (
                    <Input
                      key={idx}
                      value={d}
                      onChange={e => {
                        const val = e.target.value;
                        if (containsProfanity(val)) {
                          setProfanityWarning(t('studio.profanity'));
                          setTimeout(() => setProfanityWarning(''), 3000);
                          return;
                        }
                        updateCustomDistractor(idx, val);
                      }}
                      className="rounded-xl border-primary/30 text-sm"
                      placeholder={t('studio.distractor', { number: idx + 1 })}
                      aria-label={t('studio.distractor', { number: idx + 1 })}
                      maxLength={100}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {t('studio.distractor_hint')}
                </p>
              </div>
            )}
          </div>
        ) : !customMode ? (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {autoRandomize ? (
                <>{t('studio.auto_hint')}</>
              ) : (
                <>{t('studio.manual_hint')}</>
              )}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              {q.options.map((opt, oi) => {
                const isCorrect = q.correctAnswer === opt;
                const isDistractor = q.distractors.includes(opt);
                return (
                  <motion.button
                    key={opt}
                    aria-pressed={isCorrect || isDistractor}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: oi * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (autoRandomize) {
                        selectCorrect(isCorrect ? '' : opt);
                      } else {
                        if (!q.correctAnswer || isCorrect) selectCorrect(isCorrect ? '' : opt);
                        else if (q.correctAnswer && q.correctAnswer !== opt) toggleDistractor(opt);
                      }
                    }}
                    className={`group relative overflow-hidden rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-semibold transition-colors ${
                      isCorrect
                        ? 'border-secondary bg-secondary/15 text-secondary shadow-glow'
                        : isDistractor
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    {/* selection burst */}
                    <AnimatePresence>
                      {(isCorrect || isDistractor) && (
                        <motion.span
                          key="burst"
                          initial={{ scale: 0.4, opacity: 0.6 }}
                          animate={{ scale: 2.2, opacity: 0 }}
                          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                          className={`pointer-events-none absolute inset-0 rounded-2xl ${
                            isCorrect ? 'bg-secondary/40' : 'bg-primary/40'
                          }`}
                        />
                      )}
                    </AnimatePresence>

                    <div className="relative flex items-center gap-2">
                      <AnimatePresence mode="wait">
                        {isCorrect ? (
                          <motion.span
                            key="ok"
                            initial={{ scale: 0, rotate: -90 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 16 }}
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full gradient-teal text-white"
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </motion.span>
                        ) : isDistractor ? (
                          <motion.span
                            key="x"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary"
                          >
                            ✕
                          </motion.span>
                        ) : (
                          <motion.span
                            key="letter"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
                          >
                            {String.fromCharCode(65 + oi)}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <span className="leading-tight">{opt}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            <button
              onClick={() => { setCustomMode(true); setCustomCorrect(q.customCorrect || ''); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <Pencil className="h-3 w-3" /> {t('studio.write_answer')}
            </button>
          </>
        ) : (
          <>
            <div className="mb-3">
              <label className="text-xs font-semibold text-secondary mb-1 block">{t('studio.your_correct')}</label>
              <div className="flex gap-2">
                <Input
                  value={customCorrect}
                  onChange={e => validateAndSetCustomText(e.target.value, setCustomCorrect)}
                  className="rounded-xl border-secondary/30 flex-1"
                  placeholder={t('studio.type_answer')}
                  aria-label={t('studio.your_correct')}
                  maxLength={100}
                />
                <Button variant="ghost" size="icon" aria-label={t('common.cancel')} className="h-10 w-10 flex-shrink-0" onClick={() => setCustomMode(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {customCorrect.trim() && (
                <Button
                  size="sm"
                  className="mt-2 gradient-teal text-secondary-foreground text-xs"
                  onClick={() => {
                    if (!customCorrect.trim()) return;
                    selectCorrect(customCorrect.trim());
                    setSelected((prev: SelectedQuestion[]) => prev.map((s: SelectedQuestion) =>
                      s.questionId === q.questionId ? { ...s, isCustom: true, customCorrect: customCorrect.trim() } : s
                    ));
                    setCustomMode(false);
                    toast.success(t('studio.custom_set'));
                  }}
                >
                  <Check className="mr-1 h-3 w-3" /> {t('studio.set_correct')}
                </Button>
              )}
            </div>

            <p className="mb-2 text-xs text-muted-foreground">
              {t('studio.pick_distractors')}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              {q.options.map((opt, oi) => {
                const isDistractor = q.distractors.includes(opt);
                return (
                  <motion.button
                    key={opt}
                    aria-pressed={isDistractor}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: oi * 0.04 }}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleDistractor(opt)}
                    className={`rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-semibold transition-colors ${
                      isDistractor
                        ? 'border-primary bg-primary/15 text-primary shadow-soft'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    {opt}
                  </motion.button>
                );
              })}
            </div>
          </>
        )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ===== Navigation footer ===== */}
      <StudioActions className="studio-answer-actions mt-6 flex items-center justify-between gap-3">
        <motion.button
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full glass shadow-soft disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t('common.previous_question')}
        >
          <ArrowLeft className="h-4 w-4" />
        </motion.button>

        {/* Progress dots morph */}
        <select aria-label={t('common.question', { current: currentIdx + 1, total: selected.length })} value={currentIdx} onChange={event => setCurrentIdx(Number(event.target.value))} className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-card px-2 text-sm md:hidden">
          {selected.map((s: SelectedQuestion, i: number) => <option key={s.questionId} value={i}>{t('common.question', { current: i + 1, total: selected.length })}{s.correctAnswer && s.distractors.length === 3 ? ' ✓' : ''}</option>)}
        </select>
        <div className="hidden items-center gap-1.5 px-2 md:flex">
          {selected.map((_: any, i: number) => {
            const s = selected[i] as SelectedQuestion;
            const done = s.correctAnswer && s.distractors.length === 3 && s.distractors.every((d: string) => d.trim());
            const isActive = i === currentIdx;
            return (
              <motion.button
                key={i}
                onClick={() => setCurrentIdx(i)}
                animate={{
                  width: isActive ? 28 : 8,
                  backgroundColor: isActive
                    ? 'hsl(var(--coral))'
                    : done
                      ? 'hsl(var(--teal))'
                      : 'hsl(var(--muted))',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className={`h-2 rounded-full ${isActive ? 'shadow-glow' : ''}`}
                aria-label={t('common.go_question', { number: i + 1 })}
              />
            );
          })}
        </div>

        {currentIdx < selected.length - 1 ? (
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentIdx(currentIdx + 1)}
            disabled={!isComplete}
            className={`relative flex h-12 items-center gap-2 overflow-hidden rounded-full px-5 text-sm font-bold shadow-glow disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none ${
              isComplete ? 'shimmer-sweep gradient-coral text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {t('common.next')}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNext}
            disabled={selected.some((s: SelectedQuestion) => !s.correctAnswer || s.distractors.length < 3 || s.distractors.some((d: string) => !d.trim()))}
            className="relative flex h-12 items-center gap-2 overflow-hidden rounded-full shimmer-sweep gradient-coral text-primary-foreground px-5 text-sm font-bold shadow-glow disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t('common.review')} <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </StudioActions>
    </motion.div>
  );
}

/* ============= REVIEW STEP ============= */
function ReviewStep({ selected, onSave, user, onLogin, appearance, isOpen, setIsOpen, title, setTitle, onEditLook }: any) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [saving, setSaving] = useState(false);

  // Stats
  const categories = useMemo(() => {
    const set = new Set<string>();
    selected.forEach((s: SelectedQuestion) => set.add(s.category));
    return Array.from(set);
  }, [selected]);
  const customCount = selected.filter((s: SelectedQuestion) => s.isCustom).length;

  // Floating sparkles for the hero card
  const sparkles = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    left: Math.random() * 90 + 5,
    bottom: Math.random() * 80 + 5,
    delay: Math.random() * 4,
    duration: 4 + Math.random() * 3,
    size: 8 + Math.random() * 8,
  })), []);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  };
  const handleLogin = async () => {
    setSaving(true);
    try { await onLogin(); } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* ===== Celebration hero ===== */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.05 }}
        className="relative mb-6 overflow-hidden rounded-3xl gradient-hero p-6 md:p-8 text-center text-white shadow-glow"
      >
        {/* Sparkles */}
        {!reduce && (
          <div className="pointer-events-none absolute inset-0">
            {sparkles.map(s => (
              <span
                key={s.id}
                className="absolute animate-sparkle"
                style={{
                  left: `${s.left}%`,
                  bottom: `${s.bottom}%`,
                  animationDelay: `${s.delay}s`,
                  animationDuration: `${s.duration}s`,
                }}
              >
                <Sparkles style={{ width: s.size, height: s.size, color: 'white' }} />
              </span>
            ))}
          </div>
        )}

        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 250, damping: 16, delay: 0.2 }}
          className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
        >
          <PartyPopper className="h-7 w-7 drop-shadow" />
          <span className="absolute -inset-2 rounded-full bg-white/30 blur-lg animate-pulse-soft" />
        </motion.div>

        <motion.h2
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative mb-1 text-2xl md:text-3xl font-bold font-display drop-shadow"
        >
          {t('studio.review_title')}
        </motion.h2>
        <motion.p
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="relative text-sm md:text-base text-white/90"
        >
          {t('studio.review_hint')}
        </motion.p>

        {/* Stat row */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative mt-5 flex flex-wrap items-center justify-center gap-2"
        >
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold">
            <ListChecks className="h-3.5 w-3.5" /> {t('common.questions', { count: selected.length })}
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> {t('common.categories', { count: categories.length })}
          </div>
          {customCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold">
              <Wand2 className="h-3.5 w-3.5" /> {t('common.custom_count', { count: customCount })}
            </div>
          )}
        </motion.div>
      </motion.div>

      <label htmlFor="publish-title" className="mb-2 block text-sm font-bold">{t('studio.quiz_name')}</label>
      <Input id="publish-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={80} className="mb-5 rounded-xl bg-white/70" />
      <PublishSettings isOpen={isOpen} onChange={setIsOpen} appearance={appearance} onEdit={onEditLook} />
      {/* ===== Question cards ===== */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05, delayChildren: 0.5 } },
        }}
        className="space-y-3 mb-6"
      >
        {selected.map((q: SelectedQuestion, i: number) => {
          const meta = getCategoryMeta(q.category);
          const Icon = meta.icon;
          return (
            <motion.div
              key={q.questionId}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
              }}
              whileHover={{ y: -2 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-glow"
            >
              {/* Color stripe */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.bgClass}`} />

              <div className="flex items-start gap-3 pl-2">
                <div className="relative h-9 w-9 flex-shrink-0">
                  <div className={`absolute inset-0 rounded-xl ${meta.colorClass} border border-current`} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-display">
                    {i + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Icon className="h-3 w-3 opacity-60" />
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t(`categories.${q.category}`, { defaultValue: q.category })}</span>
                    {q.isCustom && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">{t('studio.custom')}</span>
                    )}
                  </div>
                  <p className="mb-2 text-sm font-medium leading-snug">{q.emoji && <span className="mr-2 text-xl">{q.emoji}</span>}{q.text}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className="bg-secondary/15 text-secondary border-secondary/30 text-[11px] font-semibold">
                      <Check className="mr-1 h-2.5 w-2.5" strokeWidth={3} />
                      {q.correctAnswer}
                    </Badge>
                    {q.distractors.map((d: string) => (
                      <Badge key={d} variant="outline" className="text-[11px] text-muted-foreground">{d}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ===== Save CTA ===== */}
      <StudioActions className="studio-publish-actions relative">
        {user ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="relative w-full overflow-hidden rounded-full shimmer-sweep gradient-coral text-primary-foreground px-6 py-5 text-base font-bold shadow-glow disabled:opacity-60"
          >
            <span className="relative inline-flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                  />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <PartyPopper className="h-5 w-5" />
                  {t('studio.publish')}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </span>
          </motion.button>
        ) : (
          <div className="text-center">
            <p className="mb-3 hidden text-sm text-muted-foreground md:block">
              {t('studio.draft_hint')}
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              disabled={saving || !title.trim()}
              className="relative w-full overflow-hidden rounded-full shimmer-sweep gradient-coral text-primary-foreground px-6 py-5 text-base font-bold shadow-glow disabled:opacity-60"
            >
              <span className="relative inline-flex items-center justify-center gap-2">
                {saving ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                    />
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    {t('studio.save_draft')}
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </span>
            </motion.button>
          </div>
        )}
      </StudioActions>
    </motion.div>
  );
}
