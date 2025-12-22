const API_URL = import.meta.env.VITE_API_URL ?? '/api';
let authToken: string | null = null;

const buildHeaders = (options: RequestInit) => {
  const existingHeaders = (options.headers as Record<string, string>) || {};
  const baseHeaders: Record<string, string> = { ...existingHeaders };
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !baseHeaders['Content-Type']) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  if (authToken) {
    baseHeaders.Authorization = `Bearer ${authToken}`;
  }
  return baseHeaders;
};

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isOffline = !navigator.onLine;
  const method = options.method || 'GET';
  const isMutation = method !== 'GET' && method !== 'HEAD';

  if (isOffline && isMutation) {
    const { offlineStorage } = await import('../../utils/offlineStorage');
    await offlineStorage.init();
    let payload: any = undefined;
    if (options.body) {
      if (typeof options.body === 'string') {
        try {
          payload = JSON.parse(options.body);
        } catch {
          payload = options.body;
        }
      } else {
        payload = options.body;
      }
    }
    const actionId = await offlineStorage.savePendingAction({
      type: 'api_request',
      endpoint: `${API_URL}${path}`,
      method,
      payload
    });
    throw new Error(`OFFLINE_QUEUED:${actionId}`);
  }

  try {
    const url = `${API_URL}${path}`;
    const response = await fetch(url, {
      headers: buildHeaders(options),
      ...options
    });

    if (!response.ok) {
      const isJson = response.headers.get('Content-Type')?.includes('application/json');
      let errorMessage = 'Erreur API';
      try {
        if (isJson) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || JSON.stringify(errorData);
        } else {
          const text = await response.text();
          // Si la réponse est du HTML (probablement une page d'erreur), c'est probablement une erreur de connexion
          if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('ECONNREFUSED')) {
            errorMessage = `Le serveur backend n'est pas démarré ou inaccessible (HTTP ${response.status})`;
          } else {
            errorMessage = text || `Erreur HTTP ${response.status}`;
          }
        }
      } catch (parseError) {
        // Si on ne peut pas parser la réponse, c'est probablement une erreur de connexion
        if (response.status === 500) {
          errorMessage = `Le serveur backend rencontre une erreur (HTTP 500). Vérifiez que le serveur est démarré correctement.`;
        } else {
          errorMessage = `Erreur HTTP ${response.status}: ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (error: any) {
    // Si c'est une erreur réseau (connexion refusée, timeout, etc.)
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      // Pendant le démarrage, le serveur peut ne pas être encore prêt - c'est normal
      const isStartup = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isStartup) {
        // Ne pas afficher d'erreur pendant le démarrage, le serveur va démarrer
        throw new Error(`Connexion en cours... (serveur backend en démarrage)`);
      }
      throw new Error(`Impossible de se connecter au serveur. Vérifiez que le serveur backend est démarré (${API_URL})`);
    }
    // Si c'est une erreur de connexion refusée (ECONNREFUSED)
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('NetworkError')) {
      // Pendant le démarrage, le serveur peut ne pas être encore prêt - c'est normal
      const isStartup = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isStartup) {
        // Ne pas afficher d'erreur pendant le démarrage, le serveur va démarrer
        throw new Error(`Connexion en cours... (serveur backend en démarrage)`);
      }
      throw new Error(`Le serveur backend n'est pas démarré. Vérifiez que le serveur est en cours d'exécution sur ${API_URL}`);
    }
    // Relever les erreurs hors ligne déjà gérées plus haut
    throw error;
  }
}

export { API_URL };


