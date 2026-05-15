import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Check, Shuffle, Pencil, X, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { containsProfanity } from '@/lib/profanity';
import { generateLLMDistractors } from '@/lib/llmDistractorGenerator';
import type { QuestionData, SelectedQuestion } from '@/types/quiz';
import questionsData from '@/data/qna.json';
import PacksStep from '@/components/quiz/PacksStep';

const MAX_QUESTIONS = 10;
const allQuestions = (questionsData as { questions: QuestionData[] }).questions;

const DRAFT_TOKEN_KEY = 'quiz_draft_token';
const DRAFT_QUIZ_ID_KEY = 'quiz_draft_id';

function generateDraftToken() {
  return crypto.randomUUID();
}

export default function CreateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState<'packs' | 'play' | 'review'>('packs');
  const [currentQuestions, setCurrentQuestions] = useState<QuestionData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedQuestion[]>([]);
  
  const [quizTitle, setQuizTitle] = useState('My Quiz');
  const [isCustomMode, setIsCustomMode] = useState(false);
  
  const [customText, setCustomText] = useState('');
  const [customCorrect, setCustomCorrect] = useState('');
  const [customDistractors, setCustomDistractors] = useState<string[]>(['', '', '']);
  const [isGeneratingDistractors, setIsGeneratingDistractors] = useState(false);
  
  const customIdCounter = useRef(90000);

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
            localStorage.removeItem(DRAFT_TOKEN_KEY);
            localStorage.removeItem(DRAFT_QUIZ_ID_KEY);
          }
        });
    }
  }, [user]);

  // Auto-generate distractors when customCorrect changes
  useEffect(() => {
    if (!isCustomMode || !customCorrect.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      const allEmpty = customDistractors.every(d => !d.trim());
      if (allEmpty) {
        handleGenerateDistractors();
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [customCorrect, isCustomMode]);

  const handleGenerateDistractors = async () => {
    if (!customCorrect.trim()) {
      toast.error('Please enter a correct answer first to generate distractors');
      return;
    }
    
    setIsGeneratingDistractors(true);
    setCustomDistractors(['', '', '']); // clear them before showing loading
    try {
      const distractors = await generateLLMDistractors(customCorrect.trim(), customText.trim());
      
      // Pop them out one by one
      for (let i = 0; i < distractors.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 400)); // small delay for each pop
        setCustomDistractors(prev => {
          const next = [...prev];
          next[i] = distractors[i];
          return next;
        });
      }
      
      toast.success('Distractors generated!');
    } catch (err) {
      toast.error('Failed to generate distractors');
    } finally {
      setIsGeneratingDistractors(false);
    }
  };

  const handleSelectPack = (packQuestions: SelectedQuestion[]) => {
    // Pack questions already have everything except we need to let the user answer them.
    // We convert them back to QuestionData so the user can play the card flow with them.
    const questionsToPlay: QuestionData[] = packQuestions.map(pq => ({
      id: pq.questionId,
      category: pq.category,
      text: pq.text,
      options: pq.options
    }));
    setCurrentQuestions(questionsToPlay);
    setStep('play');
  };

  const handleStartRandom = () => {
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    setCurrentQuestions(shuffled.slice(0, MAX_QUESTIONS));
    setStep('play');
  };

  const handleShuffle = () => {
    const usedIds = new Set([
      ...selected.map(s => s.questionId),
      ...currentQuestions.map(q => q.id)
    ]);
    const available = allQuestions.filter(q => !usedIds.has(q.id));
    if (available.length === 0) {
      toast.error("No more questions to shuffle!");
      return;
    }
    
    const nextQ = available[Math.floor(Math.random() * available.length)];
    setCurrentQuestions(prev => {
      const newArr = [...prev];
      newArr[currentIndex] = nextQ;
      return newArr;
    });
  };

  const handleAnswer = (option: string) => {
    const q = currentQuestions[currentIndex];
    const availableDistractors = q.options.filter(o => o !== option);
    const shuffledDistractors = [...availableDistractors].sort(() => Math.random() - 0.5).slice(0, 3);
    
    const newSelected: SelectedQuestion = {
      questionId: q.id,
      category: q.category,
      text: q.text,
      options: q.options,
      orderNumber: currentIndex + 1,
      correctAnswer: option,
      distractors: shuffledDistractors,
      isCustom: false,
    };
    
    saveAndNext(newSelected);
  };

  const handleCustomSubmit = () => {
    if (!customText.trim() || !customCorrect.trim()) {
      toast.error('Please enter both question and answer');
      return;
    }
    if (containsProfanity(customText) || containsProfanity(customCorrect)) {
      toast.error('Please use appropriate language');
      return;
    }
    
    const validDistractors = customDistractors.filter(d => d.trim() !== '');
    if (validDistractors.length < 3) {
      toast.error('Please provide or generate 3 distractors');
      return;
    }

    customIdCounter.current += 1;
    
    const newSelected: SelectedQuestion = {
      questionId: customIdCounter.current,
      category: 'Custom',
      text: customText.trim(),
      options: [],
      orderNumber: currentIndex + 1,
      correctAnswer: customCorrect.trim(),
      distractors: validDistractors,
      isCustom: true,
      customCorrect: customCorrect.trim(),
      customDistractors: validDistractors,
    };
    
    setCustomText('');
    setCustomCorrect('');
    setCustomDistractors(['', '', '']);
    setIsCustomMode(false);
    saveAndNext(newSelected);
  };

  const saveAndNext = (newSelected: SelectedQuestion) => {
    const nextSelected = [...selected, newSelected];
    setSelected(nextSelected);
    
    if (currentIndex + 1 >= MAX_QUESTIONS) {
      setStep('review');
    } else {
      setCurrentIndex(curr => curr + 1);
    }
  };

  const saveQuiz = async () => {
    if (!user) {
      // Save as draft in DB first
      const draftToken = generateDraftToken();
      try {
        const { data: quiz, error: quizErr } = await supabase
          .from('quizzes')
          .insert({ user_id: null, title: quizTitle, max_questions: selected.length, draft_token: draftToken } as any)
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

    try {
      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({ user_id: user.id, title: quizTitle, max_questions: selected.length })
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

      toast.success('Quiz saved successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save quiz');
    }
  };

  const progressPercent = ((currentIndex) / MAX_QUESTIONS) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-4 py-4 border-b border-border flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => {
          if (step === 'packs') navigate(-1);
          else if (step === 'play') setStep('packs');
          else setStep('play');
        }}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="text-sm font-bold flex-1 text-center font-display">
          {step === 'packs' ? 'Choose a Pack' : step === 'play' ? `Question ${currentIndex + 1} of ${MAX_QUESTIONS}` : 'Quiz Ready!'}
        </div>
        <div className="w-16" /> {/* Spacer */}
      </header>

      {step === 'play' && (
        <div className="h-1 w-full bg-muted overflow-hidden">
          <motion.div
            className="h-full gradient-coral"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      <main className="flex-1 overflow-hidden relative flex flex-col items-center p-4">
        <AnimatePresence mode="wait">
          {step === 'packs' ? (
            <div className="w-full max-w-3xl my-auto">
              <PacksStep 
                onSelectPack={handleSelectPack}
                onSkip={handleStartRandom}
              />
            </div>
          ) : step === 'play' ? (
            <motion.div
              key={isCustomMode ? 'custom' : currentQuestions[currentIndex].id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md w-full my-auto flex flex-col items-center"
            >
              {isCustomMode ? (
                <div className="w-full rounded-3xl gradient-card border border-border p-6 shadow-glow">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold font-display">Write Your Own</h2>
                    <Button variant="ghost" size="icon" onClick={() => {
                      setIsCustomMode(false);
                      setCustomText('');
                      setCustomCorrect('');
                      setCustomDistractors(['', '', '']);
                    }}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-2">Question</label>
                      <Input 
                        placeholder="e.g. What's my secret talent?"
                        value={customText}
                        onChange={e => setCustomText(e.target.value)}
                        className="rounded-xl border-primary/20 bg-background/50"
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-2">Correct Answer</label>
                      <Input 
                        placeholder="e.g. Juggling"
                        value={customCorrect}
                        onChange={e => setCustomCorrect(e.target.value)}
                        className="rounded-xl border-primary/20 bg-background/50"
                        maxLength={50}
                      />
                    </div>
                    
                    <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-xs font-semibold text-muted-foreground block">Distractors (Incorrect Options)</label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs px-2 hover:bg-primary/10"
                          onClick={handleGenerateDistractors}
                          disabled={isGeneratingDistractors}
                        >
                          {isGeneratingDistractors ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                          Refresh
                        </Button>
                      </div>
                      <div className="space-y-2.5">
                        {[0, 1, 2].map((index) => (
                           <Input 
                             key={index}
                             placeholder={`Distractor ${index + 1}`}
                             value={customDistractors[index] || ''}
                             onChange={e => {
                               const newDistractors = [...customDistractors];
                               newDistractors[index] = e.target.value;
                               setCustomDistractors(newDistractors);
                             }}
                             className="rounded-lg border-primary/10 bg-background text-sm h-9"
                             maxLength={50}
                             disabled={isGeneratingDistractors}
                           />
                        ))}
                      </div>
                    </div>

                    <Button 
                      onClick={handleCustomSubmit} 
                      className="w-full gradient-coral text-primary-foreground rounded-xl mt-4 py-6"
                    >
                      Use Question <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-full rounded-3xl gradient-card border border-border p-6 md:p-8 shadow-glow text-center mb-6">
                    <Badge variant="outline" className="mb-4 bg-background/50 backdrop-blur-sm">
                      {currentQuestions[currentIndex].category}
                    </Badge>
                    <h2 className="text-2xl md:text-3xl font-bold font-display leading-tight mb-8">
                      {currentQuestions[currentIndex].text}
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {currentQuestions[currentIndex].options.map(opt => (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          key={opt}
                          onClick={() => handleAnswer(opt)}
                          className="rounded-2xl border-2 border-primary/20 bg-background/50 px-4 py-4 text-sm font-semibold hover:border-primary hover:bg-primary/5 transition-all text-center"
                        >
                          {opt}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="flex w-full gap-3 justify-center mb-4">
                    <Button variant="outline" size="lg" className="rounded-full flex-1 gap-2" onClick={handleShuffle}>
                      <Shuffle className="h-4 w-4" /> Shuffle
                    </Button>
                    <Button variant="outline" size="lg" className="rounded-full flex-1 gap-2" onClick={() => setIsCustomMode(true)}>
                      <Pencil className="h-4 w-4" /> Write My Own
                    </Button>
                  </div>
                  {selected.length >= 5 && (
                    <Button 
                      onClick={() => setStep('review')} 
                      className="w-full gradient-coral text-primary-foreground rounded-full shadow-glow" size="lg"
                    >
                      Finish Quiz Now ({selected.length}/10 selected) <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md w-full my-auto flex flex-col items-center text-center"
            >
              <div className="h-20 w-20 rounded-full gradient-coral text-primary-foreground flex items-center justify-center mb-6 shadow-glow">
                <Sparkles className="h-10 w-10" />
              </div>
              <h2 className="text-3xl font-bold font-display mb-2">Quiz Ready!</h2>
              <p className="text-muted-foreground mb-8">You've locked in {selected.length} questions.</p>

              <div className="w-full rounded-3xl gradient-card border border-border p-6 mb-8 text-left">
                <label className="text-sm font-semibold block mb-3 text-center">Give your quiz a name</label>
                <Input 
                  value={quizTitle}
                  onChange={e => setQuizTitle(e.target.value)}
                  className="text-center font-bold text-lg rounded-xl h-14 bg-background/50 border-primary/20"
                  maxLength={50}
                />
              </div>

              {user ? (
                <Button onClick={saveQuiz} size="lg" className="w-full gradient-coral text-primary-foreground py-6 text-lg rounded-xl shadow-glow">
                  Save Quiz & Continue
                </Button>
              ) : (
                <div className="w-full space-y-4">
                  <p className="text-sm text-muted-foreground">Sign in to share your quiz and see results.</p>
                  <Button onClick={saveQuiz} size="lg" className="w-full gradient-coral text-primary-foreground py-6 text-lg rounded-xl shadow-glow">
                    Save & Sign In
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
