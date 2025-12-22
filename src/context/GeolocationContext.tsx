import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Api } from '../lib/api';

interface GeolocationContextType {
  startGeolocation: () => void;
  stopGeolocation: () => void;
}

const GeolocationContext = createContext<GeolocationContextType | null>(null);

export const useGeolocation = () => {
  const context = useContext(GeolocationContext);
  if (!context) {
    throw new Error('useGeolocation must be used within GeolocationProvider');
  }
  return context;
};

export const GeolocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);

  const updateLocation = useCallback((latitude: number, longitude: number) => {
    Api.updateCurrentLocation({ latitude, longitude })
      .then(() => {
        // Position mise à jour avec succès
      })
      .catch((error) => {
        if (error instanceof Error) {
          try {
            const parsed = JSON.parse(error.message);
            if (parsed?.message?.toLowerCase().includes('employé introuvable')) {
              console.info('[Geolocation] Géolocalisation ignorée : aucun employé associé');
              return;
            }
          } catch {
            // ignore JSON parse errors
          }
          if (error.message.toLowerCase().includes('employé introuvable')) {
            console.info('[Geolocation] Géolocalisation ignorée : aucun employé associé');
            return;
          }
        }
        console.error('[Geolocation] Erreur mise à jour localisation:', error);
      });
  }, []);

  const handleGeolocationSuccess = useCallback((position: GeolocationPosition) => {
    const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
    updateLocation(coords[0], coords[1]);
  }, [updateLocation]);

  const fallbackToIpLocation = useCallback(async () => {
    try {
      const ipLocation = await Api.fetchLocationByIp();
      if (ipLocation.latitude && ipLocation.longitude) {
        console.info('[Geolocation] Utilisation de la localisation IP (GPS non disponible)');
        updateLocation(ipLocation.latitude, ipLocation.longitude);
      }
    } catch (error) {
      console.warn('[Geolocation] Erreur localisation IP:', error);
    }
  }, [updateLocation]);

  const startGeolocation = useCallback(() => {
    // Arrêter le watch existant si présent
    if (geoWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // GPS non disponible, utiliser directement IP
      console.info('[Geolocation] GPS non disponible, utilisation de la localisation IP');
      fallbackToIpLocation();
      return;
    }

    // Essayer GPS d'abord
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleGeolocationSuccess(pos);
        // Démarrer le suivi continu
        const id = navigator.geolocation.watchPosition(
          handleGeolocationSuccess,
          (err) => {
            console.warn('[Geolocation] Erreur GPS, utilisation de la localisation IP:', err);
            fallbackToIpLocation();
          },
          { enableHighAccuracy: true }
        );
        setGeoWatchId(id);
      },
      (err) => {
        console.warn('[Geolocation] Permission GPS refusée ou indisponible, utilisation de la localisation IP:', err);
        fallbackToIpLocation();
      },
      { enableHighAccuracy: true }
    );
  }, [handleGeolocationSuccess, fallbackToIpLocation, geoWatchId]);

  const stopGeolocation = useCallback(() => {
    if (geoWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }
  }, [geoWatchId]);

  // Nettoyer le watch au démontage
  useEffect(() => {
    return () => {
      if (geoWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
    };
  }, [geoWatchId]);

  return (
    <GeolocationContext.Provider value={{ startGeolocation, stopGeolocation }}>
      {children}
    </GeolocationContext.Provider>
  );
};

