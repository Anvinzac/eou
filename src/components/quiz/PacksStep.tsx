import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Package, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SelectedQuestion } from '@/types/quiz';

interface PackQuestion {
  text: string;
  category: string;
  options: string[];
}

interface QuestionPack {
  id: string;
  title: string;
  description: string;
  emoji: string;
  questions: PackQuestion[];
  is_system: boolean;
}

interface PacksStepProps {
  onSelectPack: (questions: SelectedQuestion[]) => void;
  onSkip: () => void;
}

export default function PacksStep({ onSelectPack, onSkip }: PacksStepProps) {
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPacks = async () => {
      const { data } = await supabase
        .from('question_packs')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) {
        setPacks(data.map(p => ({
          ...p,
          questions: (p.questions as any as PackQuestion[]) || [],
        })));
      }
    };
    fetchPacks();
  }, []);

  const selectedPack = packs.find(p => p.id === selectedPackId);

  const handleUsePack = () => {
    if (!selectedPack) return;
    const questions: SelectedQuestion[] = selectedPack.questions.map((q, i) => ({
      questionId: 80000 + i,
      category: q.category,
      text: q.text,
      options: q.options,
      orderNumber: i + 1,
      correctAnswer: '',
      distractors: [],
      isCustom: false,
    }));
    onSelectPack(questions);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h2 className="mb-1 text-xl font-bold font-display">Quick Start with a Pack</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Pick a question pack to get started fast, or skip to build from scratch.
      </p>

      {/* Horizontal scrollable packs */}
      <div className="-mx-4 mb-6">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto py-2 px-4 hide-scrollbar snap-x snap-mandatory"
        >
          {packs.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setSelectedPackId(pack.id === selectedPackId ? null : pack.id)}
              className={`relative flex-shrink-0 snap-center rounded-2xl border-2 p-5 text-left transition-all w-[260px] ${
                pack.id === selectedPackId
                  ? 'border-primary bg-primary/5 shadow-soft'
                  : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
              }`}
            >
              <div className="text-3xl mb-2">{pack.emoji}</div>
              <h3 className="font-bold font-display text-sm mb-1">{pack.title}</h3>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{pack.description}</p>
              <Badge variant="secondary" className="text-[10px]">
                {pack.questions.length} questions
              </Badge>
              {pack.id === selectedPackId && (
                <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-[10px] font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected pack preview */}
      {selectedPack && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-4 mb-6"
        >
          <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            {selectedPack.emoji} {selectedPack.title} — Preview
          </h3>
          <div className="space-y-1.5">
            {selectedPack.questions.map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="flex-shrink-0 w-5 h-5 rounded-md bg-muted flex items-center justify-center font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-foreground">{q.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleUsePack}
          disabled={!selectedPack}
          className="gradient-coral text-primary-foreground flex-1"
        >
          Use This Pack <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onSkip} className="flex-shrink-0">
          <Pencil className="mr-1 h-4 w-4" /> Build from Scratch
        </Button>
      </div>
    </motion.div>
  );
}
