import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clapperboard } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

// The sheet and its renderer load on first use, keeping them out of the main bundle.
const ShareMediaSheet = lazy(() => import('./ShareMediaSheet'));

type Props = {
  quizId: string;
  title: string;
  /** Only open quizzes get media; an invite-only quiz has no link anyone could use. */
  isOpen: boolean;
  className?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
};

export default function ShareMediaButton({ quizId, title, isOpen, className, variant = 'outline', size }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  if (!isOpen) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
      >
        <Clapperboard className="mr-2 h-4 w-4" aria-hidden="true" /> {t('share_media.button')}
      </Button>
      {requested && (
        <Suspense fallback={null}>
          <ShareMediaSheet quizId={quizId} title={title} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
