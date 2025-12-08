import { useEffect, useState, useCallback } from 'react';
import { offlineStorage } from '../utils/offlineStorage';
import { Api } from '../lib/api';
import toast from 'react-hot-toast';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingActions();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast('Mode hors ligne activé', { icon: '📴' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    offlineStorage
      .init()
      .then(updatePendingCount)
      .catch((err) => console.error('offlineStorage init error', err));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updatePendingCount = async () => {
    const actions = await offlineStorage.getPendingActions();
    setPendingCount(actions.length);
  };

  const syncPendingActions = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    try {
      const actions = await offlineStorage.getPendingActions();
      if (actions.length === 0) {
        setIsSyncing(false);
        return;
      }

      toast(`Synchronisation de ${actions.length} action(s)...`, { icon: '🔄' });

      for (const action of actions) {
        try {
          const response = await fetch(action.endpoint, {
            method: action.method,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`
            },
            body: action.method !== 'GET' ? JSON.stringify(action.payload) : undefined
          });

          if (response.ok) {
            await offlineStorage.removePendingAction(action.id);
          } else if (response.status >= 500 && action.retries < 3) {
            await offlineStorage.incrementRetry(action.id);
          } else if (response.status < 500) {
            await offlineStorage.removePendingAction(action.id);
          }
        } catch (error) {
          if (action.retries < 3) {
            await offlineStorage.incrementRetry(action.id);
          } else {
            await offlineStorage.removePendingAction(action.id);
            console.error('Failed to sync action after retries:', action);
          }
        }
      }

      await updatePendingCount();
      const remaining = await offlineStorage.getPendingActions();
      if (remaining.length === 0) {
        toast.success('Synchronisation terminée');
      } else {
        toast.error(`${remaining.length} action(s) en attente`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erreur de synchronisation');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    if (isOnline && !isSyncing) {
      const interval = setInterval(() => {
        syncPendingActions();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isOnline, isSyncing, syncPendingActions]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncPendingActions,
    updatePendingCount
  };
};

