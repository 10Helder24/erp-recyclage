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
    const response = await fetch(`${API_URL}${path}`, {
      headers: buildHeaders(options),
      ...options
    });

    if (!response.ok) {
      const isJson = response.headers.get('Content-Type')?.includes('application/json');
      const errorMessage = isJson ? JSON.stringify(await response.json()) : await response.text();
      throw new Error(errorMessage || 'Erreur API');
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (error: any) {
    // Relever les erreurs hors ligne déjà gérées plus haut
    throw error;
  }
}

export { API_URL };


