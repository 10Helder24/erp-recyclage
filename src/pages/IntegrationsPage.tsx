import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Api,
  type ExternalIntegration,
  type Webhook,
  type IntegrationLog,
  type WebhookLog,
  type CreateIntegrationPayload,
  type CreateWebhookPayload
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import {
  Settings, CheckCircle, XCircle, Clock, Activity, Webhook as WebhookIcon, Mail, MessageSquare,
  MapPin, Scale, Calculator, Plus, Edit, Trash2, Play, History, Eye, EyeOff
} from 'lucide-react';

type TabType = 'accounting' | 'email' | 'sms' | 'gps' | 'scale' | 'webhooks';

const INTEGRATION_TYPES = [
  { value: 'accounting', label: 'Comptable', icon: Calculator, color: '#3b82f6' },
  { value: 'email', label: 'Email', icon: Mail, color: '#10b981' },
  { value: 'sms', label: 'SMS', icon: MessageSquare, color: '#f59e0b' },
  { value: 'gps', label: 'GPS', icon: MapPin, color: '#8b5cf6' },
  { value: 'scale', label: 'Balances', icon: Scale, color: '#ef4444' }
];

const WEBHOOK_EVENTS = [
  { value: 'document_created', label: 'Document créé' },
  { value: 'document_approved', label: 'Document approuvé' },
  { value: 'invoice_created', label: 'Facture créée' },
  { value: 'invoice_paid', label: 'Facture payée' },
  { value: 'order_created', label: 'Commande créée' },
  { value: 'order_completed', label: 'Commande complétée' },
  { value: 'alert_created', label: 'Alerte créée' },
  { value: 'alert_resolved', label: 'Alerte résolue' },
  { value: 'customer_created', label: 'Client créé' },
  { value: 'customer_updated', label: 'Client modifié' },
  { value: 'route_created', label: 'Route créée' },
  { value: 'route_completed', label: 'Route complétée' },
  { value: 'scale_measurement', label: 'Mesure balance' },
  { value: 'gps_update', label: 'Mise à jour GPS' },
  { value: 'custom', label: 'Personnalisé' }
];

