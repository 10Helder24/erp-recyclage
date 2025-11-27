import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Loader2,
  MapPin,
  Shield,
  Upload,
  X,
  Clock,
  AlertTriangle,
  RefreshCcw,
  ExternalLink,
  Image,
  Map
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Api, type AuditLogEntry, type CustomerDetailPayload, type CustomerDocument, type Intervention } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type TabId = 'fiche' | 'historique' | 'interventions' | 'risques' | 'documents';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'fiche', label: 'Coordonnées' },
  { id: 'historique', label: 'Historique' },
  { id: 'interventions', label: 'Interventions' },
  { id: 'risques', label: 'Risques & tournée' },
  { id: 'documents', label: 'Documents' }
];

type CustomerDetailProps = {
  customerId: string;
  onClose: () => void;
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return value;
  }
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      } else {
        reject(new Error('Lecture du fichier impossible'));
      }
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });

const getRiskColor = (risk?: string | null) => {
  if (!risk) return '#0ea5e9';
  const normalized = risk.toLowerCase();
  if (normalized === 'urgent' || normalized === 'high') return '#dc2626';
  if (normalized === 'sensitive') return '#f97316';
  if (normalized === 'medium') return '#facc15';
  return '#0ea5e9';
};

const changedFieldsFromLog = (entry: AuditLogEntry) => {
  if (!entry.before_data || !entry.after_data) {
    return Object.keys(entry.after_data || entry.before_data || {});
  }
  const keys = new Set([...Object.keys(entry.before_data), ...Object.keys(entry.after_data)]);
  const changed: string[] = [];
  keys.forEach((key) => {
    if (entry.before_data?.[key] !== entry.after_data?.[key]) {
      changed.push(key);
    }
  });
  return changed;
};

