import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Loader2, Save, X, Upload, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

import { Api, type Material } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

type MaterialForm = {
  famille: string;
  numero: string;
  abrege: string;
  description: string;
  unite: string;
  me_bez?: string;
};

const DEFAULT_FORM: MaterialForm = {
  famille: '',
  numero: '',
  abrege: '',
  description: '',
  unite: '',
  me_bez: ''
};

export const MaterialsPage = () => {
  const { hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager || hasPermission('edit_materials');

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [form, setForm] = useState<MaterialForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchMaterials();
      setMaterials(data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des matières');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canEdit) {
      loadMaterials();
    }
  }, [canEdit]);

  const filteredMaterials = materials.filter(
    (material) =>
      material.abrege?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.famille?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.numero?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setEditingMaterial(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  };

  const openEditModal = (material: Material) => {
    setEditingMaterial(material);
    setForm({
      famille: material.famille || '',
      numero: material.numero || '',
      abrege: material.abrege || '',
      description: material.description || '',
      unite: material.unite || '',
      me_bez: material.me_bez || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMaterial(null);
    setForm(DEFAULT_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.abrege?.trim()) {
      toast.error('L\'abréviation est requise');
      return;
    }
    if (!form.description?.trim()) {
      toast.error('La description est requise');
      return;
    }
    if (!form.unite?.trim()) {
      toast.error('L\'unité est requise');
      return;
    }

    try {
      setSubmitting(true);
      if (editingMaterial) {
        await Api.updateMaterial(editingMaterial.id, {
          famille: form.famille || undefined,
          numero: form.numero || undefined,
          abrege: form.abrege,
          description: form.description,
          unite: form.unite,
          me_bez: form.me_bez || undefined
        });
        toast.success('Matière mise à jour avec succès');
      } else {
        await Api.createMaterial({
          famille: form.famille || undefined,
          numero: form.numero || undefined,
          abrege: form.abrege,
          description: form.description,
          unite: form.unite,
          me_bez: form.me_bez || undefined
        });
        toast.success('Matière créée avec succès');
      }
      closeModal();
      loadMaterials();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette matière ?')) {
      return;
    }

    try {
      await Api.deleteMaterial(id);
      toast.success('Matière supprimée avec succès');
      loadMaterials();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error('Le fichier Excel doit contenir au moins une ligne de données (après les en-têtes)');
        return;
      }

      // Détection automatique des colonnes (première ligne = en-têtes)
      const headers = (jsonData[0] || []).map((h: any) => String(h || '').toLowerCase().trim());
      
      // Mapping des colonnes possibles
      const getColumnIndex = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const idx = headers.findIndex(h => h.includes(name));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const familleIdx = getColumnIndex(['famille', 'family']);
      const numeroIdx = getColumnIndex(['n°', 'numero', 'numéro', 'number', 'no']);
      const abregeIdx = getColumnIndex(['abrégé', 'abrege', 'abrev', 'abbreviation', 'code']);
      const descriptionIdx = getColumnIndex(['description', 'desc', 'libellé', 'libelle']);
      const uniteIdx = getColumnIndex(['unité', 'unite', 'unit', 'uom']);
      const meBezIdx = getColumnIndex(['me-bez', 'me_bez', 'mebez', 'me bez']);

      if (abregeIdx < 0 || descriptionIdx < 0 || uniteIdx < 0) {
        toast.error('Le fichier Excel doit contenir les colonnes : Abrégé, Description, Unité');
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Traiter chaque ligne (en commençant à l'index 1 pour ignorer les en-têtes)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every((cell: any) => !cell)) continue; // Ignorer les lignes vides

        const abrege = String(row[abregeIdx] || '').trim();
        const description = String(row[descriptionIdx] || '').trim();
        const unite = String(row[uniteIdx] || '').trim();

        if (!abrege || !description || !unite) {
          errorCount++;
          errors.push(`Ligne ${i + 1}: Abrégé, Description et Unité sont requis`);
          continue;
        }

        try {
          await Api.createMaterial({
            famille: familleIdx >= 0 ? String(row[familleIdx] || '').trim() || undefined : undefined,
            numero: numeroIdx >= 0 ? String(row[numeroIdx] || '').trim() || undefined : undefined,
            abrege,
            description,
            unite,
            me_bez: meBezIdx >= 0 ? String(row[meBezIdx] || '').trim() || undefined : undefined
          });
          successCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`Ligne ${i + 1}: ${error.message || 'Erreur lors de la création'}`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} matière(s) importée(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`);
        loadMaterials();
      } else {
        toast.error(`Aucune matière importée. ${errorCount} erreur(s)`);
      }

      if (errors.length > 0 && errors.length <= 10) {
        console.warn('Erreurs d\'import:', errors);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de l\'import du fichier Excel');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!canEdit) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <p className="eyebrow">Gestion</p>
            <h1 className="page-title">Gestion des matières</h1>
          </div>
        </div>
        <div className="empty-state">
          <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Gestion</p>
          <h1 className="page-title">Gestion des matières</h1>
          {materials.length > 0 && (
            <p className="page-subtitle">{materials.length} matière{materials.length > 1 ? 's' : ''} enregistrée{materials.length > 1 ? 's' : ''}</p>
          )}
        </div>
        {canEdit && (
          <div className="page-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <>
                  <Loader2 size={18} className="spinner" />
                  Import...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Importer Excel
                </>
              )}
            </button>
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              Ajouter une matière
            </button>
          </div>
        )}
      </div>

      <div className="page-content materials-page-content">
        <div className="materials-search-bar">
          <div className="materials-search-wrapper">
            <Search size={20} />
            <input
              type="text"
              placeholder="Rechercher une matière (abréviation, description, famille, numéro)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader2 size={24} className="spinner" />
            <p>Chargement des matières...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="empty-state">
            <FileSpreadsheet size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 500 }}>
              {searchTerm ? 'Aucune matière ne correspond à votre recherche' : 'Aucune matière enregistrée'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {searchTerm
                ? 'Essayez avec d\'autres mots-clés'
                : 'Commencez par ajouter une matière manuellement ou importez un fichier Excel'}
            </p>
          </div>
        ) : (
          <div className="materials-table-wrapper">
            <table className="materials-data-table">
              <thead>
                <tr>
                  <th>Famille</th>
                  <th>N°</th>
                  <th>Abrégé</th>
                  <th>Description</th>
                  <th>Unité</th>
                  <th>ME-Bez</th>
                  {canEdit && <th className="actions-column">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((material) => (
                  <tr key={material.id}>
                    <td>{material.famille || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                    <td>{material.numero || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                    <td><strong>{material.abrege || '-'}</strong></td>
                    <td>{material.description || '-'}</td>
                    <td>{material.unite || '-'}</td>
                    <td>{material.me_bez || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                    {canEdit && (
                      <td className="actions-column">
                        <button
                          className="btn-icon"
                          onClick={() => openEditModal(material)}
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(material.id)}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay materials-modal-overlay" onClick={closeModal}>
          <div className="modal-panel materials-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header materials-modal-header">
              <div>
                <h2>{editingMaterial ? 'Modifier la matière' : 'Nouvelle matière'}</h2>
                <p className="modal-subtitle">Remplissez les informations ci-dessous</p>
              </div>
              <button className="btn-icon btn-icon-ghost" onClick={closeModal} aria-label="Fermer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="materials-form">
              <div className="form-section">
                <h3 className="form-section-title">Informations principales</h3>
                <div className="form-grid materials-form-grid">
                  <div className="form-field">
                    <label htmlFor="abrege">
                      Abrégé <span className="required">*</span>
                    </label>
                    <input
                      id="abrege"
                      type="text"
                      value={form.abrege}
                      onChange={(e) => setForm({ ...form, abrege: e.target.value })}
                      placeholder="Ex: PET, Alu, Carton..."
                      required
                      autoFocus
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="unite">
                      Unité <span className="required">*</span>
                    </label>
                    <input
                      id="unite"
                      type="text"
                      value={form.unite}
                      onChange={(e) => setForm({ ...form, unite: e.target.value })}
                      placeholder="Ex: kg, m³, pièce..."
                      required
                    />
                  </div>

                  <div className="form-field form-field-full">
                    <label htmlFor="description">
                      Description <span className="required">*</span>
                    </label>
                    <input
                      id="description"
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Description complète de la matière"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="form-section-title">Informations complémentaires</h3>
                <div className="form-grid materials-form-grid">
                  <div className="form-field">
                    <label htmlFor="famille">
                      Famille
                    </label>
                    <input
                      id="famille"
                      type="text"
                      value={form.famille}
                      onChange={(e) => setForm({ ...form, famille: e.target.value })}
                      placeholder="Ex: Plastique, Métal, Papier..."
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="numero">
                      N°
                    </label>
                    <input
                      id="numero"
                      type="text"
                      value={form.numero}
                      onChange={(e) => setForm({ ...form, numero: e.target.value })}
                      placeholder="Ex: 1.02, 2.06..."
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="me_bez">
                      ME-Bez
                    </label>
                    <input
                      id="me_bez"
                      type="text"
                      value={form.me_bez}
                      onChange={(e) => setForm({ ...form, me_bez: e.target.value })}
                      placeholder="ME-Bez"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-actions materials-modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal} disabled={submitting}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="spinner" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {editingMaterial ? 'Enregistrer les modifications' : 'Créer la matière'}
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
