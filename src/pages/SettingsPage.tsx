import { useEffect, useState } from 'react';
import { Key, Shield, CheckCircle, XCircle, Copy, Download, X, Save, Loader2, LogOut, Clock, MapPin, Edit2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api, type TwoFactorSetup, type UserSession, type GDPRConsent } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { SUPPORTED_LANGUAGES, TIMEZONES, type Language } from '../i18n/translations';

type TabType = 'security' | 'sessions' | 'gdpr' | 'preferences';

export const SettingsPage = () => {
  const { user, refreshUser, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [activeTab, setActiveTab] = useState<TabType>('security');
  
  // 2FA states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [loading2FA, setLoading2FA] = useState(false);
  
  // Sessions states
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // GDPR states
  const [consents, setConsents] = useState<GDPRConsent[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(false);
  
  // Preferences states
  const [preferences, setPreferences] = useState({
    language: (user as any)?.language || 'fr',
    timezone: (user as any)?.timezone || 'Europe/Zurich',
    currency: (user as any)?.currency || 'CHF',
    site_id: (user as any)?.site_id || null
  });
  const [sites, setSites] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  useEffect(() => {
    load2FAStatus();
    if (activeTab === 'sessions') {
      loadSessions();
    } else if (activeTab === 'gdpr') {
      loadConsents();
    } else if (activeTab === 'preferences') {
      loadPreferences();
    }
  }, [activeTab]);

  const load2FAStatus = async () => {
    // On vérifie si 2FA est activé en essayant de récupérer les sessions
    // Si l'utilisateur a 2FA, on peut le détecter autrement
    // Pour l'instant, on initialise à false
    setTwoFactorEnabled(false);
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await Api.fetchSessions();
      setSessions(data);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadConsents = async () => {
    setLoadingConsents(true);
    try {
      const data = await Api.fetchGDPRConsents();
      setConsents(data);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des consentements');
    } finally {
      setLoadingConsents(false);
    }
  };

  const handleSetup2FA = async () => {
    try {
      setLoading2FA(true);
      const setup = await Api.setup2FA();
      setTwoFactorSetup(setup);
      setShow2FAModal(true);
    } catch (error: any) {
      toast.error('Erreur lors de la configuration 2FA');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      toast.error('Veuillez entrer un code à 6 chiffres');
      return;
    }
    try {
      setLoading2FA(true);
      await Api.enable2FA({ code: twoFactorCode });
      toast.success('2FA activé avec succès');
      setShow2FAModal(false);
      setTwoFactorCode('');
      setTwoFactorSetup(null);
      setTwoFactorEnabled(true);
    } catch (error: any) {
      toast.error('Code 2FA invalide');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error('Veuillez entrer votre mot de passe');
      return;
    }
    try {
      setLoading2FA(true);
      await Api.disable2FA({ password: disablePassword });
      toast.success('2FA désactivé');
      setTwoFactorEnabled(false);
      setDisablePassword('');
    } catch (error: any) {
      toast.error('Mot de passe incorrect');
    } finally {
      setLoading2FA(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!confirm('Générer de nouveaux codes de secours ? Les anciens codes ne fonctionneront plus.')) return;
    try {
      const result = await Api.regenerateBackupCodes();
      if (twoFactorSetup) {
        setTwoFactorSetup({ ...twoFactorSetup, backupCodes: result.backupCodes });
      }
      toast.success('Nouveaux codes de secours générés');
    } catch (error: any) {
      toast.error('Erreur lors de la régénération des codes');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await Api.deleteSession(sessionId);
      toast.success('Session fermée');
      loadSessions();
    } catch (error: any) {
      toast.error('Erreur lors de la fermeture de la session');
    }
  };

  const handleLogoutOthers = async () => {
    if (!confirm('Fermer toutes les autres sessions ? Vous resterez connecté sur cet appareil.')) return;
    try {
      await Api.logoutOtherSessions();
      toast.success('Toutes les autres sessions ont été fermées');
      loadSessions();
    } catch (error: any) {
      toast.error('Erreur lors de la fermeture des sessions');
    }
  };

  const handleUpdateConsent = async (consentType: string, granted: boolean) => {
    try {
      await Api.updateGDPRConsent({ consent_type: consentType, granted });
      toast.success('Consentement mis à jour');
      loadConsents();
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour du consentement');
    }
  };

  const handleGDPRRequest = async (requestType: string) => {
    try {
      await Api.createGDPRRequest({ request_type: requestType, notes: '' });
      toast.success('Demande RGPD créée. Un administrateur la traitera sous peu.');
    } catch (error: any) {
      toast.error('Erreur lors de la création de la demande');
    }
  };

  const loadPreferences = async () => {
    try {
      const [sitesData, currenciesData] = await Promise.all([
        Api.fetchSites(),
        Api.fetchCurrencies()
      ]);
      setSites(sitesData);
      setCurrencies(currenciesData);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des préférences');
    }
  };

  const handleSavePreferences = async () => {
    setLoadingPreferences(true);
    try {
      await Api.updateUserPreferences(preferences);
      
      // Mettre à jour localStorage pour que le changement soit immédiat
      if (preferences.language) {
        localStorage.setItem('language', preferences.language);
      }
      
      // Recharger les données utilisateur pour mettre à jour le contexte
      await refreshUser();
      
      toast.success('Préférences enregistrées');
      
      // Recharger la page pour appliquer la nouvelle langue partout
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Erreur lors de l\'enregistrement des préférences:', error);
      toast.error('Erreur lors de l\'enregistrement des préférences');
    } finally {
      setLoadingPreferences(false);
    }
  };

  const copyBackupCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    toast.success('Codes de secours copiés');
  };

  const downloadBackupCodes = (codes: string[]) => {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codes-secours-2fa.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Codes de secours téléchargés');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Paramètres</p>
          <h1 className="page-title">Paramètres de sécurité</h1>
          <p className="page-subtitle">Gérez votre authentification, vos sessions et vos données personnelles.</p>
        </div>
      </div>

      <div className="stock-page tab-nav" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={activeTab === 'security' ? 'active' : ''}
          onClick={() => setActiveTab('security')}
        >
          <Shield size={16} />
          Sécurité
        </button>
        <button
          type="button"
          className={activeTab === 'sessions' ? 'active' : ''}
          onClick={() => setActiveTab('sessions')}
        >
          <LogOut size={16} />
          Sessions
        </button>
        <button
          type="button"
          className={activeTab === 'gdpr' ? 'active' : ''}
          onClick={() => setActiveTab('gdpr')}
        >
          <Shield size={16} />
          RGPD
        </button>
        <button
          type="button"
          className={activeTab === 'preferences' ? 'active' : ''}
          onClick={() => setActiveTab('preferences')}
        >
          <Clock size={16} />
          Préférences
        </button>
      </div>

      <div className="destruction-card">
        {activeTab === 'security' && (
          <div className="destruction-section">
            <h2 style={{ marginBottom: '24px' }}>Authentification à deux facteurs (2FA)</h2>
            
            {!isAdmin ? (
              <div style={{ padding: '24px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fbbf24' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Shield size={24} style={{ color: '#f59e0b' }} />
                  <div>
                    <p style={{ fontWeight: 600, color: '#92400e' }}>Gestion réservée aux administrateurs</p>
                    <p style={{ fontSize: '0.875rem', color: '#78350f', marginTop: '4px' }}>
                      L'activation et la désactivation de l'authentification à deux facteurs sont gérées par votre administrateur.
                      Contactez votre administrateur pour activer ou désactiver le 2FA sur votre compte.
                    </p>
                  </div>
                </div>
                {twoFactorEnabled ? (
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#dcfce7', borderRadius: '6px', border: '1px solid #86efac' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={20} style={{ color: '#16a34a' }} />
                      <p style={{ fontSize: '0.875rem', color: '#166534', fontWeight: 500 }}>
                        2FA activé sur votre compte
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <XCircle size={20} style={{ color: '#dc2626' }} />
                      <p style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: 500 }}>
                        2FA non activé sur votre compte
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : twoFactorEnabled ? (
              <div style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <CheckCircle size={24} style={{ color: '#22c55e' }} />
                  <div>
                    <p style={{ fontWeight: 600 }}>2FA activé</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Votre compte est protégé par l'authentification à deux facteurs.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleRegenerateBackupCodes}
                  >
                    <Key size={16} />
                    Régénérer les codes de secours
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const password = prompt('Entrez votre mot de passe pour désactiver le 2FA :');
                      if (password) {
                        setDisablePassword(password);
                        handleDisable2FA();
                      }
                    }}
                    style={{ color: '#ef4444' }}
                  >
                    <XCircle size={16} />
                    Désactiver 2FA
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <XCircle size={24} style={{ color: '#ef4444' }} />
                  <div>
                    <p style={{ fontWeight: 600 }}>2FA désactivé</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Activez l'authentification à deux facteurs pour renforcer la sécurité de votre compte.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSetup2FA}
                  disabled={loading2FA}
                >
                  {loading2FA ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      Activer 2FA
                    </>
                  )}
                </button>
              </div>
            )}

            {isAdmin && (
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ marginBottom: '16px' }}>Comment fonctionne le 2FA ?</h3>
                <ol style={{ paddingLeft: '24px', lineHeight: '1.8' }}>
                  <li>Téléchargez une application d'authentification (Google Authenticator, Authy, Microsoft Authenticator)</li>
                  <li>Scannez le QR code affiché lors de l'activation</li>
                  <li>Entrez le code à 6 chiffres généré par l'application pour confirmer</li>
                  <li>À chaque connexion, vous devrez entrer un code généré par l'application</li>
                  <li>Conservez les codes de secours en lieu sûr en cas de perte de votre appareil</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="destruction-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2>Sessions actives</h2>
              {sessions.length > 1 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleLogoutOthers}
                >
                  <LogOut size={16} />
                  Fermer toutes les autres sessions
                </button>
              )}
            </div>

            {loadingSessions ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader2 className="spinner" size={32} />
                <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Chargement...</p>
              </div>
            ) : sessions.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Aucune session active</p>
            ) : (
              <div className="unified-table-container">
                <table className="unified-table">
                  <thead>
                    <tr>
                      <th>Adresse IP</th>
                      <th>Appareil</th>
                      <th>Dernière activité</th>
                      <th>Expire le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MapPin size={14} />
                            {session.ip_address || '—'}
                          </div>
                        </td>
                        <td>
                          <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {session.user_agent || '—'}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={14} />
                            {format(new Date(session.last_activity), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </div>
                        </td>
                        <td>{format(new Date(session.expires_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                        <td>
                          {session.is_active && (
                            <button
                              type="button"
                              className="btn-icon text-red-600"
                              onClick={() => handleDeleteSession(session.id)}
                              title="Fermer la session"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'gdpr' && (
          <div className="destruction-section">
            <h2 style={{ marginBottom: '24px' }}>Gestion des données personnelles (RGPD)</h2>

            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '16px' }}>Consentements</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { type: 'data_processing', label: 'Traitement des données', description: 'Autoriser le traitement de vos données personnelles' },
                  { type: 'marketing', label: 'Marketing', description: 'Recevoir des communications marketing' },
                  { type: 'analytics', label: 'Analytics', description: 'Partager des données pour l\'analyse' },
                  { type: 'cookies', label: 'Cookies', description: 'Utiliser des cookies pour améliorer l\'expérience' },
                  { type: 'location', label: 'Géolocalisation', description: 'Partager votre position géographique' }
                ].map((consent) => {
                  const currentConsent = consents.find(c => c.consent_type === consent.type);
                  const granted = currentConsent?.granted || false;
                  return (
                    <div key={consent.type} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{consent.label}</p>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{consent.description}</p>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={granted}
                            onChange={(e) => handleUpdateConsent(consent.type, e.target.checked)}
                            style={{ width: 'auto' }}
                          />
                          <span style={{ fontSize: '0.875rem' }}>{granted ? 'Autorisé' : 'Refusé'}</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: '16px' }}>Demandes RGPD</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleGDPRRequest('data_export')}
                >
                  <Download size={16} />
                  Exporter mes données
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (confirm('Êtes-vous sûr de vouloir demander la suppression de toutes vos données ? Cette action est irréversible.')) {
                      handleGDPRRequest('data_deletion');
                    }
                  }}
                  style={{ color: '#ef4444' }}
                >
                  <XCircle size={16} />
                  Demander la suppression de mes données
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleGDPRRequest('data_rectification')}
                >
                  <Edit2 size={16} />
                  Demander la rectification de mes données
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleGDPRRequest('access_request')}
                >
                  <Shield size={16} />
                  Demander l'accès à mes données
                </button>
              </div>
              <p style={{ marginTop: '16px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Vos demandes seront traitées par un administrateur dans les meilleurs délais.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="destruction-section">
            <h2 style={{ marginBottom: '24px' }}>Préférences utilisateur</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="unified-form-field">
                <label htmlFor="pref-language" style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Langue
                </label>
                <select
                  id="pref-language"
                  value={preferences.language}
                  onChange={(e) => setPreferences({ ...preferences, language: e.target.value as Language })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="unified-form-field">
                <label htmlFor="pref-timezone" style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Fuseau horaire
                </label>
                <select
                  id="pref-timezone"
                  value={preferences.timezone}
                  onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="unified-form-field">
                <label htmlFor="pref-currency" style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Devise
                </label>
                <select
                  id="pref-currency"
                  value={preferences.currency}
                  onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  {currencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.name} ({curr.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="unified-form-field">
                <label htmlFor="pref-site" style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Site
                </label>
                <select
                  id="pref-site"
                  value={preferences.site_id || ''}
                  onChange={(e) => setPreferences({ ...preferences, site_id: e.target.value || null })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Aucun site</option>
                  {sites.filter(s => s.is_active).map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.code} - {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#1e3a8a',
                  lineHeight: '1.6'
                }}>
                  <strong>Note :</strong> La modification de la langue nécessitera un rechargement de la page pour être appliquée.
                </p>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '8px'
              }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSavePreferences}
                  disabled={loadingPreferences}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: loadingPreferences ? '#9ca3af' : '#3b82f6',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: loadingPreferences ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {loadingPreferences ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Enregistrer les préférences
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal 2FA Setup */}
      {show2FAModal && twoFactorSetup && (
        <div className="unified-modal-overlay" onClick={() => setShow2FAModal(false)}>
          <div className="unified-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="unified-modal-header">
              <h2>Configuration de l'authentification à deux facteurs</h2>
              <button type="button" className="btn-icon" onClick={() => setShow2FAModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="unified-modal-form">
              <div className="unified-form-section">
                <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                  1. Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)
                </p>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <img src={twoFactorSetup.qrCode} alt="QR Code 2FA" style={{ maxWidth: '250px', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }} />
                </div>
                <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                  2. Entrez le code à 6 chiffres généré par votre application pour activer le 2FA
                </p>
                <div className="unified-form-field">
                  <label htmlFor="2fa-code">Code de vérification</label>
                  <input
                    id="2fa-code"
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="unified-form-input"
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px' }}
                  />
                </div>
                <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 600, marginBottom: '12px', fontSize: '0.9rem' }}>Codes de secours</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Conservez ces codes en lieu sûr. Ils vous permettront de vous connecter si vous perdez accès à votre application d'authentification.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {twoFactorSetup.backupCodes.map((code, idx) => (
                      <code key={idx} style={{ padding: '8px', backgroundColor: 'var(--bg)', borderRadius: '4px', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                        {code}
                      </code>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => copyBackupCodes(twoFactorSetup.backupCodes)}
                      style={{ flex: 1 }}
                    >
                      <Copy size={14} />
                      Copier
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => downloadBackupCodes(twoFactorSetup.backupCodes)}
                      style={{ flex: 1 }}
                    >
                      <Download size={14} />
                      Télécharger
                    </button>
                  </div>
                </div>
              </div>
              <div className="unified-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShow2FAModal(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleEnable2FA}
                  disabled={twoFactorCode.length !== 6 || loading2FA}
                >
                  {loading2FA ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      Activation...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Activer 2FA
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

