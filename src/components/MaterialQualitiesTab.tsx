import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Api, type Material, type MaterialQuality } from '../lib/api';

interface MaterialQualitiesTabProps {
  materials: Material[];
  canEdit: boolean;
}

export const MaterialQualitiesTab = ({ materials, canEdit }: MaterialQualitiesTabProps) => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [qualities, setQualities] = useState<MaterialQuality[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [editingQuality, setEditingQuality] = useState<MaterialQuality | null>(null);
  const [qualityForm, setQualityForm] = useState({
    name: '',
    description: '',
    deduction_pct: 0,
    is_default: false
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedMaterial) {
      loadQualities(selectedMaterial.id);
    } else {
      setQualities([]);
    }
  }, [selectedMaterial]);

  const loadQualities = async (materialId: string) => {
    try {
      setLoading(true);
      const data = await Api.fetchMaterialQualities(materialId);
      setQualities(data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des qualités');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    if (!selectedMaterial) {
      toast.error('Veuillez sélectionner une matière');
      return;
    }
    setEditingQuality(null);
    setQualityForm({
      name: '',
      description: '',
      deduction_pct: 0,
      is_default: false
    });
    setShowQualityModal(true);
  };

  const openEditModal = (quality: MaterialQuality) => {
    setEditingQuality(quality);
    setQualityForm({
      name: quality.name,
      description: quality.description || '',
      deduction_pct: quality.deduction_pct,
      is_default: quality.is_default
    });
    setShowQualityModal(true);
  };

  const closeModal = () => {
    setShowQualityModal(false);
    setEditingQuality(null);
    setQualityForm({
      name: '',
      description: '',
      deduction_pct: 0,
      is_default: false
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;

    if (!qualityForm.name.trim()) {
      toast.error('Le nom de la qualité est requis');
      return;
    }

    try {
      setSubmitting(true);
      if (editingQuality) {
        await Api.updateMaterialQuality(editingQuality.id, qualityForm);
        toast.success('Qualité mise à jour avec succès');
      } else {
        await Api.createMaterialQuality({
          material_id: selectedMaterial.id,
          ...qualityForm
        });
        toast.success('Qualité créée avec succès');
      }
      closeModal();
      await loadQualities(selectedMaterial.id);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette qualité ?')) return;
    try {
      await Api.deleteMaterialQuality(id);
      toast.success('Qualité supprimée');
      if (selectedMaterial) {
        await loadQualities(selectedMaterial.id);
      }
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="material-qualities-tab">
      <div className="material-qualities-header">
        <div className="material-qualities-select">
          <label>Sélectionner une matière :</label>
          <select
            value={selectedMaterial?.id || ''}
            onChange={(e) => {
              const material = materials.find(m => m.id === e.target.value);
              setSelectedMaterial(material || null);
            }}
            className="material-qualities-select-input"
          >
            <option value="">-- Sélectionner --</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>
                {m.abrege} - {m.description}
              </option>
            ))}
          </select>
        </div>
        {selectedMaterial && canEdit && (
          <button onClick={openAddModal} className="btn-primary">
            <Plus size={16} />
            Ajouter une qualité
          </button>
        )}
      </div>

      {selectedMaterial ? (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="spinner" size={32} />
          </div>
        ) : (
          <div className="material-qualities-content">
            {qualities.length === 0 ? (
              <div className="empty-state">
                <p>Aucune qualité définie pour cette matière</p>
                {canEdit && (
                  <button onClick={openAddModal} className="btn-primary mt-4">
                    <Plus size={16} />
                    Ajouter la première qualité
                  </button>
                )}
              </div>
            ) : (
              <table className="unified-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Description</th>
                    <th>Déduction (%)</th>
                    <th>Par défaut</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {qualities.map((quality) => (
                    <tr key={quality.id}>
                      <td>{quality.name}</td>
                      <td>{quality.description || '-'}</td>
                      <td>{quality.deduction_pct}%</td>
                      <td>
                        {quality.is_default ? (
                          <span className="badge badge-success">Oui</span>
                        ) : (
                          <span className="badge badge-secondary">Non</span>
                        )}
                      </td>
                      {canEdit && (
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(quality)}
                              className="btn-icon"
                              title="Modifier"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(quality.id)}
                              className="btn-icon text-red-600"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      ) : (
        <div className="empty-state">
          <p>Sélectionnez une matière pour gérer ses qualités</p>
        </div>
      )}

      {showQualityModal && (
        <div className="unified-modal-overlay" onClick={closeModal}>
          <div className="unified-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="unified-modal-header">
              <h2>{editingQuality ? 'Modifier la qualité' : 'Nouvelle qualité'}</h2>
              <button onClick={closeModal} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="unified-modal-form">
              <div className="unified-form-grid">
                <div className="unified-form-field">
                  <label htmlFor="quality-name">
                    Nom * <span className="required">*</span>
                  </label>
                  <input
                    id="quality-name"
                    type="text"
                    value={qualityForm.name}
                    onChange={(e) => setQualityForm({ ...qualityForm, name: e.target.value })}
                    required
                    className="unified-form-input"
                    placeholder="Ex: Premium, Standard, Déclassé..."
                  />
                </div>
                <div className="unified-form-field">
                  <label htmlFor="quality-deduction">
                    Déduction (%)
                  </label>
                  <input
                    id="quality-deduction"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={qualityForm.deduction_pct}
                    onChange={(e) => setQualityForm({ ...qualityForm, deduction_pct: parseFloat(e.target.value) || 0 })}
                    className="unified-form-input"
                  />
                </div>
                <div className="unified-form-field unified-form-field-full">
                  <label htmlFor="quality-description">
                    Description
                  </label>
                  <textarea
                    id="quality-description"
                    value={qualityForm.description}
                    onChange={(e) => setQualityForm({ ...qualityForm, description: e.target.value })}
                    rows={3}
                    className="unified-form-textarea"
                    placeholder="Description de la qualité..."
                  />
                </div>
                <div className="unified-form-field">
                  <label htmlFor="quality-default" className="unified-form-checkbox-label">
                    <input
                      id="quality-default"
                      type="checkbox"
                      checked={qualityForm.is_default}
                      onChange={(e) => setQualityForm({ ...qualityForm, is_default: e.target.checked })}
                      className="unified-form-checkbox"
                    />
                    Qualité par défaut
                  </label>
                </div>
              </div>
              <div className="unified-modal-actions">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingQuality ? 'Mettre à jour' : 'Créer'}
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

