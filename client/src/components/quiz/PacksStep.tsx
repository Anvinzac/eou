import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import { StudioActions } from './QuizStudio';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Pencil, Sparkles, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { packsApi } from '@/api';
import type { QuestionData, SelectedQuestion } from '@/types/quiz';

interface PackQuestion {
  id?: number;
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
  catalog?: QuestionData[];
}

export default function PacksStep({ onSelectPack, onSkip, catalog = [] }: PacksStepProps) {
  const { t } = useTranslation();
  const [savedPacks, setPacks] = useState<QuestionPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPacks = async () => {
      try {
        const { packs: data } = await packsApi.list();
        setPacks((data || []).map((p: any) => ({
          ...p,
          questions: (p.questions as PackQuestion[]) || [],
        })));
      } catch {
        setPacks([]);
      }
    };
    fetchPacks();
  }, []);

  const curatedPacks: QuestionPack[] = catalog.length ? [
    { id: 'curated-mixed', title: t('packs.pack_mixed'), description: t('packs.pack_mixed_desc'), emoji: '🌈', questions: catalog.filter((_, index) => index % Math.max(1, Math.floor(catalog.length / 10)) === 0).slice(0, 10), is_system: true },
    { id: 'curated-fun', title: t('packs.pack_fun'), description: t('packs.pack_fun_desc'), emoji: '🪩', questions: catalog.filter(q => ['Leisure', 'Entertainment', 'Food', 'Travel'].includes(q.category)).filter((_, index) => index % 3 === 0).slice(0, 10), is_system: true },
    { id: 'curated-deep', title: t('packs.pack_deep'), description: t('packs.pack_deep_desc'), emoji: '💌', questions: catalog.filter(q => ['Emotion', 'Growth', 'Values'].includes(q.category)).filter((_, index) => index % 2 === 0).slice(0, 10), is_system: true },
  ].filter(pack => pack.questions.length >= 5) : [];
  const packs = [...curatedPacks, ...savedPacks];
  const selectedPack = packs.find(p => p.id === selectedPackId);

  const handleUsePack = () => {
    if (!selectedPack) return;
    const questions: SelectedQuestion[] = selectedPack.questions.map((q, i) => ({
      questionId: q.id ?? 80000 + i,
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

  // Keep active card centered when activeIdx changes
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const child = node.children[activeIdx] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeIdx]);

  const go = (dir: -1 | 1) => {
    setActiveIdx(idx => Math.min(packs.length - 1, Math.max(0, idx + dir)));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="mb-6 text-center md:text-left">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary"
        >
          <Sparkles className="h-3 w-3" /> {t('studio.packs_step')}
        </motion.div>
        <h2 className="mb-2 text-2xl md:text-3xl font-bold font-display">
          {t('studio.packs_title')} <span className="text-gradient-warm">{t('studio.packs_highlight')}</span>
        </h2>
        <p className="text-sm text-muted-foreground max-w-xl">
          {t('studio.packs_hint')}
        </p>
      </div>

      {packs.length === 0 && <p className="mb-6 text-sm text-muted-foreground">{t('studio.no_packs')}</p>}
      {/* Carousel */}
      <div className="relative -mx-4 mb-8">
        {/* Nav buttons */}
        {packs.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full glass p-2 shadow-soft hover-halo md:flex"
              aria-label={t('studio.pack_previous')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => go(1)}
              className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full glass p-2 shadow-soft hover-halo md:flex"
              aria-label={t('studio.pack_next')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto py-4 px-4 hide-scrollbar snap-x snap-mandatory"
        >
          {packs.map((pack, i) => {
            const isActive = i === activeIdx;
            const isSelected = pack.id === selectedPackId;
            return (
              <motion.button
                key={pack.id}
                onClick={() => {
                  setActiveIdx(i);
                  setSelectedPackId(pack.id === selectedPackId ? null : pack.id);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                initial={{ opacity: 0, y: 24 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: isActive ? 1 : 0.94,
                }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative flex-shrink-0 snap-center w-[min(300px,calc(100vw-64px))] text-left ${
                  isActive ? 'z-10' : ''
                }`}
              >
                {/* Animated conic ring on selection */}
                {isSelected && (
                  <motion.div
                    layoutId="pack-ring"
                    className="absolute -inset-[2px] rounded-3xl ring-conic opacity-80 blur-[2px]"
                  />
                )}

                <div
                  className={`tilt-card relative overflow-hidden rounded-3xl border-2 p-5 transition-all ${
                    isSelected
                      ? 'border-transparent bg-card shadow-glow'
                      : 'border-border bg-card hover:border-primary/30 shadow-soft'
                  }`}
                >
                  {/* Gradient accent corner */}
                  <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-coral/40 via-rose/30 to-lavender/30 blur-2xl" />

                  {/* Selection check */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full gradient-coral shadow-glow"
                      >
                        <Check className="h-4 w-4 text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Header */}
                  <div className="relative flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-coral/15 to-lavender/15 text-2xl">
                      {pack.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold font-display text-base truncate">{pack.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {pack.description}
                      </p>
                    </div>
                  </div>

                  {/* Question list */}
                  <div className="relative space-y-1.5 max-h-[200px] overflow-hidden mask-fade-bottom">
                    {pack.questions.slice(0, 8).map((q, qi) => (
                      <motion.div
                        key={qi}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + qi * 0.03 }}
                        className="flex items-start gap-2 text-xs"
                      >
                        <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded bg-muted flex items-center justify-center font-bold text-muted-foreground text-[10px]">
                          {qi + 1}
                        </span>
                        <span className="text-foreground leading-tight line-clamp-1">{q.text}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Footer badge */}
                  <div className="relative mt-4 flex items-center justify-between">
                    <span className="rounded-full bg-muted/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('common.questions', { count: pack.questions.length })}
                    </span>
                    <span
                      className={`text-xs font-semibold transition-colors ${
                        isSelected ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-primary'
                      }`}
                    >
                      {isSelected ? t('studio.pack_selected') : t('studio.pack_pick')}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}

          {/* End spacer */}
          <div className="w-2 flex-shrink-0" />
        </div>

        {/* Dot indicators */}
        {packs.length > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {packs.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIdx ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
                }`}
                aria-label={t('studio.pack_go', { number: i + 1 })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <StudioActions className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onSkip}
          className="glass hover-halo rounded-full sm:flex-shrink-0"
        >
          <Pencil className="mr-2 h-4 w-4" /> {t('studio.build_scratch')}
        </Button>
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="flex-1"
        >
          <Button
            onClick={handleUsePack}
            disabled={!selectedPack}
            className={`w-full rounded-full overflow-hidden relative ${
              selectedPack ? 'shimmer-sweep gradient-coral text-primary-foreground shadow-glow' : ''
            }`}
            size="lg"
          >
            {selectedPack ? (
              <>
                <span className="truncate">{t('studio.use_pack', { title: selectedPack.title })}</span><ArrowRight className="ml-2 h-4 w-4 shrink-0" />
              </>
            ) : (
              <>{t('studio.choose_pack')}</>
            )}
          </Button>
        </motion.div>
      </StudioActions>

      <style>{`
        .mask-fade-bottom {
          -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
          mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
        }
      `}</style>
    </motion.div>
  );
}
