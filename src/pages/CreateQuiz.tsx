import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Trash2, ArrowUpToLine, ArrowDownToLine, Pencil, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { containsProfanity, cleanText } from '@/lib/profanity';
import { CATEGORIES, getCategoryMeta } from '@/lib/categories';
import type { QuestionData, SelectedQuestion } from '@/types/quiz';
import questionsData from '@/data/qna.json';

const MAX_QUESTIONS = 10;
const allQuestions = (questionsData as { questions: QuestionData[] }).questions;

type Step = 'select' | 'reorder' | 'answers' | 'review';

export default function CreateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<SelectedQuestion[]>([]);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);

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

  const moveToTop = (idx: number) => {
    setSelected(prev => {
      const item = prev[idx];
      const rest = prev.filter((_, i) => i !== idx);
      return [item, ...rest].map((q, i) => ({ ...q, orderNumber: i + 1 }));
    });
  };

  const moveToBottom = (idx: number) => {
    setSelected(prev => {
      const item = prev[idx];
      const rest = prev.filter((_, i) => i !== idx);
      return [...rest, item].map((q, i) => ({ ...q, orderNumber: i + 1 }));
    });
  };

  const deleteQuestion = (idx: number) => {
    const q = selected[idx];
    setSelected(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, orderNumber: i + 1 })));
    // Jump to the category of the deleted question
    const catIdx = CATEGORIES.findIndex(c => c.key === q.category);
    if (catIdx >= 0) setActiveCategoryIdx(catIdx);
    setStep('select');
    toast.info(`Removed "${q.text.slice(0, 40)}..." — pick a replacement!`);
  };

  const saveQuiz = async () => {
    if (!user) {
      toast.error('Please sign in to save your quiz');
      navigate('/auth');
      return;
    }
    // Validate all questions have answers
    const incomplete = selected.find(q => !q.correctAnswer || q.distractors.length < 3);
    if (incomplete) {
      toast.error('Please set answers for all questions');
      return;
    }
    try {
      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({ user_id: user.id, title: 'My Quiz', max_questions: MAX_QUESTIONS })
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
          <div className="flex items-center gap-2">
            {['select', 'reorder', 'answers', 'review'].map((s, i) => (
              <div key={s} className={`h-2 w-8 rounded-full transition-colors ${step === s ? 'gradient-coral' : 'bg-muted'}`} />
            ))}
          </div>
          {step === 'select' && (
            <Badge variant="secondary" className="text-sm font-bold">
              {remaining} left
            </Badge>
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
              onNext={() => {
                if (selected.length === 0) { toast.error('Select at least 1 question'); return; }
                setStep('reorder');
              }}
            />
          )}
          {step === 'reorder' && (
            <ReorderStep
              key="reorder"
              selected={selected}
              moveToTop={moveToTop}
              moveToBottom={moveToBottom}
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
              onLogin={() => navigate('/auth')}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============= SELECT STEP ============= */
function SelectStep({ questionsByCategory, selectedIds, toggleQuestion, remaining, activeCategoryIdx, setActiveCategoryIdx, onNext }: any) {
  const activeCategory = CATEGORIES[activeCategoryIdx];
  const questions = questionsByCategory[activeCategory.key] || [];

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <h2 className="mb-1 text-xl font-bold font-display">Pick Your Questions</h2>
      <p className="mb-4 text-sm text-muted-foreground">Swipe categories, tap questions to select. <span className="font-bold text-primary">{remaining}</span> remaining.</p>

      {/* Category tabs - horizontal scroll */}
      <div className="mb-6 flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
        {CATEGORIES.map((cat, idx) => {
          const count = questionsByCategory[cat.key]?.filter((q: QuestionData) => selectedIds.has(q.id)).length || 0;
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategoryIdx(idx)}
              className={`flex flex-shrink-0 flex-col items-center gap-1 rounded-2xl border-2 px-4 py-3 transition-all ${
                idx === activeCategoryIdx 
                  ? `${cat.colorClass} border-current shadow-soft scale-105` 
                  : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-semibold whitespace-nowrap">{cat.key}</span>
              {count > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{count}</span>
              )}
            </button>
          );
        })}
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
                  : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
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
function ReorderStep({ selected, moveToTop, moveToBottom, deleteQuestion, onNext }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <h2 className="mb-1 text-xl font-bold font-display">Arrange Your Questions</h2>
      <p className="mb-4 text-sm text-muted-foreground">Reorder, or delete to pick a replacement.</p>

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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveToTop(idx)} disabled={idx === 0}>
                  <ArrowUpToLine className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveToBottom(idx)} disabled={idx === selected.length - 1}>
                  <ArrowDownToLine className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteQuestion(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} className="gradient-coral text-primary-foreground">
          Next: Set Answers <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

/* ============= ANSWERS STEP ============= */
function AnswersStep({ selected, setSelected, onNext }: any) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [customMode, setCustomMode] = useState(false);
  const [customCorrect, setCustomCorrect] = useState('');
  const [customDistractors, setCustomDistractors] = useState(['', '', '']);
  const [profanityWarning, setProfanityWarning] = useState('');
  const q = selected[currentIdx] as SelectedQuestion;

  const selectCorrect = (opt: string) => {
    setSelected((prev: SelectedQuestion[]) => prev.map((s, i) => 
      i === currentIdx ? { ...s, correctAnswer: opt, isCustom: false } : s
    ));
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

  const saveCustom = () => {
    if (!customCorrect.trim() || customDistractors.some(d => !d.trim())) {
      toast.error('Fill in all custom fields');
      return;
    }
    setSelected((prev: SelectedQuestion[]) => prev.map((s, i) => 
      i === currentIdx ? { 
        ...s, 
        isCustom: true, 
        customCorrect: customCorrect.trim(),
        customDistractors: customDistractors.map(d => d.trim()),
        correctAnswer: customCorrect.trim(),
        distractors: customDistractors.map(d => d.trim()),
      } : s
    ));
    setCustomMode(false);
    toast.success('Custom answers saved!');
  };

  const isComplete = q.correctAnswer && q.distractors.length === 3;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold font-display">Set Answers</h2>
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
              <span className="text-secondary font-bold">1.</span> Tap the <span className="font-bold text-secondary">correct answer</span>, then{' '}
              <span className="text-primary font-bold">2.</span> pick <span className="font-bold text-primary">3 distractors</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map(opt => {
                const isCorrect = q.correctAnswer === opt;
                const isDistractor = q.distractors.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      if (!q.correctAnswer || isCorrect) selectCorrect(isCorrect ? '' : opt);
                      else if (q.correctAnswer && q.correctAnswer !== opt) toggleDistractor(opt);
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
            <button onClick={() => { setCustomMode(true); setCustomCorrect(q.customCorrect || ''); setCustomDistractors(q.customDistractors || ['', '', '']); }} className="mt-3 text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
              <Pencil className="h-3 w-3" /> Custom answers
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-secondary">Correct Answer</label>
              <Input 
                value={customCorrect} 
                onChange={e => validateAndSetCustomText(e.target.value, setCustomCorrect)}
                className="rounded-xl border-secondary/30 mt-1"
                placeholder="Type the correct answer"
                maxLength={100}
              />
            </div>
            {customDistractors.map((d, i) => (
              <div key={i}>
                <label className="text-xs font-semibold text-primary">Distractor {i + 1}</label>
                <Input
                  value={d}
                  onChange={e => {
                    const val = e.target.value;
                    validateAndSetCustomText(val, (v) => {
                      setCustomDistractors(prev => prev.map((p, j) => j === i ? v : p));
                    });
                  }}
                  className="rounded-xl border-primary/30 mt-1"
                  placeholder={`Wrong answer ${i + 1}`}
                  maxLength={100}
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button onClick={saveCustom} size="sm" className="gradient-teal text-secondary-foreground">Save Custom</Button>
              <Button onClick={() => setCustomMode(false)} variant="ghost" size="sm"><X className="h-4 w-4 mr-1" /> Cancel</Button>
            </div>
          </div>
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

      {/* Progress dots */}
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
          <p className="mb-3 text-sm text-muted-foreground">Sign in to save your quiz and share it!</p>
          <Button onClick={onLogin} size="lg" className="gradient-coral text-primary-foreground">
            Sign In to Save
          </Button>
        </div>
      )}
    </motion.div>
  );
}
