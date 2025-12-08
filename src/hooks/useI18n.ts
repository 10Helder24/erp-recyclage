import { useContext, createContext } from 'react';
import { Language, getTranslation, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { useAuth } from './useAuth';

type I18nContextType = {
  language: Language;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
};

const I18nContext = createContext<I18nContextType | null>(null);

export const useI18n = () => {
  const context = useContext(I18nContext);
  const { user } = useAuth();
  
  const language = (user as any)?.language || (localStorage.getItem('language') as Language) || 'fr';
  
  const t = (key: string) => getTranslation(key, language);
  
  const setLanguage = async (lang: Language) => {
    localStorage.setItem('language', lang);
    // Mettre à jour les préférences utilisateur via l'API
    try {
      const { Api } = await import('../lib/api');
      await Api.updateUserPreferences({ language: lang });
      window.location.reload(); // Recharger pour appliquer la nouvelle langue
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la langue:', error);
    }
  };

  return {
    language,
    t,
    setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES
  };
};

