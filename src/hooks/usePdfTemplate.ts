import { useCallback, useEffect, useState, useRef } from 'react';
import { Api, type PdfTemplateConfig } from '../lib/api';

type State = {
  config: PdfTemplateConfig | null;
  loading: boolean;
  error: Error | null;
  lastUpdated: number | null;
};

// Écouter les mises à jour de templates depuis d'autres onglets/fenêtres
const setupStorageListener = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'pdf_template_updated' && e.newValue) {
      callback();
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  
  // Écouter aussi les événements personnalisés pour la même fenêtre
  const handleCustomEvent = () => callback();
  window.addEventListener('pdf_template_updated', handleCustomEvent);
  
  return () => {
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener('pdf_template_updated', handleCustomEvent);
  };
};

export const usePdfTemplate = (module: string) => {
  const [state, setState] = useState<State>({
    config: null,
    loading: true,
    error: null,
    lastUpdated: null
  });
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckRef = useRef<number>(0);

  const fetchTemplate = useCallback(async (force = false) => {
    try {
      // Ajouter un timestamp pour éviter le cache du navigateur
      const timestamp = force ? Date.now() : lastCheckRef.current;
      setState((prev) => ({ ...prev, loading: true }));
      
      // Ajouter un paramètre de cache-busting à la requête si forcé
      const template = await Api.fetchPdfTemplate(module, force);
      
      // Vérifier si le template a été mis à jour
      const templateUpdated = template.updated_at ? new Date(template.updated_at).getTime() : 0;
      const shouldUpdate = force || !state.lastUpdated || templateUpdated > state.lastUpdated;
      
      if (shouldUpdate) {
        setState({
          config: template.config,
          loading: false,
          error: null,
          lastUpdated: templateUpdated || Date.now()
        });
        lastCheckRef.current = Date.now();
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      setState({
        config: state.config, // Garder l'ancien config en cas d'erreur
        loading: false,
        error: error as Error,
        lastUpdated: state.lastUpdated
      });
    }
  }, [module, state.lastUpdated, state.config]);

  useEffect(() => {
    // Charger le template au montage
    fetchTemplate(true);
    
    // Configurer l'écoute des mises à jour depuis d'autres onglets
    const cleanup = setupStorageListener(() => {
      fetchTemplate(true);
    });
    
    // Vérifier périodiquement si le template a été mis à jour (toutes les 30 secondes)
    intervalRef.current = setInterval(() => {
      fetchTemplate(false);
    }, 30000);
    
    return () => {
      cleanup();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [module]); // Recharger si le module change

  return {
    config: state.config,
    loading: state.loading,
    error: state.error,
    refresh: () => fetchTemplate(true)
  };
};

