import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Swords, BookOpen, Clock, Globe2, Stethoscope, Briefcase, Zap, ShieldAlert, Eye, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { catalogApi, quizzesApi } from '@/api';

const CATEGORIES = [
  { id: 'Common Knowledge', label: 'Common Knowledge', icon: Globe2, color: 'from-blue-400 to-indigo-500' },
  { id: 'Software Engineering', label: 'Software Engineering', icon: Zap, color: 'from-amber-400 to-orange-500' },
  { id: 'Business & Finance', label: 'Business & Finance', icon: Briefcase, color: 'from-emerald-400 to-teal-500' },
  { id: 'Medicine', label: 'Medicine', icon: Stethoscope, color: 'from-rose-400 to-red-500' },
];

export default function CreateVersus() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedDifficulty(null);
    refreshPreview(categoryId);
  };

  const refreshPreview = async (categoryId: string) => {
    try {
      const { questions } = await catalogApi.versusPreview(categoryId);
      setPreviewQuestions(questions || []);
    } catch {
      setPreviewQuestions([]);
    }
  };

  const handleCreate = async () => {
    if (!selectedCategory || !selectedDifficulty) return;
    if (!user) {
      toast.error('You must be logged in to create a Versus Challenge.');
      navigate('/auth');
      return;
    }

    setIsCreating(true);
    try {
      await quizzesApi.createVersus(selectedCategory, selectedDifficulty);
      toast.success('Versus Challenge created!');
      navigate(`/dashboard`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create Versus Challenge');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/5 bg-grid-pattern opacity-10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30"
          >
            <Swords className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black font-display mb-4 uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-amber-500">
            Versus Mode
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose an academic field, challenge your friends. <br/>
            Strict 15s timer. One try only. No cheating allowed.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCategorySelect(cat.id)}
                className={`relative flex flex-col items-center p-6 rounded-2xl border-2 transition-all ${
                  isSelected 
                    ? 'border-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
                    : 'border-border bg-card hover:border-red-500/50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br ${cat.color} shadow-lg text-white`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold font-display text-lg">{cat.label}</h3>
                {isSelected && (
                  <Badge className="absolute top-3 right-3 bg-red-500 hover:bg-red-600">Selected</Badge>
                )}
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedCategory && previewQuestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-10 overflow-hidden"
            >
              <div className="glass rounded-3xl p-6 border border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2 text-foreground">
                    <Eye className="h-5 w-5 text-primary" /> Preview Difficulty
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => refreshPreview(selectedCategory)} className="text-muted-foreground hover:text-primary">
                    <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Tap on the question that best matches the difficulty you want for this challenge.
                </p>
                <div className="space-y-4">
                  {previewQuestions.map((q, idx) => (
                    <motion.div 
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      key={idx} 
                      onClick={() => setSelectedDifficulty(q.difficulty)}
                      className={`cursor-pointer rounded-xl p-4 border-2 transition-all ${selectedDifficulty === q.difficulty ? 'bg-primary/10 border-primary shadow-glow' : 'bg-background/50 border-border hover:border-primary/50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={q.difficulty === 'Easy' ? 'secondary' : q.difficulty === 'Medium' ? 'default' : 'destructive'}>
                          {q.difficulty}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{q.topic}</span>
                      </div>
                      <p className="font-medium text-sm mb-3">Q: {q.text}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt: string, i: number) => (
                          <div key={i} className={`text-xs p-2 rounded-lg border ${opt === q.correctAnswer ? 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400 font-bold' : 'bg-muted border-border text-muted-foreground'}`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass rounded-3xl p-6 mb-10 border border-red-500/20">
          <h3 className="font-bold flex items-center gap-2 mb-4 text-red-400">
            <ShieldAlert className="h-5 w-5" /> Rules of Engagement
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-primary" />
              <span>You and your opponent will have exactly <b>15 seconds</b> per question.</span>
            </li>
            <li className="flex items-start gap-2">
              <BookOpen className="h-4 w-4 mt-0.5 text-primary" />
              <span>Questions are randomly drawn from the selected academic category. You won't know them in advance.</span>
            </li>
            <li className="flex items-start gap-2">
              <Swords className="h-4 w-4 mt-0.5 text-primary" />
              <span>If you leave the tab to search for an answer, the question is instantly marked incorrect.</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">1 Try</Badge>
              <span>Only your very first attempt is recorded to the leaderboard. No retakes.</span>
            </li>
          </ul>
        </div>

        <Button 
          disabled={!selectedCategory || !selectedDifficulty || isCreating}
          onClick={handleCreate}
          className="w-full h-16 rounded-full text-lg font-black uppercase tracking-widest bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all hover:scale-[1.02]"
        >
          {isCreating ? 'Forging Challenge...' : 'Create Challenge'}
        </Button>
      </div>
    </div>
  );
}
