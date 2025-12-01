import { useEffect, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Calendar, Truck, Users, AlertTriangle, Users as UsersIcon, MapPin, Clock, Download, Play, Pause, Plus, FileText, User } from 'lucide-react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

import { Api, type MapUserLocation, type MapVehicle, type MapRoute, type MapUserLocationHistory } from '../lib/api';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';

const DEFAULT_POSITION: [number, number] = [46.548452466797585, 6.572221457669403];

const MapCenterController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

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

// Icône pour les dépôts (warehouse/building)
const depotIcon = L.divIcon({
  className: 'map-marker depot-marker',
  html: `
    <div style="
      width: 32px;
      height: 32px;
      background: #0ea5e9;
      border: 3px solid #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      position: relative;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

export const MapPage = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const isUser = !isAdmin && !isManager;
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [userLocations, setUserLocations] = useState<MapUserLocation[]>([]);
  const [vehicles, setVehicles] = useState<MapVehicle[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ department: string; role: string; manager: string }>({
    department: '',
    role: '',
    manager: ''
  });
  const [filterOptions, setFilterOptions] = useState<{ departments: string[]; roles: string[]; managers: string[] }>({
    departments: [],
    roles: [],
    managers: []
  });
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [centerOverride, setCenterOverride] = useState<[number, number] | null>(null);
  const [highlightedCustomer, setHighlightedCustomer] = useState<{ id?: string; name?: string } | null>(null);
  const [clusterTimestamp, setClusterTimestamp] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; risk_level: string | null }>>([]);
  
  // Mode rejeu
  const [replayMode, setReplayMode] = useState(false);
  const [replayDate, setReplayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [replayTime, setReplayTime] = useState(5); // Heure de début (05h)
  const [replayHistory, setReplayHistory] = useState<MapUserLocationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Modal intervention
  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id?: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [interventionForm, setInterventionForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    notes: ''
  });

  const buildFilterOptions = useCallback((data: MapUserLocation[]) => {
    const departments = Array.from(
      new Set(
        data
          .map((loc) => loc.department)
          .filter((dept): dept is string => typeof dept === 'string' && dept.trim().length > 0)
      )
    ).sort();
    const roles = Array.from(
      new Set(
        data.map((loc) => loc.role).filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
      )
    ).sort();
    const managers = Array.from(
      new Set(
        data
          .map((loc) => loc.manager_name)
          .filter((manager): manager is string => typeof manager === 'string' && manager.trim().length > 0)
      )
    ).sort();
    setFilterOptions({ departments, roles, managers });
  }, []);

  // Pour les users, filtrer pour ne voir que leur propre position
  const filteredUserLocations = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    // Filtrer uniquement les positions du jour présent
    const todayLocations = userLocations.filter((loc) => {
      const updateDate = new Date(loc.last_update);
      if (Number.isNaN(updateDate.getTime())) return false;
      // Vérifier que la mise à jour est aujourd'hui
      return updateDate >= todayStart && updateDate < todayEnd;
    });
    
    if (!isUser || !user?.email) return todayLocations;
    return todayLocations.filter((loc) => loc.employee_email?.toLowerCase() === user.email?.toLowerCase());
  }, [userLocations, isUser, user?.email]);

  const loadLocations = useCallback(
    async (overrideFilters?: { department: string; role: string; manager: string }) => {
      try {
        const payload = overrideFilters ?? filters;
        // Pour les users, ne pas appliquer de filtres (ils verront seulement leur position)
        const data = await Api.fetchUserLocations(
          isUser
            ? {} // Users ne peuvent pas filtrer
            : {
                department: payload.department || undefined,
                role: payload.role || undefined,
                manager: payload.manager || undefined
              }
        );
        setUserLocations(data);
        if (data.length > 0) {
          const latestUpdate = data
            .map((loc) => new Date(loc.last_update).getTime())
            .filter((time) => !Number.isNaN(time))
            .sort((a, b) => b - a)[0];
          setClusterTimestamp(latestUpdate || Date.now());
        } else {
          setClusterTimestamp(null);
        }
        // Ne construire les options de filtre que pour les managers/admins
        if (!isUser && !payload.department && !payload.role && !payload.manager) {
          buildFilterOptions(data);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [filters, buildFilterOptions, isUser]
  );

  const loadVehicles = useCallback(async () => {
    try {
      const data = await Api.fetchVehicles();
      setVehicles(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await Api.fetchCustomers();
      console.log('Clients chargés:', data.length, data.map(c => ({ 
        name: c.name, 
        lat: c.latitude, 
        lng: c.longitude,
        hasCoords: c.latitude != null && c.longitude != null
      })));
      setCustomers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
    }
  }, []);

  const loadRoutes = useCallback(async () => {
    if (!selectedDate) return;
    setLoadingRoutes(true);
    setRoutesError(null);
    try {
      const data = await Api.fetchRouteStops({
        date: selectedDate,
        vehicleId: selectedVehicle || undefined
      });
      setRoutes(data);
    } catch (error) {
      console.error(error);
      setRoutesError("Impossible de charger les tournées");
    } finally {
      setLoadingRoutes(false);
    }
  }, [selectedDate, selectedVehicle]);

  useEffect(() => {
    loadVehicles();
    loadCustomers();
    loadLocations(filters);
    const interval = setInterval(() => loadLocations(filters), 15000);
    return () => clearInterval(interval);
  }, [loadVehicles, loadCustomers, loadLocations, filters]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  // Charger l'historique pour le rejeu
  const loadHistory = useCallback(async () => {
    if (!replayDate || !replayMode) return;
    setLoadingHistory(true);
    try {
      const data = await Api.fetchUserLocationHistory({
        date: replayDate,
        timeFrom: `${String(replayTime).padStart(2, '0')}:00`,
        timeTo: '19:00'
      });
      setReplayHistory(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHistory(false);
    }
  }, [replayDate, replayTime, replayMode]);

  useEffect(() => {
    if (replayMode) {
      loadHistory();
    }
  }, [replayMode, loadHistory]);

  // Filtrer l'historique selon l'heure sélectionnée
  const filteredHistory = useMemo(() => {
    if (!replayMode || replayHistory.length === 0) return [];
    const targetTime = new Date(`${replayDate}T${String(replayTime).padStart(2, '0')}:00:00`);
    // Trouver les positions les plus proches de l'heure cible pour chaque utilisateur
    const userPositions = new Map<string, MapUserLocationHistory>();
    replayHistory.forEach((record) => {
      const recordTime = new Date(record.recorded_at);
      const existing = userPositions.get(record.employee_id);
      if (!existing || Math.abs(recordTime.getTime() - targetTime.getTime()) < Math.abs(new Date(existing.recorded_at).getTime() - targetTime.getTime())) {
        userPositions.set(record.employee_id, record);
      }
    });
    return Array.from(userPositions.values());
  }, [replayHistory, replayDate, replayTime, replayMode]);

  // Auto-play du rejeu
  useEffect(() => {
    if (!isPlaying || !replayMode) return;
    const interval = setInterval(() => {
      setReplayTime((prev) => {
        if (prev >= 19) {
          setIsPlaying(false);
          return 19;
        }
        return prev + 0.5; // Avancer de 30 minutes
      });
    }, 2000); // Changer toutes les 2 secondes
    return () => clearInterval(interval);
  }, [isPlaying, replayMode]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const stops = routes.flatMap((route) =>
      route.stops
        .filter((stop) => stop.status === 'completed' && stop.completed_at)
        .map((stop) => ({
          client: stop.customer_name || 'Inconnu',
          adresse: stop.customer_address || '',
          heure: stop.completed_at ? new Date(stop.completed_at).toLocaleString('fr-FR') : '',
          latitude: stop.latitude,
          longitude: stop.longitude,
          vehicule: route.internal_number || route.plate_number || 'Inconnu'
        }))
    );

    if (stops.length === 0) {
      alert('Aucun arrêt effectué à exporter');
      return;
    }

    const headers = ['Client', 'Adresse', 'Heure', 'Latitude', 'Longitude', 'Véhicule'];
    const csv = [
      headers.join(','),
      ...stops.map((stop) => [
        `"${stop.client}"`,
        `"${stop.adresse}"`,
        `"${stop.heure}"`,
        stop.latitude,
        stop.longitude,
        `"${stop.vehicule}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `arrets_${selectedDate}.csv`;
    link.click();
  }, [routes, selectedDate]);

  // Export PDF
  const handleExportPDF = useCallback(() => {
    const stops = routes.flatMap((route) =>
      route.stops
        .filter((stop) => stop.status === 'completed' && stop.completed_at)
        .map((stop) => ({
          client: stop.customer_name || 'Inconnu',
          adresse: stop.customer_address || '',
          heure: stop.completed_at ? new Date(stop.completed_at).toLocaleString('fr-FR') : '',
          latitude: stop.latitude,
          longitude: stop.longitude,
          vehicule: route.internal_number || route.plate_number || 'Inconnu'
        }))
    );

    if (stops.length === 0) {
      alert('Aucun arrêt effectué à exporter');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Rapport des arrêts effectués', 14, 20);
    doc.setFontSize(10);
    doc.text(`Date : ${selectedDate}`, 14, 30);

    let y = 40;
    doc.setFontSize(9);
    stops.forEach((stop, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${idx + 1}. ${stop.client}`, 14, y);
      y += 6;
      if (stop.adresse) {
        doc.text(`   Adresse : ${stop.adresse}`, 14, y);
        y += 6;
      }
      doc.text(`   Heure : ${stop.heure}`, 14, y);
      y += 6;
      doc.text(`   Coordonnées : ${stop.latitude?.toFixed(6)}, ${stop.longitude?.toFixed(6)}`, 14, y);
      y += 6;
      doc.text(`   Véhicule : ${stop.vehicule}`, 14, y);
      y += 10;
    });

    doc.save(`arrets_${selectedDate}.pdf`);
  }, [routes, selectedDate]);

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

  const mapCenter = useMemo<[number, number]>(() => centerOverride || userPosition || DEFAULT_POSITION, [centerOverride, userPosition]);
  useEffect(() => {
    const raw = localStorage.getItem('erp_map_focus_customer');
    if (!raw) return;
    localStorage.removeItem('erp_map_focus_customer');
    try {
      const data = JSON.parse(raw);
      if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
        setCenterOverride([data.latitude, data.longitude]);
        setHighlightedCustomer({ id: data.id, name: data.name });
        toast.success(`Client ${data.name || ''} centré sur la carte`);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!centerOverride) return;
    const timeout = setTimeout(() => {
      setCenterOverride(null);
      setHighlightedCustomer(null);
    }, 20000);
    return () => clearTimeout(timeout);
  }, [centerOverride]);

  const dismissHighlight = () => {
    setCenterOverride(null);
    setHighlightedCustomer(null);
  };

  const currentUserEmail = user?.email?.toLowerCase() ?? '';
  const routeColors: Record<string, string> = {
    completed: '#22c55e',
    in_progress: '#f97316',
    pending: '#38bdf8'
  };

  const getRouteColor = (status?: string | null) => {
    if (!status) return '#38bdf8';
    const key = status.toLowerCase();
    return routeColors[key] ?? '#38bdf8';
  };

  const pendingStopsCount = useMemo(
    () =>
      routes.reduce((sum, route) => sum + route.stops.filter((stop) => (stop.status ?? 'pending') !== 'completed').length, 0),
    [routes]
  );
  const formatTimeDiff = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    if (diffMs < 0) return 'À l’instant';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'À l’instant';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    return `${days} j`;
  };

  const getStatusClass = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const minutes = diffMs / 60000;
    if (minutes <= 5) return 'status-chip status-chip--online';
    if (minutes <= 20) return 'status-chip status-chip--warning';
    return 'status-chip status-chip--offline';
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters({ department: '', role: '', manager: '' });

  // Dépôt principal (Crissier)
  const depotPrincipal = FIXED_POINTS.find((p) => p.description === 'Dépôt principal')?.position || FIXED_POINTS[0].position;

  // Calculer la distance entre deux points (en mètres)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Détecter les clients sensibles (risk_level = 'high' ou 'sensitive')
  const sensitiveClients = useMemo(() => {
    const sensitive: Array<{ name: string; address: string | null; risk_level: string }> = [];
    routes.forEach((route) => {
      route.stops.forEach((stop) => {
        if (stop.risk_level && (stop.risk_level.toLowerCase() === 'high' || stop.risk_level.toLowerCase() === 'sensitive') && stop.customer_name) {
          sensitive.push({
            name: stop.customer_name,
            address: stop.customer_address,
            risk_level: stop.risk_level
          });
        }
      });
    });
    return sensitive;
  }, [routes]);

  // Détecter la proximité entre collaborateurs (< 100 mètres) - seulement pour managers/admins
  const proximityAlerts = useMemo(() => {
    if (isUser) return []; // Les users ne voient pas les alertes de regroupement
    const alerts: Array<{ user1: string; user2: string; distance: number }> = [];
    const PROXIMITY_THRESHOLD = 100; // mètres
    const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();

    const freshLocations = userLocations.filter((loc) => {
      const updatedAt = new Date(loc.last_update).getTime();
      if (Number.isNaN(updatedAt)) return false;
      return now - updatedAt <= STALE_THRESHOLD_MS;
    });

    for (let i = 0; i < freshLocations.length; i++) {
      for (let j = i + 1; j < freshLocations.length; j++) {
        const loc1 = freshLocations[i];
        const loc2 = freshLocations[j];
        const distance = calculateDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
        if (distance < PROXIMITY_THRESHOLD) {
          alerts.push({
            user1: `${loc1.first_name} ${loc1.last_name}`,
            user2: `${loc2.first_name} ${loc2.last_name}`,
            distance: Math.round(distance)
          });
        }
      }
    }
    return alerts;
  }, [userLocations, isUser]);

  // Détecter les zones vides (aucun agent dans certaines zones importantes) - seulement pour managers/admins
  const emptyZoneAlerts = useMemo(() => {
    if (isUser) return []; // Les users ne voient pas les alertes de zones vides
    const alerts: Array<{ zone: string; description: string }> = [];
    const ZONES_TO_CHECK = [
      { name: 'Genève', position: [46.22068015966211, 6.080341239904371] as [number, number], radius: 5000 }, // 5km
      { name: 'Lausanne', position: [46.519653, 6.632273] as [number, number], radius: 5000 },
      { name: 'Montreux', position: [46.433, 6.916] as [number, number], radius: 3000 }
    ];
    const EMPTY_ZONE_THRESHOLD = 2000; // mètres - considéré vide si aucun agent dans ce rayon

    ZONES_TO_CHECK.forEach((zone) => {
      const hasAgent = userLocations.some((loc) => {
        const distance = calculateDistance(zone.position[0], zone.position[1], loc.latitude, loc.longitude);
        return distance < EMPTY_ZONE_THRESHOLD;
      });
      if (!hasAgent) {
        alerts.push({
          zone: zone.name,
          description: `Aucun agent dans la zone de ${zone.name}`
        });
      }
    });
    return alerts;
  }, [userLocations, isUser]);

  // Construire le chemin complet de chaque route selon l'ordre logique :
  // Dépôt → Client 1 → Client 2 → Client 3 → ...
  const getFullRoutePath = (route: MapRoute): Array<[number, number]> => {
    // Toujours privilégier la construction à partir des stops (clients) triés par order_index
    const stopsWithCoords = route.stops
      .filter((stop) => stop.latitude != null && stop.longitude != null)
      .sort((a, b) => a.order_index - b.order_index)
      .map((stop) => [stop.latitude!, stop.longitude!] as [number, number]);
    
    if (stopsWithCoords.length > 0) {
      // Chemin logique : Dépôt → Client 1 → Client 2 → Client 3 → ...
      // Le premier segment part du dépôt vers le premier client
      // Les segments suivants partent d'un client vers le suivant
      return [depotPrincipal, ...stopsWithCoords];
    }
    
    // Fallback : utiliser le path stocké si aucun stop n'est disponible
    // Mais toujours commencer par le dépôt
    if (!route.path || route.path.length === 0) return [depotPrincipal];
    
    // Vérifier si le premier point du path est déjà proche du dépôt (tolérance ~500m pour Crissier)
    const firstPoint = route.path[0];
    const distanceToDepot = Math.sqrt(
      Math.pow(firstPoint[0] - depotPrincipal[0], 2) + Math.pow(firstPoint[1] - depotPrincipal[1], 2)
    );
    // Si le premier point est proche du dépôt, on le remplace par le dépôt
    const isDepotAlreadyInPath = distanceToDepot < 0.005;
    
    if (isDepotAlreadyInPath) {
      // Le premier point est le dépôt, on le remplace par les coordonnées exactes du dépôt
      return [depotPrincipal, ...route.path.slice(1)];
    }
    
    // Sinon, on ajoute le dépôt au début
    return [depotPrincipal, ...route.path];
  };

  // Afficher les alertes si nécessaire
  const hasAlerts = sensitiveClients.length > 0 || proximityAlerts.length > 0 || emptyZoneAlerts.length > 0;

  // Ouvrir le modal d'intervention
  const handleOpenInterventionModal = useCallback((customer: { id?: string; name: string; address?: string; latitude?: number; longitude?: number }) => {
    setSelectedCustomer(customer);
    setInterventionForm({
      title: `Intervention - ${customer.name}`,
      description: '',
      priority: 'medium',
      notes: ''
    });
    setShowInterventionModal(true);
  }, []);

  // Créer une intervention
  const handleCreateIntervention = useCallback(async () => {
    if (!selectedCustomer || !interventionForm.title.trim()) {
      toast.error('Le titre est requis');
      return;
    }

    try {
      await Api.createIntervention({
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_address: selectedCustomer.address,
        title: interventionForm.title,
        description: interventionForm.description,
        priority: interventionForm.priority,
        latitude: selectedCustomer.latitude || undefined,
        longitude: selectedCustomer.longitude || undefined,
        notes: interventionForm.notes
      });
      toast.success('Intervention créée avec succès');
      setShowInterventionModal(false);
      setSelectedCustomer(null);
      setInterventionForm({ title: '', description: '', priority: 'medium', notes: '' });
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la création de l\'intervention');
    }
  }, [selectedCustomer, interventionForm]);

  return (
    <section className="map-page">
      {/* Alertes en haut de la page */}
      {hasAlerts && (
        <div className="map-alerts-container">
          {sensitiveClients.length > 0 && (
            <div className="map-alert map-alert--risk">
              <AlertTriangle size={18} />
              <div>
                <strong>Clients sensibles ({sensitiveClients.length})</strong>
                <ul>
                  {sensitiveClients.map((client, idx) => (
                    <li key={idx}>
                      {client.name} {client.address ? `· ${client.address}` : ''} ({client.risk_level})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {proximityAlerts.length > 0 && (
            <div className="map-alert map-alert--proximity">
              <UsersIcon size={18} />
              <div>
                <strong>
                  Regroupement détecté ({proximityAlerts.length}) ·{' '}
                  {clusterTimestamp ? format(new Date(clusterTimestamp), 'dd.MM.yyyy HH:mm') : format(new Date(), 'dd.MM.yyyy HH:mm')}
                </strong>
                <ul>
                  {proximityAlerts.map((alert, idx) => (
                    <li key={idx}>
                      {alert.user1} et {alert.user2} à {alert.distance}m l'un de l'autre
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {emptyZoneAlerts.length > 0 && (
            <div className="map-alert map-alert--empty">
              <MapPin size={18} />
              <div>
                <strong>Zones vides ({emptyZoneAlerts.length})</strong>
                <ul>
                  {emptyZoneAlerts.map((alert, idx) => (
                    <li key={idx}>{alert.description}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="page-header">
        <div>
          <p className="eyebrow">Cartographie</p>
          <h1 className="page-title">{replayMode ? 'Rejeu historique' : 'Suivi en temps réel'}</h1>
          <p className="page-subtitle">
            {replayMode ? 'Visualisez les positions historiques des collaborateurs' : 'Visualisez les sites, les clients à desservir et les collaborateurs connectés.'}
          </p>
        </div>
        <div className="map-filters">
          {/* Toggle mode rejeu */}
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={replayMode}
              onChange={(e) => {
                setReplayMode(e.target.checked);
                if (!e.target.checked) {
                  setIsPlaying(false);
                }
              }}
              style={{ width: 'auto' }}
            />
            <span>Mode rejeu</span>
          </label>
          
          {/* Contrôles rejeu */}
          {replayMode && (
            <>
              <label>
                <span>Date historique</span>
                <div className="map-input">
                  <Calendar size={16} />
                  <input type="date" value={replayDate} onChange={(e) => setReplayDate(e.target.value)} />
                </div>
              </label>
              <label style={{ minWidth: '200px' }}>
                <span>Heure : {String(Math.floor(replayTime)).padStart(2, '0')}:{replayTime % 1 === 0 ? '00' : '30'}</span>
                <div className="map-input" style={{ padding: '8px 12px' }}>
                  <Clock size={16} />
                  <input
                    type="range"
                    min="5"
                    max="19"
                    step="0.5"
                    value={replayTime}
                    onChange={(e) => setReplayTime(parseFloat(e.target.value))}
                    style={{ flex: 1, margin: '0 8px' }}
                  />
                </div>
              </label>
              <button
                type="button"
                className={`btn ${isPlaying ? 'btn-outline' : 'btn-primary'}`}
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ alignSelf: 'flex-end' }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </>
          )}
          
          {/* Boutons export - seulement pour managers et admins */}
          {!replayMode && !isUser && (
            <>
              <button type="button" className="btn btn-outline" onClick={handleExportCSV} style={{ alignSelf: 'flex-end' }}>
                <Download size={16} />
                Export CSV
              </button>
              <button type="button" className="btn btn-outline" onClick={handleExportPDF} style={{ alignSelf: 'flex-end' }}>
                <Download size={16} />
                Export PDF
              </button>
            </>
          )}
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
          {/* Filtres avancés - seulement pour managers et admins */}
          {!isUser && (
            <>
              <label>
                <span>Département</span>
                <div className="map-input">
                  <Users size={16} />
                  <select value={filters.department} onChange={(e) => handleFilterChange('department', e.target.value)}>
                    <option value="">Tous</option>
                    {filterOptions.departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label>
                <span>Poste</span>
                <div className="map-input">
                  <Users size={16} />
                  <select value={filters.role} onChange={(e) => handleFilterChange('role', e.target.value)}>
                    <option value="">Tous</option>
                    {filterOptions.roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label>
                <span>Référent</span>
                <div className="map-input">
                  <Users size={16} />
                  <select value={filters.manager} onChange={(e) => handleFilterChange('manager', e.target.value)}>
                    <option value="">Tous</option>
                    {filterOptions.managers.map((manager) => (
                      <option key={manager} value={manager}>
                        {manager}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              {(filters.department || filters.role || filters.manager) ? (
                <button type="button" className="btn btn-outline map-reset" onClick={resetFilters}>
                  Réinitialiser
                </button>
              ) : null}
            </>
          )}
          <button
            type="button"
            className={`btn ${showPendingOnly ? 'btn-primary' : 'btn-outline'} map-pending`}
            onClick={() => setShowPendingOnly((prev) => !prev)}
          >
            {showPendingOnly ? 'Voir tous les clients' : `Clients restants (${pendingStopsCount})`}
          </button>
        </div>
      </div>

      {highlightedCustomer && (
        <div className="conflict-alert" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            Fiche client <strong>{highlightedCustomer.name || 'sélectionnée'}</strong> ouverte depuis le module Clients. Centrage temporaire de la carte.
          </span>
          <button type="button" className="btn btn-outline btn-small" onClick={dismissHighlight}>
            Fermer
          </button>
        </div>
      )}

      <div className="map-card">
        <MapContainer center={mapCenter} zoom={9} className="map-container">
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapCenterController center={mapCenter} />

          {FIXED_POINTS.map((point) => (
            <Marker key={point.id} position={point.position} icon={depotIcon}>
              <Popup>
                <strong>{point.name}</strong>
                <p>{point.description}</p>
              </Popup>
            </Marker>
          ))}

          {/* Afficher tous les clients avec des icônes rouges */}
          {customers
            .filter((customer) => {
              // Filtrer les clients avec des coordonnées valides (non null et non 0,0)
              if (customer.latitude == null || customer.longitude == null) {
                console.log('Client filtré (pas de coords):', customer.name);
                return false;
              }
              if (customer.latitude === 0 && customer.longitude === 0) {
                console.log('Client filtré (0,0):', customer.name);
                return false;
              }
              // Vérifier que les coordonnées sont dans une plage raisonnable (Europe de l'Ouest)
              if (customer.latitude < 40 || customer.latitude > 55) {
                console.log('Client filtré (latitude hors plage):', customer.name, customer.latitude);
                return false;
              }
              if (customer.longitude < -5 || customer.longitude > 15) {
                console.log('Client filtré (longitude hors plage):', customer.name, customer.longitude);
                return false;
              }
              console.log('Client affiché:', customer.name, customer.latitude, customer.longitude);
              return true;
            })
            .map((customer) => (
              <Marker key={customer.id} position={[customer.latitude!, customer.longitude!]} icon={redMarker}>
                <Popup>
                  <strong>{customer.name}</strong>
                  {customer.address && <p>{customer.address}</p>}
                  {customer.risk_level && (
                    <p className="map-note" style={{ color: customer.risk_level.toLowerCase() === 'high' || customer.risk_level.toLowerCase() === 'sensitive' ? '#ef4444' : '#f97316', fontWeight: 'bold' }}>
                      ⚠️ Niveau de risque : {customer.risk_level}
                    </p>
                  )}
                  {!isUser && (
                    <div className="map-popup-actions" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => handleOpenInterventionModal({
                          id: customer.id,
                          name: customer.name,
                          address: customer.address || undefined,
                          latitude: customer.latitude || undefined,
                          longitude: customer.longitude || undefined
                        })}
                        style={{ width: '100%', fontSize: '0.85rem' }}
                      >
                        <Plus size={14} />
                        Créer intervention
                      </button>
                    </div>
                  )}
                </Popup>
              </Marker>
            ))}

          {routes.map((route) => (
            <Polyline key={route.id} positions={getFullRoutePath(route)} pathOptions={{ color: getRouteColor(route.status) }} />
          ))}

          {highlightedCustomer && centerOverride && (
            <Circle
              center={centerOverride}
              radius={180}
              pathOptions={{
                color: '#0ea5e9',
                fillColor: '#38bdf8',
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '6,4'
              }}
            />
          )}

          {routes.map((route) =>
            route.stops
              .filter((stop) => {
                if (!showPendingOnly) return true;
                return (stop.status ?? 'pending').toLowerCase() !== 'completed';
              })
              .map((stop) => {
                if (stop.latitude == null || stop.longitude == null) return null;
                const status = (stop.status ?? 'pending').toLowerCase();
                const icon = status === 'completed' ? blueMarker : redMarker;
                const isSensitive = stop.risk_level && (stop.risk_level.toLowerCase() === 'high' || stop.risk_level.toLowerCase() === 'sensitive');
                return (
                  <div key={stop.id}>
                    {/* Halo rouge pour les clients sensibles */}
                    {isSensitive && (
                      <Circle
                        center={[stop.latitude, stop.longitude]}
                        radius={200}
                        pathOptions={{
                          color: '#ef4444',
                          fillColor: '#ef4444',
                          fillOpacity: 0.2,
                          weight: 2,
                          dashArray: '10, 5'
                        }}
                      />
                    )}
                    <Marker position={[stop.latitude, stop.longitude]} icon={icon}>
                      <Popup>
                        <strong>{stop.customer_name || 'Client'}</strong>
                        {stop.customer_address && <p>{stop.customer_address}</p>}
                        {isSensitive && (
                          <p className="map-note" style={{ color: '#ef4444', fontWeight: 'bold' }}>
                            ⚠️ Client sensible ({stop.risk_level})
                          </p>
                        )}
                        <small>
                          Arrêt n°{stop.order_index + 1} ·{' '}
                          {stop.estimated_time ? new Date(stop.estimated_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Heure inconnue'}
                        </small>
                        <p className="map-note">
                          Statut : {status === 'completed' ? 'Terminé' : 'À faire'}
                          {status !== 'completed' && stop.completed_at ? ` (terminé ${new Date(stop.completed_at).toLocaleTimeString('fr-FR')})` : ''}
                        </p>
                        {stop.notes && <p className="map-note">{stop.notes}</p>}
                        <div className="map-popup-actions" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* Créer intervention - seulement pour managers et admins */}
                          {!isUser && (
                            <button
                              type="button"
                              className="btn btn-primary btn-small"
                              onClick={() => handleOpenInterventionModal({
                                id: stop.customer_id || undefined,
                                name: stop.customer_name || 'Client',
                                address: stop.customer_address || undefined,
                                latitude: stop.latitude || undefined,
                                longitude: stop.longitude || undefined
                              })}
                              style={{ width: '100%', fontSize: '0.85rem' }}
                            >
                              <Plus size={14} />
                              Créer intervention
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => {
                              // Navigation vers la page clients avec recherche du client
                              window.location.hash = '#customers';
                              // TODO: Implémenter la recherche/filtre automatique par nom de client
                            }}
                            style={{ width: '100%', fontSize: '0.85rem' }}
                          >
                            <FileText size={14} />
                            Voir fiche client
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => {
                              // Navigation vers la page de congés
                              window.location.hash = '#calendar';
                            }}
                            style={{ width: '100%', fontSize: '0.85rem' }}
                          >
                            <Calendar size={14} />
                            Voir congés
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                );
              })
          )}

          {/* Afficher uniquement les positions du jour présent */}
          {filteredUserLocations.map((location) => {
            const icon = location.employee_email?.toLowerCase() === currentUserEmail ? currentUserMarker : blueMarker;
            return (
              <Marker key={location.employee_id} position={[location.latitude, location.longitude]} icon={icon}>
                <Popup>
                  <strong>
                    {location.first_name} {location.last_name}
                  </strong>
                  <p>
                    {location.department || 'Département ?'} · {location.role || 'Poste ?'}
                  </p>
                  {location.manager_name && <p className="map-note">Référent : {location.manager_name}</p>}
                  <span className={getStatusClass(location.last_update)}>
                    Mis à jour {formatTimeDiff(location.last_update)}
                  </span>
                  <div className="map-popup-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => {
                        window.location.href = `mailto:${location.employee_email}`;
                      }}
                    >
                      Contacter
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {routesError && <div className="conflict-alert" style={{ marginTop: 16 }}>{routesError}</div>}
      {loadingRoutes && <p className="map-hint">Chargement des tournées...</p>}
      {loadingHistory && replayMode && <p className="map-hint">Chargement de l'historique...</p>}
      {replayMode && filteredHistory.length === 0 && !loadingHistory && (
        <p className="map-hint">Aucune donnée historique disponible pour cette date/heure</p>
      )}

      {/* Modal création intervention */}
      {showInterventionModal && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setShowInterventionModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Créer une intervention</h2>
              <button type="button" className="modal-close" onClick={() => setShowInterventionModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <div className="destruction-field">
                <label className="destruction-label">Client</label>
                <input
                  type="text"
                  className="destruction-input"
                  value={selectedCustomer.name}
                  disabled
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Adresse</label>
                <input
                  type="text"
                  className="destruction-input"
                  value={selectedCustomer.address || ''}
                  disabled
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Titre *</label>
                <input
                  type="text"
                  className="destruction-input"
                  value={interventionForm.title}
                  onChange={(e) => setInterventionForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Titre de l'intervention"
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Description</label>
                <textarea
                  className="destruction-input"
                  rows={4}
                  value={interventionForm.description}
                  onChange={(e) => setInterventionForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Description détaillée de l'intervention"
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Priorité</label>
                <select
                  className="destruction-input"
                  value={interventionForm.priority}
                  onChange={(e) => setInterventionForm((prev) => ({ ...prev, priority: e.target.value as any }))}
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Notes</label>
                <textarea
                  className="destruction-input"
                  rows={3}
                  value={interventionForm.notes}
                  onChange={(e) => setInterventionForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes supplémentaires"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowInterventionModal(false)}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCreateIntervention}>
                Créer l'intervention
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default MapPage;

