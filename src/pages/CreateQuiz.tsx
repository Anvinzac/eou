import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, Trash2, ArrowUp, ArrowDown, Pencil, X, Shuffle, Plus,
  Package, ListChecks, MoveVertical, KeyRound, Eye, Sparkles, Wand2, Heart, PartyPopper,
  Loader2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { containsProfanity } from '@/lib/profanity';
import { generateDistractors } from '@/lib/distractorGenerator';
import { generateDistractorsWithLLM } from '@/lib/qwenDistractor';
import { CATEGORIES, getCategoryMeta } from '@/lib/categories';
import type { QuestionData, SelectedQuestion } from '@/types/quiz';
import questionsData from '@/data/qna.json';
import PacksStep from '@/components/quiz/PacksStep';

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;
const allQuestions = (questionsData as { questions: QuestionData[] }).questions;
const INTRO_SEEN_KEY = 'quiz_intro_seen_v1';

type Step = 'intro' | 'packs' | 'select' | 'reorder' | 'answers' | 'review';

const STEP_META: Record<Exclude<Step, 'intro'>, { label: string; icon: any }> = {
  packs:   { label: 'Pack',     icon: Package },
  select:  { label: 'Pick',     icon: ListChecks },
  reorder: { label: 'Order',    icon: MoveVertical },
  answers: { label: 'Answer',   icon: KeyRound },
  review:  { label: 'Review',   icon: Eye },
};
const STEP_ORDER: Exclude<Step, 'intro'>[] = ['packs', 'select', 'reorder', 'answers', 'review'];

const DRAFT_TOKEN_KEY = 'quiz_draft_token';
const DRAFT_QUIZ_ID_KEY = 'quiz_draft_id';

function generateDraftToken() {
  return crypto.randomUUID();
}

