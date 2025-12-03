import { useState, useEffect, useMemo } from 'react';
import { Api, Customer, Vehicle, OptimizedRoute, RouteScenario, DemandForecast, RealTimeTracking, RoutingConstraint } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import {
  Route,
  Package,
  TrendingUp,
  PlayCircle,
  MapPin,
  Settings,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Navigation,
  Loader
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabType = 'optimization' | 'loading' | 'forecast' | 'scenarios' | 'tracking' | 'constraints';

export const LogisticsOptimizationPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('optimization');
  const [loading, setLoading] = useState(false);

  // Optimization state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [optimizationAlgorithm, setOptimizationAlgorithm] = useState<string>('nearest_neighbor');
  const [optimizedResult, setOptimizedResult] = useState<any>(null);

  // Loading optimization state
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [loadStops, setLoadStops] = useState<Array<{ customer_id: string; weight_kg: number; volume_m3: number }>>([]);
  const [loadResult, setLoadResult] = useState<any>(null);

  // Forecast state
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [forecastForm, setForecastForm] = useState({
    forecast_date: '',
    zone_name: '',
    material_type: '',
    forecasted_volume: '',
    confidence_level: '75'
  });

  // Scenarios state
  const [scenarios, setScenarios] = useState<RouteScenario[]>([]);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [scenarioForm, setScenarioForm] = useState({
    scenario_name: '',
    scenario_description: '',
    scenario_type: 'what_if' as 'what_if' | 'comparison' | 'optimization_test' | 'constraint_test',
    scenario_config: {}
  });

  // Tracking state
  const [tracking, setTracking] = useState<RealTimeTracking[]>([]);

  // Constraints state
  const [constraints, setConstraints] = useState<RoutingConstraint[]>([]);
  const [showConstraintModal, setShowConstraintModal] = useState(false);
  const [constraintForm, setConstraintForm] = useState({
    constraint_type: 'customer_hours' as 'customer_hours' | 'max_weight' | 'max_volume' | 'restricted_zone' | 'vehicle_compatibility' | 'driver_hours' | 'custom',
    constraint_name: '',
    constraint_description: '',
    constraint_config: {}
  });

  useEffect(() => {
    loadCustomers();
    loadVehicles();
    loadForecasts();
    loadScenarios();
    loadTracking();
    loadConstraints();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await Api.fetchCustomers();
      setCustomers(data.filter(c => c.latitude && c.longitude));
    } catch (error: any) {
      console.error('Erreur chargement clients:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      const data = await Api.fetchAllVehicles();
      setVehicles(data as Vehicle[]);
    } catch (error: any) {
      console.error('Erreur chargement véhicules:', error);
    }
  };

  const loadForecasts = async () => {
    try {
      const data = await Api.fetchDemandForecasts();
      setForecasts(data);
    } catch (error: any) {
      console.error('Erreur chargement prévisions:', error);
    }
  };

  const loadScenarios = async () => {
    try {
      const data = await Api.fetchScenarios();
      setScenarios(data);
    } catch (error: any) {
      console.error('Erreur chargement scénarios:', error);
    }
  };

  const loadTracking = async () => {
    try {
      const data = await Api.fetchRealTimeTracking();
      setTracking(data);
    } catch (error: any) {
      console.error('Erreur chargement suivi:', error);
    }
  };

  const loadConstraints = async () => {
    try {
      const data = await Api.fetchRoutingConstraints();
      setConstraints(data);
    } catch (error: any) {
      console.error('Erreur chargement contraintes:', error);
    }
  };

  const handleOptimizeRoute = async () => {
    if (selectedCustomers.length === 0) {
      toast.error('Sélectionnez au moins un client');
      return;
    }

    setLoading(true);
    try {
      const result = await Api.optimizeRoute({
        customer_ids: selectedCustomers,
        vehicle_id: selectedVehicle || undefined,
        algorithm: optimizationAlgorithm
      });
      setOptimizedResult(result);
      toast.success('Tournée optimisée avec succès');
    } catch (error: any) {
      console.error('Erreur optimisation:', error);
      toast.error(error.message || 'Erreur lors de l\'optimisation');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeLoad = async () => {
    if (!selectedVehicle || loadStops.length === 0) {
      toast.error('Sélectionnez un véhicule et ajoutez des arrêts');
      return;
    }

    setLoading(true);
    try {
      const result = await Api.optimizeLoad({
        route_id: selectedRoute || undefined,
        vehicle_id: selectedVehicle,
        stops_data: loadStops
      });
      setLoadResult(result);
      toast.success('Chargement optimisé');
    } catch (error: any) {
      console.error('Erreur optimisation chargement:', error);
      toast.error(error.message || 'Erreur lors de l\'optimisation du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateForecast = async () => {
    if (!forecastForm.forecast_date || !forecastForm.zone_name || !forecastForm.forecasted_volume) {
      toast.error('Remplissez tous les champs requis');
      return;
    }

    setLoading(true);
    try {
      await Api.createDemandForecast({
        forecast_date: forecastForm.forecast_date,
        zone_name: forecastForm.zone_name,
        material_type: forecastForm.material_type || undefined,
        forecasted_volume: parseFloat(forecastForm.forecasted_volume),
        confidence_level: parseInt(forecastForm.confidence_level),
        forecast_method: 'manual'
      });
      toast.success('Prévision créée');
      setShowForecastModal(false);
      setForecastForm({
        forecast_date: '',
        zone_name: '',
        material_type: '',
        forecasted_volume: '',
        confidence_level: '75'
      });
      loadForecasts();
    } catch (error: any) {
      console.error('Erreur création prévision:', error);
      toast.error(error.message || 'Erreur lors de la création de la prévision');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScenario = async () => {
    if (!scenarioForm.scenario_name) {
      toast.error('Nom du scénario requis');
      return;
    }

    setLoading(true);
    try {
      await Api.simulateScenario(scenarioForm);
      toast.success('Scénario créé');
      setShowScenarioModal(false);
      setScenarioForm({
        scenario_name: '',
        scenario_description: '',
        scenario_type: 'what_if',
        scenario_config: {}
      });
      loadScenarios();
    } catch (error: any) {
      console.error('Erreur création scénario:', error);
      toast.error(error.message || 'Erreur lors de la création du scénario');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConstraint = async () => {
    if (!constraintForm.constraint_name) {
      toast.error('Nom de la contrainte requis');
      return;
    }

    setLoading(true);
    try {
      await Api.createRoutingConstraint(constraintForm);
      toast.success('Contrainte créée');
      setShowConstraintModal(false);
      setConstraintForm({
        constraint_type: 'customer_hours',
        constraint_name: '',
        constraint_description: '',
        constraint_config: {}
      });
      loadConstraints();
    } catch (error: any) {
      console.error('Erreur création contrainte:', error);
      toast.error(error.message || 'Erreur lors de la création de la contrainte');
    } finally {
      setLoading(false);
    }
  };

  const addLoadStop = () => {
    setLoadStops([...loadStops, { customer_id: '', weight_kg: 0, volume_m3: 0 }]);
  };

  const removeLoadStop = (index: number) => {
    setLoadStops(loadStops.filter((_, i) => i !== index));
  };

  return (
    <div className="logistics-optimization-page">
      <div className="page-header">
        <div>
          <h1>Optimisation Logistique Avancée</h1>
          <p>Optimisez vos tournées, chargez vos véhicules efficacement et prévoyez la demande</p>
        </div>
      </div>

      <div className="logistics-tabs">
        <button
          className={activeTab === 'optimization' ? 'active' : ''}
          onClick={() => setActiveTab('optimization')}
        >
          <Route size={18} />
          Optimisation Tournées
        </button>
        <button
          className={activeTab === 'loading' ? 'active' : ''}
          onClick={() => setActiveTab('loading')}
        >
          <Package size={18} />
          Chargement Optimal
        </button>
        <button
          className={activeTab === 'forecast' ? 'active' : ''}
          onClick={() => setActiveTab('forecast')}
        >
          <TrendingUp size={18} />
          Prévisions Demande
        </button>
        <button
          className={activeTab === 'scenarios' ? 'active' : ''}
          onClick={() => setActiveTab('scenarios')}
        >
          <PlayCircle size={18} />
          Simulation Scénarios
        </button>
        <button
          className={activeTab === 'tracking' ? 'active' : ''}
          onClick={() => setActiveTab('tracking')}
        >
          <MapPin size={18} />
          Suivi Temps Réel
        </button>
        <button
          className={activeTab === 'constraints' ? 'active' : ''}
          onClick={() => setActiveTab('constraints')}
        >
          <Settings size={18} />
          Contraintes
        </button>
      </div>

      <div className="logistics-content">
        {/* Optimization Tab */}
        {activeTab === 'optimization' && (
          <div className="optimization-section">
            <div className="section-header">
              <h2>Optimisation de Tournée</h2>
              <p>Sélectionnez les clients et optimisez l'ordre de visite</p>
            </div>

            <div className="optimization-form">
              <div className="form-group">
                <label>Clients à visiter</label>
                <div className="customer-selector">
                  {customers.map(customer => (
                    <label key={customer.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedCustomers.includes(customer.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCustomers([...selectedCustomers, customer.id]);
                          } else {
                            setSelectedCustomers(selectedCustomers.filter(id => id !== customer.id));
                          }
                        }}
                      />
                      <span>{customer.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Véhicule (optionnel)</label>
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                >
                  <option value="">Aucun véhicule spécifique</option>
                  {vehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.internal_number || vehicle.plate_number || vehicle.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Algorithme d'optimisation</label>
                <select
                  value={optimizationAlgorithm}
                  onChange={(e) => setOptimizationAlgorithm(e.target.value)}
                >
                  <option value="nearest_neighbor">Plus proche voisin</option>
                  <option value="genetic">Génétique</option>
                  <option value="simulated_annealing">Recuit simulé</option>
                </select>
              </div>

              <button
                className="btn-primary"
                onClick={handleOptimizeRoute}
                disabled={loading || selectedCustomers.length === 0}
              >
                {loading ? <Loader className="spinning" size={18} /> : <RefreshCw size={18} />}
                Optimiser la Tournée
              </button>

              {optimizedResult && (
                <div className="optimization-result">
                  <h3>Résultats de l'optimisation</h3>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <span className="metric-label">Distance totale</span>
                      <span className="metric-value">{optimizedResult.metrics.total_distance_km.toFixed(2)} km</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Durée totale</span>
                      <span className="metric-value">{Math.round(optimizedResult.metrics.total_duration_minutes / 60)}h {optimizedResult.metrics.total_duration_minutes % 60}min</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Arrêts</span>
                      <span className="metric-value">{optimizedResult.metrics.stops_count}</span>
                    </div>
                    {optimizedResult.metrics.vehicle_utilization_rate !== null && (
                      <div className="metric-card">
                        <span className="metric-label">Utilisation véhicule</span>
                        <span className="metric-value">{optimizedResult.metrics.vehicle_utilization_rate.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>

                  <div className="optimized-order">
                    <h4>Ordre optimisé</h4>
                    <ol>
                      {optimizedResult.optimized_order.map((customer: any, index: number) => (
                        <li key={customer.id}>
                          {index + 1}. {customer.name}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading Optimization Tab */}
        {activeTab === 'loading' && (
          <div className="loading-section">
            <div className="section-header">
              <h2>Optimisation du Chargement</h2>
              <p>Vérifiez la capacité et l'utilisation optimale de vos véhicules</p>
            </div>

            <div className="loading-form">
              <div className="form-group">
                <label>Véhicule</label>
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                >
                  <option value="">Sélectionner un véhicule</option>
                  {vehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.internal_number || vehicle.plate_number || vehicle.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Arrêts avec chargement</label>
                <button className="btn-secondary" onClick={addLoadStop}>
                  Ajouter un arrêt
                </button>
                {loadStops.map((stop, index) => (
                  <div key={index} className="load-stop-row">
                    <select
                      value={stop.customer_id}
                      onChange={(e) => {
                        const updated = [...loadStops];
                        updated[index].customer_id = e.target.value;
                        setLoadStops(updated);
                      }}
                    >
                      <option value="">Sélectionner un client</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Poids (kg)"
                      value={stop.weight_kg || ''}
                      onChange={(e) => {
                        const updated = [...loadStops];
                        updated[index].weight_kg = parseFloat(e.target.value) || 0;
                        setLoadStops(updated);
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Volume (m³)"
                      value={stop.volume_m3 || ''}
                      onChange={(e) => {
                        const updated = [...loadStops];
                        updated[index].volume_m3 = parseFloat(e.target.value) || 0;
                        setLoadStops(updated);
                      }}
                    />
                    <button
                      className="btn-icon-danger"
                      onClick={() => removeLoadStop(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="btn-primary"
                onClick={handleOptimizeLoad}
                disabled={loading || !selectedVehicle || loadStops.length === 0}
              >
                {loading ? <Loader className="spinning" size={18} /> : <Package size={18} />}
                Optimiser le Chargement
              </button>

              {loadResult && (
                <div className="load-result">
                  <h3>Résultats de l'optimisation</h3>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <span className="metric-label">Poids total</span>
                      <span className="metric-value">{loadResult.metrics.total_weight_kg.toFixed(2)} kg</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Volume total</span>
                      <span className="metric-value">{loadResult.metrics.total_volume_m3.toFixed(2)} m³</span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Utilisation poids</span>
                      <span className={`metric-value ${loadResult.metrics.weight_utilization_rate > 100 ? 'error' : ''}`}>
                        {loadResult.metrics.weight_utilization_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="metric-card">
                      <span className="metric-label">Utilisation volume</span>
                      <span className={`metric-value ${loadResult.metrics.volume_utilization_rate > 100 ? 'error' : ''}`}>
                        {loadResult.metrics.volume_utilization_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {loadResult.metrics.recommendations.length > 0 && (
                    <div className="recommendations">
                      <h4>Recommandations</h4>
                      <ul>
                        {loadResult.metrics.recommendations.map((rec: string, index: number) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Forecast Tab */}
        {activeTab === 'forecast' && (
          <div className="forecast-section">
            <div className="section-header">
              <h2>Prévisions de Demande</h2>
              <p>Prévoyez la demande par zone géographique</p>
              <button className="btn-primary" onClick={() => setShowForecastModal(true)}>
                Nouvelle Prévision
              </button>
            </div>

            <div className="forecasts-list">
              {forecasts.length === 0 ? (
                <div className="empty-state">
                  <TrendingUp size={48} />
                  <p>Aucune prévision disponible</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Zone</th>
                      <th>Type matière</th>
                      <th>Volume prévu</th>
                      <th>Confiance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecasts.map(forecast => (
                      <tr key={forecast.id}>
                        <td>{format(new Date(forecast.forecast_date), 'dd/MM/yyyy', { locale: fr })}</td>
                        <td>{forecast.zone_name}</td>
                        <td>{forecast.material_type || 'Tous'}</td>
                        <td>{forecast.forecasted_volume.toLocaleString()}</td>
                        <td>{forecast.confidence_level || 75}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Scenarios Tab */}
        {activeTab === 'scenarios' && (
          <div className="scenarios-section">
            <div className="section-header">
              <h2>Simulation de Scénarios</h2>
              <p>Testez différents scénarios "Et si..."</p>
              <button className="btn-primary" onClick={() => setShowScenarioModal(true)}>
                Nouveau Scénario
              </button>
            </div>

            <div className="scenarios-list">
              {scenarios.length === 0 ? (
                <div className="empty-state">
                  <PlayCircle size={48} />
                  <p>Aucun scénario disponible</p>
                </div>
              ) : (
                <div className="scenarios-grid">
                  {scenarios.map(scenario => (
                    <div key={scenario.id} className="scenario-card">
                      <h3>{scenario.scenario_name}</h3>
                      <p className="scenario-type">{scenario.scenario_type}</p>
                      {scenario.scenario_description && <p>{scenario.scenario_description}</p>}
                      <div className="scenario-metrics">
                        {scenario.simulated_metrics && Object.entries(scenario.simulated_metrics).map(([key, value]: [string, any]) => (
                          <div key={key} className="metric">
                            <span className="metric-label">{key}</span>
                            <span className="metric-value">{typeof value === 'number' ? value.toFixed(2) : String(value)}</span>
                          </div>
                        ))}
                      </div>
                      {scenario.is_applied && (
                        <span className="badge badge-success">Appliqué</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tracking Tab */}
        {activeTab === 'tracking' && (
          <div className="tracking-section">
            <div className="section-header">
              <h2>Suivi en Temps Réel</h2>
              <p>Suivez vos véhicules en temps réel avec ETA</p>
              <button className="btn-secondary" onClick={loadTracking}>
                <RefreshCw size={18} />
                Actualiser
              </button>
            </div>

            <div className="tracking-list">
              {tracking.length === 0 ? (
                <div className="empty-state">
                  <MapPin size={48} />
                  <p>Aucun véhicule en suivi actif</p>
                </div>
              ) : (
                <div className="tracking-grid">
                  {tracking.map(track => (
                    <div key={track.id} className="tracking-card">
                      <div className="tracking-header">
                        <h3>{track.vehicle_number || 'Véhicule inconnu'}</h3>
                        <span className={`status-badge ${track.tracking_status === 'active' ? 'status-green' : ''}`}>
                          {track.tracking_status}
                        </span>
                      </div>
                      {track.customer_name && (
                        <p className="tracking-destination">
                          <Navigation size={16} />
                          Destination: {track.customer_name}
                        </p>
                      )}
                      {track.estimated_arrival_time && (
                        <p className="tracking-eta">
                          <Clock size={16} />
                          ETA: {format(new Date(track.estimated_arrival_time), 'HH:mm', { locale: fr })}
                        </p>
                      )}
                      {track.distance_to_destination_km !== null && (
                        <p className="tracking-distance">
                          Distance: {track.distance_to_destination_km.toFixed(2)} km
                        </p>
                      )}
                      {track.current_speed_kmh !== null && (
                        <p className="tracking-speed">
                          Vitesse: {track.current_speed_kmh.toFixed(0)} km/h
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Constraints Tab */}
        {activeTab === 'constraints' && (
          <div className="constraints-section">
            <div className="section-header">
              <h2>Contraintes de Routage</h2>
              <p>Gérez les contraintes pour l'optimisation</p>
              <button className="btn-primary" onClick={() => setShowConstraintModal(true)}>
                Nouvelle Contrainte
              </button>
            </div>

            <div className="constraints-list">
              {constraints.length === 0 ? (
                <div className="empty-state">
                  <Settings size={48} />
                  <p>Aucune contrainte configurée</p>
                </div>
              ) : (
                <div className="constraints-grid">
                  {constraints.map(constraint => (
                    <div key={constraint.id} className="constraint-card">
                      <div className="constraint-header">
                        <h3>{constraint.constraint_name}</h3>
                        <span className={`status-badge ${constraint.is_active ? 'status-green' : 'status-gray'}`}>
                          {constraint.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="constraint-type">{constraint.constraint_type}</p>
                      {constraint.constraint_description && <p>{constraint.constraint_description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Forecast Modal */}
      {showForecastModal && (
        <div className="modal-overlay" onClick={() => setShowForecastModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouvelle Prévision</h2>
              <button className="btn-icon" onClick={() => setShowForecastModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Date de prévision</label>
                <input
                  type="date"
                  value={forecastForm.forecast_date}
                  onChange={(e) => setForecastForm({ ...forecastForm, forecast_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nom de la zone</label>
                <input
                  type="text"
                  value={forecastForm.zone_name}
                  onChange={(e) => setForecastForm({ ...forecastForm, zone_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Type de matière (optionnel)</label>
                <input
                  type="text"
                  value={forecastForm.material_type}
                  onChange={(e) => setForecastForm({ ...forecastForm, material_type: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Volume prévu</label>
                <input
                  type="number"
                  value={forecastForm.forecasted_volume}
                  onChange={(e) => setForecastForm({ ...forecastForm, forecasted_volume: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Niveau de confiance (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={forecastForm.confidence_level}
                  onChange={(e) => setForecastForm({ ...forecastForm, confidence_level: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowForecastModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleCreateForecast} disabled={loading}>
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Modal */}
      {showScenarioModal && (
        <div className="modal-overlay" onClick={() => setShowScenarioModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouveau Scénario</h2>
              <button className="btn-icon" onClick={() => setShowScenarioModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nom du scénario</label>
                <input
                  type="text"
                  value={scenarioForm.scenario_name}
                  onChange={(e) => setScenarioForm({ ...scenarioForm, scenario_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={scenarioForm.scenario_description}
                  onChange={(e) => setScenarioForm({ ...scenarioForm, scenario_description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Type de scénario</label>
                <select
                  value={scenarioForm.scenario_type}
                  onChange={(e) => setScenarioForm({ ...scenarioForm, scenario_type: e.target.value as any })}
                >
                  <option value="what_if">Et si...</option>
                  <option value="comparison">Comparaison</option>
                  <option value="optimization_test">Test d'optimisation</option>
                  <option value="constraint_test">Test de contrainte</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowScenarioModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleCreateScenario} disabled={loading}>
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Constraint Modal */}
      {showConstraintModal && (
        <div className="modal-overlay" onClick={() => setShowConstraintModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouvelle Contrainte</h2>
              <button className="btn-icon" onClick={() => setShowConstraintModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Type de contrainte</label>
                <select
                  value={constraintForm.constraint_type}
                  onChange={(e) => setConstraintForm({ ...constraintForm, constraint_type: e.target.value as any })}
                >
                  <option value="customer_hours">Heures clients</option>
                  <option value="max_weight">Poids maximum</option>
                  <option value="max_volume">Volume maximum</option>
                  <option value="restricted_zone">Zone restreinte</option>
                  <option value="vehicle_compatibility">Compatibilité véhicule</option>
                  <option value="driver_hours">Heures conducteur</option>
                  <option value="custom">Personnalisée</option>
                </select>
              </div>
              <div className="form-group">
                <label>Nom de la contrainte</label>
                <input
                  type="text"
                  value={constraintForm.constraint_name}
                  onChange={(e) => setConstraintForm({ ...constraintForm, constraint_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={constraintForm.constraint_description}
                  onChange={(e) => setConstraintForm({ ...constraintForm, constraint_description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowConstraintModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleCreateConstraint} disabled={loading}>
                {loading ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

