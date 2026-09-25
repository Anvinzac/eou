import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Globe } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const LanguageSwitcher = ({ className = '' }: { className?: string }) => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className={`language-switcher min-h-11 shrink-0 gap-2 rounded-full border-primary/20 bg-background/90 px-3 text-xs shadow-sm backdrop-blur-md ${className}`}
      aria-label={i18n.language === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'}
      lang={i18n.language === 'vi' ? 'en' : 'vi'}
    >
      <Globe className="h-4 w-4" />
      <span>{i18n.language === 'vi' ? 'English' : 'Tiếng Việt'}</span>
    </Button>
  );
};

export function AppLanguageSwitcher() {
  const { pathname } = useLocation();
  if (pathname === '/' || pathname === '/create') return null;
  return <div className="app-language-bar"><LanguageSwitcher /></div>;
}
