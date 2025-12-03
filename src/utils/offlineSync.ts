// Utilitaire pour la synchronisation offline
import { Api } from '../lib/api';

interface SyncItem {
  entity_type: string;
  action: 'create' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

class OfflineSyncManager {
  private queue: SyncItem[] = [];
  private isSyncing = false;

  constructor() {
    this.loadQueue();
    // Écouter les événements online/offline
    window.addEventListener('online', () => {
      this.sync();
    });
  }

  private loadQueue() {
    const stored = localStorage.getItem('offline_sync_queue');
    if (stored) {
      try {
        this.queue = JSON.parse(stored);
      } catch (e) {
        this.queue = [];
      }
    }
  }

  private saveQueue() {
    localStorage.setItem('offline_sync_queue', JSON.stringify(this.queue));
  }

  addToQueue(entityType: string, action: 'create' | 'update' | 'delete', payload: any) {
    const item: SyncItem = {
      entity_type: entityType,
      action,
      payload,
      timestamp: Date.now()
    };
    this.queue.push(item);
    this.saveQueue();
    // Tenter une synchronisation immédiate si en ligne
    if (navigator.onLine) {
      this.sync();
    }
  }

  async sync() {
    if (this.isSyncing || this.queue.length === 0 || !navigator.onLine) {
      return;
    }
    this.isSyncing = true;
    try {
      const syncItems = this.queue.map((item) => ({
        entity_type: item.entity_type,
        action: item.action,
        payload: item.payload
      }));
      const result = await Api.syncOfflineData({ sync_items: syncItems });
      // Supprimer les éléments synchronisés avec succès
      const syncedCount = result.results.filter((r: any) => r.result?.success).length;
      if (syncedCount > 0) {
        this.queue = this.queue.slice(syncedCount);
        this.saveQueue();
      }
    } catch (error) {
      console.error('Erreur synchronisation:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  getQueueLength() {
    return this.queue.length;
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
  }
}

export const offlineSyncManager = new OfflineSyncManager();

