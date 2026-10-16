import type { TFunction } from 'i18next';
import type { ShareLabels } from './types';

const pad = (value: number) => String(value).padStart(2, '0');

export function buildShareLabels(t: TFunction): ShareLabels {
  return {
    eyebrow: t('share_media.eyebrow'),
    questionCount: (count) => t('share_media.question_count', { count }),
    counter: (current, total) => `${pad(current)} / ${pad(total)}`,
    more: (count) => t('share_media.more', { count }),
    ctaTitle: t('share_media.cta_title'),
    ctaSubtitle: t('share_media.cta_subtitle'),
    posterFooter: t('share_media.poster_footer'),
  };
}

/** Same labels QuestionStage shows above each question. */
export function categoryLabeler(t: TFunction) {
  return (category: string) => (category ? t(`categories.${category}`, { defaultValue: category }) : t('studio.about_me'));
}
