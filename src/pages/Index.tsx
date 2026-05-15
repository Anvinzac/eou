import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, Users, Link2, BarChart3, ArrowRight, Sparkles, MessageCircleQuestion, Mail, Star, Quote } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';

const steps = [
  { icon: MessageCircleQuestion, title: 'Create Your Quiz', desc: 'Pick 5 to 10 questions from 11 categories about your personal preferences.' },
  { icon: Heart, title: 'Set Your Answers', desc: 'Choose the correct answer and 3 distractors for each question.' },
  { icon: Users, title: 'Sign In & Share', desc: 'Log in to save your quiz, generate invitation codes and share the link.' },
  { icon: Link2, title: 'Invite People', desc: 'Send unique invitation codes to friends, family and your partner.' },
  { icon: BarChart3, title: 'See Results', desc: 'View how well each person knows you with percentage scores!' },
];

const FloatingShapes = () => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-primary/20"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            scale: Math.random() * 0.5 + 0.5,
            opacity: 0,
          }}
          animate={{
            y: [null, Math.random() * -200 - 100],
            x: [null, Math.random() * 200 - 100],
            rotate: [0, 180, 360],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 10,
          }}
        >
          {i % 3 === 0 ? <Heart size={40} /> : i % 3 === 1 ? <Star size={30} /> : <MessageCircleQuestion size={40} />}
        </motion.div>
      ))}
    </div>
  );
};

