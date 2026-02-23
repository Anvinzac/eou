import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, Users, Link2, BarChart3, ArrowRight, Sparkles, MessageCircleQuestion } from 'lucide-react';

const steps = [
  { icon: MessageCircleQuestion, title: 'Create Your Quiz', desc: 'Pick 10 questions from 11 categories about your personal preferences.' },
  { icon: Heart, title: 'Set Your Answers', desc: 'Choose the correct answer and 3 distractors for each question.' },
  { icon: Users, title: 'Sign In & Share', desc: 'Log in to save your quiz, generate invitation codes and share the link.' },
  { icon: Link2, title: 'Invite People', desc: 'Send unique invitation codes to friends, family and your partner.' },
  { icon: BarChart3, title: 'See Results', desc: 'View how well each person knows you with percentage scores!' },
];

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hasQuiz, setHasQuiz] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      if (!user) { setChecking(false); return; }
      const { data } = await supabase
        .from('quizzes')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      setHasQuiz(!!(data && data.length > 0));
      setChecking(false);
    }
    if (!loading) check();
  }, [user, loading]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user && hasQuiz) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold font-display">Welcome back! 🎉</h1>
            <p className="text-muted-foreground">You already have a quiz. Manage it from your dashboard.</p>
          </motion.div>
          <div className="flex flex-col gap-4">
            <Button onClick={() => navigate('/dashboard')} size="lg" className="gradient-coral text-primary-foreground">
              Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/create')} size="lg">
              Create Another Quiz
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20">
        <div className="absolute inset-0 gradient-hero opacity-10" />
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-3xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" /> How well do they know you?
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight font-display md:text-5xl lg:text-6xl">
            Do Your People <span className="text-primary">Really</span> Know You?
          </h1>
          <p className="mb-8 text-lg text-muted-foreground md:text-xl">
            Create a personalized quiz about your preferences and share it with friends, family, and your partner. See who knows you best!
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate('/create')} size="lg" className="gradient-coral text-primary-foreground px-8 py-6 text-lg shadow-glow">
              Start Creating <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            {!user && (
              <Button variant="outline" onClick={() => navigate('/auth')} size="lg" className="px-8 py-6 text-lg">
                Sign In
              </Button>
            )}
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-bold font-display md:text-3xl">How It Works</h2>
          <div className="grid gap-6 md:grid-cols-5">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-coral text-primary-foreground shadow-soft">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1 text-sm font-bold font-display">{step.title}</h3>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
                {i < steps.length - 1 && (
                  <div className="absolute -right-3 top-7 hidden text-muted-foreground/30 md:block">→</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-2xl rounded-3xl gradient-card border border-border p-8 text-center shadow-soft"
        >
          <h2 className="mb-3 text-2xl font-bold font-display">Ready to find out?</h2>
          <p className="mb-6 text-muted-foreground">It only takes a few minutes to create your quiz.</p>
          <Button onClick={() => navigate('/create')} size="lg" className="gradient-coral text-primary-foreground">
            Create My Quiz <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>
    </div>
  );
}
