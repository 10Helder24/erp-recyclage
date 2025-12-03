import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Loader2,
  Edit2,
  Trash2,
  AlertTriangle,
  Warehouse,
  Package,
  TrendingUp,
  FileText,
  CheckCircle,
  XCircle,
  BarChart3,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import {
  Api,
  type Warehouse as WarehouseType,
  type StockThreshold,
  type StockLot,
  type StockMovement,
  type StockAlert,
  type StockReconciliation,
  type StockValuation,
  type StockForecast,
  type Material
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type TabType = 'overview' | 'warehouses' | 'thresholds' | 'lots' | 'movements' | 'reconciliations' | 'valuations' | 'forecasts';

export const StockManagementPage = () => {
  const { hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager || hasPermission('edit_materials');

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Data states
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [thresholds, setThresholds] = useState<StockThreshold[]>([]);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [reconciliations, setReconciliations] = useState<StockReconciliation[]>([]);
  const [valuations, setValuations] = useState<StockValuation[]>([]);
  const [forecasts, setForecasts] = useState<StockForecast[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  // Modal states
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [showForecastModal, setShowForecastModal] = useState(false);

  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const [editingThreshold, setEditingThreshold] = useState<StockThreshold | null>(null);
  const [editingLot, setEditingLot] = useState<StockLot | null>(null);
  const [editingReconciliation, setEditingReconciliation] = useState<StockReconciliation | null>(null);
  const [editingForecast, setEditingForecast] = useState<StockForecast | null>(null);

  // Form states
  const [warehouseForm, setWarehouseForm] = useState({ 
    code: '', 
    name: '', 
    address: '', 
    location: '', 
    latitude: '', 
    longitude: '', 
    is_depot: false, 
    notes: '' 
  });
  const [thresholdForm, setThresholdForm] = useState({
    material_id: '',
    warehouse_id: '',
    min_quantity: 0,
    max_quantity: 0,
    alert_enabled: true,
    unit: '',
    notes: ''
  });
  const [lotForm, setLotForm] = useState({
    lot_number: '',
    material_id: '',
    warehouse_id: '',
    quantity: 0,
    unit: '',
    production_date: '',
    expiry_date: '',
    origin: '',
    supplier_name: '',
    batch_reference: '',
    quality_status: '',
    notes: ''
  });
  const [movementForm, setMovementForm] = useState({
    movement_type: 'in' as 'in' | 'out' | 'transfer' | 'adjustment' | 'production' | 'consumption',
    material_id: '',
    lot_id: '',
    warehouse_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    quantity: 0,
    unit: '',
    unit_price: 0,
    reference_type: '',
    reference_id: '',
    origin: '',
    destination: '',
    treatment_stage: '',
    notes: ''
  });
  const [reconciliationForm, setReconciliationForm] = useState({
    warehouse_id: '',
    material_id: '',
    reconciliation_date: format(new Date(), 'yyyy-MM-dd'),
    theoretical_quantity: 0,
    actual_quantity: 0,
    reason: '',
    unit: '',
    notes: ''
  });
  const [valuationForm, setValuationForm] = useState({
    material_id: '',
    warehouse_id: '',
    valuation_method: 'FIFO' as 'FIFO' | 'LIFO' | 'AVERAGE',
    valuation_date: format(new Date(), 'yyyy-MM-dd')
  });
  const [forecastForm, setForecastForm] = useState({
    material_id: '',
    warehouse_id: '',
    forecast_date: format(new Date(), 'yyyy-MM-dd'),
    forecasted_quantity: 0,
    confidence_level: 80,
    forecast_method: '',
    historical_period_months: 12,
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'overview':
          await Promise.all([
            loadAlerts(),
            loadWarehouses(),
            loadMaterials()
          ]);
          break;
        case 'warehouses':
          await loadWarehouses();
          break;
        case 'thresholds':
          await Promise.all([loadThresholds(), loadWarehouses(), loadMaterials()]);
          break;
        case 'lots':
          await Promise.all([loadLots(), loadWarehouses(), loadMaterials()]);
          break;
        case 'movements':
          await Promise.all([loadMovements(), loadWarehouses(), loadMaterials()]);
          break;
        case 'reconciliations':
          await Promise.all([loadReconciliations(), loadWarehouses(), loadMaterials()]);
          break;
        case 'valuations':
          await Promise.all([loadValuations(), loadWarehouses(), loadMaterials()]);
          break;
        case 'forecasts':
          await Promise.all([loadForecasts(), loadWarehouses(), loadMaterials()]);
          break;
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    const data = await Api.fetchWarehouses();
    setWarehouses(data);
  };

  const loadMaterials = async () => {
    const data = await Api.fetchMaterials();
    setMaterials(data);
  };

  const loadThresholds = async () => {
    const data = await Api.fetchStockThresholds();
    setThresholds(data);
  };

  const loadLots = async () => {
    const data = await Api.fetchStockLots();
    setLots(data);
  };

  const loadMovements = async () => {
    const data = await Api.fetchStockMovements({});
    setMovements(data);
  };

  const loadAlerts = async () => {
    const data = await Api.fetchStockAlerts({ is_resolved: false });
    setAlerts(data);
  };

  const loadReconciliations = async () => {
    const data = await Api.fetchStockReconciliations({});
    setReconciliations(data);
  };

  const loadValuations = async () => {
    const data = await Api.fetchStockValuations({});
    setValuations(data);
  };

  const loadForecasts = async () => {
    const data = await Api.fetchStockForecasts({});
    setForecasts(data);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'below_min':
        return 'Stock minimum';
      case 'above_max':
        return 'Stock maximum';
      case 'expiring_soon':
        return 'Expiration proche';
      case 'expired':
        return 'Expiré';
      case 'reconciliation_needed':
        return 'Réconciliation nécessaire';
      default:
        return type;
    }
  };

  const handleResolveAlert = async (id: string) => {
    try {
      await Api.resolveStockAlert(id);
      toast.success('Alerte résolue');
      await loadAlerts();
    } catch (error: any) {
      toast.error('Erreur lors de la résolution de l\'alerte');
    }
  };

  if (!canEdit) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Gestion des Stocks</h1>
        </div>
        <div className="page-content">
          <p>Vous n'avez pas accès à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container stock-page">
      <div className="page-header">
        <h1>Gestion Avancée des Stocks</h1>
      </div>

      <div className="stock-page tab-nav">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
          <BarChart3 size={16} />
          Vue d'ensemble
        </button>
        <button className={activeTab === 'warehouses' ? 'active' : ''} onClick={() => setActiveTab('warehouses')}>
          <Warehouse size={16} />
          Entrepôts
        </button>
        <button className={activeTab === 'thresholds' ? 'active' : ''} onClick={() => setActiveTab('thresholds')}>
          <AlertTriangle size={16} />
          Seuils
        </button>
        <button className={activeTab === 'lots' ? 'active' : ''} onClick={() => setActiveTab('lots')}>
          <Package size={16} />
          Lots
        </button>
        <button className={activeTab === 'movements' ? 'active' : ''} onClick={() => setActiveTab('movements')}>
          <FileText size={16} />
          Mouvements
        </button>
        <button className={activeTab === 'reconciliations' ? 'active' : ''} onClick={() => setActiveTab('reconciliations')}>
          <CheckCircle size={16} />
          Réconciliations
        </button>
        <button className={activeTab === 'valuations' ? 'active' : ''} onClick={() => setActiveTab('valuations')}>
          <TrendingUp size={16} />
          Valorisations
        </button>
        <button className={activeTab === 'forecasts' ? 'active' : ''} onClick={() => setActiveTab('forecasts')}>
          <Calendar size={16} />
          Prévisions
        </button>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="spinner" size={32} />
          </div>
        ) : activeTab === 'overview' ? (
          <div>
            <div className="stock-stats-grid">
              <div className="stock-stat-card stock-stat-card-alert">
                <div className="stock-stat-icon stock-stat-icon-alert">
                  <AlertTriangle size={24} />
                </div>
                <div className="stock-stat-content">
                  <p className="stock-stat-label">Alertes actives</p>
                  <p className="stock-stat-value stock-stat-value-alert">{alerts.length}</p>
                </div>
              </div>
              <div className="stock-stat-card stock-stat-card-info">
                <div className="stock-stat-icon stock-stat-icon-info">
                  <Warehouse size={24} />
                </div>
                <div className="stock-stat-content">
                  <p className="stock-stat-label">Entrepôts</p>
                  <p className="stock-stat-value stock-stat-value-info">{warehouses.length}</p>
                </div>
              </div>
              <div className="stock-stat-card stock-stat-card-success">
                <div className="stock-stat-icon stock-stat-icon-success">
                  <Package size={24} />
                </div>
                <div className="stock-stat-content">
                  <p className="stock-stat-label">Lots actifs</p>
                  <p className="stock-stat-value stock-stat-value-success">{lots.length}</p>
                </div>
              </div>
            </div>

            <div className="stock-card">
              <div className="stock-card-header">
                <h2 className="stock-card-title">Alertes récentes</h2>
              </div>
              <div className="stock-card-body">
                {alerts.length === 0 ? (
                  <div className="stock-empty-state">
                    <AlertTriangle size={48} className="stock-empty-icon" />
                    <p className="stock-empty-text">Aucune alerte active</p>
                    <p className="stock-empty-subtext">Tous les stocks sont dans les normes</p>
                  </div>
                ) : (
                  <div className="stock-alerts-list">
                    {alerts.slice(0, 10).map((alert) => (
                      <div
                        key={alert.id}
                        className={`stock-alert-card stock-alert-card-${alert.severity}`}
                      >
                        <div className="stock-alert-content">
                          <div className="stock-alert-header">
                            <span className={`stock-severity-badge ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                            <p className="stock-alert-type">{getAlertTypeLabel(alert.alert_type)}</p>
                          </div>
                          {alert.message && <p className="stock-alert-message">{alert.message}</p>}
                        </div>
                        <button
                          onClick={() => handleResolveAlert(alert.id)}
                          className="stock-alert-action btn-secondary btn-sm"
                        >
                          Résoudre
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'warehouses' ? (
          <div>
            <div className="stock-page-header">
              <div className="stock-page-search-bar">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Rechercher un entrepôt..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button onClick={() => {
                setEditingWarehouse(null);
                setWarehouseForm({ code: '', name: '', address: '', location: '', latitude: '', longitude: '', is_depot: false, notes: '' });
                setShowWarehouseModal(true);
              }} className="btn-primary">
                <Plus size={16} />
                Nouvel entrepôt
              </button>
            </div>
            <div className="stock-page-table-container">
              <table className="stock-page-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Adresse</th>
                    <th>Localisation</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.filter(w => 
                    w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    w.name.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((warehouse) => (
                    <tr key={warehouse.id}>
                      <td className="font-mono">{warehouse.code}</td>
                      <td>{warehouse.name}</td>
                      <td>{warehouse.address || '-'}</td>
                      <td>{warehouse.location || '-'}</td>
                      <td>
                        <span className={`stock-status-badge ${warehouse.is_active ? 'stock-status-badge-active' : 'stock-status-badge-inactive'}`}>
                          {warehouse.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingWarehouse(warehouse);
                              setWarehouseForm({
                                code: warehouse.code,
                                name: warehouse.name,
                                address: warehouse.address || '',
                                location: warehouse.location || '',
                                latitude: warehouse.latitude?.toString() || '',
                                longitude: warehouse.longitude?.toString() || '',
                                is_depot: warehouse.is_depot || false,
                                notes: warehouse.notes || ''
                              });
                              setShowWarehouseModal(true);
                            }}
                            className="btn-icon"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={async () => {
                                if (!confirm('Supprimer cet entrepôt ?')) return;
                                try {
                                  await Api.deleteWarehouse(warehouse.id);
                                  toast.success('Entrepôt supprimé');
                                  await loadWarehouses();
                                } catch (error: any) {
                                  toast.error('Erreur lors de la suppression');
                                }
                              }}
                              className="btn-icon text-red-600"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="stock-empty-state">
            <Package size={48} className="stock-empty-icon" />
            <p className="stock-empty-text">Fonctionnalité en développement</p>
            <p className="stock-empty-subtext">Cet onglet sera disponible prochainement</p>
          </div>
        )}
      </div>

      {/* Modal Entrepôt */}
      {showWarehouseModal && (
        <div className="stock-page modal-overlay" onClick={() => setShowWarehouseModal(false)}>
          <div className="stock-page modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="stock-modal-header">
              <h2>{editingWarehouse ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt'}</h2>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const payload = {
                  ...warehouseForm,
                  latitude: warehouseForm.latitude ? parseFloat(warehouseForm.latitude) : undefined,
                  longitude: warehouseForm.longitude ? parseFloat(warehouseForm.longitude) : undefined
                };
                if (editingWarehouse) {
                  await Api.updateWarehouse(editingWarehouse.id, payload);
                  toast.success('Entrepôt mis à jour');
                } else {
                  await Api.createWarehouse(payload);
                  toast.success('Entrepôt créé');
                }
                setShowWarehouseModal(false);
                await loadWarehouses();
              } catch (error: any) {
                toast.error(error.message || 'Erreur lors de la sauvegarde');
              }
            }}>
              <div className="stock-page-form-grid">
                <div className="stock-page-form-group">
                  <label className="stock-page-form-label">Code *</label>
                  <input
                    type="text"
                    value={warehouseForm.code}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                    required
                    className="stock-page-form-input"
                  />
                </div>
                <div className="stock-page-form-group">
                  <label className="stock-page-form-label">Nom *</label>
                  <input
                    type="text"
                    value={warehouseForm.name}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                    required
                    className="stock-page-form-input"
                  />
                </div>
                <div className="stock-page-form-group">
                  <label className="stock-page-form-label">Adresse</label>
                  <input
                    type="text"
                    value={warehouseForm.address}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                    className="stock-page-form-input"
                  />
                </div>
                <div className="stock-page-form-group">
                  <label className="stock-page-form-label">Localisation</label>
                  <input
                    type="text"
                    value={warehouseForm.location}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
                    className="stock-page-form-input"
                  />
                </div>
                <div className="stock-page-form-group">
                  <label className="stock-page-form-label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={warehouseForm.latitude}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, latitude: e.target.value })}
                    placeholder="46.548452"
                    className="stock-page-form-input"
                  />
                </div>
                <div className="stock-page-form-group">
                  <label className="stock-page-form-label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={warehouseForm.longitude}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, longitude: e.target.value })}
                    placeholder="6.572221"
                    className="stock-page-form-input"
                  />
                </div>
                <div className="stock-page-form-group">
                  <label className="stock-page-form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={warehouseForm.is_depot}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, is_depot: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    Afficher sur la carte comme dépôt
                  </label>
                </div>
              </div>
              <div className="stock-page-form-group">
                <label className="stock-page-form-label">Notes</label>
                <textarea
                  value={warehouseForm.notes}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, notes: e.target.value })}
                  rows={3}
                  className="stock-page-form-textarea"
                />
              </div>
              <div className="stock-page-modal-actions">
                <button type="button" onClick={() => setShowWarehouseModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {editingWarehouse ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

