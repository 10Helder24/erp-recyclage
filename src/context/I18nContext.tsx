import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, getTranslation, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { useAuth } from '../hooks/useAuth';

interface I18nContextValue {
  language: Language;
  t: (key: string) => string;
  setLanguage: (lang: Language) => Promise<void>;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const { user, refreshUser } = useAuth();
  const [language, setLanguageState] = useState<Language>(() => {
    // Priorité : user.language > localStorage (avec clé unique par utilisateur) > 'fr'
    if (user?.id) {
      const userKey = `language_${user.id}`;
      const saved = localStorage.getItem(userKey) as Language;
      if (saved && ['fr', 'de', 'en', 'it', 'pt'].includes(saved)) {
        return saved;
      }
    }
    return (user as any)?.language || 'fr';
  });

  // Mettre à jour la langue quand l'utilisateur change
  useEffect(() => {
    if (!user?.id) return;
    
    // Utiliser la langue de l'utilisateur depuis la base de données
    if ((user as any)?.language) {
      const userLang = (user as any).language;
      setLanguageState(userLang);
      // Sauvegarder avec une clé unique par utilisateur
      localStorage.setItem(`language_${user.id}`, userLang);
    } else {
      // Si pas de langue dans la BD, vérifier localStorage pour cet utilisateur
      const userKey = `language_${user.id}`;
      const saved = localStorage.getItem(userKey) as Language;
      if (saved && ['fr', 'de', 'en', 'it', 'pt'].includes(saved)) {
        setLanguageState(saved);
      }
    }
  }, [user?.id, (user as any)?.language]);

  const t = (key: string) => getTranslation(key, language);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    
    // Sauvegarder avec une clé unique par utilisateur
    if (user?.id) {
      localStorage.setItem(`language_${user.id}`, lang);
    }
    
    // Mettre à jour les préférences utilisateur via l'API
    try {
      const { Api } = await import('../lib/api');
      await Api.updateUserPreferences({ language: lang });
      // Recharger les données utilisateur
      if (refreshUser) {
        await refreshUser();
      }
      // Forcer le rechargement de la page pour appliquer la nouvelle langue partout
      // Car beaucoup de textes sont en dur dans les composants
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la langue:', error);
      // Même en cas d'erreur, recharger pour appliquer la langue
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  };

  return (
    <I18nContext.Provider value={{ language, t, setLanguage, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};

