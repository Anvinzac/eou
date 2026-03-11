import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Trash2, ArrowUp, ArrowDown, Pencil, X, Shuffle, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { containsProfanity } from '@/lib/profanity';
import { generateDistractors } from '@/lib/distractorGenerator';
import { CATEGORIES, getCategoryMeta } from '@/lib/categories';
import type { QuestionData, SelectedQuestion } from '@/types/quiz';
import questionsData from '@/data/qna.json';

const MAX_QUESTIONS = 10;
const allQuestions = (questionsData as { questions: QuestionData[] }).questions;

type Step = 'select' | 'reorder' | 'answers' | 'review';

const DRAFT_TOKEN_KEY = 'quiz_draft_token';
const DRAFT_QUIZ_ID_KEY = 'quiz_draft_id';

function generateDraftToken() {
  return crypto.randomUUID();
}

export default function CreateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('select');
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
      if (prev.length >= MAX_QUESTIONS) return prev;
      const usedIds = new Set(prev.map(s => s.questionId));
      const available = allQuestions.filter(q => !usedIds.has(q.id));
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const needed = MAX_QUESTIONS - prev.length;
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
    if (selected.length < MAX_QUESTIONS) {
      const needed = MAX_QUESTIONS - selected.length;
      toast(`You have ${selected.length}/${MAX_QUESTIONS} questions. Adding ${needed} random questions to fill the quiz.`, {
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

  const stepIndex = ['select', 'reorder', 'answers', 'review'].indexOf(step);
  const progressPercent = ((stepIndex + 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header with editable title + progress underline */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => {
            if (step === 'select') navigate('/');
            else if (step === 'reorder') setStep('select');
            else if (step === 'answers') setStep('reorder');
            else setStep('answers');
          }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>

          <div className="flex-1 mx-4 text-center">
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
                className="inline-flex items-center gap-1.5"
              >
                <span className="text-sm font-bold font-display">{quizTitle}</span>
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {/* Progress underline */}
            <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full gradient-coral rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            </div>
          </div>

          {step === 'select' && (
            remaining > 0 ? (
              <Badge variant="secondary" className="text-sm font-bold">
                {remaining} left
              </Badge>
            ) : (
              <Button size="sm" onClick={handleNextToReorder} className="gradient-coral text-primary-foreground text-xs">
                Next <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )
          )}
          {step !== 'select' && <div className="w-16" />}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <AnimatePresence mode="wait">
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

/* ============= SELECT STEP ============= */
function SelectStep({ questionsByCategory, selectedIds, toggleQuestion, remaining, activeCategoryIdx, setActiveCategoryIdx, onNext, addCustomQuestion }: any) {
  const activeCategory = CATEGORIES[activeCategoryIdx];
  const questions = questionsByCategory[activeCategory.key] || [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const [customText, setCustomText] = useState('');

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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) swipeCategory(diff > 0 ? 1 : -1);
      }}
    >
      <h2 className="mb-1 text-xl font-bold font-display">Pick Your Questions</h2>
      <p className="mb-4 text-sm text-muted-foreground">Swipe categories, tap questions to select. <span className="font-bold text-primary">{remaining}</span> remaining.</p>

      {/* Custom question input */}
      <div className="mb-4 flex gap-2">
        <Input
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddCustom(); }}
          placeholder="Write your own question…"
          className="flex-1 text-sm"
          maxLength={200}
          disabled={remaining === 0}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleAddCustom}
          disabled={remaining === 0 || !customText.trim()}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Category tabs */}
      <div className="-mx-4 mb-6">
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto py-2 px-4 hide-scrollbar">
          {CATEGORIES.map((cat, idx) => {
            const count = questionsByCategory[cat.key]?.filter((q: QuestionData) => selectedIds.has(q.id)).length || 0;
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategoryIdx(idx)}
                className={`relative flex flex-shrink-0 flex-col items-center gap-1 rounded-2xl border-2 px-4 py-3 transition-all ${
                  idx === activeCategoryIdx
                    ? `${cat.colorClass} border-current shadow-soft`
                    : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {count > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{count}</span>
                )}
                <Icon className="h-5 w-5" />
                <span className="text-xs font-semibold whitespace-nowrap">{cat.key}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Questions grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {questions.map((q: QuestionData) => {
          const isSelected = selectedIds.has(q.id);
          return (
            <motion.button
              key={q.id}
              layout
              onClick={() => toggleQuestion(q)}
              className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? `${activeCategory.colorClass} border-current shadow-soft`
                  : 'border-border bg-muted/50 hover:border-primary/30 hover:shadow-sm'
              }`}
            >
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <p className="pr-8 text-sm font-medium">{q.text}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} className="gradient-coral text-primary-foreground" disabled={remaining === MAX_QUESTIONS}>
          Next: Reorder <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

/* ============= REORDER STEP ============= */
function ReorderStep({ selected, moveUp, moveDown, deleteQuestion, onNext }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display">Arrange Your Questions</h2>
          <p className="text-sm text-muted-foreground">Reorder, or delete to pick a replacement.</p>
        </div>
        <Button onClick={onNext} className="gradient-coral text-primary-foreground">
          Done <Check className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {selected.map((q: SelectedQuestion, idx: number) => {
          const meta = getCategoryMeta(q.category);
          return (
            <motion.div
              key={q.questionId}
              layout
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${meta.colorClass} border-current`}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{q.text}</p>
                <span className="text-xs opacity-60">{q.category}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveUp(idx)} disabled={idx === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveDown(idx)} disabled={idx === selected.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteQuestion(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
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
  const q = selected[currentIdx] as SelectedQuestion;

  const selectCorrect = (opt: string) => {
    if (autoRandomize && opt) {
      // Auto-pick 3 random distractors
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

  const isComplete = q.correctAnswer && q.distractors.length === 3;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold font-display">Set Answers</h2>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={autoRandomize}
              onCheckedChange={(checked) => setAutoRandomize(!!checked)}
              className="h-4 w-4"
            />
            <span className="text-xs text-muted-foreground font-medium">Auto-pick distractors</span>
          </label>
        </div>
        <Badge variant="secondary">{currentIdx + 1}/{selected.length}</Badge>
      </div>

      <div className="rounded-2xl gradient-card border border-border p-6 shadow-soft">
        <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{q.category}</p>
        <p className="mb-4 text-lg font-semibold">{q.text}</p>

        {profanityWarning && (
          <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive font-medium">
            {profanityWarning}
          </div>
        )}

        {!customMode ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {autoRandomize ? (
                <>Tap the <span className="font-bold text-secondary">correct answer</span> — distractors will be picked automatically</>
              ) : (
                <>Firstly, tap the <span className="font-bold text-secondary">correct answer</span>, then pick <span className="font-bold text-primary">3 distractors</span></>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map(opt => {
                const isCorrect = q.correctAnswer === opt;
                const isDistractor = q.distractors.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      if (autoRandomize) {
                        selectCorrect(isCorrect ? '' : opt);
                      } else {
                        if (!q.correctAnswer || isCorrect) selectCorrect(isCorrect ? '' : opt);
                        else if (q.correctAnswer && q.correctAnswer !== opt) toggleDistractor(opt);
                      }
                    }}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all ${
                      isCorrect
                        ? 'border-secondary bg-secondary/10 text-secondary shadow-sm'
                        : isDistractor
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    {isCorrect && <Check className="mr-1 inline h-3 w-3" />}
                    {opt}
                  </button>
                );
              })}
            </div>
            <button onClick={() => { setCustomMode(true); setCustomCorrect(q.customCorrect || ''); }} className="mt-3 text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
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
            <div className="grid grid-cols-2 gap-2">
              {q.options.map(opt => {
                const isDistractor = q.distractors.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleDistractor(opt)}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition-all ${
                      isDistractor
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Prev
        </Button>

        {currentIdx < selected.length - 1 ? (
          <Button onClick={() => setCurrentIdx(currentIdx + 1)} disabled={!isComplete} className="gradient-coral text-primary-foreground">
            Next <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onNext} disabled={selected.some((s: SelectedQuestion) => !s.correctAnswer || s.distractors.length < 3)} className="gradient-coral text-primary-foreground">
            Review <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-4 flex justify-center gap-1">
        {selected.map((_: any, i: number) => {
          const s = selected[i] as SelectedQuestion;
          const done = s.correctAnswer && s.distractors.length === 3;
          return (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`h-2 w-2 rounded-full transition-all ${
                i === currentIdx ? 'w-6 gradient-coral' : done ? 'bg-secondary' : 'bg-muted'
              }`}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

/* ============= REVIEW STEP ============= */
function ReviewStep({ selected, onSave, user, onLogin }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <h2 className="mb-1 text-xl font-bold font-display">Review Your Quiz</h2>
      <p className="mb-4 text-sm text-muted-foreground">{selected.length} questions ready!</p>

      <div className="space-y-3 mb-6">
        {selected.map((q: SelectedQuestion, i: number) => (
          <div key={q.questionId} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">{q.text}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge className="bg-secondary/10 text-secondary border-secondary/30 text-xs">{q.correctAnswer}</Badge>
                  {q.distractors.map((d: string) => (
                    <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {user ? (
        <Button onClick={onSave} size="lg" className="w-full gradient-coral text-primary-foreground">
          Save Quiz & Continue
        </Button>
      ) : (
        <div className="text-center">
          <p className="mb-3 text-sm text-muted-foreground">Sign in to manage your quiz, or save as draft first!</p>
          <Button onClick={onLogin} size="lg" className="gradient-coral text-primary-foreground">
            Save Draft & Sign In
          </Button>
        </div>
      )}
    </motion.div>
  );
}
