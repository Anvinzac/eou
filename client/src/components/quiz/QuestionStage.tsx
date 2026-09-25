import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { getQuizStyle, getQuizTheme, type QuizAppearance } from '@/lib/quizAppearance';

interface QuestionStageProps {
  appearance: QuizAppearance;
  text: string;
  emoji?: string;
  category?: string;
  choices: string[];
  selectedAnswer?: string;
  onAnswer: (answer: string) => void;
  questionNumber: number;
  total: number;
  compact?: boolean;
}

/** The same question card is used in the studio preview and the published quiz. */
export default function QuestionStage({ appearance, text, emoji, category, choices, selectedAnswer, onAnswer, questionNumber, total, compact = false }: QuestionStageProps) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const theme = getQuizTheme(appearance);
  const style = getQuizStyle(appearance);
  const playful = style.id === 'playful';
  return (
    <section
      className={`question-stage relative isolate overflow-hidden ${compact ? 'min-h-[420px] p-5' : 'p-6 sm:p-9'} ${style.id === 'minimal' ? 'rounded-xl' : 'rounded-[2rem]'}`}
      style={{ background: theme.gradient, color: theme.ink }}
      aria-label={t('common.question', { current: questionNumber, total })}
    >
      {playful && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full border-[22px] border-white/20" />
          <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full border border-current opacity-10" />
          <span className="absolute right-8 top-28 text-3xl opacity-30">✳</span>
          <span className="absolute left-5 top-36 text-xl opacity-30">✦</span>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.18em]">
        <span className="truncate">{category ? t(`categories.${category}`, { defaultValue: category }) : t('studio.about_me')}</span>
        <span className="shrink-0 rounded-full border border-current/20 px-2.5 py-1">{String(questionNumber).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      </div>
      {emoji && (
        <motion.div
          key={emoji}
          initial={reduce ? false : { scale: 0.7, rotate: -15 }}
          animate={reduce ? undefined : { scale: 1, rotate: playful ? [0, -7, 7, 0] : 0 }}
          transition={{ duration: 0.65 }}
          className={`mx-auto mb-4 w-fit select-none text-center ${compact ? 'text-5xl' : 'text-6xl'}`}
          aria-label={t('studio.question_sticker')}
        >{emoji}</motion.div>
      )}
      <h2
        className={`mx-auto mb-7 max-w-xl text-center leading-snug ${compact ? 'text-[23px]' : 'text-2xl sm:text-3xl'} ${style.id === 'editorial' ? 'font-normal italic' : 'font-bold'}`}
        style={{ fontFamily: style.font, overflowWrap: 'anywhere' }}
      >{text}</h2>
      <div className="grid gap-2.5">
        {choices.map((choice, index) => {
          const checked = choice === selectedAnswer;
          return (
            <motion.button
              key={`${index}-${choice}`}
              type="button"
              aria-pressed={checked}
              onClick={() => onAnswer(choice)}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              className={`flex w-full items-center gap-3 border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${style.id === 'minimal' ? 'rounded-lg' : 'rounded-2xl'}`}
              style={{
                background: checked ? theme.ink : 'rgba(255,255,255,0.65)',
                color: checked ? theme.background : (appearance.theme === 'midnight' ? '#302e52' : theme.ink),
                borderColor: checked ? theme.ink : 'rgba(255,255,255,0.65)',
              }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/20 text-[10px]">
                {checked ? <Check className="h-3 w-3" /> : String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 break-words">{choice}</span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-5 text-center text-[10px] font-medium opacity-70">{t('studio.question_hint')}</p>
    </section>
  );
}
