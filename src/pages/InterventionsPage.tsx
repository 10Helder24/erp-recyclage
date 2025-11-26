import { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Filter, CheckCircle, Clock, XCircle, Edit2, Trash2, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Api, type Intervention } from '../lib/api';
import type { Employee } from '../types/employees';
import { useAuth } from '../hooks/useAuth';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'En attente', icon: Clock, color: '#f97316' },
  { value: 'in_progress', label: 'En cours', icon: AlertTriangle, color: '#3b82f6' },
  { value: 'completed', label: 'Terminée', icon: CheckCircle, color: '#22c55e' },
  { value: 'cancelled', label: 'Annulée', icon: XCircle, color: '#6b7280' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Basse', color: '#3b82f6' },
  { value: 'medium', label: 'Moyenne', color: '#f97316' },
  { value: 'high', label: 'Haute', color: '#ef4444' },
  { value: 'urgent', label: 'Urgente', color: '#dc2626' }
];

export const InterventionsPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager;

  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingIntervention, setEditingIntervention] = useState<Intervention | null>(null);
  const [form, setForm] = useState({
    status: 'pending',
    priority: 'medium',
    assigned_to: '',
    notes: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [interventionsData, employeesData] = await Promise.all([
        Api.fetchInterventions(),
        Api.fetchEmployees()
      ]);
      setInterventions(interventionsData);
      setEmployees(employeesData);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInterventions = useMemo(() => {
    let filtered = interventions;
    if (statusFilter) {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    if (priorityFilter) {
      filtered = filtered.filter((i) => i.priority === priorityFilter);
    }
    return filtered;
  }, [interventions, statusFilter, priorityFilter]);

  const openEditModal = (intervention: Intervention) => {
    setEditingIntervention(intervention);
    setForm({
      status: intervention.status,
      priority: intervention.priority,
      assigned_to: intervention.assigned_to || '',
      notes: intervention.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIntervention) return;

    try {
      await Api.updateIntervention(editingIntervention.id, {
        status: form.status,
        priority: form.priority,
        assigned_to: form.assigned_to || undefined,
        notes: form.notes || undefined
      });
      toast.success('Intervention mise à jour avec succès');
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette intervention ?')) return;
    try {
      await Api.deleteIntervention(id);
      toast.success('Intervention supprimée avec succès');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getStatusInfo = (status: string) => {
    return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  };

  const getPriorityInfo = (priority: string) => {
    return PRIORITY_OPTIONS.find((p) => p.value === priority) || PRIORITY_OPTIONS[1];
  };

  return (
    <section className="destruction-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Gestion</p>
          <h1 className="page-title">Interventions</h1>
          <p className="page-subtitle">Gérez les interventions et tickets créés depuis la carte.</p>
        </div>
      </div>

      <div className="destruction-card">
        <div className="destruction-section">
          <div className="interventions-filters" style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div className="map-input" style={{ minWidth: '200px' }}>
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, cursor: 'pointer' }}
              >
                <option value="">Tous les statuts</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="map-input" style={{ minWidth: '200px' }}>
              <Filter size={16} />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, cursor: 'pointer' }}
              >
                <option value="">Toutes les priorités</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 className="spinner" size={32} />
              <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Chargement...</p>
            </div>
          ) : filteredInterventions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>Aucune intervention trouvée</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredInterventions.map((intervention) => {
                const statusInfo = getStatusInfo(intervention.status);
                const priorityInfo = getPriorityInfo(intervention.priority);
                const StatusIcon = statusInfo.icon;

                return (
                  <div key={intervention.id} className="employee-card">
                    <div className="employee-card-header">
                      <div style={{ flex: 1 }}>
                        <h3>{intervention.title}</h3>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <span className="tag" style={{ backgroundColor: statusInfo.color, color: '#fff' }}>
                            <StatusIcon size={12} style={{ marginRight: '4px' }} />
                            {statusInfo.label}
                          </span>
                          <span className="tag" style={{ backgroundColor: priorityInfo.color, color: '#fff' }}>
                            {priorityInfo.label}
                          </span>
                        </div>
                      </div>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => openEditModal(intervention)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-small"
                            onClick={() => handleDelete(intervention.id)}
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="employee-info">
                      <div className="info-row">
                        <strong>Client :</strong>
                        <span>{intervention.customer_name}</span>
                      </div>
                      {intervention.customer_address && (
                        <div className="info-row">
                          <span>{intervention.customer_address}</span>
                        </div>
                      )}
                      {intervention.description && (
                        <div className="info-row">
                          <span>{intervention.description}</span>
                        </div>
                      )}
                      {intervention.assigned_to_name && (
                        <div className="info-row">
                          <strong>Assigné à :</strong>
                          <span>{intervention.assigned_to_name}</span>
                        </div>
                      )}
                      {intervention.created_by_name && (
                        <div className="info-row">
                          <strong>Créé par :</strong>
                          <span>{intervention.created_by_name}</span>
                        </div>
                      )}
                      <div className="info-row">
                        <strong>Créé le :</strong>
                        <span>{new Date(intervention.created_at).toLocaleString('fr-FR')}</span>
                      </div>
                      {intervention.notes && (
                        <div className="info-row">
                          <strong>Notes :</strong>
                          <span>{intervention.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal édition */}
      {showModal && editingIntervention && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Modifier l'intervention</h2>
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
                <label className="destruction-label">Statut</label>
                <select
                  className="destruction-input"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Priorité</label>
                <select
                  className="destruction-input"
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Assigné à</label>
                <select
                  className="destruction-input"
                  value={form.assigned_to}
                  onChange={(e) => setForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
                >
                  <option value="">Non assigné</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="destruction-field">
                <label className="destruction-label">Notes</label>
                <textarea
                  className="destruction-input"
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes supplémentaires"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Modifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default InterventionsPage;

