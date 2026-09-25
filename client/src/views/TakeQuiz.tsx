import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Copy, HeartHandshake, Lock, Sparkles,
  Send, Home, Mail, KeyRound, UserCircle2, Users2, Hourglass, ChevronDown,
  Heart,
} from 'lucide-react';
import { quizzesApi, invitationsApi, attemptsApi, coupleApi } from '@/api';
import { getCategoryMeta } from '@/lib/categories';
import type { StoredCoupleSessionState } from '@/types/couple';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { KineticCanvas, buildQuizCanvasSpec, quizThemeGradient } from '@/components/kinetic/KineticCanvas';
import QuestionStage from '@/components/quiz/QuestionStage';
import { getQuizTheme, resolveQuizAppearance } from '@/lib/quizAppearance';

type QuizRow = any;
type QuizQuestionRow = {
  id: string;
  category: string;
  question_text: string;
  order_number: number;
  emoji?: string;
  choices?: string[];
  distractor_answers?: string[];
  correct_answers?: string[];
};
type InvitationRow = any;
type CoupleSession = any;
type CoupleSlot = 'first' | 'second';

export default function TakeQuiz() {
  const { t } = useTranslation();
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const inviteCode = searchParams.get('code');
  const pairCode = searchParams.get('pair');

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionRow[]>([]);
  const [invitation, setInvitation] = useState<InvitationRow | null>(null);
  const [verified, setVerified] = useState(false);
  const [codeInput, setCodeInput] = useState(inviteCode || '');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [respondentName, setRespondentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coupleCodeInput, setCoupleCodeInput] = useState(pairCode || '');
  const reduceMotion = useReducedMotion();
  const [coupleSession, setCoupleSession] = useState<CoupleSession | null>(null);
  const [coupleSlot, setCoupleSlot] = useState<CoupleSlot | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);

  const isVersus = quiz?.title.startsWith('[Versus]') || false;
  const appearance = quiz?.appearance ? resolveQuizAppearance(quiz.appearance) : null;
  const [timeLeft, setTimeLeft] = useState(15);
  const [hasTakenVersus, setHasTakenVersus] = useState(false);

  useEffect(() => {
    if (isVersus && quizId && verified) {
      if (localStorage.getItem(`versus_taken_${quizId}`)) {
        setHasTakenVersus(true);
      }
    }
  }, [isVersus, quizId, verified]);

  useEffect(() => {
    if (!isVersus || !verified || submitting || hasTakenVersus || currentIdx >= questions.length) return;
    
    setTimeLeft(15);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          const currentQ = questions[currentIdx];
          setAnswers(a => {
            if (!a[currentQ.id]) return { ...a, [currentQ.id]: '___TIMED_OUT___' };
            return a;
          });
          if (currentIdx < questions.length - 1) {
            setCurrentIdx(c => c + 1);
          } else {
            setTimeout(() => {
              const btn = document.getElementById('submit-quiz-btn');
              if (btn) btn.click();
            }, 100);
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isVersus, verified, currentIdx, submitting, hasTakenVersus, questions]);

  useEffect(() => {
    if (!isVersus || !verified || submitting || hasTakenVersus || currentIdx >= questions.length) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        toast.error(t('player.tab'));
        const currentQ = questions[currentIdx];
        setAnswers(a => {
          if (!a[currentQ.id]) return { ...a, [currentQ.id]: '___CHEATED___' };
          return a;
        });
        if (currentIdx < questions.length - 1) {
          setCurrentIdx(c => c + 1);
        } else {
          setTimeout(() => {
            const btn = document.getElementById('submit-quiz-btn');
            if (btn) btn.click();
          }, 100);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isVersus, verified, currentIdx, submitting, hasTakenVersus, questions]);

  useEffect(() => {
    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  useEffect(() => {
    if (!quizId || !verified) {
      return;
    }

    const storedState = getStoredCoupleState(quizId);
    if (storedState) {
      void restoreCoupleSession(storedState);
      return;
    }

    if (pairCode) {
      setCoupleCodeInput(pairCode.toUpperCase());
    }
  }, [pairCode, quizId, verified]);

  async function loadQuiz() {
    if (!quizId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const { quiz: quizData, questions: questionRows } = await quizzesApi.getTake(quizId);
      setQuiz(quizData);
      setQuestions(questionRows || []);

      if (quizData.is_open) {
        setVerified(true);
      } else if (inviteCode) {
        await verifyCode(inviteCode);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const fetchCoupleSession = useCallback(async (sessionCode: string) => {
    if (!quizId) return null;
    try {
      const { session } = await coupleApi.getByCode(sessionCode);
      if (session.quiz_id !== quizId) return null;
      return session;
    } catch {
      return null;
    }
  }, [quizId]);

  const restoreCoupleSession = useCallback(async (storedState: StoredCoupleSessionState) => {
    const session = await fetchCoupleSession(storedState.code);
    if (!session) {
      clearStoredCoupleState();
      return;
    }
    setCoupleSession(session);
    setCoupleSlot(storedState.slot);
    setCoupleCodeInput(session.session_code);
  }, [fetchCoupleSession]);

  async function verifyCode(inputCode: string) {
    if (!quizId) return;
    try {
      const result = await invitationsApi.verify(quizId, inputCode);
      setInvitation(result.invitation);
      setVerified(true);
      if (result.invitation?.label) setRespondentName(result.invitation.label);
    } catch (err: any) {
      toast.error(t('player.invalid'));
    }
  }

  function selectAnswer(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  async function createCoupleSession() {
    if (!quizId) return;
    const name = respondentName.trim();
    if (!name) {
      toast.error(t('player.name_start'));
      return;
    }
    setSessionBusy(true);
    try {
      const { session, slot } = await coupleApi.create(quizId, name);
      setCoupleSession(session);
      setCoupleSlot(slot);
      setCoupleCodeInput(session.session_code);
      saveCoupleState(quizId, { code: session.session_code, slot });
      toast.success(t('player.started'));
    } catch (err: any) {
      toast.error(t('player.create_failed'));
    } finally {
      setSessionBusy(false);
    }
  }

  async function joinCoupleSession() {
    if (!quizId) return;
    const name = respondentName.trim();
    const normalizedCode = coupleCodeInput.trim().toUpperCase();
    if (!name) {
      toast.error(t('player.name_join'));
      return;
    }
    if (!normalizedCode) {
      toast.error(t('player.enter_code'));
      return;
    }
    setSessionBusy(true);
    try {
      const { session, slot } = await coupleApi.join(quizId, normalizedCode, name);
      setCoupleSession(session);
      setCoupleSlot(slot);
      saveCoupleState(quizId, { code: normalizedCode, slot });
      toast.success(t('player.joined'));
    } catch (err: any) {
      toast.error(t('player.join_failed'));
    } finally {
      setSessionBusy(false);
    }
  }

  async function submitQuiz() {
    if (!quizId) return;

    if (Object.keys(answers).length < questions.length && !isVersus) {
      toast.error(t('player.all'));
      return;
    }

    if (!isVersus && (coupleSession || coupleCodeInput.trim()) && !respondentName.trim()) {
      toast.error(t('player.name_submit'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await attemptsApi.submit(quizId, {
        answers,
        respondentName: respondentName.trim() || null,
        invitationId: invitation?.id || null,
        invitationCode: inviteCode || null,
        coupleSessionCode: coupleSession?.session_code || coupleCodeInput.trim() || null,
        coupleSlot,
        versusFlags: {
          timedOut: Object.values(answers).includes('___TIMED_OUT___'),
          cheated: Object.values(answers).includes('___CHEATED___'),
        },
      });

      if (isVersus) localStorage.setItem(`versus_taken_${quizId}`, 'true');
      if (result.coupleSession) setCoupleSession(result.coupleSession);
      navigate(result.redirectTo);
    } catch (err: any) {
      toast.error(t('player.submit_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  function copyCoupleShareLink() {
    if (!coupleSession || !quizId) {
      return;
    }

    const base = `${window.location.origin}/quiz/${quizId}`;
    const params = new URLSearchParams();

    if (inviteCode) {
      params.set('code', inviteCode);
    }

    params.set('pair', coupleSession.session_code);

    navigator.clipboard.writeText(`${base}?${params.toString()}`);
    toast.success(t('player.copied'));
  }

  function saveCoupleState(currentQuizId: string, value: StoredCoupleSessionState) {
    localStorage.setItem(getCoupleStorageKey(currentQuizId), JSON.stringify(value));
  }

  function clearStoredCoupleState() {
    if (!quizId) {
      return;
    }
    localStorage.removeItem(getCoupleStorageKey(quizId));
  }

  const canvasSpec = useMemo(
    () => {
      const current = questions[currentIdx];
      if (!current) return null;
      const themeGradient = quiz ? quizThemeGradient(quiz.id) : quizThemeGradient("kinetic");
      return buildQuizCanvasSpec(current.question_text, themeGradient, current.category);
    },
    [questions, currentIdx, quiz],
  );

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <TakeQuizBackdrop />
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative flex flex-col items-center gap-4 rounded-3xl glass px-9 py-8 shadow-soft"
        >
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-primary/15 animate-ring-ping" />
            <span className="absolute inset-2 rounded-full bg-primary/20 animate-ring-ping" style={{ animationDelay: '0.6s' }} />
            <Heart className="relative h-9 w-9 text-primary fill-primary animate-heartbeat" />
          </div>
          <div className="text-sm font-medium text-muted-foreground">{t('player.warming')}</div>
        </motion.div>
      </div>
    );
  }

  if (notFound || !quiz || questions.length === 0) {
    return <div className="consumer-page flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t('take_quiz.not_found')}</h1>
      <Button onClick={() => navigate('/')}>{t('journey.go_home')}</Button>
    </div>;
  }

  if (!verified) {
    return (
      <LockScreen
        codeInput={codeInput}
        setCodeInput={setCodeInput}
        verifyCode={verifyCode}
        quizTitle={quiz?.title || null}
        isVersus={isVersus}
        hasTakenVersus={hasTakenVersus}
        setVerified={setVerified}
        respondentName={respondentName}
        setRespondentName={setRespondentName}
      />
    );
  }

  const question = questions[currentIdx];
  const shuffledChoices = question ? getShuffledChoices(question) : [];
  const completionCount = Object.keys(answers).length;

  const progressPct = questions.length ? (completionCount / questions.length) * 100 : 0;
  const allAnswered = completionCount >= questions.length && questions.length > 0;
  const currentAnswered = !!(question && answers[question.id]);
  const categoryMeta = question ? getCategoryMeta(question.category) : null;
  const CategoryIcon = categoryMeta?.icon;
  // Heartfelt micro-copy rotates by question index — gentle, never repeats consecutively
  const promptLines = [
    t('player.gut'),
    t('player.time'),
    t('player.moments'),
    t('player.instinct'),
    t('player.picture'),
    t('player.feels'),
    t('player.mind'),
    t('player.feeling'),
    t('player.hunch'),
    t('player.know'),
  ];
  const promptLine = question ? promptLines[currentIdx % promptLines.length] : '';
  const milestoneNote =
    completionCount === 0
      ? null
      : completionCount === Math.floor(questions.length / 2)
        ? t('player.halfway')
        : completionCount === questions.length - 1 && !allAnswered
          ? t('player.one_more')
          : allAnswered
            ? t('player.ready')
            : null;
  const firstName = (respondentName || invitation?.label || '').trim().split(/\s+/)[0] || '';

  return (
    <div className="consumer-page quiz-player relative min-h-screen overflow-x-hidden bg-background" style={appearance ? { background: getQuizTheme(appearance).wash } : undefined}>
      {!appearance && <TakeQuizBackdrop dim />}
      {!appearance && !reduceMotion && canvasSpec && (
        <div className="pointer-events-none absolute inset-0 z-0 opacity-70">
          <KineticCanvas spec={canvasSpec} playKey={currentIdx} />
        </div>
      )}

      {/* ===== Sticky glass header ===== */}
      <header className="sticky top-0 z-30 border-b border-border/40 glass px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t('player.answering')}</div>
            <div className="truncate text-sm font-bold font-display">{quiz?.title || t('journey.quiz')}</div>
          </div>

          {/* Progress ring */}
          <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <motion.circle
                cx="18" cy="18" r="15"
                fill="none"
                stroke="hsl(var(--coral))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 15}
                initial={{ strokeDashoffset: 2 * Math.PI * 15 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - progressPct / 100) }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              />
            </svg>
            <span className="text-[11px] font-bold tabular-nums">
              {currentIdx + 1}<span className="text-muted-foreground/60">/{questions.length}</span>
            </span>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-40 sm:pb-28 pt-4 sm:pt-6">
        {/* ===== Welcome banner ===== */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl glass p-5 shadow-soft"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br from-coral/35 via-rose/30 to-lavender/30 blur-3xl" />

          {/* Subtle floating hearts in the corner */}
          <FloatingHearts count={4} />

          <div className="relative flex items-start gap-4">
            {/* Beating heart badge */}
            <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-2xl gradient-coral shadow-soft" />
              <span className="absolute -inset-1 rounded-2xl bg-coral/25 blur-md animate-pulse-soft" />
              <Heart className="relative h-5 w-5 text-white fill-white animate-heartbeat" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-widest font-bold text-primary">
                <Heart className="h-3 w-3 fill-current" /> {t('player.made_for_you')}
              </div>
              <h1 className="text-xl md:text-2xl font-bold font-display leading-tight">
                {firstName ? (
                  <span className="text-gradient-warm">{t('player.greeting', { name: firstName })}</span>
                ) : (
                  <span className="text-gradient-warm">{t('player.greeting_plain')}</span>
                )}
              </h1>
              <p className="mt-1.5 text-xs md:text-sm text-muted-foreground leading-relaxed">
                {t('player.intro')}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ===== Couple mode panel (collapsible) ===== */}
        <CouplePanel
          coupleSession={coupleSession}
          coupleSlot={coupleSlot}
          coupleCodeInput={coupleCodeInput}
          setCoupleCodeInput={setCoupleCodeInput}
          respondentName={respondentName}
          setRespondentName={setRespondentName}
          createCoupleSession={createCoupleSession}
          joinCoupleSession={joinCoupleSession}
          copyCoupleShareLink={copyCoupleShareLink}
          sessionBusy={sessionBusy}
        />

        {/* ===== Question card ===== */}
        <section className="relative">
          <AnimatePresence mode="wait" initial={false}>
            {question && appearance && !isVersus ? (
              <motion.div key={question.id} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <QuestionStage appearance={appearance} text={question.question_text} emoji={question.emoji} category={question.category} choices={shuffledChoices} selectedAnswer={answers[question.id]} onAnswer={option => selectAnswer(question.id, option)} questionNumber={currentIdx + 1} total={questions.length} />
              </motion.div>
            ) : question && categoryMeta && CategoryIcon && (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, rotateY: 10, x: 40 }}
                animate={{ opacity: 1, rotateY: 0, x: 0 }}
                exit={{ opacity: 0, rotateY: -10, x: -40 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformPerspective: 1000 }}
                className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
              >
                {/* Category color wash */}
                <div className={`pointer-events-none absolute inset-0 ${categoryMeta.colorClass} opacity-35`} />
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-coral/30 via-rose/25 to-lavender/25 blur-3xl" />

                {isVersus && (
                  <div className="absolute top-4 right-4 z-50 glass px-4 py-2 rounded-full border border-red-500/30 flex items-center gap-2 text-red-500 font-bold animate-pulse">
                    <Hourglass className="w-4 h-4" /> {timeLeft}s
                  </div>
                )}

                <div className="relative p-6 md:p-7">
                  {/* Top row: category pill + gentle micro-prompt */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-[11px] font-semibold">
                      <CategoryIcon className="h-3.5 w-3.5" />
                      {t(`categories.${question.category}`, { defaultValue: t(`versus.categories.${question.category}`, { defaultValue: question.category }) })}
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={promptLine}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.3 }}
                        className="inline-flex items-center gap-1 text-[11px] italic text-muted-foreground"
                      >
                        <Heart className="h-2.5 w-2.5 fill-coral text-coral" />
                        {promptLine}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  {/* Question */}
                  <h2 className="mb-6 text-xl md:text-2xl font-bold font-display leading-tight">
                    {question.question_text}
                  </h2>

                  {/* Answer buttons */}
                  <div className="grid gap-3">
                    {shuffledChoices.map((option, oi) => {
                      const isSelected = answers[question.id] === option;
                      return (
                        <motion.button
                          key={option}
                          type="button"
                          aria-pressed={isSelected}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: oi * 0.05, type: 'spring', stiffness: 280, damping: 24 }}
                          whileHover={{ y: -2, scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectAnswer(question.id, option)}
                          className={`group relative overflow-visible rounded-2xl border-2 px-4 py-4 text-left font-semibold transition-colors ${
                            isSelected
                              ? 'border-transparent gradient-coral text-primary-foreground shadow-glow'
                              : 'border-border bg-card hover:border-primary/40 hover:shadow-soft'
                          }`}
                        >
                          {/* selection burst */}
                          <AnimatePresence>
                            {isSelected && (
                              <motion.span
                                key="burst"
                                initial={{ scale: 0.6, opacity: 0.5 }}
                                animate={{ scale: 2.2, opacity: 0 }}
                                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                                className="pointer-events-none absolute inset-0 rounded-2xl bg-white/30"
                              />
                            )}
                          </AnimatePresence>

                          {/* Heart trail rising from the right side */}
                          {isSelected && <HeartTrail keySalt={option} />}

                          <div className="relative flex items-center gap-3">
                            {/* Letter chip or heart */}
                            <AnimatePresence mode="wait">
                              {isSelected ? (
                                <motion.span
                                  key="ok"
                                  initial={{ scale: 0, rotate: -90 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  exit={{ scale: 0 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 16 }}
                                  className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm"
                                >
                                  <Heart className="h-3.5 w-3.5 text-white fill-white animate-heartbeat" />
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="letter"
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.8, opacity: 0 }}
                                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
                                >
                                  {String.fromCharCode(65 + oi)}
                                </motion.span>
                              )}
                            </AnimatePresence>
                            <span className="leading-snug">{option}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Gentle reassurance under the options */}
                  <p className="mt-4 text-center text-[11px] text-muted-foreground/80 italic">
                    {t('player.change')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ===== Milestone whisper ===== */}
        <AnimatePresence mode="wait">
          {milestoneNote && (
            <motion.div
              key={milestoneNote}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex justify-center"
            >
              <div className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-foreground/80 shadow-soft">
                <Heart className="h-3 w-3 fill-coral text-coral animate-heartbeat" />
                {milestoneNote}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== Navigation + progress dots ===== */}
        <div className="player-navigation flex items-center justify-between gap-3">
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

          <select className="min-w-0 rounded-xl border border-border bg-card px-2 py-3 text-center sm:hidden" value={currentIdx} onChange={event => setCurrentIdx(Number(event.target.value))} aria-label={t('common.question', { current: currentIdx + 1, total: questions.length })}>
            {questions.map((item, index) => <option key={item.id} value={index}>{index + 1}/{questions.length}{answers[item.id] ? ' ✓' : ''}</option>)}
          </select>
          <div className="hidden sm:flex items-center gap-1.5 px-2 overflow-x-auto hide-scrollbar">
            {questions.map((_, index) => {
              const answered = !!answers[questions[index]?.id];
              const isActive = index === currentIdx;
              return (
                <motion.button
                  key={index}
                  type="button"
                  onClick={() => setCurrentIdx(index)}
                  animate={{
                    width: isActive ? 28 : 8,
                    backgroundColor: isActive
                      ? 'hsl(var(--coral))'
                      : answered
                        ? 'hsl(var(--teal))'
                        : 'hsl(var(--muted))',
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  className={`h-2 rounded-full flex-shrink-0 ${isActive ? 'shadow-glow' : ''}`}
                  aria-label={t('common.go_question', { number: index + 1 })}
                />
              );
            })}
          </div>

          {currentIdx < questions.length - 1 ? (
            <motion.button
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentIdx(currentIdx + 1)}
              disabled={!currentAnswered}
              className={`relative flex h-12 items-center gap-1.5 overflow-hidden rounded-full px-5 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed ${
                currentAnswered ? 'shimmer-sweep gradient-coral text-primary-foreground shadow-glow' : 'bg-muted text-muted-foreground'
              }`}
            >
              {t('common.next')} <ArrowRight className="h-4 w-4" />
            </motion.button>
          ) : (
            <motion.button
              id="submit-quiz-btn"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={submitQuiz}
              disabled={submitting || (!allAnswered && !isVersus)}
              className="relative flex h-12 items-center gap-1.5 overflow-hidden rounded-full shimmer-sweep gradient-coral text-primary-foreground px-5 text-sm font-bold shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Heart className="h-4 w-4 fill-white animate-heartbeat" />
                  {t('player.sending')}
                </>
              ) : (
                <>
                  <Heart className="h-4 w-4 fill-white" />
                  {coupleSession ? t('player.compare') : t('player.send')}
                </>
              )}
            </motion.button>
          )}
        </div>

        {/* Hint when missing answers at end */}
        {currentIdx === questions.length - 1 && !allAnswered && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-xs text-muted-foreground italic"
          >
            {t('player.remaining', { count: questions.length - completionCount })}
          </motion.p>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
/* Decorative + sub-views                                       */
/* ============================================================ */

/* ====== Tiny heart-burst rising from the selected answer ====== */
function HeartTrail({ keySalt }: { keySalt: string }) {
  const reduce = useReducedMotion();
  const hearts = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    // small spread of horizontal offsets + rotations + sizes
    const dx = (i - 2) * 8 + (Math.random() - 0.5) * 6;
    return {
      id: i,
      hx: `${dx}px`,
      hdx: `${(Math.random() - 0.5) * 18}px`,
      hr: `${(Math.random() - 0.5) * 30}deg`,
      delay: i * 0.06,
      size: 10 + Math.random() * 6,
      hue: ['var(--coral)', 'var(--rose)', 'var(--coral-light)'][i % 3],
    };
  }), [keySalt]);

  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20">
      {hearts.map(h => (
        <span
          key={h.id}
          className="absolute animate-heart-rise"
          style={{
            // @ts-expect-error CSS vars
            '--hx': h.hx,
            '--hdx': h.hdx,
            '--hr': h.hr,
            animationDelay: `${h.delay}s`,
            top: 0,
            right: 0,
          }}
        >
          <Heart
            style={{
              width: h.size,
              height: h.size,
              color: `hsl(${h.hue})`,
              fill: `hsl(${h.hue})`,
              filter: 'drop-shadow(0 2px 4px hsl(var(--coral) / 0.4))',
            }}
          />
        </span>
      ))}
    </div>
  );
}

function TakeQuizBackdrop({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${dim ? 'opacity-50' : ''}`}>
      <div className="absolute inset-0 aurora-bg" />
      <div className="absolute inset-0 mesh-dots opacity-60" />
      <div
        className="blob animate-drift-y"
        style={{ width: 360, height: 360, top: '-4rem', left: '-6rem', background: 'hsl(var(--coral) / 0.5)' }}
      />
      <div
        className="blob animate-drift-x"
        style={{ width: 320, height: 320, top: '20%', right: '-4rem', background: 'hsl(var(--lavender) / 0.45)', animationDelay: '1.5s' }}
      />
      <div
        className="blob animate-drift-y"
        style={{ width: 280, height: 280, bottom: '-4rem', left: '30%', background: 'hsl(var(--teal) / 0.4)', animationDelay: '3s' }}
      />
    </div>
  );
}

/* ====== Floating hearts decoration ====== */
function FloatingHearts({ count = 8 }: { count?: number }) {
  const reduce = useReducedMotion();
  const hearts = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    bottom: Math.random() * 30,
    delay: Math.random() * 6,
    duration: 5 + Math.random() * 4,
    size: 10 + Math.random() * 14,
    hue: ['var(--coral)', 'var(--rose)', 'var(--coral-light)'][i % 3],
    rotate: (Math.random() - 0.5) * 30,
  })), [count]);

  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {hearts.map(h => (
        <span
          key={h.id}
          className="absolute animate-sparkle"
          style={{
            left: `${h.left}%`,
            bottom: `${h.bottom}%`,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.duration}s`,
            transform: `rotate(${h.rotate}deg)`,
          }}
        >
          <Heart
            style={{
              width: h.size,
              height: h.size,
              color: `hsl(${h.hue})`,
              fill: `hsl(${h.hue} / 0.85)`,
            }}
          />
        </span>
      ))}
    </div>
  );
}

/* ====== Lock screen (invitation code) ====== */
function LockScreen({
  codeInput,
  setCodeInput,
  verifyCode,
  quizTitle,
  isVersus,
  hasTakenVersus,
  setVerified,
  respondentName,
  setRespondentName,
}: {
  codeInput: string;
  setCodeInput: (v: string) => void;
  verifyCode: (code: string) => void;
  quizTitle: string | null;
  isVersus?: boolean;
  hasTakenVersus?: boolean;
  setVerified: (v: boolean) => void;
  respondentName: string;
  setRespondentName: (v: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="consumer-page relative flex min-h-[calc(100dvh-56px)] items-center justify-center overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-10">
      <TakeQuizBackdrop />
      <FloatingHearts count={9} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -inset-1 rounded-[2rem] ring-conic opacity-50 blur-md" />
        <div className="relative overflow-hidden rounded-[2rem] glass p-4 sm:p-7 md:p-9 text-center shadow-glow">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-coral/35 via-rose/25 to-lavender/25 blur-3xl" />

          {/* Beating heart icon (with key cameo on hover-like halo) */}
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.15 }}
            className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center"
          >
            <span className="absolute inset-0 rounded-full bg-coral/20 animate-ring-ping" />
            <span className="absolute inset-2 rounded-full bg-rose/20 animate-ring-ping" style={{ animationDelay: '0.7s' }} />
            <div className="absolute inset-2 rounded-full gradient-coral shadow-glow" />
            <Heart className="relative h-9 w-9 text-white fill-white animate-heartbeat" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold text-primary">
              <Heart className="h-3 w-3 fill-current" /> {isVersus ? t('home_page.versus') : t('player.invited')}
            </div>
            <h1 className="mb-2 text-2xl md:text-3xl font-bold font-display leading-tight">
              {isVersus ? t('player.challenge') : t('player.prove')}
            </h1>
            {hasTakenVersus ? (
              <>
                <p className="mb-6 text-sm text-muted-foreground">
                  {t('player.already')}
                </p>
                <Button onClick={() => navigate('/dashboard')} className="w-full rounded-full bg-primary text-primary-foreground">
                  {t('journey.return_home')}
                </Button>
              </>
            ) : (
              <>
                <p className="mb-6 text-sm text-muted-foreground">
                  {isVersus ? t('player.strict') : t('player.name_begin')}
                </p>
                <div className="mb-5 flex items-center gap-2 rounded-full glass p-1.5 pl-4 shadow-soft">
                  <UserCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <Input
                    value={respondentName}
                    onChange={(e) => setRespondentName(e.target.value)}
                    placeholder={t('journey.your_name')}
                    className="flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
                    maxLength={30}
                    aria-label={t('journey.your_name')}
                  />
                  <Button
                    onClick={() => setVerified(true)}
                    disabled={!respondentName.trim()}
                    className="h-9 rounded-full gradient-coral text-primary-foreground px-5 shadow-glow transition-transform hover:scale-105 active:scale-95"
                  >
                    {t('player.start')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

/* ====== Couple-mode panel ====== */
function CouplePanel({
  coupleSession,
  coupleSlot,
  coupleCodeInput,
  setCoupleCodeInput,
  respondentName,
  setRespondentName,
  createCoupleSession,
  joinCoupleSession,
  copyCoupleShareLink,
  sessionBusy,
}: {
  coupleSession: CoupleSession | null;
  coupleSlot: CoupleSlot | null;
  coupleCodeInput: string;
  setCoupleCodeInput: (v: string) => void;
  respondentName: string;
  setRespondentName: (v: string) => void;
  createCoupleSession: () => void;
  joinCoupleSession: () => void;
  copyCoupleShareLink: () => void;
  sessionBusy: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<boolean>(!!coupleSession);
  const isActive = !!coupleSession;

  // Auto-expand when a session activates
  useEffect(() => {
    if (coupleSession) setExpanded(true);
  }, [coupleSession]);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
    >
      {/* Color wash when active */}
      {isActive && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-coral/15 via-rose/10 to-lavender/15" />
      )}

      {/* Header (toggle) */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="relative flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl gradient-coral text-white shadow-soft">
          <HeartHandshake className="h-5 w-5" />
          {isActive && (
            <span className="absolute -inset-1 rounded-2xl bg-primary/30 blur-md animate-pulse-soft" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold font-display">{t('player.couple')}</div>
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" /> {t('dashboard.active')}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t('player.optional')}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {isActive ? t('player.code_slot', { code: coupleSession.session_code, partner: coupleSlot === 'first' ? t('journey.first') : t('journey.second') }) : t('player.together')}
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden"
          >
            <div className="space-y-4 p-4 pt-0">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('player.privacy')}
              </p>

              {/* Name field */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <UserCircle2 className="h-3 w-3" /> {t('journey.your_name')}
                </label>
                <Input
                  aria-label={t('journey.your_name')}
                  value={respondentName}
                  onChange={(event) => setRespondentName(event.target.value)}
                  placeholder={t('journey.your_name')}
                  maxLength={40}
                  className="rounded-xl"
                />
              </div>

              {isActive ? (
                /* Active session view */
                <div className="space-y-3">
                  {/* Code chip with copy */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl glass px-4 py-3">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t('player.session_code')}</div>
                      <div className="font-mono text-lg font-bold tracking-[0.35em]">{coupleSession.session_code}</div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={copyCoupleShareLink}
                      className="flex h-12 w-12 items-center justify-center rounded-xl gradient-coral text-white shadow-soft"
                      aria-label={t('player.copy')}
                    >
                      <Copy className="h-4 w-4" />
                    </motion.button>
                  </div>

                  {/* Partner names */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t('journey.first')}</div>
                      <div className="text-sm font-bold font-display truncate">{coupleSession.first_name || '—'}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t('journey.second')}</div>
                      <div className="text-sm font-bold font-display truncate flex items-center gap-1.5">
                        {coupleSession.second_name || (
                          <>
                            <Hourglass className="h-3 w-3 text-muted-foreground animate-pulse" />
                            <span className="text-muted-foreground italic">{t('journey.waiting_dots')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="rounded-xl bg-secondary/10 p-3 text-xs text-secondary-foreground/80 leading-relaxed">
                    <Heart className="mr-1.5 inline h-3.5 w-3.5 text-secondary fill-secondary/40" />
                    {t('player.finish')}
                  </p>
                </div>
              ) : (
                /* Start / join layout */
                <div className="space-y-3">
                  {/* Start a session */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={createCoupleSession}
                    disabled={sessionBusy}
                    className="relative w-full overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-soft disabled:opacity-50"
                  >
                    <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-coral to-rose" />
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-coral/15 text-coral">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold font-display">{t('player.session_start')}</div>
                        <div className="text-[11px] text-muted-foreground">{t('player.six_code')}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </motion.button>

                  <div className="relative flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{t('player.or_join')}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Join with code */}
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <KeyRound className="h-3 w-3" /> {t('player.partner_code')}
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <InputOTP
                        maxLength={6}
                        aria-label={t('player.partner_code')}
                        value={coupleCodeInput}
                        onChange={(v) => setCoupleCodeInput(v.toUpperCase())}
                      >
                        <InputOTPGroup className="gap-1.5">
                          {[0, 1, 2, 3, 4, 5].map(i => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="h-10 w-8 rounded-lg border-2 border-border bg-background text-sm font-bold font-display data-[active=true]:border-primary first:rounded-l-lg last:rounded-r-lg"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <Button
                        type="button"
                        onClick={joinCoupleSession}
                        disabled={sessionBusy || !coupleCodeInput.trim()}
                        className="ml-auto rounded-full gradient-coral text-primary-foreground"
                      >
                        {t('player.join')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function getCoupleStorageKey(quizId: string) {
  return `couple_session_${quizId}`;
}

function getStoredCoupleState(quizId: string): StoredCoupleSessionState | null {
  const raw = localStorage.getItem(getCoupleStorageKey(quizId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredCoupleSessionState;
    if (!parsed.code || (parsed.slot !== 'first' && parsed.slot !== 'second')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getShuffledChoices(question: QuizQuestionRow): string[] {
  const allChoices = question.choices?.length
    ? [...question.choices]
    : [...(question.correct_answers || []), ...(question.distractor_answers || [])];
  const seed = question.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const shuffled = [...allChoices];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = (seed * (index + 1) * 7) % (index + 1);
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
  }

  return shuffled;
}