const MockupCard = () => {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ rotate: -5, scale: 0.9 }}
      whileInView={{ rotate: 0, scale: 1 }}
      transition={{ type: 'spring', bounce: 0.5 }}
      viewport={{ once: true }}
      className="relative mx-auto w-full max-w-sm rounded-3xl border border-border/50 bg-card/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
    >
      <div className="absolute -left-6 -top-6 rounded-full bg-primary p-3 text-white shadow-lg shadow-primary/30">
        <Sparkles size={24} />
      </div>
      <div className="mb-2 text-sm font-medium text-primary">Question 4 of 10</div>
      <h3 className="mb-6 text-xl font-bold font-display leading-tight text-card-foreground">
        What is my absolute favorite thing to do on a lazy Sunday?
      </h3>
      <div className="space-y-3">
        {['Binge-watch a new series', 'Go for a long hike', 'Read a book by the window', 'Try cooking a new recipe'].map((opt, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelected(i)}
            className={`w-full rounded-2xl border p-4 text-left font-medium transition-all ${
              selected === i
                ? 'border-primary bg-primary/10 text-primary shadow-inner'
                : 'border-border/50 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-background'
            }`}
          >
            {opt}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [hasQuiz, setHasQuiz] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      if (!user) { setChecking(false); return; }

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user && hasQuiz) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <FloatingShapes />
      
      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-6 py-20 z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        
        <motion.div 
          initial={{ opacity: 0, y: 50 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mx-auto max-w-4xl text-center"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-6 py-2 text-sm font-semibold text-primary backdrop-blur-md"
          >
            <Sparkles className="h-4 w-4" /> Discover Your Relationships
          </motion.div>
          
          <h1 className="mb-6 text-4xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight font-display text-foreground md:text-7xl lg:text-8xl">
            Do They <br className="md:hidden" />
            <span className="relative inline-block text-transparent bg-clip-text gradient-coral">
              Really
              <motion.svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                <motion.path 
                  d="M0 10 Q50 20 100 10" 
                  fill="transparent" 
                  stroke="currentColor" 
                  strokeWidth="4" 
                  className="text-primary/30"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.8, duration: 1 }}
                />
              </motion.svg>
            </span> Know You?
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-2xl font-medium leading-relaxed">
            Create an exciting personalized quiz. Share it with your favorite people. Uncover who pays the most attention to the real you!
          </p>
          
          <motion.div 
            className="flex flex-col items-center gap-4 sm:gap-6 w-full sm:w-auto sm:flex-row sm:justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
              <Button 
                onClick={() => navigate('/create')} 
                size="lg" 
                className="gradient-coral w-full sm:w-auto text-primary-foreground relative h-16 rounded-full px-10 text-xl font-bold shadow-glow overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative flex items-center">Start Creating <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" /></span>
              </Button>
            </motion.div>
          </motion.div>

          {!user && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 flex flex-col items-center gap-4 w-full sm:w-auto sm:flex-row sm:justify-center"
            >
              <Button
                variant="outline"
                size="lg"
                className="h-14 w-full sm:w-auto rounded-full px-8 text-base border-border/50 bg-background/50 backdrop-blur hover:bg-background/80 transition-all"
                onClick={async () => {
                  const { error } = await lovable.auth.signInWithOAuth('google', {
                    redirect_uri: window.location.origin,
                  });
                  if (error) toast.error(error.message || 'Google sign-in failed');
                }}
              >
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/auth')} 
                size="lg" 
                className="h-14 w-full sm:w-auto rounded-full px-8 text-base text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                <Mail className="mr-3 h-5 w-5" /> Use Email
              </Button>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Sneak Peek Section */}
      <section className="relative py-16 md:py-24 px-6 z-10 bg-secondary/5">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="space-y-6 md:space-y-8"
            >
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display leading-tight">
                Crafted for <br className="hidden md:block"/> <span className="text-primary">Curiosity</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                We've built an experience that makes testing your friends not just insightful, but incredibly fun. Beautiful questions, interactive choices, and dramatic results.
              </p>
              <ul className="space-y-4">
                {[
                  "11 distinct categories of life",
                  "AI-assisted custom questions",
                  "Real-time scoreboard & rankings",
                  "Mobile-first, buttery smooth design"
                ].map((feature, i) => (
                  <motion.li 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center text-lg font-medium"
                  >
                    <div className="mr-4 rounded-full bg-primary/20 p-1 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    {feature}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            
            <div className="relative mt-8 lg:mt-0 lg:h-[500px] flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent blur-3xl -z-10 rounded-full opacity-50" />
              <MockupCard />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative px-6 py-16 md:py-32 z-10">
        <div className="mx-auto max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 md:mb-20 text-center"
          >
            <h2 className="text-3xl font-bold font-display md:text-5xl">How the Magic Happens</h2>
            <p className="mt-4 text-lg md:text-xl text-muted-foreground">Four simple steps to find out the truth.</p>
          </motion.div>
          
          <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.slice(0, 4).map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, type: "spring", stiffness: 100 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="group relative flex flex-col items-start rounded-3xl border border-border/50 bg-card/50 p-8 shadow-lg backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card hover:shadow-primary/20"
              >
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-coral text-primary-foreground shadow-soft transition-transform group-hover:rotate-6 group-hover:scale-110">
                  <step.icon className="h-8 w-8" />
                </div>
                <div className="absolute top-8 right-8 text-6xl font-bold text-primary/5 font-display transition-colors group-hover:text-primary/10">
                  {i + 1}
                </div>
                <h3 className="mb-3 text-2xl font-bold font-display">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 py-16 md:py-24 z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring" }}
          className="mx-auto max-w-4xl overflow-hidden rounded-3xl md:rounded-[3rem] gradient-card border border-primary/20 p-8 md:p-12 text-center shadow-2xl relative"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
          <div className="relative z-10 flex flex-col items-center">
            <Heart className="h-12 w-12 md:h-16 md:w-16 text-primary mb-6 animate-bounce" />
            <h2 className="mb-6 text-3xl font-extrabold font-display md:text-5xl leading-tight">
              Ready to reveal the <br className="hidden md:block" /> ultimate truth?
            </h2>
            <p className="mb-8 md:mb-10 text-lg md:text-xl text-muted-foreground/90 max-w-xl mx-auto font-medium">
              Join thousands of people who have already put their relationships to the test. It takes less than 3 minutes!
            </p>
            <motion.div className="w-full sm:w-auto" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => navigate('/create')} size="lg" className="gradient-coral w-full sm:w-auto text-primary-foreground h-16 rounded-full px-8 md:px-12 text-lg md:text-xl font-bold shadow-glow border-2 border-white/20">
                Create My Quiz Now
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

