import { useEffect, useState } from 'react';
import {
  Shield,
  Mail,
  MessageSquare,
  Bell,
  BellOff,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
  Settings,
  Plus,
  Trash2,
  Edit,
  X,
  type LucideIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Api, type NotificationPreference, type AlertCategoryRecipient, type CreateAlertCategoryRecipientPayload } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { AuthUser } from '../types/auth';

type AlertCategory = 'security' | 'operational' | 'financial' | 'hr';
type NotificationType = 'email' | 'sms' | 'push' | 'in_app';
type RecipientType = 'email' | 'phone' | 'role' | 'department' | 'user';

const ALERT_CATEGORIES: Array<{ value: AlertCategory; label: string; Icon: LucideIcon; description: string }> = [
  {
    value: 'security',
    label: 'Sécurité',
    Icon: Shield,
    description: 'Tentatives de connexion suspectes, accès non autorisés, violations de sécurité'
  },
  {
    value: 'operational',
    label: 'Opérationnel',
    Icon: AlertCircle,
    description: 'Stocks faibles, véhicules en retard, problèmes opérationnels'
  },
  {
    value: 'financial',
    label: 'Financier',
    Icon: AlertCircle,
    description: 'Factures impayées, seuils financiers dépassés, alertes comptables'
  },
  {
    value: 'hr',
    label: 'RH',
    Icon: AlertCircle,
    description: 'Absences, demandes en attente, alertes ressources humaines'
  }
];

const NOTIFICATION_TYPES: Array<{ value: NotificationType; label: string; Icon: LucideIcon; description: string }> = [
  {
    value: 'email',
    label: 'Email',
    Icon: Mail,
    description: 'Recevoir les alertes par email'
  },
  {
    value: 'sms',
    label: 'SMS',
    Icon: MessageSquare,
    description: 'Recevoir les alertes par SMS'
  },
  {
    value: 'push',
    label: 'Notification Push',
    Icon: Bell,
    description: 'Recevoir les notifications push sur votre appareil'
  },
  {
    value: 'in_app',
    label: 'Dans l\'application',
    Icon: Bell,
    description: 'Afficher les alertes dans l\'application'
  }
];

const RECIPIENT_TYPES: Array<{ value: RecipientType; label: string; description: string }> = [
  { value: 'email', label: 'Email', description: 'Adresse email spécifique' },
  { value: 'phone', label: 'Téléphone', description: 'Numéro de téléphone spécifique' },
  { value: 'role', label: 'Rôle', description: 'Tous les utilisateurs avec ce rôle (admin, manager, user)' },
  { value: 'department', label: 'Département', description: 'Tous les utilisateurs de ce département' },
  { value: 'user', label: 'Utilisateur', description: 'Utilisateur spécifique par ID' }
];

