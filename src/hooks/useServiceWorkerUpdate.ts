import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useServiceWorkerUpdate(): {
  updateAvailable: boolean;
  handleUpdate: () => Promise<void>;
  checkForUpdate: () => Promise<void>;
} {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const handleUpdate = useCallback(async () => {
    if (!registration) return;

    const newWorker = registration.installing || registration.waiting;
    if (!newWorker) {
      // Pas de nouveau worker, forcer la vérification
      await registration.update();
      // Recharger après un court délai
      setTimeout(() => {
        window.location.reload();
      }, 500);
      return;
    }

    // Envoyer un message au nouveau worker pour forcer l'activation
    newWorker.postMessage({ type: 'SKIP_WAITING' });

    // Attendre que le nouveau worker soit activé
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'activated') {
        // Recharger la page
        window.location.reload();
      }
    });

    // Timeout de sécurité
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }, [registration]);

  const checkForUpdate = useCallback(async () => {
    if (!registration) return;
    try {
      await registration.update();
      toast.success('Vérification de mise à jour effectuée');
    } catch (error) {
      console.error('Erreur lors de la vérification de mise à jour:', error);
    }
  }, [registration]);

  useEffect(() => {
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        
        setRegistration(reg);

        // Écouter les mises à jour disponibles
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouvelle version disponible
              setUpdateAvailable(true);
              toast(
                (t) => (
                  <div>
                    <p style={{ marginBottom: '8px', fontWeight: 600 }}>
                      Nouvelle version disponible
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          toast.dismiss(t.id);
                          handleUpdate();
                        }}
                        style={{
                          padding: '6px 12px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 500
                        }}
                      >
                        Mettre à jour
                      </button>
                      <button
                        onClick={() => {
                          toast.dismiss(t.id);
                          setUpdateAvailable(false);
                        }}
                        style={{
                          padding: '6px 12px',
                          background: '#e5e7eb',
                          color: '#374151',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Plus tard
                      </button>
                    </div>
                  </div>
                ),
                {
                  duration: Infinity,
                  icon: '🔄',
                  position: 'top-center'
                }
              );
            }
          });
        });

        // Vérifier les mises à jour toutes les 5 minutes
        const checkInterval = setInterval(() => {
          reg.update();
        }, 5 * 60 * 1000);

        return () => clearInterval(checkInterval);
      });
    }
  }, [handleUpdate]);

  return {
    updateAvailable,
    handleUpdate,
    checkForUpdate
  };
}

