import { useState, useEffect } from 'react';
import { RefreshCw, Eye, Save, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { Api, type PdfTemplateConfig, type Material } from '../lib/api';
import { usePdfTemplate } from '../hooks/usePdfTemplate';
import { openPdfPreview } from '../utils/pdfPreview';
import { getZonePalette, hexToRgb, resolveTemplateImage } from '../utils/pdfTemplate';

const DeclassementDispoPage = () => {
  const [loading, setLoading] = useState(false);
  const [pendingDowngrades, setPendingDowngrades] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<any | null>(null);
  const { config: templateConfig, loading: templateLoading } = usePdfTemplate('declassement');
  const [materialSuggestions, setMaterialSuggestions] = useState<Material[]>([]);
  const [materialQuery, setMaterialQuery] = useState('');

  useEffect(() => {
    loadPending();
  }, []);

  useEffect(() => {
    const q = materialQuery.trim();
    if (q.length < 2) {
      setMaterialSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await Api.searchMaterials(q);
        if (!cancelled) setMaterialSuggestions(data);
      } catch (error) {
        console.error(error);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [materialQuery]);

  useEffect(() => {
    if (selectedId) {
      loadDowngrade(selectedId);
    }
  }, [selectedId]);

  const loadPending = async () => {
    try {
      const data = await Api.fetchDowngradesPending();
      setPendingDowngrades(data);
    } catch (error: any) {
      console.error(error);
      toast.error('Erreur chargement déclassements en attente');
    }
  };

  const loadDowngrade = async (id: string) => {
    try {
      const data = await Api.fetchDowngrade(id);
      setSelectedData(data);
    } catch (error: any) {
      console.error(error);
      toast.error('Erreur chargement déclassement');
    }
  };

  const handleUpdate = async (field: string, value: any) => {
    if (!selectedId || !selectedData) return;
    setSelectedData({ ...selectedData, [field]: value });
  };

  const handleSave = async () => {
    if (!selectedId || !selectedData) return;
    setLoading(true);
    try {
      await Api.updateDowngrade(selectedId, selectedData);
      toast.success('Déclassement mis à jour');
      await loadPending();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAndArchive = async () => {
    if (!selectedId || !selectedData || !templateConfig) {
      toast.error('Données incomplètes');
      return;
    }
    setLoading(true);
    try {
      // Générer le PDF
      const doc = await buildTemplatePdf(templateConfig, selectedData);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const filename = `declassement_${selectedId}_${Date.now()}.pdf`;

      // Archiver le PDF (10 ans)
      await Api.generateDowngradePdf(selectedId, {
        pdf_base64: pdfBase64,
        pdf_filename: filename,
        finalize: true
      });

      toast.success('PDF généré et archivé (10 ans)');
      await loadPending();
      setSelectedId(null);
      setSelectedData(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erreur lors de la génération/archivage');
    } finally {
      setLoading(false);
    }
  };

  const buildTemplatePdf = async (templateConfig: PdfTemplateConfig | null, data: any) => {
    if (!templateConfig) {
      throw new Error('Template PDF introuvable.');
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 36;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const safeWidth = pageWidth - margin * 2;

    const headerPalette = getZonePalette(templateConfig, 'header');
    const bodyPalette = getZonePalette(templateConfig, 'body');
    const highlightPalette = getZonePalette(templateConfig, 'highlight');

    const rgbToArray = (rgb: [number, number, number]) => rgb;
    const applyColor = (rgb: [number, number, number]) => {
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    };
    const applyFillColor = (rgb: [number, number, number]) => {
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    };

    // Header
    const headerBg = rgbToArray(headerPalette.background);
    const headerTextColor = rgbToArray(headerPalette.text);
    const headerTitleColor = rgbToArray(headerPalette.title);
    const headerSubtitleColor = rgbToArray(headerPalette.subtitle);
    
    const headerHeight = 100;
    applyFillColor(headerBg);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    
    let y = margin;
    
    if (templateConfig?.headerLogo) {
      try {
        const img = await resolveTemplateImage(templateConfig.headerLogo);
        if (img) {
          doc.addImage(img, 'PNG', margin, y, 120, 40);
        }
      } catch (err) {
        console.warn('Erreur chargement logo header:', err);
      }
    }

    const headerBgIsDark = headerBg[0] < 128 && headerBg[1] < 128 && headerBg[2] < 128;
    const headerTitleIsDark = headerTitleColor[0] < 128 && headerTitleColor[1] < 128 && headerTitleColor[2] < 128;
    const titleColorToUse = (headerBgIsDark && headerTitleIsDark) ? headerTextColor : headerTitleColor;
    
    applyColor(titleColorToUse);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    const titleX = margin + 130;
    const titleY = y + 20;
    doc.text(templateConfig?.title || 'Déclassement de matières', titleX, titleY);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    applyColor(headerSubtitleColor);
    doc.text(templateConfig?.subtitle || 'Rapport de tri', titleX, titleY + 18);
    
    const now = new Date();
    const weekday = now.toLocaleDateString('fr-FR', { weekday: 'long' });
    const day = now.getDate();
    const month = now.toLocaleDateString('fr-FR', { month: 'long' });
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dateStr = `${weekday}, ${day} ${month} ${year} à ${hours}:${minutes}`;
    applyColor(headerSubtitleColor);
    doc.setFontSize(10);
    const dateWidth = doc.getTextWidth(dateStr);
    doc.text(dateStr, pageWidth - margin - dateWidth, titleY + 18);

    y = headerHeight + margin;

    // Section Client
    const highlightBg = rgbToArray(highlightPalette.background);
    const highlightTitleColor = rgbToArray(highlightPalette.title);
    const highlightTextColor = rgbToArray(highlightPalette.text);

    y += 10;
    const sectionPadding = 12;
    const sectionHeight = 60;
    
    applyFillColor(highlightBg);
    doc.rect(margin, y, safeWidth, sectionHeight, 'F');
    
    applyColor(highlightTitleColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Client', margin + sectionPadding, y + 20);
    
    applyColor(highlightTextColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    let infoY = y + 35;
    
    const clientName = data.lot_origin_client_id || '—';
    doc.text(`Nom de l'entreprise : ${clientName}`, margin + sectionPadding, infoY);
    infoY += 14;
    
    const vehiclePlate = data.vehicle_plate || '—';
    doc.text(`Plaque véhicule : ${vehiclePlate}`, margin + sectionPadding, infoY);
    infoY += 14;
    
    const slipNumber = data.slip_number || '—';
    doc.text(`Bon / Référence : ${slipNumber}`, margin + sectionPadding, infoY);

    y += sectionHeight + 15;

    // Section Matières
    y += 10;
    
    applyFillColor(highlightBg);
    doc.rect(margin, y, safeWidth, sectionHeight, 'F');
    
    applyColor(highlightTitleColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Matières déclarées', margin + sectionPadding, y + 20);
    
    applyColor(highlightTextColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    infoY = y + 35;
    
    const matAnnoncee = data.lot_filiere || data.lot_quality_grade || '—';
    doc.text(`Mat. annoncée : ${matAnnoncee}`, margin + sectionPadding, infoY);
    infoY += 14;
    
    const declassedEn = data.declassed_material || data.new_category || '—';
    doc.text(`Déclassée en : ${declassedEn}`, margin + sectionPadding, infoY);
    infoY += 14;
    
    const taux = data.motive_ratio ? `${data.motive_ratio}%` : '—';
    const duree = data.sorting_time_minutes ? `${data.sorting_time_minutes} min` : '—';
    doc.text(`Taux / Durée : ${taux} / ${duree}`, margin + sectionPadding, infoY);

    return doc;
  };

  const handlePreview = async () => {
    if (!selectedData || !templateConfig) {
      toast.error('Données incomplètes');
      return;
    }
    try {
      const doc = await buildTemplatePdf(templateConfig, selectedData);
      openPdfPreview({ doc, filename: 'declassement_preview.pdf' });
    } catch (error: any) {
      console.error(error);
      toast.error('Erreur lors de la prévisualisation');
    }
  };

  if (selectedId && selectedData) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Compléter déclassement</h1>
          <div className="actions">
            <button className="btn-secondary" onClick={() => { setSelectedId(null); setSelectedData(null); }}>
              Retour liste
            </button>
            <button className="btn-secondary" onClick={handlePreview} disabled={loading || templateLoading}>
              <Eye size={16} />
              Prévisualiser
            </button>
            <button className="btn-secondary" onClick={handleSave} disabled={loading}>
              <Save size={16} />
              Sauvegarder
            </button>
            <button className="btn-primary" onClick={handleGenerateAndArchive} disabled={loading || templateLoading}>
              {loading ? <RefreshCw size={16} className="spinning" /> : <CheckCircle size={16} />}
              Générer PDF & Archiver (10 ans)
            </button>
          </div>
        </div>

        <div className="declassement-page declassement-compact">
          {/* Section 1: Identification du lot */}
          <div className="section-card">
            <h3>1) Identification du lot</h3>
            <div className="mobile-grid">
              <div className="input-with-suggestions">
                <input
                  type="text"
                  placeholder="Code matières"
                  value={selectedData.lot_id || ''}
                  onChange={(e) => {
                    handleUpdate('lot_id', e.target.value);
                    setMaterialQuery(e.target.value);
                  }}
                />
                {materialSuggestions.length > 0 && materialQuery.length >= 2 && (
                  <div className="suggestions">
                    {materialSuggestions.map((m) => {
                      const label = [m.numero, m.abrege || m.description].filter(Boolean).join(' — ');
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            handleUpdate('lot_id', m.numero || m.abrege || '');
                            handleUpdate('lot_quality_grade', m.abrege || m.description || selectedData.lot_quality_grade);
                            setMaterialQuery('');
                            setMaterialSuggestions([]);
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Code client"
                value={selectedData.lot_internal_code || ''}
                onChange={(e) => handleUpdate('lot_internal_code', e.target.value)}
              />
              <input
                type="text"
                placeholder="Plaque camion"
                value={selectedData.vehicle_plate || ''}
                onChange={(e) => handleUpdate('vehicle_plate', e.target.value)}
              />
              <input
                type="text"
                placeholder="N° de bon"
                value={selectedData.slip_number || ''}
                onChange={(e) => handleUpdate('slip_number', e.target.value)}
              />
              <input
                type="text"
                placeholder="Client origine"
                value={selectedData.lot_origin_client_id || ''}
                onChange={(e) => handleUpdate('lot_origin_client_id', e.target.value)}
              />
              <input
                type="datetime-local"
                placeholder="Date & heure d'ouverture"
                value={selectedData.lot_entry_at || ''}
                onChange={(e) => handleUpdate('lot_entry_at', e.target.value)}
              />
              <div className="input-with-suggestions">
                <input
                  type="text"
                  placeholder="Qualité entrante"
                  value={selectedData.lot_quality_grade || ''}
                  onChange={(e) => {
                    handleUpdate('lot_quality_grade', e.target.value);
                    setMaterialQuery(e.target.value);
                  }}
                />
                {materialSuggestions.length > 0 && materialQuery.length >= 2 && (
                  <div className="suggestions">
                    {materialSuggestions.map((m) => {
                      const label = [m.numero, m.abrege || m.description].filter(Boolean).join(' — ');
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            handleUpdate('lot_quality_grade', m.abrege || m.description || '');
                            handleUpdate('lot_id', m.numero || selectedData.lot_id);
                            setMaterialQuery('');
                            setMaterialSuggestions([]);
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="input-with-suggestions">
                <input
                  type="text"
                  placeholder="Matière déclassée"
                  value={selectedData.declassed_material || ''}
                  onChange={(e) => {
                    handleUpdate('declassed_material', e.target.value);
                    setMaterialQuery(e.target.value);
                  }}
                />
                {materialSuggestions.length > 0 && materialQuery.length >= 2 && (
                  <div className="suggestions">
                    {materialSuggestions.map((m) => {
                      const label = [m.numero, m.abrege || m.description].filter(Boolean).join(' — ');
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            handleUpdate('declassed_material', m.abrege || m.description || '');
                            handleUpdate('lot_id', m.numero || selectedData.lot_id);
                            setMaterialQuery('');
                            setMaterialSuggestions([]);
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Motif & preuves */}
          <div className="section-card">
            <h3>2) Motif & preuves</h3>
            <div className="mobile-grid">
              <input
                type="text"
                placeholder="Motif principal"
                value={selectedData.motive_principal || ''}
                onChange={(e) => handleUpdate('motive_principal', e.target.value)}
              />
              <input
                type="text"
                placeholder="% déclassé"
                value={selectedData.motive_ratio || ''}
                onChange={(e) => handleUpdate('motive_ratio', e.target.value)}
              />
              <input
                type="text"
                placeholder="Temps de tri (min)"
                value={selectedData.sorting_time_minutes || ''}
                onChange={(e) => handleUpdate('sorting_time_minutes', e.target.value)}
              />
              <textarea
                rows={3}
                placeholder="Description détaillée"
                value={selectedData.motive_description || ''}
                onChange={(e) => handleUpdate('motive_description', e.target.value)}
              />
            </div>
          </div>

          {/* Section 3: Nouvelles caractéristiques */}
          <div className="section-card">
            <h3>3) Nouvelles caractéristiques</h3>
            <div className="mobile-grid">
              <input
                type="text"
                placeholder="Nouvelle catégorie / filière"
                value={selectedData.new_category || ''}
                onChange={(e) => handleUpdate('new_category', e.target.value)}
              />
              <input
                type="text"
                placeholder="Nouveau code VeVA"
                value={selectedData.new_veva_code || ''}
                onChange={(e) => handleUpdate('new_veva_code', e.target.value)}
              />
              <input
                type="text"
                placeholder="Nouvelle qualité"
                value={selectedData.new_quality || ''}
                onChange={(e) => handleUpdate('new_quality', e.target.value)}
              />
              <input
                type="text"
                placeholder="Poids net déclassé"
                value={selectedData.poids_net_declasse || ''}
                onChange={(e) => handleUpdate('poids_net_declasse', e.target.value)}
              />
            </div>
          </div>

          {/* Section 4: Légal CH */}
          <div className="section-card">
            <h3>4) Légal CH</h3>
            <div className="mobile-grid">
              <input
                type="text"
                placeholder="Type VeVA"
                value={selectedData.veva_type || ''}
                onChange={(e) => handleUpdate('veva_type', e.target.value)}
              />
              <input
                type="text"
                placeholder="N° bordereau VeVA"
                value={selectedData.veva_slip_number || ''}
                onChange={(e) => handleUpdate('veva_slip_number', e.target.value)}
              />
            </div>
          </div>

          {/* Section 5: Logistique */}
          <div className="section-card">
            <h3>5) Logistique</h3>
            <div className="mobile-grid">
              <input
                type="text"
                placeholder="Emplacement actuel"
                value={selectedData.emplacement_actuel || ''}
                onChange={(e) => handleUpdate('emplacement_actuel', e.target.value)}
              />
              <input
                type="text"
                placeholder="Nouvel emplacement"
                value={selectedData.nouvel_emplacement || ''}
                onChange={(e) => handleUpdate('nouvel_emplacement', e.target.value)}
              />
              <input
                type="text"
                placeholder="Poids final brut"
                value={selectedData.poids_final_brut || ''}
                onChange={(e) => handleUpdate('poids_final_brut', e.target.value)}
              />
              <input
                type="text"
                placeholder="Poids final net"
                value={selectedData.poids_final_net || ''}
                onChange={(e) => handleUpdate('poids_final_net', e.target.value)}
              />
            </div>
          </div>

          {/* Section 6: Économique */}
          <div className="section-card">
            <h3>6) Économique</h3>
            <div className="mobile-grid">
              <input
                type="text"
                placeholder="Valeur avant"
                value={selectedData.valeur_avant || ''}
                onChange={(e) => handleUpdate('valeur_avant', e.target.value)}
              />
              <input
                type="text"
                placeholder="Valeur après"
                value={selectedData.valeur_apres || ''}
                onChange={(e) => handleUpdate('valeur_apres', e.target.value)}
              />
              <input
                type="text"
                placeholder="Perte/Gain"
                value={selectedData.perte_gain || ''}
                onChange={(e) => handleUpdate('perte_gain', e.target.value)}
              />
            </div>
          </div>

          {/* Section 7: HSE */}
          <div className="section-card">
            <h3>7) HSE</h3>
            <div className="mobile-grid">
              <textarea
                rows={3}
                placeholder="Risques identifiés"
                value={Array.isArray(selectedData.risques_identifies) ? selectedData.risques_identifies.join(', ') : (selectedData.risques_identifies || '')}
                onChange={(e) => handleUpdate('risques_identifies', e.target.value.split(',').map(s => s.trim()))}
              />
              <textarea
                rows={3}
                placeholder="EPI requis"
                value={Array.isArray(selectedData.epis_requis) ? selectedData.epis_requis.join(', ') : (selectedData.epis_requis || '')}
                onChange={(e) => handleUpdate('epis_requis', e.target.value.split(',').map(s => s.trim()))}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Déclassements en attente de complétion</h1>
        <button className="btn-secondary" onClick={loadPending} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          Actualiser
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Lot ID</th>
              <th>Plaque camion</th>
              <th>Client origine</th>
              <th>Date entrée</th>
              <th>Motif</th>
              <th>Créé le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingDowngrades.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>
                  Aucun déclassement en attente
                </td>
              </tr>
            ) : (
              pendingDowngrades.map((dg) => (
                <tr key={dg.id}>
                  <td>{dg.id.slice(0, 8)}...</td>
                  <td>{dg.lot_id ? dg.lot_id.slice(0, 8) + '...' : dg.lot_internal_code || '—'}</td>
                  <td>{dg.vehicle_plate || '—'}</td>
                  <td>{dg.lot_origin_client_id || '—'}</td>
                  <td>{dg.lot_entry_at || dg.lot_entry_date || '—'}</td>
                  <td>{dg.motive_principal || '—'}</td>
                  <td>{new Date(dg.performed_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => setSelectedId(dg.id)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      Compléter
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeclassementDispoPage;

