import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy, HeartHandshake, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { buildCoupleMatchSummary } from '@/lib/coupleMatching';
import { generateInviteCode } from '@/lib/nameGenerator';
import type { CoupleSession, StoredCoupleSessionState } from '@/types/couple';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type QuizRow = Tables<'quizzes'>;
type QuizQuestionRow = Tables<'quiz_questions'>;
type InvitationRow = Tables<'invitations'>;
type QuizResponseRow = Tables<'quiz_responses'>;
type CoupleSlot = 'first' | 'second';

export default function TakeQuiz() {
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
  const [coupleSession, setCoupleSession] = useState<CoupleSession | null>(null);
  const [coupleSlot, setCoupleSlot] = useState<CoupleSlot | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);

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

    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('is_active', true)
      .single();

    if (!quizData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setQuiz(quizData);

    const { data: questionRows } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_number');

    setQuestions(questionRows || []);

    if (quizData.is_open) {
      setVerified(true);
    } else if (inviteCode) {
      await verifyCode(inviteCode);
    }

    setLoading(false);
  }

  const fetchCoupleSession = useCallback(async (sessionCode: string) => {
    if (!quizId) {
      return null;
    }

    const { data } = await supabase
      .from('couple_sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('session_code', sessionCode.toUpperCase())
      .single();
    return data;
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
    if (!quizId) {
      return;
    }

    const { data: invite } = await supabase
      .from('invitations')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('code', inputCode.toUpperCase())
      .single();

    if (invite) {
      setInvitation(invite);
      setVerified(true);
      setRespondentName(invite.label);
    } else {
      toast.error('Invalid invitation code');
    }
  }

  function selectAnswer(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  async function createCoupleSession() {
    if (!quizId) {
      return;
    }

    const name = respondentName.trim();
    if (!name) {
      toast.error('Add your name before starting couple mode');
      return;
    }

    setSessionBusy(true);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sessionCode = generateInviteCode();
      const { data, error } = await supabase
        .from('couple_sessions')
        .insert({
          quiz_id: quizId,
          session_code: sessionCode,
          first_name: name,
        })
        .select()
        .single();

      if (!error && data) {
        setCoupleSession(data);
        setCoupleSlot('first');
        setCoupleCodeInput(sessionCode);
        saveCoupleState(quizId, { code: sessionCode, slot: 'first' });
        toast.success('Couple mode started. Share the code with your partner.');
        setSessionBusy(false);
        return;
      }
    }

    setSessionBusy(false);
    toast.error('Unable to create a couple session right now');
  }

  async function joinCoupleSession() {
    if (!quizId) {
      return;
    }

    const name = respondentName.trim();
    const normalizedCode = coupleCodeInput.trim().toUpperCase();

    if (!name) {
      toast.error('Add your name before joining couple mode');
      return;
    }

    if (!normalizedCode) {
      toast.error('Enter a couple code to join');
      return;
    }

    setSessionBusy(true);
    const session = await fetchCoupleSession(normalizedCode);
    const stored = getStoredCoupleState(quizId);

    if (!session) {
      setSessionBusy(false);
      toast.error('Couple code not found');
      return;
    }

    if (session.status === 'completed' || session.second_attempt_id) {
      setSessionBusy(false);
      toast.error('This couple session is already completed');
      return;
    }

    if (session.second_name && stored?.code !== normalizedCode) {
      setSessionBusy(false);
      toast.error('This couple session already has two participants');
      return;
    }

    const { data, error } = await supabase
      .from('couple_sessions')
      .update({
        second_name: session.second_name || name,
      })
      .eq('id', session.id)
      .select()
      .single();

    if (error || !data) {
      setSessionBusy(false);
      toast.error(error?.message || 'Unable to join couple session');
      return;
    }

    setCoupleSession(data);
    setCoupleSlot('second');
    saveCoupleState(quizId, { code: normalizedCode, slot: 'second' });
    setSessionBusy(false);
    toast.success('Couple mode joined. Finish the quiz to reveal your match.');
  }

  async function submitQuiz() {
    if (!quizId) {
      return;
    }

    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions');
      return;
    }

    if ((coupleSession || coupleCodeInput.trim()) && !respondentName.trim()) {
      toast.error('Add your name before submitting');
      return;
    }

    setSubmitting(true);

    try {
      let score = 0;
      questions.forEach((question) => {
        const selected = answers[question.id];
        if (question.correct_answers.includes(selected)) {
          score += 1;
        }
      });

      const { data: attempt, error: attemptError } = await supabase
        .from('quiz_attempts')
        .insert({
          quiz_id: quizId,
          invitation_id: invitation?.id || null,
          respondent_name: respondentName.trim() || null,
          score,
          total_questions: questions.length,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (attemptError || !attempt) {
        throw attemptError || new Error('Unable to create quiz attempt');
      }

      const responses = questions.map((question) => ({
        attempt_id: attempt.id,
        question_id: question.id,
        selected_answer: answers[question.id],
        is_correct: question.correct_answers.includes(answers[question.id]),
      }));

      const { error: responseError } = await supabase.from('quiz_responses').insert(responses as any);
      if (responseError) {
        throw responseError;
      }

      if (invitation) {
        await supabase.from('invitations').update({ is_used: true }).eq('id', invitation.id);
      }

      if (coupleSession && coupleSlot) {
        await syncCoupleSessionAfterSubmit(coupleSession, coupleSlot, attempt.id, respondentName.trim(), responses as any);
        navigate(`/couple/${coupleSession.session_code}`);
      } else {
        navigate(`/result/${attempt.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit quiz';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function syncCoupleSessionAfterSubmit(
    session: CoupleSession,
    slot: CoupleSlot,
    attemptId: string,
    name: string,
    currentResponses: QuizResponseRow[],
  ) {
    const latestSession = await fetchCoupleSession(session.session_code);

    if (!latestSession) {
      throw new Error('Couple session no longer exists');
    }

    const baseUpdate =
      slot === 'first'
        ? { first_attempt_id: attemptId, first_name: name || latestSession.first_name, status: 'waiting', completed_at: null }
        : { second_attempt_id: attemptId, second_name: name || latestSession.second_name, status: 'waiting', completed_at: null };

    const { data: updatedSession, error: updateError } = await supabase
      .from('couple_sessions')
      .update(baseUpdate)
      .eq('id', latestSession.id)
      .select()
      .single();

    if (updateError || !updatedSession) {
      throw updateError || new Error('Unable to sync couple session');
    }

    const firstAttemptId = slot === 'first' ? attemptId : updatedSession.first_attempt_id;
    const secondAttemptId = slot === 'second' ? attemptId : updatedSession.second_attempt_id;

    if (!firstAttemptId || !secondAttemptId) {
      setCoupleSession(updatedSession);
      return;
    }

    const { data: storedResponses, error: storedResponseError } = await supabase
      .from('quiz_responses')
      .select('*')
      .in('attempt_id', [firstAttemptId, secondAttemptId]);

    if (storedResponseError || !storedResponses) {
      throw storedResponseError || new Error('Unable to load couple answers');
    }

    const firstResponses =
      slot === 'first'
        ? currentResponses
        : storedResponses.filter((response) => response.attempt_id === firstAttemptId);

    const secondResponses =
      slot === 'second'
        ? currentResponses
        : storedResponses.filter((response) => response.attempt_id === secondAttemptId);

    const summary = buildCoupleMatchSummary(questions, firstResponses, secondResponses);

    const { data: finalizedSession, error: finalizeError } = await supabase
      .from('couple_sessions')
      .update({
        first_attempt_id: firstAttemptId,
        second_attempt_id: secondAttemptId,
        status: 'completed',
        match_percentage: summary.matchPercentage,
        match_count: summary.matchCount,
        total_compared: summary.totalCompared,
        match_details: summary.details as any,
        completed_at: new Date().toISOString(),
      })
      .eq('id', updatedSession.id)
      .select()
      .single();

    if (finalizeError || !finalizedSession) {
      throw finalizeError || new Error('Unable to finalize couple comparison');
    }

    setCoupleSession(finalizedSession);
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
    toast.success('Couple link copied');
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
        />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="mb-3 text-3xl font-bold font-display">Quiz Not Found</h1>
        <p className="mb-6 text-muted-foreground">This quiz doesn't exist or is no longer active.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <Lock className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="mb-2 text-2xl font-bold font-display">Enter Invitation Code</h1>
          <p className="mb-6 text-sm text-muted-foreground">You need an invitation code to take this quiz.</p>
          <Input
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
            placeholder="Enter code..."
            className="mb-4 rounded-xl text-center text-lg font-mono tracking-widest"
            maxLength={6}
          />
          <Button
            onClick={() => verifyCode(codeInput)}
            className="w-full gradient-coral text-primary-foreground"
            disabled={codeInput.length < 6}
          >
            Verify & Start
          </Button>
        </motion.div>
      </div>
    );
  }

  const question = questions[currentIdx];
  const shuffledChoices = question ? getShuffledChoices(question) : [];
  const completionCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-sm text-muted-foreground">{quiz?.title}</span>
          <Badge variant="secondary">
            {currentIdx + 1}/{questions.length}
          </Badge>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        <section className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary">
                <HeartHandshake className="h-4 w-4" />
                Couple mode
              </div>
              <h2 className="text-lg font-bold font-display">Answer together, compare later</h2>
              <p className="text-sm text-muted-foreground">
                Each person answers privately on their own phone. We compare exact answer matches when both are done.
              </p>
            </div>
            <Badge variant={coupleSession ? 'default' : 'secondary'}>
              {coupleSession ? 'Active' : 'Optional'}
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
            <Input
              value={respondentName}
              onChange={(event) => setRespondentName(event.target.value)}
              placeholder="Your name"
              maxLength={40}
            />
            {coupleSession ? (
              <div className="flex gap-2">
                <Input value={coupleSession.session_code} readOnly className="font-mono tracking-[0.3em]" />
                <Button type="button" variant="outline" size="icon" onClick={copyCoupleShareLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={coupleCodeInput}
                  onChange={(event) => setCoupleCodeInput(event.target.value.toUpperCase())}
                  placeholder="Partner code"
                  maxLength={6}
                  className="font-mono tracking-[0.3em]"
                />
                <Button type="button" variant="outline" onClick={joinCoupleSession} disabled={sessionBusy || !coupleCodeInput.trim()}>
                  Join
                </Button>
              </div>
            )}
          </div>

          {coupleSession ? (
            <div className="mt-4 rounded-2xl bg-muted/60 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{coupleSlot === 'first' ? 'Partner 1' : 'Partner 2'}</Badge>
                <span className="text-muted-foreground">Code {coupleSession.session_code}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {coupleSession.first_name || 'Partner 1'}
                {' + '}
                {coupleSession.second_name || 'Waiting for partner'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Submit your answers to open the shared comparison screen. The first phone will wait there until the second one finishes.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={createCoupleSession} disabled={sessionBusy} className="gradient-coral text-primary-foreground">
                Start Couple Session
              </Button>
              <p className="self-center text-sm text-muted-foreground">
                Starting creates a 6-character code you can share with your partner.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card/90 p-5 shadow-soft">
          <div className="mb-5 flex items-center justify-between text-sm text-muted-foreground">
            <span>{completionCount} answered</span>
            <span>{questions.length - completionCount} left</span>
          </div>

          <AnimatePresence mode="wait">
            {question && (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{question.category}</p>
                <h2 className="mb-6 text-xl font-bold font-display">{question.question_text}</h2>

                <div className="grid gap-3">
                  {shuffledChoices.map((option) => {
                    const isSelected = answers[question.id] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => selectAnswer(question.id, option)}
                        className={`rounded-2xl border-2 p-4 text-left text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-primary gradient-coral text-primary-foreground shadow-soft'
                            : 'border-border bg-card hover:border-primary/30'
                        }`}
                      >
                        {isSelected && <Check className="mr-2 inline h-4 w-4" />}
                        {option}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Prev
            </Button>
            {currentIdx < questions.length - 1 ? (
              <Button onClick={() => setCurrentIdx(currentIdx + 1)} disabled={!answers[question?.id || '']} className="gradient-coral text-primary-foreground">
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={submitQuiz}
                disabled={submitting || Object.keys(answers).length < questions.length}
                className="gradient-teal text-secondary-foreground"
              >
                {submitting ? 'Submitting...' : coupleSession ? 'Submit & Compare' : 'Submit Quiz'}
              </Button>
            )}
          </div>

          <div className="mt-4 flex justify-center gap-1">
            {questions.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIdx(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentIdx ? 'w-6 gradient-coral' : answers[questions[index]?.id] ? 'bg-secondary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
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
  const allChoices = [...(question.correct_answers || []), ...(question.distractor_answers || [])];
  const seed = question.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const shuffled = [...allChoices];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = (seed * (index + 1) * 7) % (index + 1);
    [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
  }

  return shuffled;
}