export default function CreateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(() => {
    if (typeof window === 'undefined') return 'packs';
    return localStorage.getItem(INTRO_SEEN_KEY) ? 'packs' : 'intro';
  });
  const [selected, setSelected] = useState<SelectedQuestion[]>([]);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [quizTitle, setQuizTitle] = useState('My Quiz');
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const questionsByCategory = useMemo(() => {
    const map: Record<string, QuestionData[]> = {};
    CATEGORIES.forEach(c => { map[c.key] = []; });
    allQuestions.forEach(q => {
      if (map[q.category]) map[q.category].push(q);
    });
    return map;
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map(s => s.questionId)), [selected]);
  const remaining = MAX_QUESTIONS - selected.length;
  const customIdCounter = useRef(90000);

  const addCustomQuestion = useCallback((text: string) => {
    setSelected(prev => {
      if (prev.length >= MAX_QUESTIONS) {
        toast.error(`Maximum ${MAX_QUESTIONS} questions allowed`);
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
  }, []);

  // Link draft quiz to user after login
  useEffect(() => {
    if (!user) return;
    const draftToken = localStorage.getItem(DRAFT_TOKEN_KEY);
    const draftQuizId = localStorage.getItem(DRAFT_QUIZ_ID_KEY);
    if (draftToken && draftQuizId) {
      supabase
        .from('quizzes')
        .update({ user_id: user.id, draft_token: null })
        .eq('id', draftQuizId)
        .eq('draft_token', draftToken)
        .then(({ error }) => {
          if (!error) {
            // Also update quiz_questions ownership is inherited via quiz_id
            localStorage.removeItem(DRAFT_TOKEN_KEY);
            localStorage.removeItem(DRAFT_QUIZ_ID_KEY);
          }
        });
    }
  }, [user]);

  const toggleQuestion = useCallback((q: QuestionData) => {
    setSelected(prev => {
      const exists = prev.find(s => s.questionId === q.id);
      if (exists) {
        return prev.filter(s => s.questionId !== q.id);
      }
      if (prev.length >= MAX_QUESTIONS) {
        toast.error(`Maximum ${MAX_QUESTIONS} questions allowed`);
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
  }, []);

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
  }, []);

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
    toast.info(`Removed "${q.text.slice(0, 40)}..." — pick a replacement!`);
  };

  const handleNextToReorder = () => {
    if (selected.length === 0) {
      toast.error('Select at least 1 question');
      return;
    }
    if (selected.length < MIN_QUESTIONS) {
      const needed = MIN_QUESTIONS - selected.length;
      toast(`You need at least ${MIN_QUESTIONS} questions. Adding ${needed} random questions.`, {
        action: {
          label: 'Fill & Continue',
          onClick: () => {
            fillRandomQuestions();
            setStep('reorder');
          },
        },
      });
      return;
    }
    setStep('reorder');
  };

  const handleSelectPack = (questions: SelectedQuestion[]) => {
    setSelected(questions);
    setStep('select');
    toast.success('Pack loaded! Add more questions or proceed.');
  };

  const saveQuiz = async () => {
    if (!user) {
      // Save as draft in DB first
      const draftToken = generateDraftToken();
      try {
        const { data: quiz, error: quizErr } = await supabase
          .from('quizzes')
          .insert({ user_id: null, title: quizTitle, max_questions: MAX_QUESTIONS, draft_token: draftToken } as any)
          .select()
          .single();
        if (quizErr) throw quizErr;

        const questionsToInsert = selected.map(q => ({
          quiz_id: quiz.id,
          question_ref_id: q.questionId,
          category: q.category,
          question_text: q.text,
          order_number: q.orderNumber,
          correct_answers: [q.isCustom && q.customCorrect ? q.customCorrect : q.correctAnswer],
          distractor_answers: q.isCustom && q.customDistractors?.length === 3 ? q.customDistractors : q.distractors,
          is_custom: q.isCustom,
        }));

        const { error: qErr } = await supabase.from('quiz_questions').insert(questionsToInsert);
        if (qErr) throw qErr;

        localStorage.setItem(DRAFT_TOKEN_KEY, draftToken);
        localStorage.setItem(DRAFT_QUIZ_ID_KEY, quiz.id);
        toast.success('Quiz saved as draft! Sign in to manage it.');
        navigate('/auth');
      } catch (err: any) {
        toast.error(err.message || 'Failed to save draft');
      }
      return;
    }

    const incomplete = selected.find(q => !q.correctAnswer || q.distractors.length < 3);
    if (incomplete) {
      toast.error('Please set answers for all questions');
      return;
    }
    try {
      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({ user_id: user.id, title: quizTitle, max_questions: MAX_QUESTIONS })
        .select()
        .single();
      if (quizErr) throw quizErr;

      const questionsToInsert = selected.map(q => ({
        quiz_id: quiz.id,
        question_ref_id: q.questionId,
        category: q.category,
        question_text: q.text,
        order_number: q.orderNumber,
        correct_answers: [q.isCustom && q.customCorrect ? q.customCorrect : q.correctAnswer],
        distractor_answers: q.isCustom && q.customDistractors?.length === 3 ? q.customDistractors : q.distractors,
        is_custom: q.isCustom,
      }));

      const { error: qErr } = await supabase.from('quiz_questions').insert(questionsToInsert);
      if (qErr) throw qErr;

      toast.success('Quiz saved!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save quiz');
    }
  };

  const stepIndex = STEP_ORDER.indexOf(step as any);
  const showStepper = step !== 'intro';

  const handleBack = () => {
    if (step === 'intro') navigate('/');
    else if (step === 'packs') {
      // Allow re-entering the intro if user wants
      localStorage.removeItem(INTRO_SEEN_KEY);
      setStep('intro');
    }
    else if (step === 'select') setStep('packs');
    else if (step === 'reorder') setStep('select');
    else if (step === 'answers') setStep('reorder');
    else setStep('answers');
  };

  const dismissIntro = () => {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
    setStep('packs');
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Ambient backdrop (subtle on creator screens, vivid on intro) */}
      <div className={`pointer-events-none fixed inset-0 -z-10 transition-opacity duration-700 ${step === 'intro' ? 'opacity-100' : 'opacity-40'}`}>
        <div className="absolute inset-0 aurora-bg" />
        <div className="absolute inset-0 mesh-dots" />
      </div>

      {/* Header with editable title + segmented stepper */}
      {showStepper && (
        <header className="sticky top-0 z-20 border-b border-border/60 glass px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="rounded-full">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>

            <div className="flex-1 mx-2 text-center">
              {editingTitle ? (
                <div className="flex items-center justify-center gap-2">
                  <Input
                    ref={titleInputRef}
                    value={tempTitle}
                    onChange={e => setTempTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setQuizTitle(tempTitle.trim() || 'My Quiz');
                        setEditingTitle(false);
                      }
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    className="h-8 max-w-[200px] text-center text-sm font-bold rounded-lg"
                    maxLength={50}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setQuizTitle(tempTitle.trim() || 'My Quiz');
                    setEditingTitle(false);
                  }}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setTempTitle(''); setEditingTitle(true); }}
                  className="inline-flex items-center gap-1.5 group"
                >
                  <span className="text-sm font-bold font-display">{quizTitle}</span>
                  <Pencil className="h-3 w-3 text-muted-foreground transition-transform group-hover:rotate-12" />
                </button>
              )}

              {/* Segmented animated stepper */}
              <SegmentedStepper currentIdx={stepIndex} />
            </div>

            {step === 'select' && (
              remaining > 0 ? (
                <Badge variant="secondary" className="text-sm font-bold rounded-full">
                  {remaining} left
                </Badge>
              ) : (
                <Button size="sm" onClick={handleNextToReorder} className="gradient-coral text-primary-foreground text-xs rounded-full shimmer-sweep overflow-hidden relative">
                  Next <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )
            )}
            {step !== 'select' && <div className="w-16" />}
          </div>
        </header>
      )}

      <div className={`relative mx-auto max-w-3xl px-4 ${showStepper ? 'py-6' : 'py-0'}`}>
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <IntroStep
              key="intro"
              onStart={dismissIntro}
              onExit={() => navigate('/')}
            />
          )}
          {step === 'packs' && (
            <PacksStep
              key="packs"
              onSelectPack={handleSelectPack}
              onSkip={() => setStep('select')}
            />
          )}
          {step === 'select' && (
            <SelectStep
              key="select"
              questionsByCategory={questionsByCategory}
              selectedIds={selectedIds}
              toggleQuestion={toggleQuestion}
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
              onNext={() => setStep('answers')}
            />
          )}
          {step === 'answers' && (
            <AnswersStep
              key="answers"
              selected={selected}
              setSelected={setSelected}
              onNext={() => setStep('review')}
            />
          )}
          {step === 'review' && (
            <ReviewStep
              key="review"
              selected={selected}
              onSave={saveQuiz}
              user={user}
              onLogin={saveQuiz}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============= SEGMENTED STEPPER ============= */
function SegmentedStepper({ currentIdx }: { currentIdx: number }) {
  return (
    <div className="mt-2 flex items-center justify-center gap-1.5">
      {STEP_ORDER.map((s, i) => {
        const meta = STEP_META[s];
        const Icon = meta.icon;
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div className="relative">
              <motion.div
                initial={false}
                animate={{
                  scale: active ? 1.15 : 1,
                  backgroundColor: active
                    ? 'hsl(var(--coral))'
                    : done
                      ? 'hsl(var(--teal))'
                      : 'hsl(var(--muted))',
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  active ? 'shadow-glow' : ''
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {done ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    >
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="icon"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Icon className={`h-3 w-3 ${active ? 'text-white' : 'text-muted-foreground'}`} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              {active && (
                <span className="absolute -inset-1 rounded-full bg-primary/40 blur-md animate-pulse-soft -z-10" />
              )}
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div className="relative h-[3px] w-6 overflow-hidden rounded-full bg-muted sm:w-10">
                <motion.div
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.45, ease: 'easeInOut' }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal to-coral"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============= INTRO STEP ============= */
function IntroStep({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
  const reduce = useReducedMotion();
  const phases = [
    { icon: Package, label: 'Pick a pack', color: 'from-coral to-rose' },
    { icon: ListChecks, label: 'Choose questions', color: 'from-rose to-lavender' },
    { icon: KeyRound, label: 'Set the answers', color: 'from-lavender to-teal' },
    { icon: Eye, label: 'Review & share', color: 'from-teal to-gold' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative min-h-[calc(100vh-1px)] flex flex-col items-center justify-center px-4 py-16"
    >
      {/* Floating blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="blob animate-drift-y"
          style={{ width: 380, height: 380, top: '-4rem', left: '-6rem', background: 'hsl(var(--coral) / 0.55)' }}
        />
        <div
          className="blob animate-drift-x"
          style={{ width: 320, height: 320, top: '20%', right: '-4rem', background: 'hsl(var(--teal) / 0.45)', animationDelay: '1.5s' }}
        />
        <div
          className="blob animate-drift-y"
          style={{ width: 280, height: 280, bottom: '-4rem', left: '30%', background: 'hsl(var(--lavender) / 0.45)', animationDelay: '3s' }}
        />
      </div>

      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full glass px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Home
      </button>

      <div className="relative mx-auto max-w-2xl text-center">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-xs font-semibold uppercase tracking-widest text-foreground/80"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Let's make something great together
        </motion.div>

        {/* Title — staggered words */}
        <h1 className="mb-5 text-4xl md:text-5xl lg:text-6xl font-bold font-display leading-tight">
          {['Your', 'quiz,'].map((w, i) => (
            <motion.span
              key={i}
              initial={{ y: '110%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block mr-3"
            >
              {w}
            </motion.span>
          ))}
          <br />
          <motion.span
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block text-gradient-warm italic"
          >
            in four playful steps.
          </motion.span>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mb-10 text-base md:text-lg text-muted-foreground max-w-lg mx-auto"
        >
          We'll guide you the whole way. No accounts needed to start — just pick, click, and you're done.
        </motion.p>

        {/* Phase preview */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.1, delayChildren: 0.8 } },
          }}
          className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          {phases.map((p, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 30, scale: 0.9 },
                show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } },
              }}
              whileHover={reduce ? undefined : { y: -4, scale: 1.03 }}
              className="tilt-card glass relative overflow-hidden rounded-2xl p-4 text-left shadow-soft"
            >
              <div className={`absolute inset-x-0 -top-px h-[3px] bg-gradient-to-r ${p.color}`} />
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-coral text-white shadow-soft">
                <p.icon className="h-4 w-4" />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold mb-0.5">
                Step {i + 1}
              </p>
              <p className="text-sm font-bold font-display">{p.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.3, type: 'spring', stiffness: 200, damping: 18 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            whileHover={reduce ? undefined : { scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="relative"
          >
            <div className="absolute -inset-1 rounded-full ring-conic opacity-60 blur-md" />
            <Button
              onClick={onStart}
              size="lg"
              className="relative shimmer-sweep overflow-hidden gradient-coral text-primary-foreground px-10 py-7 text-base font-bold rounded-full shadow-glow"
            >
              <Wand2 className="mr-2 h-5 w-5" />
              Let's start
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-primary" /> About 3 minutes · Skippable anytime
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ============= SELECT STEP ============= */
function SelectStep({ questionsByCategory, selectedIds, toggleQuestion, remaining, activeCategoryIdx, setActiveCategoryIdx, onNext, addCustomQuestion }: any) {
  const activeCategory = CATEGORIES[activeCategoryIdx];
  const questions = questionsByCategory[activeCategory.key] || [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const [customText, setCustomText] = useState('');
  const totalSelected = MAX_QUESTIONS - remaining;
  const minReached = totalSelected >= MIN_QUESTIONS;
  const progressPct = Math.min(100, (totalSelected / MAX_QUESTIONS) * 100);

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    if (trimmed.length < 5) {
      toast.error('Question is too short');
      return;
    }
    if (containsProfanity(trimmed)) {
      toast.error('Please use appropriate language');
      return;
    }
    addCustomQuestion(trimmed);
    setCustomText('');
    toast.success('Custom question added!');
  };

  const swipeCategory = (dir: number) => {
    const newIdx = activeCategoryIdx + dir;
    if (newIdx >= 0 && newIdx < CATEGORIES.length) {
      setActiveCategoryIdx(newIdx);
    }
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
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) swipeCategory(diff > 0 ? 1 : -1);
      }}
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
              <span className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">of {MAX_QUESTIONS}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Step 2 · Pick questions</div>
            <h2 className="text-lg md:text-xl font-bold font-display leading-tight">
              {totalSelected === 0 && 'What should they answer about you?'}
              {totalSelected > 0 && totalSelected < MIN_QUESTIONS && `${MIN_QUESTIONS - totalSelected} more to reach the minimum`}
              {totalSelected >= MIN_QUESTIONS && totalSelected < MAX_QUESTIONS && "Looking great — keep going or move on"}
              {totalSelected === MAX_QUESTIONS && (
                <span className="text-gradient-warm">Maxed out — let's lock these in</span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Min {MIN_QUESTIONS} · Max {MAX_QUESTIONS} · Swipe categories below
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
            placeholder="Write your own question…"
            className="flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={200}
            disabled={remaining === 0}
          />
          <Button
            onClick={handleAddCustom}
            disabled={remaining === 0 || !customText.trim()}
            className="h-9 rounded-full gradient-coral text-primary-foreground text-xs px-4 shrink-0"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
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
                  <span className="text-xs font-semibold whitespace-nowrap">{cat.key}</span>
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
          <h3 className="text-sm font-bold font-display">{activeCategory.key}</h3>
          <span className="text-xs text-muted-foreground">· {questions.length} questions</span>
        </motion.div>
      </AnimatePresence>

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

                <p className="relative pr-8 text-sm font-medium leading-relaxed">{q.text}</p>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ========== Sticky-feel bottom action ========== */}
      <motion.div
        layout
        className="mt-8 flex items-center justify-between gap-3 rounded-2xl glass p-3 shadow-soft"
      >
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
            disabled={selectedIds.size === 0}
            className={`relative overflow-hidden rounded-full ${
              minReached
                ? 'shimmer-sweep gradient-coral text-primary-foreground shadow-glow'
                : ''
            }`}
            size="lg"
          >
            {minReached ? (
              <>Next: Order <ArrowRight className="ml-1.5 h-4 w-4" /></>
            ) : (
              <>Pick {Math.max(0, MIN_QUESTIONS - totalSelected)} more</>
            )}
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ============= REORDER STEP ============= */
function ReorderStep({ selected, moveUp, moveDown, deleteQuestion, onNext }: any) {
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
            <div className="mb-1 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Step 3 · Arrange</div>
            <h2 className="text-xl md:text-2xl font-bold font-display leading-tight">
              Set the <span className="text-gradient-warm">story arc</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag the arrows to reorder. Delete to swap in another question.
            </p>
          </div>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              onClick={onNext}
              className="relative overflow-hidden shimmer-sweep gradient-coral text-primary-foreground rounded-full shadow-glow"
              size="lg"
            >
              Done <Check className="ml-1.5 h-4 w-4" />
            </Button>
          </motion.div>
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
                title={`${key}: ${count}`}
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

              <div className="flex items-center gap-3 p-4 pl-5">
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
                  <p className="text-sm font-medium leading-snug line-clamp-2">{q.text}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Icon className="h-3 w-3 opacity-60" />
                    <span className="text-[11px] font-semibold opacity-70">{q.category}</span>
                  </div>
                </div>

                {/* Controls — pill cluster */}
                <div className="flex items-center gap-0.5 rounded-full bg-muted/60 p-1">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-card hover:shadow-soft disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === selected.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-card hover:shadow-soft disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteQuestion(idx)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-destructive transition-all hover:bg-destructive/10"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
function AnswersStep({ selected, setSelected, onNext }: any) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [customMode, setCustomMode] = useState(false);
  const [customCorrect, setCustomCorrect] = useState('');
  const [profanityWarning, setProfanityWarning] = useState('');
  const [autoRandomize, setAutoRandomize] = useState(true);
  const [customDistractorInputs, setCustomDistractorInputs] = useState<string[]>(['', '', '']);
  const [generating, setGenerating] = useState(false);
  const q = selected[currentIdx] as SelectedQuestion;
  const isFullyCustom = q.isCustom && q.options.length === 0;

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
      setProfanityWarning('⚠️ Inappropriate language detected! Text cleared.');
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
      toast.error('Enter a correct answer');
      return;
    }
    setGenerating(true);
    generateDistractorsWithLLM(answer, 3, { questionText: q.text, category: q.category })
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
        toast.success(source === 'llm' ? 'AI-generated distractors ready!' : 'Distractors auto-generated! Edit them if needed.');
      })
      .finally(() => setGenerating(false));
  };

  const handleRegenerateDistractors = () => {
    const answer = q.correctAnswer || customCorrect.trim();
    if (!answer) return;
    const selectedQuestion = q;
    setGenerating(true);
    generateDistractorsWithLLM(answer, 3, { questionText: selectedQuestion.text, category: selectedQuestion.category })
      .then(({ distractors, source }) => {
        setCustomDistractorInputs(distractors);
        setSelected((prev: SelectedQuestion[]) => prev.map((s, i) =>
          i === currentIdx ? {
            ...s,
            customDistractors: distractors,
            distractors,
          } : s
        ));
        toast.success(source === 'llm' ? 'AI-generated distractors ready!' : 'Distractors generated! Edit them if needed.');
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
      toast.error('Enter a correct answer');
      return;
    }
    const available = q.options.filter(o => o.toLowerCase() !== customCorrect.trim().toLowerCase());
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const autoDistractors = shuffled.slice(0, 3);

    if (autoDistractors.length < 3) {
      toast.error('Not enough options for distractors');
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
    toast.success('Custom answer saved with auto-generated distractors!');
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Step 4 · Answers</div>
          <h2 className="text-lg md:text-xl font-bold font-display leading-tight">
            {completedCount}/{selected.length} answered
          </h2>
        </div>
        {!isFullyCustom && (
          <label className="flex items-center gap-2 cursor-pointer rounded-full glass px-3 py-1.5">
            <Checkbox
              checked={autoRandomize}
              onCheckedChange={(checked) => setAutoRandomize(!!checked)}
              className="h-4 w-4"
            />
            <span className="text-xs font-medium">Auto-pick distractors</span>
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
          className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft"
          style={{ transformPerspective: 1000 }}
        >
          {/* Category color wash */}
          <div className={`pointer-events-none absolute inset-0 ${catMeta.colorClass} opacity-40`} />
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-coral/40 via-rose/30 to-lavender/30 blur-3xl" />

          <div className="relative">
            {/* Category pill */}
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-[11px] font-semibold">
              <CatIcon className="h-3.5 w-3.5" />
              {q.category}
            </div>

            {/* Question text */}
            <p className="mb-5 text-xl md:text-2xl font-bold font-display leading-tight">{q.text}</p>

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
              <label className="text-xs font-semibold text-secondary mb-1 block">✅ Correct Answer</label>
              <div className="flex gap-2">
                <Input
                  value={customCorrect}
                  onChange={e => validateAndSetCustomText(e.target.value, setCustomCorrect)}
                  className="rounded-xl border-secondary/30 flex-1"
                  placeholder="Type the correct answer"
                  maxLength={100}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCustomAnswerSubmit(); }}
                />
                <Button
                  size="sm"
                  className="gradient-teal text-secondary-foreground text-xs shrink-0"
                  onClick={handleCustomAnswerSubmit}
                  disabled={!customCorrect.trim() || generating}
                >
                  {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                  {generating ? 'Generating…' : 'Set'}
                </Button>
              </div>
            </div>

            {q.correctAnswer && q.distractors.length === 3 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-primary">❌ Distractors (wrong answers)</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={handleRegenerateDistractors}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
                    {generating ? 'Generating…' : 'Regenerate'}
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
                          setProfanityWarning('⚠️ Inappropriate language detected!');
                          setTimeout(() => setProfanityWarning(''), 3000);
                          return;
                        }
                        updateCustomDistractor(idx, val);
                      }}
                      className="rounded-xl border-primary/30 text-sm"
                      placeholder={`Distractor ${idx + 1}`}
                      maxLength={100}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  💡 Distractors are auto-generated to confuse. Edit or regenerate as needed.
                </p>
              </div>
            )}
          </div>
        ) : !customMode ? (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {autoRandomize ? (
                <>Tap the <span className="font-bold text-secondary">correct answer</span> — distractors will be picked automatically</>
              ) : (
                <>First tap the <span className="font-bold text-secondary">correct answer</span>, then pick <span className="font-bold text-primary">3 distractors</span></>
              )}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt, oi) => {
                const isCorrect = q.correctAnswer === opt;
                const isDistractor = q.distractors.includes(opt);
                return (
                  <motion.button
                    key={opt}
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
              <Pencil className="h-3 w-3" /> Write your own answer
            </button>
          </>
        ) : (
          <>
            <div className="mb-3">
              <label className="text-xs font-semibold text-secondary mb-1 block">Your Correct Answer</label>
              <div className="flex gap-2">
                <Input
                  value={customCorrect}
                  onChange={e => validateAndSetCustomText(e.target.value, setCustomCorrect)}
                  className="rounded-xl border-secondary/30 flex-1"
                  placeholder="Type the correct answer"
                  maxLength={100}
                  autoFocus
                />
                <Button variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => setCustomMode(false)}>
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
                    toast.success('Custom answer set! Now pick 3 distractors below.');
                  }}
                >
                  <Check className="mr-1 h-3 w-3" /> Set as correct
                </Button>
              )}
            </div>

            <p className="mb-2 text-xs text-muted-foreground">
              Pick <span className="font-bold text-primary">3 distractors</span> from below
            </p>
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt, oi) => {
                const isDistractor = q.distractors.includes(opt);
                return (
                  <motion.button
                    key={opt}
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
      <div className="mt-6 flex items-center justify-between gap-3">
        <motion.button
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full glass shadow-soft disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous question"
        >
          <ArrowLeft className="h-4 w-4" />
        </motion.button>

        {/* Progress dots morph */}
        <div className="flex items-center gap-1.5 px-2">
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
                aria-label={`Go to question ${i + 1}`}
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
            Next
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
            Review <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/* ============= REVIEW STEP ============= */
function ReviewStep({ selected, onSave, user, onLogin }: any) {
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
          Your quiz is ready
        </motion.h2>
        <motion.p
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="relative text-sm md:text-base text-white/90"
        >
          One last look. Then we share it.
        </motion.p>

        {/* Stat row */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative mt-5 flex flex-wrap items-center justify-center gap-2"
        >
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold">
            <ListChecks className="h-3.5 w-3.5" /> {selected.length} questions
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
          </div>
          {customCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold">
              <Wand2 className="h-3.5 w-3.5" /> {customCount} custom
            </div>
          )}
        </motion.div>
      </motion.div>

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
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{q.category}</span>
                    {q.isCustom && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">CUSTOM</span>
                    )}
                  </div>
                  <p className="mb-2 text-sm font-medium leading-snug">{q.text}</p>
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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 + selected.length * 0.05 }}
        className="relative"
      >
        {user ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
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
                  Saving…
                </>
              ) : (
                <>
                  <PartyPopper className="h-5 w-5" />
                  Save & Share
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </span>
          </motion.button>
        ) : (
          <div className="text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              Sign in to keep it forever, or save as a draft first.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              disabled={saving}
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
                    Saving…
                  </>
                ) : (
                  <>
                    Save Draft & Sign In
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </span>
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