export const SecurityAlertsSettingsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'preferences' | 'recipients'>('preferences');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, Record<string, boolean>>>({});
  
  // Recipients state
  const [recipients, setRecipients] = useState<AlertCategoryRecipient[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<AlertCategoryRecipient | null>(null);
  const [recipientForm, setRecipientForm] = useState<CreateAlertCategoryRecipientPayload>({
    alert_category: 'operational',
    recipient_type: 'email',
    recipient_value: '',
    notification_types: ['in_app'],
    enabled: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadPreferences(), loadRecipients(), loadUsers()]);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const data = await Api.fetchNotificationPreferences();
      const prefsMap: Record<string, Record<string, boolean>> = {};
      ALERT_CATEGORIES.forEach((category) => {
        prefsMap[category.value] = {};
        NOTIFICATION_TYPES.forEach((type) => {
          const pref = data.find(
            (p) => p.alert_category === category.value && p.notification_type === type.value
          );
          prefsMap[category.value][type.value] = pref ? pref.enabled : true;
        });
      });
      setPreferences(prefsMap);
    } catch (error: any) {
      console.error('Erreur chargement préférences:', error);
      toast.error('Erreur lors du chargement des préférences');
    }
  };

  const loadRecipients = async () => {
    try {
      const data = await Api.fetchAlertCategoryRecipients();
      setRecipients(data);
    } catch (error: any) {
      console.error('Erreur chargement destinataires:', error);
      toast.error('Erreur lors du chargement des destinataires');
    }
  };

  const loadUsers = async () => {
    try {
      const data = await Api.fetchUsers();
      setUsers(data);
    } catch (error: any) {
      console.error('Erreur chargement utilisateurs:', error);
    }
  };

  const handleToggle = (category: AlertCategory, type: NotificationType) => {
    setPreferences((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: !prev[category]?.[type]
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const prefsToSave: Array<{ alert_category: string; notification_type: string; enabled: boolean }> = [];
      ALERT_CATEGORIES.forEach((category) => {
        NOTIFICATION_TYPES.forEach((type) => {
          const enabled = preferences[category.value]?.[type.value] ?? true;
          prefsToSave.push({
            alert_category: category.value,
            notification_type: type.value,
            enabled
          });
        });
      });
      await Api.updateNotificationPreferences(prefsToSave);
      toast.success('Préférences sauvegardées avec succès');
    } catch (error: any) {
      console.error('Erreur sauvegarde préférences:', error);
      toast.error('Erreur lors de la sauvegarde des préférences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaultPrefs: Record<string, Record<string, boolean>> = {};
    ALERT_CATEGORIES.forEach((category) => {
      defaultPrefs[category.value] = {};
      NOTIFICATION_TYPES.forEach((type) => {
        defaultPrefs[category.value][type.value] = true;
      });
    });
    setPreferences(defaultPrefs);
  };

  const openAddRecipient = (category?: AlertCategory) => {
    setEditingRecipient(null);
    setRecipientForm({
      alert_category: category || 'operational',
      recipient_type: 'email',
      recipient_value: '',
      notification_types: ['in_app'],
      enabled: true
    });
    setShowRecipientModal(true);
  };

  const openEditRecipient = (recipient: AlertCategoryRecipient) => {
    setEditingRecipient(recipient);
    setRecipientForm({
      alert_category: recipient.alert_category,
      recipient_type: recipient.recipient_type,
      recipient_value: recipient.recipient_value,
      notification_types: recipient.notification_types,
      enabled: recipient.enabled
    });
    setShowRecipientModal(true);
  };

  const handleSaveRecipient = async () => {
    try {
      if (!recipientForm.recipient_value.trim()) {
        toast.error('Veuillez remplir la valeur du destinataire');
        return;
      }
      if (editingRecipient) {
        await Api.updateAlertCategoryRecipient(editingRecipient.id, {
          notification_types: recipientForm.notification_types,
          enabled: recipientForm.enabled
        });
        toast.success('Destinataire mis à jour');
      } else {
        await Api.createAlertCategoryRecipient(recipientForm);
        toast.success('Destinataire ajouté');
      }
      setShowRecipientModal(false);
      loadRecipients();
    } catch (error: any) {
      console.error('Erreur sauvegarde destinataire:', error);
      toast.error('Erreur lors de la sauvegarde du destinataire');
    }
  };

  const handleDeleteRecipient = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce destinataire ?')) return;
    try {
      await Api.deleteAlertCategoryRecipient(id);
      toast.success('Destinataire supprimé');
      loadRecipients();
    } catch (error: any) {
      console.error('Erreur suppression destinataire:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getRecipientLabel = (recipient: AlertCategoryRecipient) => {
    if (recipient.recipient_type === 'role') {
      return `Rôle: ${recipient.recipient_value}`;
    } else if (recipient.recipient_type === 'department') {
      return `Département: ${recipient.recipient_value}`;
    } else if (recipient.recipient_type === 'user') {
      const user = users.find((u) => u.id === recipient.recipient_value);
      return user ? `Utilisateur: ${user.full_name || user.email}` : `Utilisateur: ${recipient.recipient_value}`;
    }
    return `${recipient.recipient_type === 'email' ? 'Email' : 'Téléphone'}: ${recipient.recipient_value}`;
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="spinner" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container security-alerts-settings-page">
      <div className="page-header">
        <div>
          <h1>Alertes Sécurité</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configurez les alertes et leurs destinataires
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="security-alerts-tabs">
        <button
          className={`security-alerts-tab ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          <Settings size={18} />
          Mes Préférences
        </button>
        <button
          className={`security-alerts-tab ${activeTab === 'recipients' ? 'active' : ''}`}
          onClick={() => setActiveTab('recipients')}
        >
          <Users size={18} />
          Destinataires par Catégorie
        </button>
      </div>

      {activeTab === 'preferences' && (
        <>
          <div className="security-alerts-settings-content">
            {ALERT_CATEGORIES.map((category) => {
              const CategoryIcon = category.Icon;
              return (
                <div key={category.value} className="security-alerts-category-card">
                  <div className="security-alerts-category-header">
                    <div className="security-alerts-category-icon">
                      <CategoryIcon size={20} />
                    </div>
                    <div className="security-alerts-category-info">
                      <h3 className="security-alerts-category-title">{category.label}</h3>
                      <p className="security-alerts-category-description">{category.description}</p>
                    </div>
                  </div>
                  
                  <div className="security-alerts-notifications-grid">
                    {NOTIFICATION_TYPES.map((type) => {
                      const TypeIcon = type.Icon;
                      const enabled = preferences[category.value]?.[type.value] ?? true;
                      return (
                        <div
                          key={type.value}
                          className={`security-alerts-notification-item ${enabled ? 'enabled' : 'disabled'}`}
                          onClick={() => handleToggle(category.value, type.value)}
                        >
                          <div className="security-alerts-notification-icon">
                            <TypeIcon size={18} />
                          </div>
                          <div className="security-alerts-notification-content">
                            <label className="security-alerts-notification-label">{type.label}</label>
                            <p className="security-alerts-notification-desc">{type.description}</p>
                          </div>
                          <div className="security-alerts-toggle">
                            <div className={`security-alerts-toggle-switch ${enabled ? 'active' : ''}`}>
                              {enabled ? <CheckCircle size={16} /> : <BellOff size={16} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="security-alerts-actions">
            <button onClick={handleReset} className="btn-secondary">
              Réinitialiser
            </button>
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </>
      )}

      {activeTab === 'recipients' && (
        <div className="security-alerts-recipients-content">
          {ALERT_CATEGORIES.map((category) => {
            const CategoryIcon = category.Icon;
            const categoryRecipients = recipients.filter((r) => r.alert_category === category.value);
            return (
              <div key={category.value} className="security-alerts-recipients-category">
                <div className="security-alerts-recipients-category-header">
                  <div className="security-alerts-recipients-category-icon">
                    <CategoryIcon size={20} />
                  </div>
                  <div className="security-alerts-recipients-category-info">
                    <h3>{category.label}</h3>
                    <p>{category.description}</p>
                  </div>
                  <button
                    onClick={() => openAddRecipient(category.value)}
                    className="btn-icon btn-primary"
                    title="Ajouter un destinataire"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {categoryRecipients.length === 0 ? (
                  <div className="security-alerts-recipients-empty">
                    <p>Aucun destinataire configuré</p>
                    <button onClick={() => openAddRecipient(category.value)} className="btn-secondary">
                      <Plus size={16} />
                      Ajouter un destinataire
                    </button>
                  </div>
                ) : (
                  <div className="security-alerts-recipients-list">
                    {categoryRecipients.map((recipient) => (
                      <div key={recipient.id} className="security-alerts-recipient-item">
                        <div className="security-alerts-recipient-info">
                          <div className="security-alerts-recipient-label">{getRecipientLabel(recipient)}</div>
                          <div className="security-alerts-recipient-types">
                            {recipient.notification_types.map((type) => (
                              <span key={type} className="security-alerts-recipient-badge">
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="security-alerts-recipient-actions">
                          <span className={`security-alerts-recipient-status ${recipient.enabled ? 'enabled' : 'disabled'}`}>
                            {recipient.enabled ? 'Actif' : 'Inactif'}
                          </span>
                          <button
                            onClick={() => openEditRecipient(recipient)}
                            className="btn-icon"
                            title="Modifier"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRecipient(recipient.id)}
                            className="btn-icon btn-icon-danger"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recipient Modal */}
      {showRecipientModal && (
        <div className="modal-overlay" onClick={() => setShowRecipientModal(false)}>
          <div className="modal-content security-alerts-recipient-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRecipient ? 'Modifier le destinataire' : 'Nouveau destinataire'}</h2>
              <button onClick={() => setShowRecipientModal(false)} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Catégorie d'alerte</label>
                <select
                  value={recipientForm.alert_category}
                  onChange={(e) => setRecipientForm({ ...recipientForm, alert_category: e.target.value as AlertCategory })}
                  disabled={!!editingRecipient}
                >
                  {ALERT_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Type de destinataire</label>
                <select
                  value={recipientForm.recipient_type}
                  onChange={(e) => setRecipientForm({ ...recipientForm, recipient_type: e.target.value as RecipientType, recipient_value: '' })}
                  disabled={!!editingRecipient}
                >
                  {RECIPIENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <small>{RECIPIENT_TYPES.find((t) => t.value === recipientForm.recipient_type)?.description}</small>
              </div>
              <div className="form-group">
                <label>
                  {recipientForm.recipient_type === 'email' ? 'Adresse email' :
                   recipientForm.recipient_type === 'phone' ? 'Numéro de téléphone' :
                   recipientForm.recipient_type === 'role' ? 'Rôle (admin, manager, user)' :
                   recipientForm.recipient_type === 'department' ? 'Nom du département' :
                   'ID utilisateur'}
                </label>
                {recipientForm.recipient_type === 'user' ? (
                  <select
                    value={recipientForm.recipient_value}
                    onChange={(e) => setRecipientForm({ ...recipientForm, recipient_value: e.target.value })}
                    disabled={!!editingRecipient}
                  >
                    <option value="">Sélectionner un utilisateur</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={recipientForm.recipient_type === 'email' ? 'email' : 'text'}
                    value={recipientForm.recipient_value}
                    onChange={(e) => setRecipientForm({ ...recipientForm, recipient_value: e.target.value })}
                    disabled={!!editingRecipient}
                    placeholder={
                      recipientForm.recipient_type === 'email' ? 'exemple@retripa.com' :
                      recipientForm.recipient_type === 'phone' ? '+41 XX XXX XX XX' :
                      recipientForm.recipient_type === 'role' ? 'admin, manager ou user' :
                      'Nom du département'
                    }
                  />
                )}
              </div>
              <div className="form-group">
                <label>Types de notifications</label>
                <div className="security-alerts-notification-types-checkboxes">
                  {NOTIFICATION_TYPES.map((type) => (
                    <label key={type.value} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={recipientForm.notification_types?.includes(type.value)}
                        onChange={(e) => {
                          const types = recipientForm.notification_types || [];
                          if (e.target.checked) {
                            setRecipientForm({ ...recipientForm, notification_types: [...types, type.value] });
                          } else {
                            setRecipientForm({ ...recipientForm, notification_types: types.filter((t) => t !== type.value) });
                          }
                        }}
                      />
                      <span>{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={recipientForm.enabled}
                    onChange={(e) => setRecipientForm({ ...recipientForm, enabled: e.target.checked })}
                  />
                  <span>Activer ce destinataire</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowRecipientModal(false)} className="btn-secondary">
                Annuler
              </button>
              <button onClick={handleSaveRecipient} className="btn-primary">
                <Save size={16} />
                {editingRecipient ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="security-alerts-settings-footer">
        <div className="security-alerts-info-box">
          <AlertCircle size={20} />
          <div>
            <p className="security-alerts-info-title">Comment ça fonctionne ?</p>
            <p className="security-alerts-info-text">
              <strong>Mes Préférences :</strong> Configurez comment vous souhaitez recevoir les alertes (email, SMS, push, in-app).
              <br />
              <strong>Destinataires par Catégorie :</strong> Configurez qui doit recevoir automatiquement les alertes selon leur catégorie.
              Par exemple, les alertes financières peuvent être envoyées au responsable comptable, et les alertes opérationnelles aux managers Logistique et Exploitation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
