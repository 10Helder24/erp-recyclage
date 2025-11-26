import { useEffect, useState } from 'react';
import { Plus, Truck, Hash, Edit2, Trash2, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Api, type MapVehicle } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type VehicleForm = {
  internal_number: string;
  plate_number: string;
};

const DEFAULT_FORM: VehicleForm = {
  internal_number: '',
  plate_number: ''
};

export const VehiclesPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager;

  const [vehicles, setVehicles] = useState<MapVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<MapVehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(DEFAULT_FORM);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchAllVehicles();
      setVehicles(data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des véhicules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const filteredVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.internal_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle.plate_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setEditingVehicle(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  };

  const openEditModal = (vehicle: MapVehicle) => {
    setEditingVehicle(vehicle);
    setForm({
      internal_number: vehicle.internal_number || '',
      plate_number: vehicle.plate_number || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.internal_number.trim() && !form.plate_number.trim()) {
      toast.error('Le numéro interne ou la plaque d\'immatriculation est requis');
      return;
    }

    try {
      if (editingVehicle) {
        await Api.updateVehicle(editingVehicle.id, {
          internal_number: form.internal_number || undefined,
          plate_number: form.plate_number || undefined
        });
        toast.success('Véhicule mis à jour avec succès');
      } else {
        await Api.createVehicle({
          internal_number: form.internal_number || undefined,
          plate_number: form.plate_number || undefined
        });
        toast.success('Véhicule créé avec succès');
      }
      setShowModal(false);
      loadVehicles();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ?')) return;
    try {
      await Api.deleteVehicle(id);
      toast.success('Véhicule supprimé avec succès');
      loadVehicles();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <section className="destruction-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Gestion</p>
          <h1 className="page-title">Véhicules</h1>
          <p className="page-subtitle">Gérez votre flotte de véhicules.</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            Ajouter un véhicule
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
                placeholder="Rechercher un véhicule..."
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
          ) : filteredVehicles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>Aucun véhicule trouvé</p>
            </div>
          ) : (
            <div className="employees-grid">
              {filteredVehicles.map((vehicle) => (
                <div key={vehicle.id} className="employee-card">
                  <div className="employee-card-header">
                    <div>
                      <h3>
                        <Truck size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                        {vehicle.internal_number || vehicle.plate_number || 'Véhicule sans nom'}
                      </h3>
                    </div>
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-small"
                          onClick={() => openEditModal(vehicle)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-small"
                          onClick={() => handleDelete(vehicle.id)}
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="employee-info">
                    {vehicle.internal_number && (
                      <div className="info-row">
                        <Hash size={16} />
                        <span>Numéro interne : {vehicle.internal_number}</span>
                      </div>
                    )}
                    {vehicle.plate_number && (
                      <div className="info-row">
                        <span>Plaque : {vehicle.plate_number}</span>
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
              <h2 className="modal-title">{editingVehicle ? 'Modifier le véhicule' : 'Nouveau véhicule'}</h2>
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
                <label className="destruction-label">Numéro interne</label>
                <input
                  type="text"
                  className="destruction-input"
                  value={form.internal_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, internal_number: e.target.value }))}
                  placeholder="Ex: Camion 12"
                />
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Plaque d'immatriculation</label>
                <input
                  type="text"
                  className="destruction-input"
                  value={form.plate_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, plate_number: e.target.value }))}
                  placeholder="Ex: VD123456"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingVehicle ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default VehiclesPage;

