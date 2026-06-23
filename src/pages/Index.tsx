import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Heart, Users, Link2, BarChart3, ArrowRight, Sparkles,
  MessageCircleQuestion, Mail, Star, Wand2, PartyPopper, Swords
} from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';

const steps = [
  { icon: MessageCircleQuestion, title: 'Pick Questions', desc: 'Choose from 11 colourful categories — or write your own.', tint: 'from-coral to-rose' },
  { icon: Heart, title: 'Set Answers', desc: 'Mark the correct one. We sprinkle in believable distractors.', tint: 'from-rose to-lavender' },
  { icon: Users, title: 'Sign In & Save', desc: 'Lock it in. Your quiz lives in your dashboard forever.', tint: 'from-lavender to-teal' },
  { icon: Link2, title: 'Share The Link', desc: 'One tap shares to anyone — no app, no signup for them.', tint: 'from-teal to-gold' },
  { icon: BarChart3, title: 'See The Results', desc: 'Watch who really knows you, ranked beautifully.', tint: 'from-gold to-coral' },
];

const rotatingPrompts = [
  'how well your partner really knows you',
  'who your closest friend actually is',
  'which family member pays attention',
  'who has been listening all along',
];

/* ------------------------------------------------------------ */
/* Decorative pieces                                             */
/* ------------------------------------------------------------ */

function AuroraBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 aurora-bg opacity-70" />
      <div className="absolute inset-0 mesh-dots opacity-50" />
      {/* Floating blobs */}
      <div
        className="blob animate-drift-y"
        style={{ width: 420, height: 420, top: '-6rem', left: '-8rem', background: 'hsl(var(--coral) / 0.55)' }}
      />
      <div
        className="blob animate-drift-x"
        style={{ width: 360, height: 360, top: '-4rem', right: '-6rem', background: 'hsl(var(--lavender) / 0.55)', animationDelay: '1.5s' }}
      />
      <div
        className="blob animate-drift-y"
        style={{ width: 320, height: 320, bottom: '-6rem', left: '20%', background: 'hsl(var(--teal) / 0.45)', animationDelay: '3s' }}
      />
    </div>
  );
}

function SparkleField({ count = 14 }: { count?: number }) {
  const reduce = useReducedMotion();
  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    bottom: -Math.random() * 30,
    delay: Math.random() * 5,
    duration: 4 + Math.random() * 4,
    size: 6 + Math.random() * 10,
    hue: ['var(--coral)', 'var(--gold)', 'var(--lavender)', 'var(--teal)'][i % 4],
  })), [count]);

  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map(s => (
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
          <Sparkles
            style={{ width: s.size, height: s.size, color: `hsl(${s.hue})` }}
          />
        </span>
      ))}
    </div>
  );
}

function AnimatedTitle({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <h1 className="mb-5 text-5xl font-bold leading-[1.05] font-display md:text-6xl lg:text-7xl tracking-tight">
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block mr-[0.25em]"
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {w === 'Really' ? (
            <span className="text-gradient-warm italic">{w}</span>
          ) : (
            w
          )}
        </motion.span>
      ))}
    </h1>
  );
}

function RotatingTagline() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % rotatingPrompts.length), 2800);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="mb-10 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
      Find out{' '}
      <span className="relative inline-block align-middle h-[1.4em] overflow-hidden min-w-[18ch] text-left">
        <AnimatePresence mode="wait">
          <motion.span
            key={idx}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 font-semibold text-foreground"
          >
            {rotatingPrompts[idx]}
          </motion.span>
        </AnimatePresence>
      </span>
      .
    </p>
  );
}

