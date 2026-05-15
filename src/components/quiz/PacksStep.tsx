import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Package, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { SelectedQuestion } from '@/types/quiz';
import questionsData from '@/data/qna.json';

const allQuestions = (questionsData as any).questions;
const categories = [...new Set(allQuestions.map((q: any) => q.category))] as string[];

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
      if (data && data.length > 0) {
        setPacks(data.map(p => ({
          ...p,
          questions: (p.questions as any as PackQuestion[]) || [],
        })));
      } else {
        const getMixedQuestions = (offset: number) => {
          const categories = [...new Set(allQuestions.map((q: any) => q.category))];
          const result: any[] = [];
          for (let i = 0; i < 10; i++) {
            const cat = categories[i % categories.length];
            const qs = allQuestions.filter((q: any) => q.category === cat);
            result.push(qs[(i + offset) % qs.length]);
          }
          return result;
        };

        const mockPacks: QuestionPack[] = [
          {
            id: 'mock-1',
            title: 'The Essentials',
            description: 'A great mix of basic, everyday topics.',
            emoji: '🌟',
            questions: getMixedQuestions(0),
            is_system: true
          },
          {
            id: 'mock-2',
            title: 'Deep & Quirky',
            description: 'Fun, thoughtful, and unexpected questions.',
            emoji: '🔮',
            questions: getMixedQuestions(3),
            is_system: true
          },
          {
            id: 'mock-3',
            title: 'Partner Test',
            description: 'The ultimate test for close relationships.',
            emoji: '💑',
            questions: getMixedQuestions(7),
            is_system: true
          }
        ];
        setPacks(mockPacks);
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

  const handleCategorySelect = (category: string) => {
    const catQs = allQuestions.filter((q: any) => q.category === category);
    const shuffled = [...catQs].sort(() => Math.random() - 0.5).slice(0, 10);
    
    const questions: SelectedQuestion[] = shuffled.map((q: any, i: number) => ({
      questionId: q.id,
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

      {/* Horizontal scrollable packs with full question lists */}
      <div className="-mx-4 mb-6">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto py-2 px-4 hide-scrollbar snap-x snap-mandatory"
        >
          {packs.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setSelectedPackId(pack.id === selectedPackId ? null : pack.id)}
              className={`relative flex-shrink-0 snap-center rounded-2xl border-2 p-5 text-left transition-all w-[280px] ${
                pack.id === selectedPackId
                  ? 'border-primary bg-primary/5 shadow-soft'
                  : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{pack.emoji}</span>
                <div>
                  <h3 className="font-bold font-display text-sm">{pack.title}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{pack.description}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {pack.questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="flex-shrink-0 w-4 h-4 rounded bg-muted flex items-center justify-center font-bold text-muted-foreground text-[10px]">
                      {i + 1}
                    </span>
                    <span className="text-foreground leading-tight">{q.text}</span>
                  </div>
                ))}
              </div>
              {pack.id === selectedPackId && (
                <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-[10px] font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-8">
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

      <div>
        <h3 className="mb-3 text-sm font-bold text-muted-foreground uppercase tracking-wider">Or Browse by Category</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <Badge 
              key={cat} 
              variant="outline" 
              className="cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors py-1.5 px-3 text-sm"
              onClick={() => handleCategorySelect(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
