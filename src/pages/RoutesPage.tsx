import { useEffect, useState, useMemo } from 'react';
import { Plus, Route, Calendar, Truck, MapPin, Edit2, Trash2, Loader2, X, CheckCircle, Clock, Shuffle } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  Api,
  type Route as RouteType,
  type Customer,
  type MapVehicle,
  type RouteStop,
  type RouteOptimizationResponse
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';


type RouteForm = {
  date: string;
  vehicle_id: string;
  status: string;
};

type RouteStopForm = {
  customer_id: string;
  order_index: number;
  estimated_time: string;
  notes: string;
};

const DEFAULT_ROUTE_FORM: RouteForm = {
  date: new Date().toISOString().split('T')[0],
  vehicle_id: '',
  status: 'pending'
};

const DEFAULT_STOP_FORM: RouteStopForm = {
  customer_id: '',
  order_index: 0,
  estimated_time: '',
  notes: ''
};

export const RoutesPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager;

  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<MapVehicle[]>([]);
  const [routeStops, setRouteStops] = useState<Map<string, RouteStop[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [routeStartTime, setRouteStartTime] = useState('08:00');
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteType | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null);
  const [routeForm, setRouteForm] = useState<RouteForm>(DEFAULT_ROUTE_FORM);
  const [stopForm, setStopForm] = useState<RouteStopForm>(DEFAULT_STOP_FORM);
  const [editingStop, setEditingStop] = useState<RouteStop | null>(null);
  const [optimizingRouteId, setOptimizingRouteId] = useState<string | null>(null);
  const [optimizationPreview, setOptimizationPreview] = useState<{
    route: RouteType;
    result: RouteOptimizationResponse;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [routesData, customersData, vehiclesData] = await Promise.all([
        Api.fetchRoutes({ date: selectedDate }),
        Api.fetchCustomers(),
        Api.fetchAllVehicles()
      ]);
      setRoutes(routesData);
      setCustomers(customersData);
      setVehicles(vehiclesData);

      // Charger les arrêts pour chaque route
      const stopsMap = new Map<string, RouteStop[]>();
      for (const route of routesData) {
        try {
          const stops = await Api.fetchRouteStopsByRoute(route.id);
          stopsMap.set(route.id, stops);
        } catch (error) {
          console.error(`Erreur chargement arrêts route ${route.id}:`, error);
        }
      }
      setRouteStops(stopsMap);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const openAddRouteModal = () => {
    setEditingRoute(null);
    setRouteForm(DEFAULT_ROUTE_FORM);
    setShowRouteModal(true);
  };

  const openEditRouteModal = (route: RouteType) => {
    setEditingRoute(route);
    setRouteForm({
      date: route.date,
      vehicle_id: route.vehicle_id || '',
      status: route.status || 'pending'
    });
    setShowRouteModal(true);
  };

  const openAddStopModal = (route: RouteType) => {
    setSelectedRoute(route);
    const stops = routeStops.get(route.id) || [];
    setStopForm({
      ...DEFAULT_STOP_FORM,
      order_index: stops.length
    });
    setEditingStop(null);
    setShowStopModal(true);
  };

  const openEditStopModal = (route: RouteType, stop: RouteStop) => {
    setSelectedRoute(route);
    setEditingStop(stop);
    setStopForm({
      customer_id: stop.customer_id || '',
      order_index: stop.order_index,
      estimated_time: stop.estimated_time ? new Date(stop.estimated_time).toISOString().slice(0, 16) : '',
      notes: stop.notes || ''
    });
    setShowStopModal(true);
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.date) {
      toast.error('La date est requise');
      return;
    }

    try {
      if (editingRoute) {
        await Api.updateRoute(editingRoute.id, {
          date: routeForm.date,
          vehicle_id: routeForm.vehicle_id || undefined,
          status: routeForm.status
        });
        toast.success('Route mise à jour avec succès');
      } else {
        await Api.createRoute({
          date: routeForm.date,
          vehicle_id: routeForm.vehicle_id || undefined,
          status: routeForm.status
        });
        toast.success('Route créée avec succès');
      }
      setShowRouteModal(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleStopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) return;
    if (!stopForm.customer_id) {
      toast.error('Le client est requis');
      return;
    }

    try {
      if (editingStop) {
        await Api.updateRouteStop(editingStop.id, {
          customer_id: stopForm.customer_id,
          order_index: stopForm.order_index,
          estimated_time: stopForm.estimated_time || undefined,
          notes: stopForm.notes || undefined
        });
        toast.success('Arrêt mis à jour avec succès');
      } else {
        await Api.createRouteStop({
          route_id: selectedRoute.id,
          customer_id: stopForm.customer_id,
          order_index: stopForm.order_index,
          estimated_time: stopForm.estimated_time || undefined,
          notes: stopForm.notes || undefined
        });
        toast.success('Arrêt créé avec succès');
      }
      setShowStopModal(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette route ? Tous les arrêts seront également supprimés.')) return;
    try {
      await Api.deleteRoute(id);
      toast.success('Route supprimée avec succès');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeleteStop = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet arrêt ?')) return;
    try {
      await Api.deleteRouteStop(id);
      toast.success('Arrêt supprimé avec succès');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCompleteStop = async (stop: RouteStop) => {
    try {
      await Api.updateRouteStop(stop.id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
      toast.success('Arrêt marqué comme terminé');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleOptimizeRoute = async (route: RouteType) => {
    try {
      setOptimizingRouteId(route.id);
      const result = await Api.optimizeRoute(route.id, { startTime: routeStartTime });
      setOptimizationPreview({ route, result });
      toast.success('Suggestion calculée');
    } catch (error) {
      console.error(error);
      toast.error("Impossible d'optimiser la tournée");
    } finally {
      setOptimizingRouteId(null);
    }
  };

  const applyOptimizationSuggestion = async () => {
    if (!optimizationPreview) return;
    try {
      setOptimizingRouteId(optimizationPreview.route.id);
      await Api.optimizeRoute(optimizationPreview.route.id, { startTime: routeStartTime, apply: true });
      toast.success('Ordre appliqué');
      setOptimizationPreview(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Application de l'optimisation impossible");
    } finally {
      setOptimizingRouteId(null);
    }
  };

  const getStatusColor = (status?: string | null) => {
    if (!status) return '#6b7280';
    const s = status.toLowerCase();
    if (s === 'completed') return '#22c55e';
    if (s === 'in_progress') return '#3b82f6';
    if (s === 'pending') return '#f97316';
    return '#6b7280';
  };

  const getStatusLabel = (status?: string | null) => {
    if (!status) return 'Non défini';
    const s = status.toLowerCase();
    if (s === 'completed') return 'Terminée';
    if (s === 'in_progress') return 'En cours';
    if (s === 'pending') return 'En attente';
    return status;
  };

  return (
    <section className="destruction-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Gestion</p>
          <h1 className="page-title">Routes & Tournées</h1>
          <p className="page-subtitle">Gérez vos routes et leurs arrêts clients.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openAddRouteModal}>
            <Plus size={18} />
            Créer une route
          </button>
        )}
      </div>

      <div className="destruction-card">
        <div className="destruction-section">
          <div className="routes-date-picker" style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="destruction-field" style={{ flex: '0 0 200px' }}>
              <label className="destruction-label">Date</label>
              <div className="map-input">
                <Calendar size={16} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
                />
              </div>
            </div>
            <div className="destruction-field" style={{ flex: '0 0 160px' }}>
              <label className="destruction-label">Départ (heure)</label>
              <input
                type="time"
                className="destruction-input"
                value={routeStartTime}
                onChange={(e) => setRouteStartTime(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 className="spinner" size={32} />
              <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Chargement...</p>
            </div>
          ) : routes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>Aucune route trouvée pour cette date</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {routes.map((route) => {
                const stops = routeStops.get(route.id) || [];
                const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);

                return (
                  <div key={route.id} className="employee-card">
                    <div className="employee-card-header">
                      <div style={{ flex: 1 }}>
                        <h3>
                          <Route size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                          Route du {new Date(route.date).toLocaleDateString('fr-FR')}
                        </h3>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                          {route.internal_number && (
                            <span className="tag" style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
                              <Truck size={12} style={{ marginRight: '4px' }} />
                              {route.internal_number}
                            </span>
                          )}
                          {route.plate_number && (
                            <span className="tag" style={{ backgroundColor: '#6b7280', color: '#fff' }}>
                              {route.plate_number}
                            </span>
                          )}
                          <span className="tag" style={{ backgroundColor: getStatusColor(route.status), color: '#fff' }}>
                            {getStatusLabel(route.status)}
                          </span>
                        </div>
                      </div>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => handleOptimizeRoute(route)}
                            disabled={optimizingRouteId === route.id}
                          >
                            {optimizingRouteId === route.id ? (
                              <>
                                <Loader2 className="spinner" size={14} />
                                Calcul...
                              </>
                            ) : (
                              <>
                                <Shuffle size={14} />
                                IA Optimiser
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => openAddStopModal(route)}
                          >
                            <Plus size={14} />
                            Ajouter arrêt
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => openEditRouteModal(route)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => handleDeleteRoute(route.id)}
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {sortedStops.length > 0 ? (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={{ marginBottom: '12px', fontSize: '0.95rem', fontWeight: 600 }}>Arrêts ({sortedStops.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sortedStops.map((stop) => (
                            <div
                              key={stop.id}
                              className="route-stop-item"
                              style={{
                                padding: '12px',
                                border: '1px solid var(--divider)',
                                borderRadius: '8px',
                                backgroundColor: stop.status === 'completed' ? '#f0fdf4' : '#fff'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                      #{stop.order_index + 1}
                                    </span>
                                    <strong>{stop.customer_name || 'Client inconnu'}</strong>
                                    {stop.status === 'completed' && (
                                      <CheckCircle size={16} style={{ color: '#22c55e' }} />
                                    )}
                                  </div>
                                  {stop.customer_address && (
                                    <div className="info-row" style={{ marginTop: '4px' }}>
                                      <MapPin size={14} />
                                      <span style={{ fontSize: '0.9rem' }}>{stop.customer_address}</span>
                                    </div>
                                  )}
                                  {stop.estimated_time && (
                                    <div className="info-row" style={{ marginTop: '4px' }}>
                                      <Clock size={14} />
                                      <span style={{ fontSize: '0.9rem' }}>
                                        {new Date(stop.estimated_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  )}
                                  {stop.notes && (
                                    <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{stop.notes}</p>
                                  )}
                                  {stop.completed_at && (
                                    <p style={{ marginTop: '4px', fontSize: '0.8rem', color: '#22c55e' }}>
                                      Terminé le {new Date(stop.completed_at).toLocaleString('fr-FR')}
                                    </p>
                                  )}
                                </div>
                                {canEdit && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {stop.status !== 'completed' && (
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-small"
                                        onClick={() => handleCompleteStop(stop)}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                      >
                                        Terminer
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-small"
                                      onClick={() => openEditStopModal(route, stop)}
                                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-small"
                                      onClick={() => handleDeleteStop(stop.id)}
                                      style={{ color: '#ef4444', fontSize: '0.75rem', padding: '4px 8px' }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '16px', padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>Aucun arrêt pour cette route</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {optimizationPreview && (
        <div className="modal-backdrop" onClick={() => setOptimizationPreview(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                Suggestion IA · {new Date(optimizationPreview.route.date).toLocaleDateString('fr-FR')}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOptimizationPreview(null)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="team-alerts" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                <div className="team-alert-card">
                  <p className="muted-text">Distance totale estimée</p>
                  <h3>{optimizationPreview.result.totalDistanceKm} km</h3>
                </div>
                <div className="team-alert-card">
                  <p className="muted-text">Durée projetée</p>
                  <h3>{optimizationPreview.result.totalDurationMin} min</h3>
                </div>
              </div>
              {optimizationPreview.result.trafficNotes.length > 0 && (
                <div className="conflict-alert">
                  Zones denses détectées : {optimizationPreview.result.trafficNotes.join(', ')}
                </div>
              )}
              <div className="detail-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Ancien ordre</th>
                      <th>Nouveau</th>
                      <th>Client</th>
                      <th>ETA</th>
                      <th>Trajet</th>
                      <th>Trafic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizationPreview.result.suggestedStops.map((stop) => (
                      <tr key={stop.stop_id}>
                        <td>#{stop.previous_order + 1}</td>
                        <td>
                          #{stop.suggested_order}
                          {stop.previous_order + 1 !== stop.suggested_order && (
                            <span className="tag" style={{ marginLeft: 6, backgroundColor: '#f97316', color: '#fff' }}>
                              déplacé
                            </span>
                          )}
                        </td>
                        <td>{stop.customer_name || 'Client'}</td>
                        <td>{stop.eta ? new Date(stop.eta).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>
                          {stop.distance_km} km · {stop.travel_minutes} min
                        </td>
                        <td>
                          {stop.traffic_label ? (
                            <span className="tag" style={{ backgroundColor: '#0ea5e9', color: '#fff' }}>
                              {stop.traffic_label}
                            </span>
                          ) : (
                            'Fluide'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {optimizationPreview.result.missingStops.length > 0 && (
                <p className="muted-text">
                  {optimizationPreview.result.missingStops.length} arrêt(s) gardé(s) à la fin faute de coordonnées complètes.
                </p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setOptimizationPreview(null)}>
                  Fermer
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={applyOptimizationSuggestion}
                  disabled={optimizingRouteId === optimizationPreview.route.id}
                >
                  {optimizingRouteId === optimizationPreview.route.id ? 'Application...' : 'Appliquer la suggestion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal création/édition route */}
      {showRouteModal && (
        <div className="modal-backdrop" onClick={() => setShowRouteModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingRoute ? 'Modifier la route' : 'Nouvelle route'}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowRouteModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleRouteSubmit} style={{ padding: '24px' }}>
              <div className="destruction-field">
                <label className="destruction-label">Date *</label>
                <input
                  type="date"
                  className="destruction-input"
                  value={routeForm.date}
                  onChange={(e) => setRouteForm((prev) => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Véhicule</label>
                <select
                  className="destruction-input"
                  value={routeForm.vehicle_id}
                  onChange={(e) => setRouteForm((prev) => ({ ...prev, vehicle_id: e.target.value }))}
                >
                  <option value="">Aucun véhicule</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.internal_number || vehicle.plate_number || 'Véhicule'}
                      {vehicle.plate_number && vehicle.internal_number ? ` · ${vehicle.plate_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Statut</label>
                <select
                  className="destruction-input"
                  value={routeForm.status}
                  onChange={(e) => setRouteForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="pending">En attente</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminée</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowRouteModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingRoute ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal création/édition arrêt */}
      {showStopModal && selectedRoute && (
        <div className="modal-backdrop" onClick={() => setShowStopModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingStop ? 'Modifier l\'arrêt' : 'Nouvel arrêt'}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowStopModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleStopSubmit} style={{ padding: '24px' }}>
              <div className="destruction-field">
                <label className="destruction-label">Client *</label>
                <select
                  className="destruction-input"
                  value={stopForm.customer_id}
                  onChange={(e) => setStopForm((prev) => ({ ...prev, customer_id: e.target.value }))}
                  required
                >
                  <option value="">Sélectionner un client</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.address ? ` · ${customer.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Ordre d'arrêt</label>
                <input
                  type="number"
                  min="0"
                  className="destruction-input"
                  value={stopForm.order_index}
                  onChange={(e) => setStopForm((prev) => ({ ...prev, order_index: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Heure estimée</label>
                <input
                  type="datetime-local"
                  className="destruction-input"
                  value={stopForm.estimated_time}
                  onChange={(e) => setStopForm((prev) => ({ ...prev, estimated_time: e.target.value }))}
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Notes</label>
                <textarea
                  className="destruction-input"
                  rows={3}
                  value={stopForm.notes}
                  onChange={(e) => setStopForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes sur cet arrêt"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowStopModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingStop ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default RoutesPage;