const ACCOUNTING_PROVIDERS = ['Sage', 'QuickBooks', 'Xero', 'ComptaCom', 'Autre'];
const EMAIL_PROVIDERS = ['SMTP', 'SendGrid', 'Mailgun', 'Brevo', 'Autre'];
const SMS_PROVIDERS = ['Twilio', 'Vonage', 'MessageBird', 'Autre'];
const GPS_PROVIDERS = ['TomTom', 'Garmin', 'Geotab', 'Autre'];
const SCALE_PROVIDERS = ['Mettler Toledo', 'Sartorius', 'Avery Weigh-Tronix', 'Autre'];

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('accounting');
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<ExternalIntegration | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [integrationLogs, setIntegrationLogs] = useState<IntegrationLog[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  
  // Modals
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showCredentials, setShowCredentials] = useState<Record<string, boolean>>({});
  
  // Forms
  const [integrationForm, setIntegrationForm] = useState<CreateIntegrationPayload>({
    integration_type: 'accounting',
    name: '',
    provider: '',
    is_active: false,
    config: {},
    credentials: {}
  });
  const [webhookForm, setWebhookForm] = useState<CreateWebhookPayload>({
    name: '',
    url: '',
    event_type: 'custom',
    http_method: 'POST',
    headers: {},
    secret_token: '',
    retry_count: 3,
    timeout_seconds: 30
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'webhooks') {
        const data = await Api.fetchWebhooks();
        setWebhooks(data);
      } else {
        const data = await Api.fetchIntegrations({ type: activeTab as any });
        setIntegrations(data);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (id: string, type: 'integration' | 'webhook') => {
    try {
      if (type === 'integration') {
        const logs = await Api.fetchIntegrationLogs(id, 50);
        setIntegrationLogs(logs);
        setShowLogsModal(true);
      } else {
        const logs = await Api.fetchWebhookLogs(id, 50);
        setWebhookLogs(logs);
        setShowLogsModal(true);
      }
    } catch (error: any) {
      console.error('Error loading logs:', error);
      toast.error('Erreur lors du chargement des logs');
    }
  };

  const handleSaveIntegration = async () => {
    if (!integrationForm.name || !integrationForm.provider) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setLoading(true);
    try {
      if (selectedIntegration) {
        await Api.updateIntegration(selectedIntegration.id, integrationForm);
        toast.success('Intégration mise à jour');
      } else {
        await Api.createIntegration(integrationForm);
        toast.success('Intégration créée');
      }
      setShowIntegrationModal(false);
      setSelectedIntegration(null);
      setIntegrationForm({
        integration_type: activeTab === 'webhooks' ? 'other' : activeTab as any,
        name: '',
        provider: '',
        is_active: false,
        config: {},
        credentials: {}
      });
      loadData();
    } catch (error: any) {
      console.error('Error saving integration:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookForm.name || !webhookForm.url || !webhookForm.event_type) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setLoading(true);
    try {
      if (selectedWebhook) {
        await Api.updateWebhook(selectedWebhook.id, webhookForm);
        toast.success('Webhook mis à jour');
      } else {
        await Api.createWebhook(webhookForm);
        toast.success('Webhook créé');
      }
      setShowWebhookModal(false);
      setSelectedWebhook(null);
      setWebhookForm({
        name: '',
        url: '',
        event_type: 'custom',
        http_method: 'POST',
        headers: {},
        secret_token: '',
        retry_count: 3,
        timeout_seconds: 30
      });
      loadData();
    } catch (error: any) {
      console.error('Error saving webhook:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleTestIntegration = async (id: string) => {
    setLoading(true);
    try {
      const result = await Api.testIntegration(id);
      if (result.success) {
        toast.success(`Test réussi (${result.executionTime}ms)`);
      } else {
        toast.error(`Test échoué: ${result.error}`);
      }
      loadData();
    } catch (error: any) {
      console.error('Error testing integration:', error);
      toast.error('Erreur lors du test');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setLoading(true);
    try {
      const result = await Api.testWebhook(id);
      if (result.success) {
        toast.success(`Test réussi (${result.statusCode}, ${result.executionTime}ms)`);
      } else {
        toast.error(`Test échoué: ${result.error}`);
      }
      loadData();
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      toast.error('Erreur lors du test');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette intégration ?')) return;
    
    setLoading(true);
    try {
      await Api.deleteIntegration(id);
      toast.success('Intégration supprimée');
      loadData();
    } catch (error: any) {
      console.error('Error deleting integration:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce webhook ?')) return;
    
    setLoading(true);
    try {
      await Api.deleteWebhook(id);
      toast.success('Webhook supprimé');
      loadData();
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const openEditIntegration = (integration: ExternalIntegration) => {
    setSelectedIntegration(integration);
    setIntegrationForm({
      integration_type: integration.integration_type,
      name: integration.name,
      provider: integration.provider,
      is_active: integration.is_active,
      config: integration.config,
      credentials: integration.credentials
    });
    setShowIntegrationModal(true);
  };

  const openEditWebhook = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setWebhookForm({
      name: webhook.name,
      url: webhook.url,
      event_type: webhook.event_type,
      http_method: webhook.http_method,
      headers: webhook.headers,
      payload_template: webhook.payload_template || undefined,
      secret_token: webhook.secret_token || undefined,
      retry_count: webhook.retry_count,
      timeout_seconds: webhook.timeout_seconds
    });
    setShowWebhookModal(true);
  };

  const getProviders = () => {
    switch (activeTab) {
      case 'accounting': return ACCOUNTING_PROVIDERS;
      case 'email': return EMAIL_PROVIDERS;
      case 'sms': return SMS_PROVIDERS;
      case 'gps': return GPS_PROVIDERS;
      case 'scale': return SCALE_PROVIDERS;
      default: return [];
    }
  };

  const getStatusBadge = (integration: ExternalIntegration) => {
    if (!integration.is_active) {
      return <span className="status-badge inactive">Inactif</span>;
    }
    if (integration.last_error) {
      return <span className="status-badge error">Erreur</span>;
    }
    return <span className="status-badge active">Actif</span>;
  };

  return (
    <div className="integrations-page">
      <div className="page-header">
        <div>
          <h1>Intégrations Externes</h1>
          <p>Configurez et gérez vos intégrations tierces</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="integrations-tabs">
        {INTEGRATION_TYPES.map(type => {
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              className={activeTab === type.value ? 'active' : ''}
              onClick={() => setActiveTab(type.value as TabType)}
            >
              <Icon size={18} />
              {type.label}
            </button>
          );
        })}
        <button
          className={activeTab === 'webhooks' ? 'active' : ''}
          onClick={() => setActiveTab('webhooks')}
        >
          <WebhookIcon size={18} />
          Webhooks
        </button>
      </div>

      {/* Content */}
      <div className="integrations-content">
        {loading && <div className="loading">Chargement...</div>}
        
        {activeTab === 'webhooks' ? (
          <div className="webhooks-section">
            <div className="section-header">
              <h2>Webhooks</h2>
              {user?.role === 'admin' && (
                <button className="btn-primary" onClick={() => {
                  setSelectedWebhook(null);
                  setWebhookForm({
                    name: '',
                    url: '',
                    event_type: 'custom',
                    http_method: 'POST',
                    headers: {},
                    secret_token: '',
                    retry_count: 3,
                    timeout_seconds: 30
                  });
                  setShowWebhookModal(true);
                }}>
                  <Plus size={18} />
                  Nouveau Webhook
                </button>
              )}
            </div>
            <div className="webhooks-grid">
              {webhooks.length === 0 ? (
                <div className="empty-state">
                  <WebhookIcon size={48} />
                  <p>Aucun webhook configuré</p>
                </div>
              ) : (
                webhooks.map(webhook => (
                  <div key={webhook.id} className="integration-card">
                    <div className="card-header">
                      <div>
                        <h3>{webhook.name}</h3>
                        <span className="webhook-url">{webhook.url}</span>
                      </div>
                      <span className={`status-badge ${webhook.is_active ? 'active' : 'inactive'}`}>
                        {webhook.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="info-row">
                        <span>Événement:</span>
                        <strong>{WEBHOOK_EVENTS.find(e => e.value === webhook.event_type)?.label || webhook.event_type}</strong>
                      </div>
                      <div className="info-row">
                        <span>Méthode:</span>
                        <strong>{webhook.http_method}</strong>
                      </div>
                      {webhook.last_triggered_at && (
                        <div className="info-row">
                          <span>Dernier déclenchement:</span>
                          <span>{format(new Date(webhook.last_triggered_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                        </div>
                      )}
                      {webhook.last_status_code && (
                        <div className="info-row">
                          <span>Dernier statut:</span>
                          <span className={webhook.last_status_code >= 200 && webhook.last_status_code < 300 ? 'success' : 'error'}>
                            {webhook.last_status_code}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="card-footer">
                      <button className="btn-icon" onClick={() => loadLogs(webhook.id, 'webhook')} title="Voir les logs">
                        <History size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => handleTestWebhook(webhook.id)} title="Tester">
                        <Play size={16} />
                      </button>
                      {user?.role === 'admin' && (
                        <>
                          <button className="btn-icon" onClick={() => openEditWebhook(webhook)} title="Modifier">
                            <Edit size={16} />
                          </button>
                          <button className="btn-icon-danger" onClick={() => handleDeleteWebhook(webhook.id)} title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="integrations-section">
            <div className="section-header">
              <h2>{INTEGRATION_TYPES.find(t => t.value === activeTab)?.label}</h2>
              {user?.role === 'admin' && (
                <button className="btn-primary" onClick={() => {
                  setSelectedIntegration(null);
                  setIntegrationForm({
                    integration_type: activeTab,
                    name: '',
                    provider: '',
                    is_active: false,
                    config: {},
                    credentials: {}
                  });
                  setShowIntegrationModal(true);
                }}>
                  <Plus size={18} />
                  Nouvelle Intégration
                </button>
              )}
            </div>
            <div className="integrations-grid">
              {integrations.length === 0 ? (
                <div className="empty-state">
                  <Settings size={48} />
                  <p>Aucune intégration configurée</p>
                </div>
              ) : (
                integrations.map(integration => (
                  <div key={integration.id} className="integration-card">
                    <div className="card-header">
                      <div>
                        <h3>{integration.name}</h3>
                        <span className="provider">{integration.provider}</span>
                      </div>
                      {getStatusBadge(integration)}
                    </div>
                    <div className="card-body">
                      {integration.last_sync_at && (
                        <div className="info-row">
                          <span>Dernière synchronisation:</span>
                          <span>{format(new Date(integration.last_sync_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                        </div>
                      )}
                      {integration.last_error && (
                        <div className="info-row error">
                          <span>Dernière erreur:</span>
                          <span className="error-text">{integration.last_error.substring(0, 100)}</span>
                        </div>
                      )}
                    </div>
                    <div className="card-footer">
                      <button className="btn-icon" onClick={() => loadLogs(integration.id, 'integration')} title="Voir les logs">
                        <History size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => handleTestIntegration(integration.id)} title="Tester">
                        <Play size={16} />
                      </button>
                      {user?.role === 'admin' && (
                        <>
                          <button className="btn-icon" onClick={() => openEditIntegration(integration)} title="Modifier">
                            <Edit size={16} />
                          </button>
                          <button className="btn-icon-danger" onClick={() => handleDeleteIntegration(integration.id)} title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Integration Modal */}
      {showIntegrationModal && (
        <div className="modal-overlay" onClick={() => setShowIntegrationModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedIntegration ? 'Modifier l\'Intégration' : 'Nouvelle Intégration'}</h2>
              <button className="btn-icon" onClick={() => setShowIntegrationModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations Générales</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Nom <span className="required-indicator">*</span></label>
                    <input
                      type="text"
                      value={integrationForm.name}
                      onChange={(e) => setIntegrationForm({ ...integrationForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Fournisseur <span className="required-indicator">*</span></label>
                    <select
                      value={integrationForm.provider}
                      onChange={(e) => setIntegrationForm({ ...integrationForm, provider: e.target.value })}
                      required
                    >
                      <option value="">Sélectionner</option>
                      {getProviders().map(provider => (
                        <option key={provider} value={provider}>{provider}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={integrationForm.is_active}
                        onChange={(e) => setIntegrationForm({ ...integrationForm, is_active: e.target.checked })}
                      />
                      Activer l'intégration
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Configuration</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group full-width">
                    <label>Configuration (JSON)</label>
                    <textarea
                      value={JSON.stringify(integrationForm.config || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const config = JSON.parse(e.target.value);
                          setIntegrationForm({ ...integrationForm, config });
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      rows={6}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Identifiants</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group full-width">
                    <label>Identifiants (JSON) - Sera chiffré</label>
                    <div className="credentials-input">
                    <textarea
                      value={JSON.stringify(integrationForm.credentials || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const credentials = JSON.parse(e.target.value);
                          setIntegrationForm({ ...integrationForm, credentials });
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      rows={6}
                      placeholder='{"api_key": "xxx", "secret": "xxx"}'
                      style={{ fontFamily: 'monospace' }}
                    />
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => setShowCredentials({
                          ...showCredentials,
                          [integrationForm.integration_type]: !showCredentials[integrationForm.integration_type]
                        })}
                      >
                        {showCredentials[integrationForm.integration_type] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowIntegrationModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleSaveIntegration} disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="modal-overlay" onClick={() => setShowWebhookModal(false)}>
          <div className="modal-panel compliance-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedWebhook ? 'Modifier le Webhook' : 'Nouveau Webhook'}</h2>
              <button className="btn-icon" onClick={() => setShowWebhookModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h3>Informations Générales</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label>Nom <span className="required-indicator">*</span></label>
                    <input
                      type="text"
                      value={webhookForm.name}
                      onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>URL <span className="required-indicator">*</span></label>
                    <input
                      type="url"
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                      required
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                  <div className="form-group">
                    <label>Événement <span className="required-indicator">*</span></label>
                    <select
                      value={webhookForm.event_type}
                      onChange={(e) => setWebhookForm({ ...webhookForm, event_type: e.target.value })}
                      required
                    >
                      {WEBHOOK_EVENTS.map(event => (
                        <option key={event.value} value={event.value}>{event.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Méthode HTTP</label>
                    <select
                      value={webhookForm.http_method}
                      onChange={(e) => setWebhookForm({ ...webhookForm, http_method: e.target.value as any })}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Token Secret (optionnel)</label>
                    <input
                      type="password"
                      value={webhookForm.secret_token || ''}
                      onChange={(e) => setWebhookForm({ ...webhookForm, secret_token: e.target.value })}
                      placeholder="Token pour authentification"
                    />
                  </div>
                  <div className="form-group">
                    <label>Nombre de tentatives</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={webhookForm.retry_count || 3}
                      onChange={(e) => setWebhookForm({ ...webhookForm, retry_count: parseInt(e.target.value) || 3 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Timeout (secondes)</label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={webhookForm.timeout_seconds || 30}
                      onChange={(e) => setWebhookForm({ ...webhookForm, timeout_seconds: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => {}}
                      />
                      Actif
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Headers (JSON optionnel)</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group full-width">
                    <textarea
                      value={JSON.stringify(webhookForm.headers || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          const headers = JSON.parse(e.target.value);
                          setWebhookForm({ ...webhookForm, headers });
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      rows={4}
                      placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowWebhookModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleSaveWebhook} disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && (
        <div className="modal-overlay" onClick={() => setShowLogsModal(false)}>
          <div className="modal-panel compliance-modal logs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Logs</h2>
              <button className="btn-icon" onClick={() => setShowLogsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {activeTab === 'webhooks' ? (
                <div className="logs-list">
                  {webhookLogs.length === 0 ? (
                    <p>Aucun log disponible</p>
                  ) : (
                    webhookLogs.map(log => (
                      <div key={log.id} className={`log-item ${log.response_status && log.response_status >= 200 && log.response_status < 300 ? 'success' : 'error'}`}>
                        <div className="log-header">
                          <span>{format(new Date(log.triggered_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}</span>
                          {log.response_status && (
                            <span className={`status-code ${log.response_status >= 200 && log.response_status < 300 ? 'success' : 'error'}`}>
                              {log.response_status}
                            </span>
                          )}
                        </div>
                        {log.error_message && (
                          <div className="log-error">{log.error_message}</div>
                        )}
                        {log.execution_time_ms && (
                          <div className="log-meta">Temps d'exécution: {log.execution_time_ms}ms</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="logs-list">
                  {integrationLogs.length === 0 ? (
                    <p>Aucun log disponible</p>
                  ) : (
                    integrationLogs.map(log => (
                      <div key={log.id} className={`log-item ${log.status}`}>
                        <div className="log-header">
                          <span>{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}</span>
                          <span className={`status-badge ${log.status}`}>
                            {log.status === 'success' ? 'Succès' : log.status === 'error' ? 'Erreur' : 'En attente'}
                          </span>
                        </div>
                        <div className="log-action">Action: {log.action}</div>
                        {log.error_message && (
                          <div className="log-error">{log.error_message}</div>
                        )}
                        {log.execution_time_ms && (
                          <div className="log-meta">Temps d'exécution: {log.execution_time_ms}ms</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowLogsModal(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

