import { useEffect, useState } from 'react';
import { Plus, MapPin, Shield, Edit2, Trash2, Search, Loader2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

import { Api, type Customer } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../context/I18nContext';
import CustomerDetailPage from './CustomerDetailPage';

type CustomerForm = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  risk_level: string;
};

const DEFAULT_FORM: CustomerForm = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  risk_level: ''
};

export const CustomersPage = () => {
  const { hasRole, hasPermission } = useAuth();
  const { t } = useI18n();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager || hasPermission('edit_customers');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(DEFAULT_FORM);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchCustomers();
      setCustomers(data);
    } catch (error) {
      console.error(error);
      toast.error(t('customers.error.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setEditingCustomer(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      address: customer.address || '',
      latitude: customer.latitude?.toString() || '',
      longitude: customer.longitude?.toString() || '',
      risk_level: customer.risk_level || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('customers.error.nameRequired'));
      return;
    }

    try {
      if (editingCustomer) {
        await Api.updateCustomer(editingCustomer.id, {
          name: form.name,
          address: form.address || undefined,
          latitude: form.latitude ? parseFloat(form.latitude) : undefined,
          longitude: form.longitude ? parseFloat(form.longitude) : undefined,
          risk_level: form.risk_level || undefined
        });
        toast.success(t('customers.success.update'));
      } else {
        await Api.createCustomer({
          name: form.name,
          address: form.address || undefined,
          latitude: form.latitude ? parseFloat(form.latitude) : undefined,
          longitude: form.longitude ? parseFloat(form.longitude) : undefined,
          risk_level: form.risk_level || undefined
        });
        toast.success(t('customers.success.create'));
      }
      setShowModal(false);
      loadCustomers();
    } catch (error) {
      console.error(error);
      toast.error(t('customers.error.save'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('customers.confirm.delete'))) return;
    try {
      await Api.deleteCustomer(id);
      toast.success(t('customers.success.delete'));
      loadCustomers();
    } catch (error) {
      console.error(error);
      toast.error(t('customers.error.delete'));
    }
  };

  const getRiskColor = (risk?: string | null) => {
    if (!risk) return '';
    const level = risk.toLowerCase();
    if (level === 'high' || level === 'urgent') return '#ef4444';
    if (level === 'sensitive' || level === 'medium') return '#f97316';
    return '#3b82f6';
  };

  const getRiskLabel = (risk?: string | null) => {
    if (!risk) return t('customers.risk.normal');
    const level = risk.toLowerCase();
    if (level === 'high') return t('customers.risk.high');
    if (level === 'sensitive') return t('customers.risk.sensitive');
    if (level === 'urgent') return t('customers.risk.urgent');
    if (level === 'medium') return t('customers.risk.medium');
    if (level === 'low') return t('customers.risk.low');
    return risk;
  };

  return (
    <section className="destruction-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t('customers.section')}</p>
          <h1 className="page-title">{t('customers.title')}</h1>
          <p className="page-subtitle">{t('customers.subtitle')}</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            {t('customers.add')}
          </button>
        )}
      </div>

      <div className="destruction-card">
        <div className="destruction-section">
          <div style={{ marginBottom: '20px' }}>
            <div className="map-input" style={{ maxWidth: '400px' }}>
              <Search size={16} />
              <input
                type="text"
                placeholder={t('customers.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 className="spinner" size={32} />
              <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>{t('common.loading')}</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>{t('customers.empty')}</p>
            </div>
          ) : (
            <div className="employees-grid">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="employee-card">
                  <div className="employee-card-header">
                    <div>
                      <h3>{customer.name}</h3>
                      {customer.risk_level && (
                        <span
                          className="tag"
                          style={{
                            backgroundColor: getRiskColor(customer.risk_level),
                            color: '#fff',
                            marginTop: '8px'
                          }}
                        >
                          <Shield size={12} style={{ marginRight: '4px' }} />
                          {getRiskLabel(customer.risk_level)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-small"
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        <Eye size={14} />
                    {t('customers.detail')}
                      </button>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => openEditModal(customer)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => handleDelete(customer.id)}
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="employee-info">
                    {customer.address && (
                      <div className="info-row">
                        <MapPin size={16} />
                        <span>{customer.address}</span>
                      </div>
                    )}
                    {customer.latitude && customer.longitude && (
                      <div className="info-row">
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {t('customers.coordinates')}: {customer.latitude.toFixed(6)}, {customer.longitude.toFixed(6)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal création/édition */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel unified-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCustomer ? t('customers.editTitle') : t('customers.createTitle')}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="customer-name">
                    {t('customers.fields.name')} <span className="required-indicator">*</span>
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="customer-address">{t('customers.fields.address')}</label>
                  <input
                    id="customer-address"
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder={t('customers.placeholders.address')}
                  />
                </div>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label htmlFor="customer-latitude">{t('customers.fields.latitude')}</label>
                    <input
                      id="customer-latitude"
                      type="number"
                      step="any"
                      value={form.latitude}
                      onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                    placeholder={t('customers.placeholders.latitude')}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="customer-longitude">{t('customers.fields.longitude')}</label>
                    <input
                      id="customer-longitude"
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                    placeholder={t('customers.placeholders.longitude')}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="customer-risk-level">{t('customers.fields.risk')}</label>
                  <select
                    id="customer-risk-level"
                    value={form.risk_level}
                    onChange={(e) => setForm((prev) => ({ ...prev, risk_level: e.target.value }))}
                  >
                    <option value="">{t('customers.risk.normal')}</option>
                    <option value="low">{t('customers.risk.low')}</option>
                    <option value="medium">{t('customers.risk.medium')}</option>
                    <option value="sensitive">{t('customers.risk.sensitive')}</option>
                    <option value="high">{t('customers.risk.high')}</option>
                    <option value="urgent">{t('customers.risk.urgent')}</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? t('common.edit') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomerId && (
        <CustomerDetailPage customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />
      )}
    </section>
  );
};

export default CustomersPage;

