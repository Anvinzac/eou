import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Trophy, RotateCcw, Home, Star, Swords } from 'lucide-react';

export default function QuizResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResult();
  }, [attemptId]);

  const loadResult = async () => {
    const { data: att } = await supabase.from('quiz_attempts').select('*').eq('id', attemptId).single();
    if (att) {
      setAttempt(att);
      const { data: q } = await supabase.from('quizzes').select('*').eq('id', att.quiz_id).single();
      setQuiz(q);
      
      if (q?.title?.startsWith('[Versus]')) {
        const { data: leaders } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('quiz_id', att.quiz_id)
          .order('score', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(10);
        if (leaders) setLeaderboard(leaders);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-2xl font-bold font-display">Result not found</h1>
        <Button onClick={() => navigate('/')} className="mt-4">Go Home</Button>
      </div>
    );
  }

  const pct = attempt.total_questions > 0 ? Math.round((attempt.score / attempt.total_questions) * 100) : 0;
  const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '😊' : pct >= 40 ? '😅' : '🤔';
  const message = pct >= 80 ? 'Amazing! They really know you!' : pct >= 60 ? 'Pretty good!' : pct >= 40 ? 'Not bad, room to grow!' : 'Time to learn more about each other!';

  const isVersus = quiz?.title?.startsWith('[Versus]');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="w-full max-w-md text-center"
      >
        {isVersus ? (
          <div className="rounded-3xl gradient-card border border-red-500/20 p-8 shadow-glow">
            <Swords className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="mb-2 text-2xl font-black font-display uppercase text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">Versus Leaderboard</h1>
            <p className="mb-6 text-sm text-muted-foreground">{quiz.title}</p>
            
            <div className="bg-card/50 rounded-2xl p-4 mb-6 text-left border border-border">
              {leaderboard.map((ld, i) => (
                <div key={ld.id} className={`flex items-center justify-between p-3 border-b border-border/50 last:border-0 ${ld.id === attempt.id ? 'bg-red-500/10 rounded-lg' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-bold">{ld.respondent_name || 'Anonymous'}</span>
                    {i === 0 && <Trophy className="h-4 w-4 text-amber-400" />}
                  </div>
                  <div className="font-bold font-display text-red-500">
                    {ld.score}/{ld.total_questions}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="my-6">
              <p className="text-sm">Your score: <strong className="text-red-500 text-lg">{attempt.score}</strong>/{attempt.total_questions}</p>
            </div>
            
            <Button onClick={() => navigate('/')} className="w-full bg-red-500 hover:bg-red-600 text-white">
              <Home className="mr-2 h-4 w-4" /> Go Home
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl gradient-card border border-border p-8 shadow-glow">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="mb-6"
            >
              <span className="text-6xl">{emoji}</span>
            </motion.div>

            <h1 className="mb-2 text-3xl font-bold font-display">Your Score</h1>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="my-6 flex items-center justify-center">
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-primary">
                  <span className="text-4xl font-bold font-display text-primary">{pct}%</span>
                </div>
              </div>

              <p className="mb-2 text-lg font-semibold">{message}</p>
              <p className="mb-6 text-sm text-muted-foreground">
                {attempt.score} out of {attempt.total_questions} correct
              </p>

              <div className="flex flex-col gap-3">
                {quiz && (
                  <Button 
                    onClick={() => navigate(`/quiz/${quiz.id}${attempt.invitation_id ? `?code=retry` : ''}`)}
                    variant="outline"
                    className="w-full"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Try Again
                  </Button>
                )}
                <Button onClick={() => navigate('/')} className="w-full gradient-coral text-primary-foreground">
                  <Home className="mr-2 h-4 w-4" /> Home
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
