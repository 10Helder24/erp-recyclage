import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './context/I18nContext';
import { GeolocationProvider } from './context/GeolocationContext';

// Correctif pour les avertissements "non-passive event listener"
// Intercepte addEventListener pour marquer automatiquement les événements de scroll/touch comme passifs
if (typeof window !== 'undefined') {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'mousewheel'];
  
  EventTarget.prototype.addEventListener = function(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    // Si c'est un événement de scroll/touch et que les options ne sont pas explicitement définies
    if (passiveEvents.includes(type.toLowerCase())) {
      if (typeof options === 'boolean') {
        options = { capture: options, passive: true };
      } else if (options && typeof options === 'object') {
        // Si passive n'est pas explicitement défini à false, le mettre à true
        if (options.passive === undefined) {
          options = { ...options, passive: true };
        }
      } else {
        options = { passive: true };
      }
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
}

// Enregistrer le Service Worker pour le mode offline avec gestion des mises à jour
// Ne pas bloquer le démarrage de l'application si le Service Worker échoue
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  // Attendre que le DOM soit prêt avant d'enregistrer le Service Worker
  if (document.readyState === 'loading') {
    window.addEventListener('load', registerServiceWorker);
  } else {
    // Le DOM est déjà chargé, enregistrer immédiatement
    registerServiceWorker();
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => {
      console.log('Service Worker enregistré:', registration.scope);

      // Vérifier les mises à jour toutes les heures
      setInterval(() => {
        registration.update().catch((err) => console.error('SW update error (interval)', err));
      }, 60 * 60 * 1000);

      // Écouter les mises à jour disponibles
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        console.log('[SW] Nouvelle version détectée');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nouvelle version disponible
            console.log('[SW] Nouvelle version disponible');
            
            // Afficher une notification à l'utilisateur
            if (window.confirm('Une nouvelle version de l\'application est disponible. Voulez-vous la charger maintenant ?')) {
              // Envoyer un message au nouveau worker pour forcer l'activation
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              // Recharger la page
              window.location.reload();
            }
          }
        });
      });

      // Écouter les messages du Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'FORCE_RELOAD') {
          console.log('[SW] Rechargement forcé demandé');
          window.location.reload();
        }
      });

      // Vérifier immédiatement s'il y a une mise à jour (ne pas bloquer si ça échoue)
      registration.update().catch((err) => console.error('SW update error (initial)', err));
    })
    .catch((error) => {
      // Ne pas bloquer l'application si le Service Worker échoue
      console.warn('Service Worker non disponible (mode offline désactivé):', error);
    });

  // Vérifier les mises à jour au focus de la fenêtre
  window.addEventListener('focus', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => {
          if (registration) {
            registration.update().catch((err) => console.error('SW update error (focus)', err));
          }
        })
        .catch((err) => console.error('SW getRegistration error (focus)', err));
    }
  });
}

// Error Boundary pour capturer les erreurs de rendu
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Erreur React:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1>Une erreur est survenue</h1>
          <p>{this.state.error?.message || 'Erreur inconnue'}</p>
          <button onClick={() => window.location.reload()}>Recharger la page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <GeolocationProvider>
            <I18nProvider>
              <App />
              <Toaster position="top-right" />
            </I18nProvider>
          </GeolocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
