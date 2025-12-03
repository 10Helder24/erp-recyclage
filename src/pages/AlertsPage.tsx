import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Filter,
  X,
  Bell,
  BellOff,
  Clock,
  DollarSign,
  Users,
  Shield,
  TrendingUp,
  Loader2,
  Eye,
  Edit2,
  Trash2,
  Search,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api, type Alert, type Notification } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type AlertCategory = 'security' | 'operational' | 'financial' | 'hr' | 'all';
type AlertSeverity = 'low' | 'medium' | 'high' | 'critical' | 'all';

export const AlertsPage = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    category: AlertCategory;
    severity: AlertSeverity;
    is_resolved: boolean | 'all';
  }>({
    category: 'all',
    severity: 'all',
    is_resolved: false
  });
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    unresolved: 0,
    critical: 0,
    byCategory: { security: 0, operational: 0, financial: 0, hr: 0 }
  });

  useEffect(() => {
    loadAlerts();
    loadNotifications();
  }, [filters]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.category !== 'all') params.category = filters.category;
      if (filters.severity !== 'all') params.severity = filters.severity;
      if (filters.is_resolved !== 'all') params.is_resolved = filters.is_resolved;
      const data = await Api.fetchAlerts(params);
      setAlerts(data);
      calculateStats(data);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des alertes');
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await Api.fetchNotifications({ unread_only: true });
      setNotifications(data);
    } catch (error: any) {
      console.error('Erreur chargement notifications:', error);
    }
  };

  const calculateStats = (alertsData: Alert[]) => {
    const unresolved = alertsData.filter((a) => !a.is_resolved);
    setStats({
      total: alertsData.length,
      unresolved: unresolved.length,
      critical: unresolved.filter((a) => a.severity === 'critical').length,
      byCategory: {
        security: unresolved.filter((a) => a.alert_category === 'security').length,
        operational: unresolved.filter((a) => a.alert_category === 'operational').length,
        financial: unresolved.filter((a) => a.alert_category === 'financial').length,
        hr: unresolved.filter((a) => a.alert_category === 'hr').length
      }
    });
  };

  const handleResolve = async () => {
    if (!selectedAlert) return;
    try {
      await Api.resolveAlert(selectedAlert.id, resolveNotes);
      toast.success('Alerte résolue');
      setShowResolveModal(false);
      setResolveNotes('');
      setSelectedAlert(null);
      await loadAlerts();
    } catch (error: any) {
      toast.error('Erreur lors de la résolution');
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await Api.markNotificationAsRead(notificationId);
      await loadNotifications();
    } catch (error: any) {
      console.error('Erreur:', error);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security':
        return <Shield size={16} />;
      case 'operational':
        return <TrendingUp size={16} />;
      case 'financial':
        return <DollarSign size={16} />;
      case 'hr':
        return <Users size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      security: 'Sécurité',
      operational: 'Opérationnel',
      financial: 'Financier',
      hr: 'RH'
    };
    return labels[category] || category;
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

  if (loading && alerts.length === 0) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="spinner" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container alerts-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Alertes & Notifications</h1>
            <p className="text-sm text-gray-600 mt-1">
              {stats.unresolved} alerte(s) non résolue(s) • {notifications.length} notification(s) non lue(s)
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary ${showFilters ? 'active' : ''}`}>
              <Filter size={16} />
              Filtres
            </button>
            {hasRole('admin') && (
              <button
                onClick={() => {
                  setSelectedAlert(null);
                  // TODO: Ouvrir modal création alerte
                }}
                className="btn-primary"
              >
                Créer une alerte
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="alerts-stats-grid">
        <div className="alerts-stat-card">
          <div className="alerts-stat-icon alerts-stat-icon-total">
            <AlertCircle size={24} />
          </div>
          <div className="alerts-stat-content">
            <p className="alerts-stat-label">Total</p>
            <p className="alerts-stat-value">{stats.total}</p>
          </div>
        </div>
        <div className="alerts-stat-card alerts-stat-card-warning">
          <div className="alerts-stat-icon alerts-stat-icon-warning">
            <Bell size={24} />
          </div>
          <div className="alerts-stat-content">
            <p className="alerts-stat-label">Non résolues</p>
            <p className="alerts-stat-value alerts-stat-value-warning">{stats.unresolved}</p>
          </div>
        </div>
        <div className="alerts-stat-card alerts-stat-card-critical">
          <div className="alerts-stat-icon alerts-stat-icon-critical">
            <AlertCircle size={24} />
          </div>
          <div className="alerts-stat-content">
            <p className="alerts-stat-label">Critiques</p>
            <p className="alerts-stat-value alerts-stat-value-critical">{stats.critical}</p>
          </div>
        </div>
        <div className="alerts-stat-card alerts-stat-card-info">
          <div className="alerts-stat-icon alerts-stat-icon-info">
            <Bell size={24} />
          </div>
          <div className="alerts-stat-content">
            <p className="alerts-stat-label">Notifications</p>
            <p className="alerts-stat-value alerts-stat-value-info">{notifications.length}</p>
          </div>
        </div>
      </div>

      {/* Statistiques par catégorie */}
      <div className="alerts-category-stats">
        <h3 className="alerts-section-title">Par catégorie</h3>
        <div className="alerts-category-grid">
          <div className="alerts-category-card" onClick={() => setFilters({ ...filters, category: 'security' })}>
            <div className="alerts-category-icon alerts-category-icon-security">
              <Shield size={20} />
            </div>
            <div className="alerts-category-content">
              <p className="alerts-category-label">Sécurité</p>
              <p className="alerts-category-value">{stats.byCategory.security}</p>
            </div>
          </div>
          <div className="alerts-category-card" onClick={() => setFilters({ ...filters, category: 'operational' })}>
            <div className="alerts-category-icon alerts-category-icon-operational">
              <TrendingUp size={20} />
            </div>
            <div className="alerts-category-content">
              <p className="alerts-category-label">Opérationnel</p>
              <p className="alerts-category-value">{stats.byCategory.operational}</p>
            </div>
          </div>
          <div className="alerts-category-card" onClick={() => setFilters({ ...filters, category: 'financial' })}>
            <div className="alerts-category-icon alerts-category-icon-financial">
              <DollarSign size={20} />
            </div>
            <div className="alerts-category-content">
              <p className="alerts-category-label">Financier</p>
              <p className="alerts-category-value">{stats.byCategory.financial}</p>
            </div>
          </div>
          <div className="alerts-category-card" onClick={() => setFilters({ ...filters, category: 'hr' })}>
            <div className="alerts-category-icon alerts-category-icon-hr">
              <Users size={20} />
            </div>
            <div className="alerts-category-content">
              <p className="alerts-category-label">RH</p>
              <p className="alerts-category-value">{stats.byCategory.hr}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      {showFilters && (
        <div className="alerts-filters-card">
          <div className="alerts-filters-header">
            <h3 className="alerts-section-title">Filtres</h3>
            <button onClick={() => setShowFilters(false)} className="btn-icon btn-icon-sm">
              <X size={16} />
            </button>
          </div>
          <div className="alerts-filters-content">
            <div className="alerts-filter-group">
              <label className="alerts-filter-label">Catégorie</label>
              <div className="alerts-filter-buttons">
                <button
                  onClick={() => setFilters({ ...filters, category: 'all' })}
                  className={`alerts-filter-btn ${filters.category === 'all' ? 'active' : ''}`}
                >
                  Toutes
                </button>
                <button
                  onClick={() => setFilters({ ...filters, category: 'security' })}
                  className={`alerts-filter-btn ${filters.category === 'security' ? 'active' : ''}`}
                >
                  <Shield size={14} />
                  Sécurité
                </button>
                <button
                  onClick={() => setFilters({ ...filters, category: 'operational' })}
                  className={`alerts-filter-btn ${filters.category === 'operational' ? 'active' : ''}`}
                >
                  <TrendingUp size={14} />
                  Opérationnel
                </button>
                <button
                  onClick={() => setFilters({ ...filters, category: 'financial' })}
                  className={`alerts-filter-btn ${filters.category === 'financial' ? 'active' : ''}`}
                >
                  <DollarSign size={14} />
                  Financier
                </button>
                <button
                  onClick={() => setFilters({ ...filters, category: 'hr' })}
                  className={`alerts-filter-btn ${filters.category === 'hr' ? 'active' : ''}`}
                >
                  <Users size={14} />
                  RH
                </button>
              </div>
            </div>
            <div className="alerts-filter-group">
              <label className="alerts-filter-label">Sévérité</label>
              <div className="alerts-filter-buttons">
                <button
                  onClick={() => setFilters({ ...filters, severity: 'all' })}
                  className={`alerts-filter-btn ${filters.severity === 'all' ? 'active' : ''}`}
                >
                  Toutes
                </button>
                <button
                  onClick={() => setFilters({ ...filters, severity: 'critical' })}
                  className={`alerts-filter-btn alerts-filter-btn-critical ${filters.severity === 'critical' ? 'active' : ''}`}
                >
                  Critique
                </button>
                <button
                  onClick={() => setFilters({ ...filters, severity: 'high' })}
                  className={`alerts-filter-btn alerts-filter-btn-high ${filters.severity === 'high' ? 'active' : ''}`}
                >
                  Haute
                </button>
                <button
                  onClick={() => setFilters({ ...filters, severity: 'medium' })}
                  className={`alerts-filter-btn alerts-filter-btn-medium ${filters.severity === 'medium' ? 'active' : ''}`}
                >
                  Moyenne
                </button>
                <button
                  onClick={() => setFilters({ ...filters, severity: 'low' })}
                  className={`alerts-filter-btn alerts-filter-btn-low ${filters.severity === 'low' ? 'active' : ''}`}
                >
                  Basse
                </button>
              </div>
            </div>
            <div className="alerts-filter-group">
              <label className="alerts-filter-label">Statut</label>
              <div className="alerts-filter-buttons">
                <button
                  onClick={() => setFilters({ ...filters, is_resolved: false })}
                  className={`alerts-filter-btn ${filters.is_resolved === false ? 'active' : ''}`}
                >
                  Non résolues
                </button>
                <button
                  onClick={() => setFilters({ ...filters, is_resolved: true })}
                  className={`alerts-filter-btn ${filters.is_resolved === true ? 'active' : ''}`}
                >
                  Résolues
                </button>
                <button
                  onClick={() => setFilters({ ...filters, is_resolved: 'all' })}
                  className={`alerts-filter-btn ${filters.is_resolved === 'all' ? 'active' : ''}`}
                >
                  Toutes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste des alertes */}
      <div className="alerts-list-section">
        <div className="alerts-list-header">
          <h3 className="alerts-section-title">Alertes ({alerts.length})</h3>
        </div>
        {alerts.length === 0 ? (
          <div className="alerts-empty-state">
            <AlertCircle size={48} className="alerts-empty-icon" />
            <p className="alerts-empty-text">Aucune alerte trouvée</p>
            <p className="alerts-empty-subtext">Les alertes apparaîtront ici lorsqu'elles seront générées</p>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`alerts-alert-card ${!alert.is_resolved ? 'alerts-alert-card-unresolved' : ''} ${alert.severity === 'critical' ? 'alerts-alert-card-critical' : ''}`}
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="alerts-alert-header">
                  <div className="alerts-alert-severity">
                    <span className={`alerts-severity-badge ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="alerts-alert-category">
                    <div className="alerts-category-badge">
                      {getCategoryIcon(alert.alert_category)}
                      <span>{getCategoryLabel(alert.alert_category)}</span>
                    </div>
                  </div>
                  <div className="alerts-alert-status">
                    {alert.is_resolved ? (
                      <span className="alerts-status-badge alerts-status-badge-resolved">
                        <CheckCircle size={14} />
                        Résolue
                      </span>
                    ) : (
                      <span className="alerts-status-badge alerts-status-badge-pending">
                        <Clock size={14} />
                        En attente
                      </span>
                    )}
                  </div>
                </div>
                <div className="alerts-alert-body">
                  <h4 className="alerts-alert-title">{alert.title}</h4>
                  <p className="alerts-alert-message">{alert.message}</p>
                </div>
                <div className="alerts-alert-footer">
                  <div className="alerts-alert-meta">
                    {alert.assigned_to_name && (
                      <span className="alerts-alert-meta-item">
                        <Users size={14} />
                        {alert.assigned_to_name}
                      </span>
                    )}
                    <span className="alerts-alert-meta-item">
                      <Clock size={14} />
                      {format(new Date(alert.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <div className="alerts-alert-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlert(alert);
                      }}
                      className="btn-icon btn-icon-sm"
                      title="Voir détails"
                    >
                      <Eye size={16} />
                    </button>
                    {!alert.is_resolved && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAlert(alert);
                          setShowResolveModal(true);
                        }}
                        className="btn-icon btn-icon-sm btn-icon-success"
                        title="Résoudre"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal détails alerte */}
      {selectedAlert && !showResolveModal && (
        <div className="alerts-modal-overlay" onClick={() => setSelectedAlert(null)}>
          <div className="alerts-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="alerts-modal-header">
              <div>
                <h2>{selectedAlert.title}</h2>
                <div className="alerts-modal-badges">
                  <div className="alerts-category-badge">
                    {getCategoryIcon(selectedAlert.alert_category)}
                    <span>{getCategoryLabel(selectedAlert.alert_category)}</span>
                  </div>
                  <span className={`alerts-severity-badge ${getSeverityColor(selectedAlert.severity)}`}>
                    {selectedAlert.severity}
                  </span>
                  {selectedAlert.is_resolved ? (
                    <span className="alerts-status-badge alerts-status-badge-resolved">
                      <CheckCircle size={14} />
                      Résolue
                    </span>
                  ) : (
                    <span className="alerts-status-badge alerts-status-badge-pending">
                      <Clock size={14} />
                      En attente
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            <div className="alerts-modal-body">
              <div className="alerts-modal-section">
                <label className="alerts-modal-label">Message</label>
                <p className="alerts-modal-text">{selectedAlert.message}</p>
              </div>
              <div className="alerts-modal-grid">
                {selectedAlert.assigned_to_name && (
                  <div className="alerts-modal-section">
                    <label className="alerts-modal-label">Assigné à</label>
                    <p className="alerts-modal-text">{selectedAlert.assigned_to_name}</p>
                  </div>
                )}
                <div className="alerts-modal-section">
                  <label className="alerts-modal-label">Date de création</label>
                  <p className="alerts-modal-text">
                    {format(new Date(selectedAlert.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                {selectedAlert.due_date && (
                  <div className="alerts-modal-section">
                    <label className="alerts-modal-label">Date limite</label>
                    <p className="alerts-modal-text">
                      {format(new Date(selectedAlert.due_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                )}
                {selectedAlert.resolved_at && (
                  <div className="alerts-modal-section">
                    <label className="alerts-modal-label">Résolue le</label>
                    <p className="alerts-modal-text">
                      {format(new Date(selectedAlert.resolved_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      {selectedAlert.resolved_by_name && ` par ${selectedAlert.resolved_by_name}`}
                    </p>
                    {selectedAlert.resolved_notes && (
                      <p className="alerts-modal-notes">{selectedAlert.resolved_notes}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="alerts-modal-actions">
              <button onClick={() => setSelectedAlert(null)} className="btn-secondary">
                Fermer
              </button>
              {!selectedAlert.is_resolved && (
                <button
                  onClick={() => {
                    setShowResolveModal(true);
                  }}
                  className="btn-primary"
                >
                  <CheckCircle size={16} />
                  Résoudre
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal résolution */}
      {showResolveModal && selectedAlert && (
        <div className="alerts-modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="alerts-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="alerts-modal-header">
              <h2>Résoudre l'alerte</h2>
              <button onClick={() => setShowResolveModal(false)} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            <div className="alerts-modal-body">
              <div className="alerts-modal-section">
                <label className="alerts-modal-label">Alerte</label>
                <p className="alerts-modal-text alerts-modal-text-bold">{selectedAlert.title}</p>
                <p className="alerts-modal-text">{selectedAlert.message}</p>
              </div>
              <div className="alerts-form-group">
                <label className="alerts-form-label">Notes de résolution (optionnel)</label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  rows={4}
                  placeholder="Ajoutez des notes sur la résolution de cette alerte..."
                  className="alerts-textarea"
                />
              </div>
            </div>
            <div className="alerts-modal-actions">
              <button onClick={() => setShowResolveModal(false)} className="btn-secondary">
                Annuler
              </button>
              <button onClick={handleResolve} className="btn-primary">
                <CheckCircle size={16} />
                Résoudre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


