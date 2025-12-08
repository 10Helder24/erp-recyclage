import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Loader2, Search, X, Save, Globe, DollarSign, Building2, MapPin, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { TIMEZONES } from '../i18n/translations';

type Site = {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SiteForm = {
  code: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: string;
  longitude: string;
  timezone: string;
  currency: string;
};

type CurrencyForm = {
  code: string;
  name: string;
  symbol: string;
  exchange_rate: string;
  is_base: boolean;
};

const DEFAULT_SITE_FORM: SiteForm = {
  code: '',
  name: '',
  address: '',
  city: '',
  postal_code: '',
  country: 'CH',
  latitude: '',
  longitude: '',
  timezone: 'Europe/Zurich',
  currency: 'CHF'
};

const DEFAULT_CURRENCY_FORM: CurrencyForm = {
  code: '',
  name: '',
  symbol: '',
  exchange_rate: '1.0',
  is_base: false
};

export const MultiSitesPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [activeTab, setActiveTab] = useState<'sites' | 'currencies'>('sites');
  const [sites, setSites] = useState<Site[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sites
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteForm, setSiteForm] = useState<SiteForm>(DEFAULT_SITE_FORM);
  const [savingSite, setSavingSite] = useState(false);
  
  // Currencies
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [currencyForm, setCurrencyForm] = useState<CurrencyForm>(DEFAULT_CURRENCY_FORM);
  const [savingCurrency, setSavingCurrency] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sites') {
        const data = await Api.fetchSites();
        setSites(data);
      } else {
        const data = await Api.fetchCurrencies();
        setCurrencies(data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const filteredSites = sites.filter(
    (site) =>
      site.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCurrencies = currencies.filter(
    (currency) =>
      currency.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      currency.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreateSiteModal = () => {
    setEditingSite(null);
    setSiteForm(DEFAULT_SITE_FORM);
    setShowSiteModal(true);
  };

  const openEditSiteModal = (site: Site) => {
    setEditingSite(site);
    setSiteForm({
      code: site.code,
      name: site.name,
      address: site.address || '',
      city: site.city || '',
      postal_code: site.postal_code || '',
      country: site.country || 'CH',
      latitude: site.latitude?.toString() || '',
      longitude: site.longitude?.toString() || '',
      timezone: site.timezone,
      currency: site.currency
    });
    setShowSiteModal(true);
  };

  const handleSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    try {
      if (editingSite) {
        await Api.updateSite(editingSite.id, {
          code: siteForm.code,
          name: siteForm.name,
          address: siteForm.address || undefined,
          city: siteForm.city || undefined,
          postal_code: siteForm.postal_code || undefined,
          country: siteForm.country,
          latitude: siteForm.latitude ? parseFloat(siteForm.latitude) : undefined,
          longitude: siteForm.longitude ? parseFloat(siteForm.longitude) : undefined,
          timezone: siteForm.timezone,
          currency: siteForm.currency
        });
        toast.success('Site mis à jour');
      } else {
        await Api.createSite({
          code: siteForm.code,
          name: siteForm.name,
          address: siteForm.address || undefined,
          city: siteForm.city || undefined,
          postal_code: siteForm.postal_code || undefined,
          country: siteForm.country,
          latitude: siteForm.latitude ? parseFloat(siteForm.latitude) : undefined,
          longitude: siteForm.longitude ? parseFloat(siteForm.longitude) : undefined,
          timezone: siteForm.timezone,
          currency: siteForm.currency
        });
        toast.success('Site créé');
      }
      setShowSiteModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingSite(false);
    }
  };

  const handleDeleteSite = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce site ?')) return;
    try {
      await Api.deleteSite(id);
      toast.success('Site supprimé');
      loadData();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const openCreateCurrencyModal = () => {
    setEditingCurrency(null);
    setCurrencyForm(DEFAULT_CURRENCY_FORM);
    setShowCurrencyModal(true);
  };

  const openEditCurrencyModal = (currency: Currency) => {
    setEditingCurrency(currency);
    setCurrencyForm({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchange_rate: currency.exchange_rate.toString(),
      is_base: currency.is_base
    });
    setShowCurrencyModal(true);
  };

  const handleCurrencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCurrency(true);
    try {
      if (editingCurrency) {
        await Api.updateCurrency(editingCurrency.id, {
          code: currencyForm.code,
          name: currencyForm.name,
          symbol: currencyForm.symbol,
          exchange_rate: parseFloat(currencyForm.exchange_rate),
          is_base: currencyForm.is_base
        });
        toast.success('Devise mise à jour');
      } else {
        await Api.createCurrency({
          code: currencyForm.code,
          name: currencyForm.name,
          symbol: currencyForm.symbol,
          exchange_rate: parseFloat(currencyForm.exchange_rate),
          is_base: currencyForm.is_base
        });
        toast.success('Devise créée');
      }
      setShowCurrencyModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingCurrency(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Gestion multi-sites</h1>
        </div>
        <div className="page-content">
          <p>Vous n'avez pas accès à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="page-title">Gestion multi-sites et devises</h1>
          <p className="page-subtitle">Gérez les sites, devises et consolidations pour l'expansion internationale.</p>
        </div>
        {activeTab === 'sites' ? (
          <button type="button" className="btn-primary" onClick={openCreateSiteModal}>
            <Plus size={16} />
            Nouveau site
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={openCreateCurrencyModal}>
            <Plus size={16} />
            Nouvelle devise
          </button>
        )}
      </div>

      <div className="stock-page tab-nav" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={activeTab === 'sites' ? 'active' : ''}
          onClick={() => setActiveTab('sites')}
        >
          <Building2 size={16} />
          Sites
        </button>
        <button
          type="button"
          className={activeTab === 'currencies' ? 'active' : ''}
          onClick={() => setActiveTab('currencies')}
        >
          <DollarSign size={16} />
          Devises
        </button>
      </div>

      <div className="destruction-card">
        <div className="destruction-section">
          <div style={{ marginBottom: '20px' }}>
            <div className="map-input" style={{ maxWidth: '400px' }}>
              <Search size={16} />
              <input
                type="text"
                placeholder={`Rechercher ${activeTab === 'sites' ? 'un site' : 'une devise'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 className="spinner" size={32} />
              <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Chargement...</p>
            </div>
          ) : activeTab === 'sites' ? (
            filteredSites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <p>Aucun site trouvé</p>
              </div>
            ) : (
              <div className="unified-table-container">
                <table className="unified-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Nom</th>
                      <th>Ville</th>
                      <th>Pays</th>
                      <th>Fuseau horaire</th>
                      <th>Devise</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSites.map((site) => (
                      <tr key={site.id}>
                        <td><strong>{site.code}</strong></td>
                        <td>{site.name}</td>
                        <td>{site.city || '—'}</td>
                        <td>{site.country || '—'}</td>
                        <td>{site.timezone}</td>
                        <td>{site.currency}</td>
                        <td>
                          {site.is_active ? (
                            <span className="badge badge-success">Actif</span>
                          ) : (
                            <span className="badge badge-secondary">Inactif</span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => openEditSiteModal(site)}
                              title="Modifier"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon text-red-600"
                              onClick={() => handleDeleteSite(site.id)}
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            filteredCurrencies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <p>Aucune devise trouvée</p>
              </div>
            ) : (
              <div className="unified-table-container">
                <table className="unified-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Nom</th>
                      <th>Symbole</th>
                      <th>Taux de change</th>
                      <th>Devise de base</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCurrencies.map((currency) => (
                      <tr key={currency.id}>
                        <td><strong>{currency.code}</strong></td>
                        <td>{currency.name}</td>
                        <td>{currency.symbol}</td>
                        <td>{typeof currency.exchange_rate === 'number' ? currency.exchange_rate.toFixed(4) : parseFloat(currency.exchange_rate || '0').toFixed(4)}</td>
                        <td>
                          {currency.is_base ? (
                            <span className="badge badge-success">Oui</span>
                          ) : (
                            <span className="badge badge-secondary">Non</span>
                          )}
                        </td>
                        <td>
                          {currency.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-secondary">Inactive</span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => openEditCurrencyModal(currency)}
                              title="Modifier"
                            >
                              <Edit2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal Site */}
      {showSiteModal && (
        <div 
          className="modal-backdrop" 
          onClick={() => setShowSiteModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          <div 
            className="modal-panel unified-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#111827',
                margin: 0
              }}>
                {editingSite ? 'Modifier le site' : 'Nouveau site'}
              </h2>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => setShowSiteModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ×
              </button>
            </div>
            
            <form 
              onSubmit={handleSiteSubmit} 
              className="modal-body"
              style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              <div className="form-grid-2-cols" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '20px',
                marginBottom: '24px'
              }}>
                <div className="form-group">
                  <label htmlFor="site-code" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Code <span className="required-indicator" style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="site-code"
                    type="text"
                    value={siteForm.code}
                    onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value.toUpperCase() })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="site-name" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Nom <span className="required-indicator" style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="site-name"
                    type="text"
                    value={siteForm.name}
                    onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="site-address" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Adresse
                  </label>
                  <input
                    id="site-address"
                    type="text"
                    value={siteForm.address}
                    onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="site-city" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Ville
                  </label>
                  <input
                    id="site-city"
                    type="text"
                    value={siteForm.city}
                    onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="site-postal-code" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Code postal
                  </label>
                  <input
                    id="site-postal-code"
                    type="text"
                    value={siteForm.postal_code}
                    onChange={(e) => setSiteForm({ ...siteForm, postal_code: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="site-country" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Pays
                  </label>
                  <input
                    id="site-country"
                    type="text"
                    value={siteForm.country}
                    onChange={(e) => setSiteForm({ ...siteForm, country: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="site-timezone" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Fuseau horaire
                  </label>
                  <select
                    id="site-timezone"
                    value={siteForm.timezone}
                    onChange={(e) => setSiteForm({ ...siteForm, timezone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="site-currency" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Devise
                  </label>
                  <select
                    id="site-currency"
                    value={siteForm.currency}
                    onChange={(e) => setSiteForm({ ...siteForm, currency: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {currencies.filter(c => c.is_active).map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.symbol} {curr.name} ({curr.code})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="site-latitude" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Latitude
                  </label>
                  <input
                    id="site-latitude"
                    type="number"
                    step="any"
                    value={siteForm.latitude}
                    onChange={(e) => setSiteForm({ ...siteForm, latitude: e.target.value })}
                    placeholder="46.548452"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="site-longitude" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Longitude
                  </label>
                  <input
                    id="site-longitude"
                    type="number"
                    step="any"
                    value={siteForm.longitude}
                    onChange={(e) => setSiteForm({ ...siteForm, longitude: e.target.value })}
                    placeholder="6.572221"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>
              
              <div className="modal-footer" style={{
                padding: '24px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: '#f9fafb',
                marginTop: 'auto'
              }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setShowSiteModal(false)} 
                  disabled={savingSite}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: savingSite ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={savingSite}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: savingSite ? '#9ca3af' : '#3b82f6',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: savingSite ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {savingSite ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingSite ? 'Mettre à jour' : 'Créer'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Currency */}
      {showCurrencyModal && (
        <div 
          className="modal-backdrop" 
          onClick={() => setShowCurrencyModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          <div 
            className="modal-panel unified-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#111827',
                margin: 0
              }}>
                {editingCurrency ? 'Modifier la devise' : 'Nouvelle devise'}
              </h2>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => setShowCurrencyModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ×
              </button>
            </div>
            
            <form 
              onSubmit={handleCurrencySubmit} 
              className="modal-body"
              style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              <div className="form-grid-2-cols" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '20px',
                marginBottom: '24px'
              }}>
                <div className="form-group">
                  <label htmlFor="currency-code" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Code <span className="required-indicator" style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="currency-code"
                    type="text"
                    value={currencyForm.code}
                    onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
                    required
                    maxLength={3}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="currency-symbol" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Symbole <span className="required-indicator" style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="currency-symbol"
                    type="text"
                    value={currencyForm.symbol}
                    onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                    required
                    maxLength={5}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="currency-name" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Nom <span className="required-indicator" style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="currency-name"
                    type="text"
                    value={currencyForm.name}
                    onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="currency-rate" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Taux de change
                  </label>
                  <input
                    id="currency-rate"
                    type="number"
                    step="0.0001"
                    value={currencyForm.exchange_rate}
                    onChange={(e) => setCurrencyForm({ ...currencyForm, exchange_rate: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                
                <div className="form-group" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  paddingTop: '28px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: '#374151'
                  }}>
                    <input
                      type="checkbox"
                      checked={currencyForm.is_base}
                      onChange={(e) => setCurrencyForm({ ...currencyForm, is_base: e.target.checked })}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#3b82f6'
                      }}
                    />
                    <span>Devise de base</span>
                  </label>
                </div>
              </div>
              
              <div className="modal-footer" style={{
                padding: '24px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: '#f9fafb',
                marginTop: 'auto'
              }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setShowCurrencyModal(false)} 
                  disabled={savingCurrency}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: savingCurrency ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={savingCurrency}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: savingCurrency ? '#9ca3af' : '#3b82f6',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: savingCurrency ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {savingCurrency ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingCurrency ? 'Mettre à jour' : 'Créer'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

