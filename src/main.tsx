import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

// Enregistrer le Service Worker pour le mode offline avec gestion des mises à jour
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' }) // Ne jamais utiliser le cache pour le SW
      .then((registration) => {
        console.log('Service Worker enregistré:', registration.scope);

        // Vérifier les mises à jour toutes les heures
        setInterval(() => {
          registration.update();
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

        // Vérifier immédiatement s'il y a une mise à jour
        registration.update();
      })
      .catch((error) => {
        console.error('Erreur enregistrement Service Worker:', error);
      });
  });

  // Vérifier les mises à jour au focus de la fenêtre
  window.addEventListener('focus', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.update();
        }
      });
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
      <AuthProvider>
        <App />
        <Toaster position="top-right" />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
