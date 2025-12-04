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
      // Ne pas afficher le loading si c'est juste une vérification périodique
      if (force) {
        setState((prev) => ({ ...prev, loading: true }));
      }
      
      // Toujours utiliser cache-busting pour détecter les changements même lors des vérifications périodiques
      const template = await Api.fetchPdfTemplate(module, true);
      
      // Vérifier si le template a été mis à jour en comparant le timestamp
      const templateUpdated = template.updated_at ? new Date(template.updated_at).getTime() : 0;
      const currentLastUpdated = state.lastUpdated || 0;
      const shouldUpdate = force || templateUpdated > currentLastUpdated;
      
      if (shouldUpdate) {
        setState({
          config: template.config,
          loading: false,
          error: null,
          lastUpdated: templateUpdated || Date.now()
        });
        lastCheckRef.current = Date.now();
      } else {
        // Pas de changement, juste mettre à jour le timestamp de vérification
        setState((prev) => ({ ...prev, loading: false }));
        lastCheckRef.current = Date.now();
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
    
    // Vérifier périodiquement si le template a été mis à jour (toutes les 10 secondes pour détecter rapidement les changements)
    intervalRef.current = setInterval(() => {
      // Vérifier seulement si assez de temps s'est écoulé depuis la dernière vérification
      if (Date.now() - lastCheckRef.current > 8000) { // Au moins 8 secondes entre les vérifications
        fetchTemplate(false);
      }
    }, 10000); // Vérifier toutes les 10 secondes
    
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

