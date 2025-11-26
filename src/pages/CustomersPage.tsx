import { useEffect, useState } from 'react';
import { Plus, MapPin, Shield, Edit2, Trash2, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Api, type Customer } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

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
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(DEFAULT_FORM);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchCustomers();
      setCustomers(data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des clients');
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
      toast.error('Le nom du client est requis');
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
        toast.success('Client mis à jour avec succès');
      } else {
        await Api.createCustomer({
          name: form.name,
          address: form.address || undefined,
          latitude: form.latitude ? parseFloat(form.latitude) : undefined,
          longitude: form.longitude ? parseFloat(form.longitude) : undefined,
          risk_level: form.risk_level || undefined
        });
        toast.success('Client créé avec succès');
      }
      setShowModal(false);
      loadCustomers();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;
    try {
      await Api.deleteCustomer(id);
      toast.success('Client supprimé avec succès');
      loadCustomers();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
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
    if (!risk) return 'Normal';
    const level = risk.toLowerCase();
    if (level === 'high') return 'Élevé';
    if (level === 'sensitive') return 'Sensible';
    if (level === 'urgent') return 'Urgent';
    if (level === 'medium') return 'Moyen';
    if (level === 'low') return 'Faible';
    return risk;
  };

  return (
    <section className="destruction-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Gestion</p>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Gérez vos clients, leurs adresses et niveaux de risque.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            Ajouter un client
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
                placeholder="Rechercher un client..."
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
          ) : filteredCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>Aucun client trouvé</p>
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
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '8px' }}>
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
                      </div>
                    )}
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
                          Coordonnées : {customer.latitude.toFixed(6)}, {customer.longitude.toFixed(6)}
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
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCustomer ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div className="destruction-field">
                <label className="destruction-label">Nom du client *</label>
                <input
                  type="text"
                  className="destruction-input"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Adresse</label>
                <input
                  type="text"
                  className="destruction-input"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Adresse complète"
                />
              </div>
              <div className="destruction-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="destruction-field">
                  <label className="destruction-label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="destruction-input"
                    value={form.latitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                    placeholder="46.548452"
                  />
                </div>
                <div className="destruction-field">
                  <label className="destruction-label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="destruction-input"
                    value={form.longitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                    placeholder="6.572221"
                  />
                </div>
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Niveau de risque</label>
                <select
                  className="destruction-input"
                  value={form.risk_level}
                  onChange={(e) => setForm((prev) => ({ ...prev, risk_level: e.target.value }))}
                >
                  <option value="">Normal</option>
                  <option value="low">Faible</option>
                  <option value="medium">Moyen</option>
                  <option value="sensitive">Sensible</option>
                  <option value="high">Élevé</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default CustomersPage;