export const CustomerDetailPage = ({ customerId, onClose }: CustomerDetailProps) => {
  const { hasRole, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('fiche');
  const [detail, setDetail] = useState<CustomerDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const canEdit = hasRole('admin', 'manager') || hasPermission('edit_customers');

  const loadDetail = async () => {
    try {
      setRefreshing(true);
      const data = await Api.fetchCustomerDetail(customerId);
      setDetail(data);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de charger la fiche client");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadDetail();
  }, [customerId]);

  const lastIntervention = useMemo<Intervention | null>(() => {
    if (!detail?.interventions?.length) return null;
    return detail.interventions[0];
  }, [detail]);

  const riskLabel = useMemo(() => detail?.customer.risk_level ?? 'Standard', [detail]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const file = event.target.files[0];
    try {
      setUploading(true);
      const base64 = await fileToBase64(file);
      await Api.uploadCustomerDocument(customerId, {
        filename: file.name,
        mimetype: file.type,
        base64
      });
      toast.success('Document ajouté');
      await loadDetail();
    } catch (error) {
      console.error(error);
      toast.error("Ajout impossible (fichier trop lourd ?)");
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Supprimer ce document ?')) {
      return;
    }
    try {
      await Api.deleteCustomerDocument(customerId, documentId);
      toast.success('Document supprimé');
      await loadDetail();
    } catch (error) {
      console.error(error);
      toast.error('Suppression impossible');
    }
  };

  const handleDownload = async (doc: CustomerDocument) => {
    try {
      const blob = await Api.downloadCustomerDocument(customerId, doc.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Téléchargement impossible');
    }
  };

  const handleOpenInMaps = () => {
    if (!detail?.customer.latitude || !detail.customer.longitude) {
      toast.error('Coordonnées indisponibles');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${detail.customer.latitude},${detail.customer.longitude}`;
    window.open(url, '_blank');
  };

  const focusOnMainMap = () => {
    if (!detail) return;
    try {
      localStorage.setItem(
        'erp_map_focus_customer',
        JSON.stringify({
          id: detail.customer.id,
          name: detail.customer.name,
          latitude: detail.customer.latitude,
          longitude: detail.customer.longitude,
          risk_level: detail.customer.risk_level
        })
      );
      toast.success('Client centré dans la carte (menu Gestion > Carte)');
    } catch {
      toast.error('Impossible de partager la position');
    }
  };

  const handlePreviewImage = async (doc: CustomerDocument) => {
    try {
      const blob = await Api.downloadCustomerDocument(customerId, doc.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error(error);
      toast.error('Prévisualisation impossible');
    }
  };

  const renderFiche = () => {
    if (!detail) return null;
    return (
      <div className="customer-detail-grid">
        <div className="customer-detail-card">
          <h3>Coordonnées</h3>
          <div className="info-row">
            <MapPin size={16} />
            <div>
              <p>{detail.customer.address || 'Adresse non renseignée'}</p>
              {detail.customer.latitude && detail.customer.longitude && (
                <small>
                  {detail.customer.latitude.toFixed(5)}, {detail.customer.longitude.toFixed(5)}
                </small>
              )}
            </div>
          </div>
          <p className="muted-text">Créé le {formatDateTime(detail.customer.created_at)}</p>
          <div className="customer-detail-map">
            {detail.customer.latitude && detail.customer.longitude ? (
              <>
                <iframe
                  title="Carte client"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    detail.customer.longitude - 0.01
                  }%2C${detail.customer.latitude - 0.01}%2C${detail.customer.longitude + 0.01}%2C${
                    detail.customer.latitude + 0.01
                  }&layer=mapnik&marker=${detail.customer.latitude}%2C${detail.customer.longitude}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="map-actions">
                  <button type="button" className="btn btn-outline" onClick={handleOpenInMaps}>
                    <ExternalLink size={14} />
                    Google Maps
                  </button>
                  <button type="button" className="btn btn-primary" onClick={focusOnMainMap}>
                    <Map size={14} />
                    Centrer dans Carte ERP
                  </button>
                </div>
              </>
            ) : (
              <p className="muted-text">Coordonnées géographiques non renseignées.</p>
            )}
          </div>
        </div>
        <div className="customer-detail-card">
          <h3>Dernière intervention</h3>
          {lastIntervention ? (
            <ul className="detail-list">
              <li>
                <strong>{lastIntervention.title}</strong>
                <small>{formatDateTime(lastIntervention.created_at)}</small>
              </li>
              <li>Statut : {lastIntervention.status}</li>
              <li>Priorité : {lastIntervention.priority}</li>
              <li>Assigné à : {lastIntervention.assigned_to_name || '—'}</li>
            </ul>
          ) : (
            <p className="muted-text">Aucune intervention enregistrée.</p>
          )}
        </div>
      </div>
    );
  };

  const renderHistorique = () => {
    if (!detail?.auditLogs?.length) {
      return <p className="muted-text">Aucune activité récente.</p>;
    }
    return (
      <div className="audit-timeline">
        {detail.auditLogs.map((log) => (
          <div key={log.id} className="audit-entry">
            <div className="audit-entry__meta">
              <Clock size={14} />
              <span>{formatDateTime(log.created_at)}</span>
            </div>
            <div className="audit-entry__body">
              <p>
                <strong>{log.action.toUpperCase()}</strong> par {log.changed_by_name || 'Système'}
              </p>
              <small>Champs concernés : {changedFieldsFromLog(log).join(', ') || '—'}</small>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderInterventions = () => {
    if (!detail?.interventions?.length) {
      return <p className="muted-text">Aucune intervention enregistrée.</p>;
    }
    return (
      <div className="detail-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Statut</th>
              <th>Priorité</th>
              <th>Assigné à</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {detail.interventions.map((intervention) => (
              <tr key={intervention.id}>
                <td>{intervention.title}</td>
                <td>{intervention.status}</td>
                <td>{intervention.priority}</td>
                <td>{intervention.assigned_to_name || '—'}</td>
                <td>{formatDateTime(intervention.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRisques = () => {
    if (!detail) return null;
    return (
      <div className="customer-detail-grid">
        <div className="customer-detail-card">
          <h3>Niveau de risque</h3>
          <div className="risk-pill" style={{ backgroundColor: getRiskColor(detail.customer.risk_level) }}>
            <Shield size={14} />
            <span>{riskLabel}</span>
          </div>
          <p className="muted-text">
            Ce niveau détermine les alertes sur la carte et les notifications en cas de proximité d&apos;équipes.
          </p>
        </div>
        <div className="customer-detail-card">
          <h3>Tournées & arrêts</h3>
          {detail.routeStops.length === 0 ? (
            <p className="muted-text">Aucun passage enregistré.</p>
          ) : (
            <ul className="detail-list">
              {detail.routeStops.slice(0, 5).map((stop) => (
                <li key={stop.id}>
                  <strong>{formatDateTime(stop.route_date)}</strong>
                  <small>
                    Véhicule {stop.internal_number || stop.plate_number || '—'} · Statut {stop.route_status || '—'}
                  </small>
                  <p>Ordre #{stop.order_index + 1}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderDocuments = () => {
    if (!detail) return null;
    const imageDocuments = detail.documents.filter((doc) => doc.mimetype?.startsWith('image/'));
    return (
      <div className="documents-section">
        <div className="documents-actions">
          <div>
            <h3>Documents partagés</h3>
            <p className="muted-text">Contrats, photos, fiches techniques… Taille limite : 10 Mo.</p>
          </div>
          {canEdit && (
            <label className="btn btn-primary upload-button">
              <Upload size={16} />
              {uploading ? 'Envoi...' : 'Ajouter'}
              <input type="file" onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>
        {detail.documents.length === 0 ? (
          <p className="muted-text">Aucun document déposé.</p>
        ) : (
          <div className="documents-list">
            {detail.documents.map((doc) => (
              <div key={doc.id} className="document-card">
                <FileText size={20} />
                <div>
                  <p>{doc.filename}</p>
                  <small>
                    Ajouté le {formatDateTime(doc.created_at)} par {doc.uploaded_by_name || '—'}
                  </small>
                </div>
                <div className="document-card__actions">
                  <button type="button" className="btn-icon" onClick={() => handleDownload(doc)} aria-label="Télécharger">
                    <Download size={16} />
                  </button>
                  {doc.mimetype?.startsWith('image/') && (
                    <button type="button" className="btn-icon" onClick={() => handlePreviewImage(doc)} aria-label="Prévisualiser">
                      <Image size={16} />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className="btn-icon danger"
                      onClick={() => handleDeleteDocument(doc.id)}
                      aria-label="Supprimer"
                    >
                      <AlertTriangle size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {imageDocuments.length > 0 && (
          <div className="photos-grid">
            {imageDocuments.map((doc) => (
              <div key={`photo-${doc.id}`} className="photo-card">
                <Image size={32} />
                <div>
                  <p>{doc.filename}</p>
                  <button type="button" className="btn btn-outline" onClick={() => handlePreviewImage(doc)}>
                    Voir la photo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="customer-detail-overlay">
      <div className="customer-detail-panel">
        <div className="customer-detail-header">
          <div>
            <p className="eyebrow">Fiche client</p>
            <h2>{detail?.customer.name ?? 'Chargement...'}</h2>
            {detail?.customer.risk_level && (
              <span className="risk-pill" style={{ backgroundColor: getRiskColor(detail.customer.risk_level) }}>
                <Shield size={12} />
                {riskLabel}
              </span>
            )}
          </div>
          <div className="customer-detail-header-buttons">
            <button type="button" className="btn btn-outline" onClick={loadDetail} disabled={refreshing}>
              <RefreshCcw size={16} />
              Actualiser
            </button>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Fermer">
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="customer-detail-loading">
            <Loader2 className="spinner" size={28} />
            <p>Chargement...</p>
          </div>
        ) : (
          <>
            <div className="customer-detail-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={activeTab === tab.id ? 'active' : ''}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="customer-detail-content">
              {activeTab === 'fiche' && renderFiche()}
              {activeTab === 'historique' && renderHistorique()}
              {activeTab === 'interventions' && renderInterventions()}
              {activeTab === 'risques' && renderRisques()}
              {activeTab === 'documents' && renderDocuments()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerDetailPage;