/* ------------------------------------------------------------ */
/* Main page                                                     */
/* ------------------------------------------------------------ */

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hasQuiz, setHasQuiz] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      if (!user) { setChecking(false); return; }

      // Link any draft quiz first
      const draftToken = localStorage.getItem('quiz_draft_token');
      const draftQuizId = localStorage.getItem('quiz_draft_id');
      if (draftToken && draftQuizId) {
        const { error } = await supabase
          .from('quizzes')
          .update({ user_id: user.id, draft_token: null })
          .eq('id', draftQuizId)
          .eq('draft_token', draftToken);
        if (!error) {
          localStorage.removeItem('quiz_draft_token');
          localStorage.removeItem('quiz_draft_id');
        }
      }

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
      <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
        <AuroraBackdrop />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
          className="h-10 w-10 rounded-full border-[3px] border-primary border-t-transparent"
        />
      </div>
    );
  }

  if (user && hasQuiz) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AuroraBackdrop />

      {/* ============== HERO ============== */}
      <section className="relative px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <SparkleField count={16} />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Eyebrow pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-medium text-foreground/80 shadow-soft"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ring-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <Sparkles className="h-4 w-4 text-primary" />
            How well do they actually know you?
          </motion.div>

          <AnimatedTitle text="Do Your People Really Know You?" />

          <RotatingTagline />

          {/* Primary CTA — magnetic + shimmer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="relative"
            >
              <div className="absolute -inset-1 rounded-full ring-conic opacity-60 blur-md" />
              <Button
                onClick={() => navigate('/create')}
                size="lg"
                className="relative shimmer-sweep overflow-hidden gradient-coral text-primary-foreground px-10 py-7 text-lg font-bold rounded-full shadow-glow w-full"
              >
                <Wand2 className="mr-2 h-5 w-5" />
                Build My Quiz
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="relative w-full max-w-[280px]"
            >
              <Button
                onClick={() => navigate('/create-versus')}
                size="lg"
                variant="outline"
                className="relative overflow-hidden border-2 border-red-500/50 bg-background/50 backdrop-blur hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 text-foreground px-10 py-7 text-lg font-bold rounded-full shadow-soft w-full transition-all"
              >
                <Swords className="mr-2 h-5 w-5 text-red-500" />
                Versus Mode
              </Button>
            </motion.div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <PartyPopper className="h-3.5 w-3.5" />
              Free · No signup needed to start · About 3 minutes
            </p>
          </motion.div>

          {!user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            >
              <div className="text-xs uppercase tracking-widest text-muted-foreground/70">
                Or sign in
              </div>
              <Button
                variant="outline"
                size="lg"
                className="glass hover-halo px-5 py-5 rounded-full"
                onClick={async () => {
                  const { error } = await lovable.auth.signInWithOAuth('google', {
                    redirect_uri: window.location.origin,
                  });
                  if (error) toast.error(error.message || 'Google sign-in failed');
                }}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/auth')}
                size="lg"
                className="glass hover-halo px-5 py-5 rounded-full"
              >
                <Mail className="mr-2 h-4 w-4" /> Email
              </Button>
            </motion.div>
          )}

          {/* Floating stat chips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="mt-14 flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { icon: Heart, label: '11 categories' },
              { icon: Star, label: 'Up to 10 questions' },
              { icon: Users, label: 'Built for couples & friends' },
            ].map((c, i) => (
              <div
                key={i}
                className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-foreground/80 shadow-soft"
              >
                <c.icon className="h-3.5 w-3.5 text-primary" />
                {c.label}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="mb-14 text-center"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> The 5-step ride
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-display">
              From idea to <span className="text-gradient-warm">aha-moment</span> in minutes
            </h2>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="group relative"
              >
                <div className="tilt-card hover-halo relative h-full overflow-hidden rounded-3xl glass p-6 shadow-soft">
                  {/* Gradient accent ribbon */}
                  <div className={`absolute inset-x-0 -top-px h-[3px] bg-gradient-to-r ${step.tint}`} />

                  {/* Step number ghost */}
                  <span className="absolute right-4 top-3 text-7xl font-black leading-none text-foreground/[0.04] select-none">
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl gradient-coral text-primary-foreground shadow-glow">
                    <step.icon className="h-7 w-7" />
                    <span className="absolute -inset-2 rounded-2xl bg-primary/30 blur-xl opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>

                  <h3 className="relative mb-2 text-base font-bold font-display">
                    {step.title}
                  </h3>
                  <p className="relative text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="relative px-6 pb-24 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-3xl"
        >
          <div className="absolute -inset-1 rounded-[2rem] ring-conic opacity-40 blur-lg" />
          <div className="grain relative overflow-hidden rounded-[2rem] gradient-hero p-10 md:p-14 text-center shadow-glow">
            <SparkleField count={10} />
            <h2 className="mb-3 text-3xl md:text-4xl font-bold font-display text-white drop-shadow">
              Ready to find out?
            </h2>
            <p className="mb-8 text-white/85 max-w-md mx-auto">
              Three minutes from now you'll have a beautiful quiz to share. Let's go.
            </p>
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="inline-block"
            >
              <Button
                onClick={() => navigate('/create')}
                size="lg"
                className="relative shimmer-sweep overflow-hidden bg-white text-primary hover:bg-white/95 px-10 py-7 text-lg font-bold rounded-full shadow-xl"
              >
                <Wand2 className="mr-2 h-5 w-5" />
                Create My Quiz
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
