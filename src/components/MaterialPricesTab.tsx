import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Loader2, Upload, X, DollarSign, Calendar, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Api, type Material, type MaterialPrice, type PriceSource } from '../lib/api';

interface MaterialPricesTabProps {
  materials: Material[];
  canEdit: boolean;
}

export const MaterialPricesTab = ({ materials, canEdit }: MaterialPricesTabProps) => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [prices, setPrices] = useState<MaterialPrice[]>([]);
  const [priceSources, setPriceSources] = useState<PriceSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<MaterialPrice | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [importFilename, setImportFilename] = useState('');
  const [importValidFrom, setImportValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [importSource, setImportSource] = useState('');
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  const [priceForm, setPriceForm] = useState({
    price_source_id: '',
    price: '',
    price_min: '',
    price_max: '',
    currency: 'CHF',
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: '',
    comment: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPriceSources();
  }, []);

  useEffect(() => {
    if (selectedMaterial) {
      loadPrices(selectedMaterial.id);
    } else {
      setPrices([]);
    }
  }, [selectedMaterial]);

  const loadPriceSources = async () => {
    try {
      const sources = await Api.fetchPriceSources();
      setPriceSources(sources);
      if (sources.length > 0 && !priceForm.price_source_id) {
        setPriceForm((prev) => ({ ...prev, price_source_id: sources[0].id }));
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des sources de prix');
    }
  };

  const loadPrices = async (materialId: string) => {
    try {
      setLoading(true);
      const data = await Api.fetchMaterialPrices(materialId);
      setPrices(data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des prix');
    } finally {
      setLoading(false);
    }
  };

  const openAddPriceModal = () => {
    setEditingPrice(null);
    setPriceForm({
      price_source_id: priceSources[0]?.id || '',
      price: '',
      price_min: '',
      price_max: '',
      currency: 'CHF',
      valid_from: new Date().toISOString().split('T')[0],
      valid_to: '',
      comment: ''
    });
    setShowPriceModal(true);
  };

  const openEditPriceModal = (price: MaterialPrice) => {
    setEditingPrice(price);
    setPriceForm({
      price_source_id: price.price_source_id,
      price: price.price.toString(),
      price_min: price.price_min?.toString() || '',
      price_max: price.price_max?.toString() || '',
      currency: price.currency,
      valid_from: price.valid_from,
      valid_to: price.valid_to || '',
      comment: price.comment || ''
    });
    setShowPriceModal(true);
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;

    const priceNum = parseFloat(priceForm.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Prix invalide');
      return;
    }

    try {
      setSubmitting(true);
      if (editingPrice) {
        await Api.updateMaterialPrice(editingPrice.id, {
          price: priceNum,
          price_min: priceForm.price_min ? parseFloat(priceForm.price_min) : undefined,
          price_max: priceForm.price_max ? parseFloat(priceForm.price_max) : undefined,
          currency: priceForm.currency,
          valid_from: priceForm.valid_from,
          valid_to: priceForm.valid_to || null,
          comment: priceForm.comment || undefined
        });
        toast.success('Prix mis à jour');
      } else {
        await Api.createMaterialPrice(selectedMaterial.id, {
          price_source_id: priceForm.price_source_id,
          price: priceNum,
          price_min: priceForm.price_min ? parseFloat(priceForm.price_min) : undefined,
          price_max: priceForm.price_max ? parseFloat(priceForm.price_max) : undefined,
          currency: priceForm.currency,
          valid_from: priceForm.valid_from,
          valid_to: priceForm.valid_to || null,
          comment: priceForm.comment || undefined
        });
        toast.success('Prix ajouté');
      }
      setShowPriceModal(false);
      loadPrices(selectedMaterial.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrice = async (priceId: string) => {
    if (!confirm('Supprimer ce prix ?')) return;
    try {
      await Api.deleteMaterialPrice(priceId);
      toast.success('Prix supprimé');
      if (selectedMaterial) {
        loadPrices(selectedMaterial.id);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setSubmitting(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error('Le fichier Excel doit contenir au moins une ligne de données (après les en-têtes)');
        return;
      }

      // Détection automatique des colonnes
      const headers = (jsonData[0] || []).map((h: any) => String(h || '').toLowerCase().trim());
      
      const getColumnIndex = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const idx = headers.findIndex(h => h.includes(name));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const abregeIdx = getColumnIndex(['abrégé', 'abrege', 'abrev', 'abbreviation', 'code', 'matière', 'matiere']);
      const descriptionIdx = getColumnIndex(['description', 'desc', 'libellé', 'libelle', 'nom']);
      const priceIdx = getColumnIndex(['prix', 'price', 'montant', 'amount']);
      const priceMinIdx = getColumnIndex(['prix min', 'prix_min', 'price min', 'price_min', 'min', 'minimum']);
      const priceMaxIdx = getColumnIndex(['prix max', 'prix_max', 'price max', 'price_max', 'max', 'maximum']);

      if (priceIdx < 0) {
        toast.error('Le fichier Excel doit contenir une colonne "Prix"');
        return;
      }

      if (abregeIdx < 0 && descriptionIdx < 0) {
        toast.error('Le fichier Excel doit contenir une colonne "Abrégé" ou "Description"');
        return;
      }

      const prices: Array<{
        abrege?: string;
        description?: string;
        price: number;
        price_min?: number;
        price_max?: number;
      }> = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.every((cell: any) => !cell)) continue;

        const abrege = abregeIdx >= 0 ? String(row[abregeIdx] || '').trim() : '';
        const description = descriptionIdx >= 0 ? String(row[descriptionIdx] || '').trim() : '';
        const priceStr = String(row[priceIdx] || '').trim();
        const price = parseFloat(priceStr);

        if (!price || isNaN(price) || price <= 0) continue;

        const priceMin = priceMinIdx >= 0 && row[priceMinIdx] ? parseFloat(String(row[priceMinIdx])) : undefined;
        const priceMax = priceMaxIdx >= 0 && row[priceMaxIdx] ? parseFloat(String(row[priceMaxIdx])) : undefined;

        prices.push({
          abrege: abrege || undefined,
          description: description || undefined,
          price,
          price_min: priceMin && !isNaN(priceMin) ? priceMin : undefined,
          price_max: priceMax && !isNaN(priceMax) ? priceMax : undefined
        });
      }

      if (prices.length === 0) {
        toast.error('Aucun prix valide trouvé dans le fichier Excel');
        return;
      }

      // Utiliser la source sélectionnée ou Copacel par défaut
      const sourceId = importSource || priceSources.find(s => s.name === 'Copacel')?.id || priceSources[0]?.id;
      if (!sourceId) {
        toast.error('Aucune source de prix disponible');
        return;
      }

      // Importer chaque prix individuellement
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const priceData of prices) {
        try {
          // Trouver la matière
          let material: Material | undefined;
          if (priceData.abrege) {
            material = materials.find(m => m.abrege?.toLowerCase() === priceData.abrege?.toLowerCase());
          }
          if (!material && priceData.description) {
            material = materials.find(m => 
              m.description?.toLowerCase().includes(priceData.description?.toLowerCase() || '')
            );
          }

          if (!material) {
            errorCount++;
            errors.push(`Matière non trouvée: ${priceData.abrege || priceData.description}`);
            continue;
          }

          await Api.createMaterialPrice(material.id, {
            price_source_id: sourceId,
            price: priceData.price,
            price_min: priceData.price_min,
            price_max: priceData.price_max,
            currency: 'CHF',
            valid_from: importValidFrom,
            comment: `Importé depuis ${file.name}`
          });
          successCount++;
        } catch (error: any) {
          errorCount++;
          errors.push(`${priceData.abrege || priceData.description}: ${error.message || 'Erreur'}`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} prix importé(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`);
        if (selectedMaterial) {
          loadPrices(selectedMaterial.id);
        }
      } else {
        toast.error(`Aucun prix importé. ${errorCount} erreur(s)`);
      }

      if (errors.length > 0 && errors.length <= 10) {
        console.warn('Erreurs d\'import:', errors);
      }

      setShowExcelImportModal(false);
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de l\'import du fichier Excel');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportCopacel = async () => {
    try {
      const lines = importData.trim().split('\n').filter(l => l.trim());
      const prices = lines.map(line => {
        const parts = line.split('\t').map(p => p.trim());
        // Format attendu: abrégé ou description, prix, prix_min (optionnel), prix_max (optionnel)
        return {
          abrege: parts[0] || undefined,
          description: parts[0] || undefined,
          price: parseFloat(parts[1] || '0'),
          price_min: parts[2] ? parseFloat(parts[2]) : undefined,
          price_max: parts[3] ? parseFloat(parts[3]) : undefined
        };
      }).filter(p => p.price > 0);

      if (prices.length === 0) {
        toast.error('Aucun prix valide trouvé dans les données');
        return;
      }

      setSubmitting(true);
      const result = await Api.importCopacelPdf({
        prices,
        filename: importFilename || undefined,
        valid_from: importValidFrom
      });

      toast.success(result.message);
      setShowImportModal(false);
      setImportData('');
      setImportFilename('');
      if (selectedMaterial) {
        loadPrices(selectedMaterial.id);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de l\'import');
    } finally {
      setSubmitting(false);
    }
  };

  const currentPrice = prices.find(p => {
    const today = new Date().toISOString().split('T')[0];
    return (!p.valid_to || p.valid_to >= today) && p.valid_from <= today;
  });

  return (
    <div style={{ display: 'flex', gap: '24px', height: '100%' }}>
      <div style={{ flex: '0 0 300px', borderRight: '1px solid var(--divider)', paddingRight: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 600 }}>Matières</h3>
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {materials.map((material) => (
            <button
              key={material.id}
              onClick={() => setSelectedMaterial(material)}
              style={{
                width: '100%',
                padding: '12px',
                textAlign: 'left',
                border: selectedMaterial?.id === material.id ? '2px solid var(--primary)' : '1px solid var(--divider)',
                borderRadius: '8px',
                marginBottom: '8px',
                background: selectedMaterial?.id === material.id ? 'var(--primary-light)' : 'transparent',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{material.abrege}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{material.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {!selectedMaterial ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <DollarSign size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p>Sélectionnez une matière pour voir ses prix</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ marginBottom: '4px' }}>{selectedMaterial.abrege}</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>{selectedMaterial.description}</p>
                {currentPrice && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Prix actuel</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#0369a1' }}>
                      {Number(currentPrice.price).toFixed(2)} {currentPrice.currency}
                      {currentPrice.source_name && (
                        <span style={{ fontSize: '0.9rem', fontWeight: 400, marginLeft: '8px', color: 'var(--text-muted)' }}>
                          ({currentPrice.source_name})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {canEdit && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={excelFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportExcel}
                    style={{ display: 'none' }}
                  />
                  <button className="btn btn-outline" onClick={() => setShowExcelImportModal(true)}>
                    <FileSpreadsheet size={16} />
                    Importer Excel
                  </button>
                  <button className="btn btn-outline" onClick={() => setShowImportModal(true)}>
                    <Upload size={16} />
                    Importer Copacel
                  </button>
                  <button className="btn btn-primary" onClick={openAddPriceModal}>
                    <Plus size={16} />
                    Ajouter un prix
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader2 className="spinner" size={24} />
              </div>
            ) : prices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <p>Aucun prix enregistré pour cette matière</p>
              </div>
            ) : (
              <div className="detail-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Prix</th>
                      <th>Prix min</th>
                      <th>Prix max</th>
                      <th>Devise</th>
                      <th>Valide du</th>
                      <th>Valide au</th>
                      <th>Commentaire</th>
                      {canEdit && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((price) => (
                      <tr key={price.id}>
                        <td>{price.source_name || '-'}</td>
                        <td><strong>{Number(price.price).toFixed(2)}</strong></td>
                        <td>{price.price_min ? Number(price.price_min).toFixed(2) : '-'}</td>
                        <td>{price.price_max ? Number(price.price_max).toFixed(2) : '-'}</td>
                        <td>{price.currency}</td>
                        <td>{new Date(price.valid_from).toLocaleDateString('fr-FR')}</td>
                        <td>{price.valid_to ? new Date(price.valid_to).toLocaleDateString('fr-FR') : '-'}</td>
                        <td>{price.comment || '-'}</td>
                        {canEdit && (
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn-icon" onClick={() => openEditPriceModal(price)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn-icon btn-icon-danger" onClick={() => handleDeletePrice(price.id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {showPriceModal && selectedMaterial && (
        <div className="modal-backdrop" onClick={() => setShowPriceModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editingPrice ? 'Modifier le prix' : 'Nouveau prix'}</h2>
              <button className="icon-button" onClick={() => setShowPriceModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePriceSubmit} style={{ padding: '24px' }}>
              <div className="input-group">
                <label>Source *</label>
                <select
                  value={priceForm.price_source_id}
                  onChange={(e) => setPriceForm({ ...priceForm, price_source_id: e.target.value })}
                  required
                  disabled={!!editingPrice}
                >
                  {priceSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Prix (CHF) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceForm.price}
                  onChange={(e) => setPriceForm({ ...priceForm, price: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Prix min (optionnel)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceForm.price_min}
                    onChange={(e) => setPriceForm({ ...priceForm, price_min: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Prix max (optionnel)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceForm.price_max}
                    onChange={(e) => setPriceForm({ ...priceForm, price_max: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Valide du *</label>
                  <input
                    type="date"
                    value={priceForm.valid_from}
                    onChange={(e) => setPriceForm({ ...priceForm, valid_from: e.target.value })}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Valide au (optionnel)</label>
                  <input
                    type="date"
                    value={priceForm.valid_to}
                    onChange={(e) => setPriceForm({ ...priceForm, valid_to: e.target.value })}
                  />
                </div>
              </div>
              <div className="input-group">
                <label>Commentaire</label>
                <textarea
                  rows={3}
                  value={priceForm.comment}
                  onChange={(e) => setPriceForm({ ...priceForm, comment: e.target.value })}
                  placeholder="Notes sur ce prix..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowPriceModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Enregistrement...' : editingPrice ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExcelImportModal && (
        <div className="modal-backdrop" onClick={() => setShowExcelImportModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Importer prix depuis Excel</h2>
              <button className="icon-button" onClick={() => setShowExcelImportModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <div className="input-group">
                <label>Fichier Excel *</label>
                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportExcel}
                />
                <small style={{ display: 'block', marginTop: '8px', color: 'var(--text-muted)' }}>
                  Le fichier doit contenir les colonnes : <strong>Abrégé</strong> (ou Description), <strong>Prix</strong>, Prix min (optionnel), Prix max (optionnel)
                </small>
              </div>
              <div className="input-group">
                <label>Source de prix *</label>
                <select
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value)}
                  required
                >
                  <option value="">Sélectionner une source</option>
                  {priceSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Date de validité *</label>
                <input
                  type="date"
                  value={importValidFrom}
                  onChange={(e) => setImportValidFrom(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowExcelImportModal(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => excelFileInputRef.current?.click()}
                  disabled={submitting || !importSource}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      Import...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={16} />
                      Sélectionner le fichier
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-backdrop" onClick={() => setShowImportModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>Importer prix Copacel</h2>
              <button className="icon-button" onClick={() => setShowImportModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <div className="input-group">
                <label>Nom du fichier (optionnel)</label>
                <input
                  type="text"
                  value={importFilename}
                  onChange={(e) => setImportFilename(e.target.value)}
                  placeholder="Ex: copacel_2024_01.pdf"
                />
              </div>
              <div className="input-group">
                <label>Date de validité *</label>
                <input
                  type="date"
                  value={importValidFrom}
                  onChange={(e) => setImportValidFrom(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Données (format: abrégé TAB prix TAB prix_min TAB prix_max)</label>
                <small style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>
                  Collez les données extraites du PDF Copacel. Une ligne par matière.
                  <br />
                  Format: Abrégé (ou description) | Prix | Prix min (optionnel) | Prix max (optionnel)
                </small>
                <textarea
                  rows={15}
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="PET&#9;150.50&#9;145.00&#9;155.00&#10;Carton&#9;80.25"
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowImportModal(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleImportCopacel}
                  disabled={submitting || !importData.trim()}
                >
                  {submitting ? 'Import...' : 'Importer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

