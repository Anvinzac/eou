import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Check, Lock } from 'lucide-react';

export default function TakeQuiz() {
  const { quizId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [invitation, setInvitation] = useState<any>(null);
  const [verified, setVerified] = useState(false);
  const [codeInput, setCodeInput] = useState(code || '');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [respondentName, setRespondentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  const loadQuiz = async () => {
    const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', quizId).eq('is_active', true).single();
    if (!quizData) { setNotFound(true); setLoading(false); return; }
    setQuiz(quizData);

    const { data: qs } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('order_number');
    setQuestions(qs || []);

    if (quizData.is_open) {
      setVerified(true);
    } else if (code) {
      await verifyCode(code);
    }
    setLoading(false);
  };

  const verifyCode = async (inputCode: string) => {
    const { data: inv } = await supabase.from('invitations').select('*').eq('quiz_id', quizId).eq('code', inputCode.toUpperCase()).single();
    if (inv) {
      setInvitation(inv);
      setVerified(true);
      setRespondentName(inv.label);
    } else {
      toast.error('Invalid invitation code');
    }
  };

  const selectAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitQuiz = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions');
      return;
    }
    setSubmitting(true);
    try {
      let score = 0;
      questions.forEach(q => {
        const selected = answers[q.id];
        if (q.correct_answers.includes(selected)) score++;
      });

      const { data: attempt, error: attemptErr } = await supabase.from('quiz_attempts').insert({
        quiz_id: quizId,
        invitation_id: invitation?.id || null,
        respondent_name: respondentName || null,
        score,
        total_questions: questions.length,
        completed_at: new Date().toISOString(),
      }).select().single();

      if (attemptErr) throw attemptErr;

      // Save individual responses
      const responses = questions.map(q => ({
        attempt_id: attempt.id,
        question_id: q.id,
        selected_answer: answers[q.id],
        is_correct: q.correct_answers.includes(answers[q.id]),
      }));

      await supabase.from('quiz_responses').insert(responses);

      // Mark invitation as used
      if (invitation) {
        await supabase.from('invitations').update({ is_used: true }).eq('id', invitation.id);
      }

      navigate(`/result/${attempt.id}`);
    } catch (err: any) {
      toast.error(err.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
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
            onChange={e => setCodeInput(e.target.value.toUpperCase())}
            placeholder="Enter code..."
            className="mb-4 rounded-xl text-center text-lg font-mono tracking-widest"
            maxLength={6}
          />
          <Button onClick={() => verifyCode(codeInput)} className="w-full gradient-coral text-primary-foreground" disabled={codeInput.length < 6}>
            Verify & Start
          </Button>
        </motion.div>
      </div>
    );
  }

  const q = questions[currentIdx];
  const allChoices = q ? [...q.correct_answers, ...q.distractor_answers].sort(() => Math.random() - 0.5) : [];
  // We need stable shuffled order, so let's use a seeded approach
  const shuffledChoices = q ? getShuffledChoices(q) : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-sm text-muted-foreground">{quiz?.title}</span>
          <Badge variant="secondary">{currentIdx + 1}/{questions.length}</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <AnimatePresence mode="wait">
          {q && (
            <motion.div key={q.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{q.category}</p>
              <h2 className="mb-6 text-xl font-bold font-display">{q.question_text}</h2>

              <div className="grid gap-3">
                {shuffledChoices.map(opt => {
                  const isSelected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => selectAnswer(q.id, opt)}
                      className={`rounded-2xl border-2 p-4 text-left text-sm font-medium transition-all ${
                        isSelected 
                          ? 'border-primary gradient-coral text-primary-foreground shadow-soft' 
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      {isSelected && <Check className="mr-2 inline h-4 w-4" />}
                      {opt}
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
            <Button onClick={() => setCurrentIdx(currentIdx + 1)} disabled={!answers[q?.id]} className="gradient-coral text-primary-foreground">
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submitQuiz} disabled={submitting || Object.keys(answers).length < questions.length} className="gradient-teal text-secondary-foreground">
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-1">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrentIdx(i)} className={`h-2 w-2 rounded-full transition-all ${i === currentIdx ? 'w-6 gradient-coral' : answers[questions[i]?.id] ? 'bg-secondary' : 'bg-muted'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Stable shuffle using question id as seed
function getShuffledChoices(q: any): string[] {
  const all = [...(q.correct_answers || []), ...(q.distractor_answers || [])];
  // Simple seeded shuffle based on question id
  const seed = q.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed * (i + 1) * 7) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
