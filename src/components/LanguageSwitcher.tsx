import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Globe } from 'lucide-react';

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi');
  };

  // HIDDEN FOR NOW AS PER USER REQUEST
  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={toggleLanguage}
      className="hidden fixed bottom-4 right-4 z-50 rounded-full shadow-lg bg-background/80 backdrop-blur-md border-primary/20"
      title="Toggle Language"
    >
      <Globe className="h-4 w-4" />
      <span className="sr-only">Toggle Language</span>
      <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
        {i18n.language.toUpperCase()}
      </span>
    </Button>
  );
};
