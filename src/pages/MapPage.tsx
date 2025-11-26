import { useEffect, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Calendar, Truck } from 'lucide-react';

import { Api, type MapUserLocation, type MapVehicle, type MapRouteStop } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const DEFAULT_POSITION: [number, number] = [46.548452466797585, 6.572221457669403];

const FIXED_POINTS: Array<{ id: number; position: [number, number]; name: string; description: string }> = [
  { id: 1, position: [46.548452466797585, 6.572221457669403], name: 'Crissier', description: 'Dépôt principal' },
  { id: 2, position: [46.22068015966211, 6.080341239904371], name: 'Genève', description: 'Centre de tri Retripa' },
  { id: 3, position: [46.26667201049415, 6.973837869040357], name: 'Massongex', description: 'Retripa Valais' },
  { id: 4, position: [46.234384268717385, 7.282828327931758], name: 'Vétroz', description: 'Retripa Valais Vétroz' },
  { id: 5, position: [46.296094268800076, 6.946372050472233], name: 'Chablais', description: 'Retripa Chablais SA' },
  { id: 6, position: [46.133600477702174, 7.086447725169667], name: 'Martigny', description: 'Centre de tri Martigny' },
  { id: 7, position: [47.10832025999326, 6.834793470119427], name: 'Neuchâtel', description: 'Retripa Vadtri' },
  { id: 8, position: [46.472647832598774, 6.377009906234024], name: 'Féchy', description: 'Henny transport' },
  { id: 9, position: [46.175661850733334, 7.1770121046357325], name: 'Saillon', description: 'Plateforme Valais' }
];

// Fix leaflet default icons (vite)
const iconRetinaUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString();
const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString();
const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString();
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl
});

const redMarker = L.divIcon({
  className: 'map-marker client-marker',
  html: "<div class='map-marker__dot map-marker__dot--red'></div>",
  iconSize: [24, 24],
  iconAnchor: [12, 24]
});

const blueMarker = L.divIcon({
  className: 'map-marker user-marker',
  html: "<div class='map-marker__dot map-marker__dot--blue'></div>",
  iconSize: [24, 24],
  iconAnchor: [12, 24]
});

const currentUserMarker = L.divIcon({
  className: 'map-marker me-marker',
  html: "<div class='map-marker__dot map-marker__dot--me'></div>",
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

export const MapPage = () => {
  const { user } = useAuth();
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [userLocations, setUserLocations] = useState<MapUserLocation[]>([]);
  const [vehicles, setVehicles] = useState<MapVehicle[]>([]);
  const [routeStops, setRouteStops] = useState<MapRouteStop[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    try {
      const data = await Api.fetchUserLocations();
      setUserLocations(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      const data = await Api.fetchVehicles();
      setVehicles(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadRouteStops = useCallback(async () => {
    if (!selectedDate) return;
    setLoadingRoutes(true);
    setRoutesError(null);
    try {
      const data = await Api.fetchRouteStops({
        date: selectedDate,
        vehicleId: selectedVehicle || undefined
      });
      setRouteStops(data);
    } catch (error) {
      console.error(error);
      setRoutesError("Impossible de charger les tournées");
    } finally {
      setLoadingRoutes(false);
    }
  }, [selectedDate, selectedVehicle]);

  useEffect(() => {
    loadVehicles();
    loadLocations();
    const interval = setInterval(loadLocations, 15000);
    return () => clearInterval(interval);
  }, [loadVehicles, loadLocations]);

  useEffect(() => {
    loadRouteStops();
  }, [loadRouteStops]);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Géolocalisation non supportée par ce navigateur');
      return;
    }
    const success = (pos: GeolocationPosition) => {
      const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setUserPosition(coords);
      Api.updateCurrentLocation({
        latitude: coords[0],
        longitude: coords[1]
      }).catch((error) => console.error(error));
    };
    const error = (err: GeolocationPositionError) => {
      console.warn('Erreur géolocalisation', err);
    };
    navigator.geolocation.getCurrentPosition(success, error, { enableHighAccuracy: true });
    const watchId = navigator.geolocation.watchPosition(success, error, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const mapCenter = useMemo<[number, number]>(() => userPosition || DEFAULT_POSITION, [userPosition]);

  const currentUserEmail = user?.email?.toLowerCase() ?? '';

  return (
    <section className="map-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Cartographie</p>
          <h1 className="page-title">Suivi en temps réel</h1>
          <p className="page-subtitle">Visualisez les sites, les clients à desservir et les collaborateurs connectés.</p>
        </div>
        <div className="map-filters">
          <label>
            <span>Date</span>
            <div className="map-input">
              <Calendar size={16} />
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
          </label>
          <label>
            <span>Véhicule</span>
            <div className="map-input">
              <Truck size={16} />
              <select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)}>
                <option value="">Tous les véhicules</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.internal_number || vehicle.plate_number || 'Véhicule'} {vehicle.plate_number ? `· ${vehicle.plate_number}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>
      </div>

      <div className="map-card">
        <MapContainer center={mapCenter} zoom={9} className="map-container">
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {FIXED_POINTS.map((point) => (
            <Marker key={point.id} position={point.position}>
              <Popup>
                <strong>{point.name}</strong>
                <p>{point.description}</p>
              </Popup>
            </Marker>
          ))}

          {routeStops.map((stop) => {
            if (stop.latitude == null || stop.longitude == null) return null;
            return (
              <Marker key={stop.id} position={[stop.latitude, stop.longitude]} icon={redMarker}>
                <Popup>
                  <strong>{stop.customer_name || 'Client'}</strong>
                  {stop.customer_address && <p>{stop.customer_address}</p>}
                  <small>
                    Arrêt n°{stop.order_index + 1} · {stop.estimated_time ? new Date(stop.estimated_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Heure inconnue'}
                  </small>
                  {stop.notes && <p className="map-note">{stop.notes}</p>}
                </Popup>
              </Marker>
            );
          })}

          {userLocations.map((location) => {
            const icon = location.employee_email?.toLowerCase() === currentUserEmail ? currentUserMarker : blueMarker;
            return (
              <Marker key={location.employee_id} position={[location.latitude, location.longitude]} icon={icon}>
                <Popup>
                  <strong>
                    {location.first_name} {location.last_name}
                  </strong>
                  {location.department && <p>{location.department}</p>}
                  <small>Dernière mise à jour : {new Date(location.last_update).toLocaleTimeString('fr-FR')}</small>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {routesError && <div className="conflict-alert" style={{ marginTop: 16 }}>{routesError}</div>}
      {loadingRoutes && <p className="map-hint">Chargement des tournées...</p>}
    </section>
  );
};

export default MapPage;

