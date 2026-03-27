import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Copy, HeartHandshake, Home, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { MatchDetail } from '@/lib/coupleMatching';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type CoupleSessionRow = Tables<'couple_sessions'>;
type QuizRow = Tables<'quizzes'>;

export default function CoupleResult() {
  const { sessionCode } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<CoupleSessionRow | null>(null);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  useEffect(() => {
    if (!session || session.status === 'completed') {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSession(false);
    }, 5000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.status]);

  async function loadSession(showSpinner = true) {
    if (!sessionCode) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }

    const { data: sessionData } = await supabase
      .from('couple_sessions')
      .select('*')
      .eq('session_code', sessionCode.toUpperCase())
      .single();

    if (!sessionData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setSession(sessionData);

    const { data: quizData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', sessionData.quiz_id)
      .single();

    setQuiz(quizData || null);
    setLoading(false);
  }

  const details = useMemo(() => {
    if (!session?.match_details || !Array.isArray(session.match_details)) {
      return [] as MatchDetail[];
    }

    return session.match_details as unknown as MatchDetail[];
  }, [session?.match_details]);

  function copyShareLink() {
    if (!session) {
      return;
    }

    navigator.clipboard.writeText(`${window.location.origin}/couple/${session.session_code}`);
    toast.success('Comparison link copied');
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

  if (notFound || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="mb-3 text-3xl font-bold font-display">Session not found</h1>
        <p className="mb-6 text-muted-foreground">This couple comparison link is invalid or no longer available.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  const waiting = session.status !== 'completed';
  const matchPercentage = session.match_percentage ?? 0;
  const matchCount = session.match_count ?? 0;
  const totalCompared = session.total_compared ?? details.length;
  const message =
    matchPercentage >= 85
      ? 'You two are seriously in sync.'
      : matchPercentage >= 65
        ? 'A strong match with a few fun surprises.'
        : matchPercentage >= 40
          ? 'Some overlap, some plot twists.'
          : 'Lots to talk about after this round.';

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-soft">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <HeartHandshake className="h-4 w-4" />
                Couple comparison
              </div>
              <h1 className="text-3xl font-bold font-display">{quiz?.title || 'Shared quiz result'}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.first_name || 'Partner 1'} and {session.second_name || 'Partner 2'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void loadSession()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <Button variant="outline" onClick={copyShareLink}>
                <Copy className="mr-2 h-4 w-4" /> Copy Link
              </Button>
            </div>
          </div>

          {waiting ? (
            <div className="rounded-2xl bg-muted/60 p-5">
              <Badge variant="secondary">Waiting for both submissions</Badge>
              <p className="mt-3 text-lg font-semibold font-display">The shared result will appear here automatically.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {session.first_attempt_id ? 'One partner has finished.' : 'No one has submitted yet.'}{' '}
                {session.second_attempt_id ? 'The second submission is already in.' : 'The page checks again every few seconds.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="rounded-3xl gradient-card border border-border p-6 text-center shadow-glow">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-primary">
                  <span className="text-4xl font-bold font-display text-primary">{matchPercentage}%</span>
                </div>
                <p className="mt-4 text-lg font-semibold">{message}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {matchCount} of {totalCompared} answers matched exactly
                </p>
              </div>

              <div className="rounded-3xl border border-border bg-muted/40 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-background p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Partner 1</p>
                    <p className="mt-1 text-lg font-bold font-display">{session.first_name || 'Partner 1'}</p>
                  </div>
                  <div className="rounded-2xl bg-background p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Partner 2</p>
                    <p className="mt-1 text-lg font-bold font-display">{session.second_name || 'Partner 2'}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Exact answer matches count toward the percentage. Every question below shows what both people picked.
                </p>
              </div>
            </div>
          )}
        </section>

        {!waiting && (
          <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-soft">
            <h2 className="mb-4 text-xl font-bold font-display">Question-by-question</h2>
            <div className="space-y-3">
              {details.map((detail) => (
                <div key={detail.questionId} className="rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">{detail.category}</p>
                      <p className="text-lg font-semibold font-display">{detail.questionText}</p>
                    </div>
                    <Badge variant={detail.isMatch ? 'default' : 'secondary'}>
                      {detail.isMatch ? 'Match' : 'Different'}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-background p-4">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">{session.first_name || 'Partner 1'}</p>
                      <p className="mt-1 text-sm font-medium">{detail.firstAnswer}</p>
                    </div>
                    <div className="rounded-2xl bg-background p-4">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">{session.second_name || 'Partner 2'}</p>
                      <p className="mt-1 text-sm font-medium">{detail.secondAnswer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex justify-center">
          <Button onClick={() => navigate('/')} className="gradient-coral text-primary-foreground">
            <Home className="mr-2 h-4 w-4" /> Home
          </Button>
        </div>
      </div>
    </div>
  );
}
