import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { Plus, RefreshCw, Send, FileDown, Upload, Eye, Save } from 'lucide-react';
import { Api, type PdfTemplateConfig, type Material, type Customer } from '../lib/api';
import { usePdfTemplate } from '../hooks/usePdfTemplate';
import { openPdfPreview } from '../utils/pdfPreview';
import { getFooterLines, getZonePalette, hexToRgb, resolveTemplateImage } from '../utils/pdfTemplate';

type FileWithPreview = File & { preview?: string };
const MAX_TOTAL_PHOTO_BYTES = 33 * 1024 * 1024;

const getUserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const toZonedDate = (date: Date, timeZone: string) => new Date(date.toLocaleString('en-US', { timeZone }));
const formatDateTimeLocal = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const DeclassementPage = () => {
  const [loading, setLoading] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const { config: templateConfig, loading: templateLoading } = usePdfTemplate('declassement');

  const [lotInfo, setLotInfo] = useState({
    lot_id: '',
    lot_origin_site_id: '',
    lot_origin_client_id: '',
    lot_origin_client_name: '',
    lot_origin_client_address: '',
    lot_origin_canton: '',
    lot_origin_commune: '',
    lot_entry_date: '',
    lot_entry_at: '',
    lot_veva_code: '',
    lot_internal_code: '',
    lot_filiere: '',
    lot_quality_grade: '',
    lot_quality_metrics: '',
    lot_weight_brut: '',
    lot_weight_tare: '',
    lot_weight_net: '',
    vehicle_plate: '',
    slip_number: '',
    declassed_material: '',
    declassed_material_code: ''
  });

  const [materialSuggestions, setMaterialSuggestions] = useState<Material[]>([]);
  const [materialQuery, setMaterialQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');

  useEffect(() => {
    // Pré-remplir la date/heure d'ouverture si vide, en respectant le fuseau du navigateur / préférences
    if (!lotInfo.lot_entry_at) {
      const tz = getUserTimeZone();
      const zoned = toZonedDate(new Date(), tz);
      const nowLocal = formatDateTimeLocal(zoned);
      setLotInfo((prev) => ({ ...prev, lot_entry_at: nowLocal }));
    }

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
    const q = customerQuery.trim();
    if (q.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await Api.searchCustomers(q);
        if (!cancelled) setCustomerSuggestions(data);
      } catch (error) {
        console.error(error);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerQuery]);

  const [motif, setMotif] = useState({
    motive_principal: '',
    motive_description: '',
    incident_number: '',
    controller_name: '',
    controller_signature: '',
    motive_ratio: '',
    sorting_time_minutes: '',
    machines_used: [] as string[],
    photos: [] as FileWithPreview[]
  });

  const [apres, setApres] = useState({
    new_category: '',
    new_veva_code: '',
    new_quality: '',
    poids_net_declasse: '',
    stockage_type: '',
    destination: ''
  });

  const [legal, setLegal] = useState({
    veva_type: '',
    previous_producer: '',
    planned_transporter: '',
    veva_slip_number: '',
    swissid_signature: '',
    documents: '',
    omod_category: '',
    omod_dangerosity: '',
    omod_dismantling_required: false,
    ldtr_canton: '',
    canton_rules_applied: '',
    proof_photos: ''
  });

  const [logistique, setLogistique] = useState({
    emplacement_actuel: '',
    nouvel_emplacement: '',
    mouvement_type: '',
    transport_number: '',
    driver_id: '',
    vehicle_id: '',
    weighbridge_id: '',
    poids_final_brut: '',
    poids_final_tare: '',
    poids_final_net: '',
    seal_number: ''
  });

  const [eco, setEco] = useState({
    valeur_avant: '',
    valeur_apres: '',
    perte_gain: '',
    responsable_validation: '',
    cause_economique: '',
    impact_marge: ''
  });

  const [hse, setHse] = useState({
    risques_identifies: '',
    epis_requis: '',
    procedure_suivie: '',
    anomalie_signalee: false,
    declaration_securite: ''
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files) as FileWithPreview[];
    let current = [...motif.photos];
    const sizeNow = current.reduce((s, f) => s + f.size, 0);
    let running = sizeNow;
    const accepted: FileWithPreview[] = [];
    for (const file of incoming) {
      if (running + file.size > MAX_TOTAL_PHOTO_BYTES) {
        toast.error('Total photos > 33 MB, réduisez ou compressez.');
        break;
      }
      if (current.length + accepted.length >= 10) {
        toast.error('Maximum 10 photos autorisées.');
        break;
      }
      file.preview = URL.createObjectURL(file);
      accepted.push(file);
      running += file.size;
    }
    if (accepted.length === 0) return;
    current = [...current, ...accepted];
    setMotif((p) => ({ ...p, photos: current }));
  };

  const filesToBase64 = async (files: FileWithPreview[]) => {
    const convert = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    const out: string[] = [];
    for (const f of files) {
      out.push(await convert(f));
    }
    return out;
  };

  const buildDraftPayload = async (): Promise<any> => {
    // Pour brouillon : seulement parties 1-2 (Identification + Motif)
    const payload: any = {
      ...lotInfo,
      ...motif,
      status: 'draft',
      save_as_draft: true
    };
    
    // Traitement des champs optionnels
    if (lotInfo.lot_quality_metrics) {
      try {
        payload.lot_quality_metrics = JSON.parse(lotInfo.lot_quality_metrics || '{}');
      } catch {
        payload.lot_quality_metrics = null;
      }
    }
    
    // Photos (optionnelles pour brouillon)
    if (motif.photos.length > 0) {
      const photos = await filesToBase64(motif.photos);
      payload.photos_avant = photos;
      payload.photos_apres = photos;
    }
    
    return payload;
  };

  const buildPayload = async (isDraft = false) => {
    // Mode toujours permissif : permettre la génération PDF même avec des champs vides
    // Seuls nom client, matière et photos sont vraiment importants mais même ceux-ci peuvent être optionnels
    // pour permettre la génération d'un PDF minimal

    const payload: any = {
      ...lotInfo,
      ...motif,
      ...apres,
      ...legal,
      ...logistique,
      ...eco,
      ...hse,
      lot_quality_metrics: lotInfo.lot_quality_metrics ? JSON.parse(lotInfo.lot_quality_metrics || '{}') : null,
      documents: legal.documents ? { notes: legal.documents } : null,
      risques_identifies: hse.risques_identifies ? hse.risques_identifies.split(',').map((s) => s.trim()) : null,
      epis_requis: hse.epis_requis ? hse.epis_requis.split(',').map((s) => s.trim()) : null
    };
    
    // Si c'est un draft ou si motive_principal est vide, mettre une valeur par défaut
    if (isDraft && (!payload.motive_principal || payload.motive_principal.trim() === '')) {
      payload.motive_principal = 'À compléter';
    }
    // Photos : convertir en base64 si présentes, sinon tableau vide
    if (motif.photos.length > 0) {
      const photos = await filesToBase64(motif.photos);
      payload.photos_avant = photos;
      payload.photos_apres = photos;
      if (legal.proof_photos) {
        payload.proof_photos = photos;
      }
    } else {
      payload.photos_avant = [];
      payload.photos_apres = [];
    }
    return payload;
  };

  const handleSaveDraft = async () => {
    const payload = await buildDraftPayload();
    setLoading(true);
    try {
      let result;
      if (lastCreatedId) {
        // Mise à jour d'un déclassement existant (parties 1-2)
        result = await Api.updateDowngrade(lastCreatedId, { ...payload, status: 'pending_completion' });
        toast.success('Déclassement mis à jour et envoyé à la disposition');
      } else {
        // Création d'un nouveau déclassement (parties 1-2) → envoi à dispo
        result = await Api.createDowngrade({ ...payload, status: 'pending_completion' });
        setLastCreatedId(result.id);
        toast.success('Déclassement enregistré et envoyé à la disposition (parties 1-2)');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (withPdf = false) => {
    // Toujours utiliser le mode permissif pour permettre la génération PDF même avec des champs vides
    const payload = await buildPayload(true);
    if (!payload) {
      toast.error('Erreur lors de la préparation des données');
      return;
    }
    
    setLoading(true);
    try {
      let result;
      if (lastCreatedId) {
        // Mise à jour d'un déclassement existant
        result = await Api.updateDowngrade(lastCreatedId, { ...payload, status: 'pending_completion' });
        toast.success('Déclassement mis à jour');
      } else {
        // Création d'un nouveau déclassement
        result = await Api.createDowngrade({ ...payload, status: 'pending_completion' });
        setLastCreatedId(result.id);
        toast.success('Déclassement enregistré');
      }
      
      if (withPdf && result?.id) {
        // Générer le PDF avec les mêmes données que la prévisualisation
        try {
          console.log('Début génération PDF avec payload:', {
            client_name: payload.lot_origin_client_name,
            material: payload.lot_id || payload.declassed_material,
            photos_count: payload.photos_avant?.length || 0
          });
          
          if (!templateConfig) {
            toast.error('Template PDF non disponible, génération impossible');
            return;
          }
          
          const doc = await buildTemplatePdf(templateConfig, payload);
          
          if (!doc) {
            toast.error('Erreur: PDF non généré');
            return;
          }
          
          // Obtenir directement le base64 compressé (comme dans DestructionPage)
          const pdfBase64 = doc.output('datauristring').split(',')[1] || '';
          
          if (!pdfBase64 || pdfBase64.length < 100) {
            toast.error('Erreur: PDF généré mais base64 vide ou trop court');
            return;
          }
          
          console.log('PDF généré avec succès, taille base64:', pdfBase64.length);
          
          // Envoyer au backend pour archivage et envoi par email
          const pdfResponse = await Api.generateDowngradePdf(result.id, {
            pdf_base64: pdfBase64,
            pdf_filename: `declassement_${result.id}_${Date.now()}.pdf`,
            finalize: true
          });
          
          if (pdfResponse.email_sent) {
            toast.success('PDF généré, archivé et envoyé par email');
          } else if (pdfResponse.email_error) {
            toast.error(`PDF généré et archivé, mais erreur email: ${pdfResponse.email_error}`);
          } else {
            toast.success('PDF généré et archivé');
          }
        } catch (err: any) {
          console.error('Erreur génération/envoi PDF:', err);
          console.error('Stack trace:', err?.stack);
          toast.error('Erreur lors de la génération/envoi du PDF: ' + (err?.message || 'Erreur inconnue'));
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    // Utiliser les mêmes validations permissives que l'enregistrement
    const payload = await buildPayload(true);
    if (!payload) return;
    if (templateLoading) {
      toast.error('Template PDF en cours de chargement...');
      return;
    }
    try {
      const doc = await buildTemplatePdf(templateConfig, payload);
      openPdfPreview({ doc, filename: 'declassement.pdf' });
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erreur lors de la prévisualisation');
    }
  };

  return (
    <div className="declassement-page declassement-compact">
      <div className="page-header sticky-actions">
        <div>
          <h1>Déclassement matières</h1>
          <p>Formulaire terrain (mobile) avec preuves obligatoires</p>
        </div>
        <div className="actions sticky-mobile">
          <button className="btn-secondary" onClick={() => window.location.reload()} disabled={loading}>
            <RefreshCw size={16} />
            Reset
          </button>
          <button className="btn-secondary" onClick={() => handlePreview()} disabled={loading}>
            <Eye size={16} />
            Prévisualiser
          </button>
          <button className="btn-primary" onClick={() => handleSave(true)} disabled={loading}>
            {loading ? <RefreshCw size={16} className="spinning" /> : <Send size={16} />}
            Enregistrer & PDF
          </button>
        </div>
      </div>

      <Section title="1) Identification du lot" subtitle="ID/QR, origine, qualité, poids, analyses">
        <div className="mobile-grid">
          <div className="input-with-suggestions">
            <Input
              label="Code matières"
              value={lotInfo.lot_id}
              onChange={(lot_id) => {
                setLotInfo({ ...lotInfo, lot_id });
                setMaterialQuery(lot_id);
              }}
              placeholder="N° matière (issu de la table matières)"
            />
            {materialSuggestions.length > 0 && materialQuery.length >= 2 && (
              <div className="suggestions">
                {materialSuggestions.map((m) => {
                  const label = [m.numero, m.description || m.abrege].filter(Boolean).join(' — ');
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setLotInfo({
                          ...lotInfo,
                          lot_id: m.numero || '',
                          lot_quality_grade: m.description || m.abrege || lotInfo.lot_quality_grade
                        });
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
          <Input label="Code client" value={lotInfo.lot_internal_code} onChange={(lot_internal_code) => setLotInfo({ ...lotInfo, lot_internal_code })} />
          <Input label="Code VeVA" value={lotInfo.lot_veva_code} onChange={(lot_veva_code) => setLotInfo({ ...lotInfo, lot_veva_code })} />
          <Input label="Plaque camion" value={lotInfo.vehicle_plate} onChange={(vehicle_plate) => setLotInfo({ ...lotInfo, vehicle_plate })} />
          <Input label="N° de bon (palettes/déchargement)" value={lotInfo.slip_number} onChange={(slip_number) => setLotInfo({ ...lotInfo, slip_number })} />
          <Input label="Site origine (ID)" value={lotInfo.lot_origin_site_id} onChange={(lot_origin_site_id) => setLotInfo({ ...lotInfo, lot_origin_site_id })} />
          <div className="input-with-suggestions">
            <Input
              label="Client (nom ou ID)"
              value={customerQuery || lotInfo.lot_origin_client_name}
              onChange={(val) => {
                // Côté terrain on ne gère que le NOM + ADRESSE.
                // On évite d'envoyer des codes numériques dans un champ *_id (UUID) côté backend.
                setCustomerQuery(val);
                setLotInfo({
                  ...lotInfo,
                  lot_origin_client_name: val,
                  // Laisser l'ID interne vide pour ne pas provoquer d'erreur UUID
                  lot_origin_client_id: ''
                });
              }}
              placeholder="Saisir nom client, auto-complétion"
            />
            {customerSuggestions.length > 0 && customerQuery.length >= 2 && (
              <div className="suggestions">
                {customerSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      // On ne stocke que le nom + adresse dans le déclassement,
                      // l'ID interne client reste géré côté ERP si nécessaire.
                      setLotInfo({
                        ...lotInfo,
                        lot_origin_client_name: c.name || '',
                        lot_origin_client_address: c.address || '',
                        lot_origin_client_id: ''
                      });
                      setCustomerQuery(c.name || '');
                      setCustomerSuggestions([]);
                    }}
                  >
                    {c.name} {c.address ? `— ${c.address}` : ''}
                  </button>
                ))}
              </div>
            )}
            {lotInfo.lot_origin_client_name && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#0f172a' }}>
                Client sélectionné : {lotInfo.lot_origin_client_name}
              </p>
            )}
            {lotInfo.lot_origin_client_address && (
              <p style={{ margin: '0', fontSize: '11px', color: '#334155' }}>
                Adresse : {lotInfo.lot_origin_client_address}
              </p>
            )}
          </div>
          <Input label="Commune" value={lotInfo.lot_origin_commune} onChange={(lot_origin_commune) => setLotInfo({ ...lotInfo, lot_origin_commune })} />
          <Input label="Canton" value={lotInfo.lot_origin_canton} onChange={(lot_origin_canton) => setLotInfo({ ...lotInfo, lot_origin_canton })} />
          <Input
            label="Date & heure d'ouverture"
            type="datetime-local"
            value={lotInfo.lot_entry_at}
            onChange={(lot_entry_at) => setLotInfo({ ...lotInfo, lot_entry_at })}
          />
          <Input label="Filière" value={lotInfo.lot_filiere} onChange={(lot_filiere) => setLotInfo({ ...lotInfo, lot_filiere })} />
          <div className="input-with-suggestions">
            <Input
              label="Qualité entrante"
              value={lotInfo.lot_quality_grade}
              onChange={(lot_quality_grade) => {
                setLotInfo({ ...lotInfo, lot_quality_grade });
                setMaterialQuery(lot_quality_grade);
              }}
              placeholder="Choisir une matière (description entrante)"
            />
            {materialSuggestions.length > 0 && materialQuery.length >= 2 && (
              <div className="suggestions">
                {materialSuggestions.map((m) => {
                  const label = [m.numero, m.description || m.abrege].filter(Boolean).join(' — ');
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setLotInfo({
                          ...lotInfo,
                          lot_quality_grade: m.description || m.abrege || '',
                          lot_id: m.numero || lotInfo.lot_id
                        });
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
            <Input
              label="Matière déclassée"
              value={lotInfo.declassed_material}
              onChange={(declassed_material) => {
                setLotInfo({ ...lotInfo, declassed_material });
                setMaterialQuery(declassed_material);
              }}
              placeholder="Ex: Déchets, Rebut, etc. (autocomplétion)"
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
                        setLotInfo({
                          ...lotInfo,
                          declassed_material: m.abrege || m.description || '',
                          declassed_material_code: m.numero || '',
                          lot_id: lotInfo.lot_id
                        });
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
          <Input label="Analyses (JSON)" value={lotInfo.lot_quality_metrics} onChange={(lot_quality_metrics) => setLotInfo({ ...lotInfo, lot_quality_metrics })} placeholder='{"humidité":8,"impuretés":2}' />
          <Input label="Poids brut" value={lotInfo.lot_weight_brut} onChange={(lot_weight_brut) => setLotInfo({ ...lotInfo, lot_weight_brut })} />
          <Input label="Poids tare" value={lotInfo.lot_weight_tare} onChange={(lot_weight_tare) => setLotInfo({ ...lotInfo, lot_weight_tare })} />
          <Input label="Poids net" value={lotInfo.lot_weight_net} onChange={(lot_weight_net) => setLotInfo({ ...lotInfo, lot_weight_net })} />
        </div>
      </Section>

      <Section title="2) Motif & preuves" subtitle="Motif standard + photos (max 10)">
        <div className="mobile-grid">
          <Select
            label="Motif principal"
            value={motif.motive_principal}
            onChange={(motive_principal) => setMotif({ ...motif, motive_principal })}
            options={[
              'Contamination',
              'Mauvaise qualité',
              'Impuretés trop élevées',
              'Erreur de tri',
              'Matériau non conforme',
              'Objet dangereux trouvé',
              'Refus client',
              'Dégradation / humidité'
            ]}
          />
          <Input label="N° incident interne" value={motif.incident_number} onChange={(incident_number) => setMotif({ ...motif, incident_number })} />
          <Input label="Contrôleur (nom)" value={motif.controller_name} onChange={(controller_name) => setMotif({ ...motif, controller_name })} />
          <Input label="Signature (SwissID réf)" value={motif.controller_signature} onChange={(controller_signature) => setMotif({ ...motif, controller_signature })} />
          <Input label="% déclassé" value={motif.motive_ratio} onChange={(motive_ratio) => setMotif({ ...motif, motive_ratio })} placeholder="Ex: 50%" />
          <Input label="Temps de tri (min)" value={motif.sorting_time_minutes} onChange={(sorting_time_minutes) => setMotif({ ...motif, sorting_time_minutes })} placeholder="Ex: 30" />
          <Select
            label="Machines utilisées"
            value="" // unused, we only use onChange to push into array
            onChange={(machine) => {
              if (!machine) return;
              setMotif((prev) =>
                prev.machines_used.includes(machine)
                  ? prev
                  : { ...prev, machines_used: [...prev.machines_used, machine] }
              );
            }}
            options={['Élévateur', 'Chargeuse', 'Grappin', 'Broyeur']}
          />
          {motif.machines_used.length > 0 && (
            <div className="form-group full">
              <label>Machines sélectionnées</label>
              <div className="chips-row">
                {motif.machines_used.map((m) => (
                  <span key={m} className="chip">
                    {m}
                    <button
                      type="button"
                      onClick={() =>
                        setMotif((prev) => ({
                          ...prev,
                          machines_used: prev.machines_used.filter((x) => x !== m)
                        }))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="form-group full">
            <label>Description détaillée</label>
            <textarea rows={2} value={motif.motive_description} onChange={(e) => setMotif({ ...motif, motive_description: e.target.value })} />
          </div>
          <FilePicker label="Photos (1 à 10)" onChange={(files) => handleFiles(files)} files={motif.photos} />
        </div>
        <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #0ea5e9' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0c4a6e', fontWeight: '500' }}>
            📤 Envoi à la disposition (parties 1-2)
          </p>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#075985' }}>
            Enregistrez et envoyez les parties 1-2 à la disposition. La disposition pourra compléter les parties 3-8 et générer le PDF complet.
          </p>
          <button 
            className="btn-primary" 
            onClick={handleSaveDraft} 
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? <RefreshCw size={16} className="spinning" /> : <Send size={16} />}
            {lastCreatedId ? 'Mettre à jour et renvoyer' : 'Enregistrer et envoyer à la disposition'}
          </button>
          {lastCreatedId && (
            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#0284c7' }}>
              ✓ Envoyé à la disposition (ID: {lastCreatedId.slice(0, 8)}...)
            </p>
          )}
        </div>
      </Section>

      <Section title="3) Nouvelles caractéristiques" subtitle="Ce que devient le lot">
        <div className="mobile-grid">
          <Input label="Nouvelle catégorie / filière" value={apres.new_category} onChange={(new_category) => setApres({ ...apres, new_category })} />
          <Input label="Nouveau code VeVA" value={apres.new_veva_code} onChange={(new_veva_code) => setApres({ ...apres, new_veva_code })} />
          <Input label="Nouvelle qualité (D/E/reject)" value={apres.new_quality} onChange={(new_quality) => setApres({ ...apres, new_quality })} />
          <Input label="Poids net déclassé" value={apres.poids_net_declasse} onChange={(poids_net_declasse) => setApres({ ...apres, poids_net_declasse })} />
          <Input label="Stockage (benne/big-bag/palette/bac)" value={apres.stockage_type} onChange={(stockage_type) => setApres({ ...apres, stockage_type })} />
          <Input label="Destination (tri/incinération/export...)" value={apres.destination} onChange={(destination) => setApres({ ...apres, destination })} />
        </div>
      </Section>

      <Section title="4) Légal CH (VeVA / OMOD / LDTR)" subtitle="Conformité cantonale et docs">
        <div className="mobile-grid">
          <Input label="Type VeVA" value={legal.veva_type} onChange={(veva_type) => setLegal({ ...legal, veva_type })} />
          <Input label="Producteur précédent" value={legal.previous_producer} onChange={(previous_producer) => setLegal({ ...legal, previous_producer })} />
          <Input label="Transporteur prévu" value={legal.planned_transporter} onChange={(planned_transporter) => setLegal({ ...legal, planned_transporter })} />
          <Input label="N° bordereau VeVA" value={legal.veva_slip_number} onChange={(veva_slip_number) => setLegal({ ...legal, veva_slip_number })} />
          <Input label="Signature SwissID resp." value={legal.swissid_signature} onChange={(swissid_signature) => setLegal({ ...legal, swissid_signature })} />
          <Input label="Docs (certifs/SDS) - texte" value={legal.documents} onChange={(documents) => setLegal({ ...legal, documents })} />
          <Input label="OMOD/DEEE catégorie" value={legal.omod_category} onChange={(omod_category) => setLegal({ ...legal, omod_category })} />
          <Input label="Dangerosité" value={legal.omod_dangerosity} onChange={(omod_dangerosity) => setLegal({ ...legal, omod_dangerosity })} />
          <Checkbox label="Démontage obligatoire" checked={legal.omod_dismantling_required} onChange={(omod_dismantling_required) => setLegal({ ...legal, omod_dismantling_required })} />
          <Input label="LDTR canton" value={legal.ldtr_canton} onChange={(ldtr_canton) => setLegal({ ...legal, ldtr_canton })} />
          <Input label="Règles cantonales appliquées" value={legal.canton_rules_applied} onChange={(canton_rules_applied) => setLegal({ ...legal, canton_rules_applied })} />
          <Input label="Preuve tri (texte)" value={legal.proof_photos} onChange={(proof_photos) => setLegal({ ...legal, proof_photos })} />
        </div>
      </Section>

      <Section title="5) Logistique & mouvement" subtitle="Où va le lot, qui le transporte, quand">
        <div className="mobile-grid">
          <Input label="Emplacement actuel" value={logistique.emplacement_actuel} onChange={(emplacement_actuel) => setLogistique({ ...logistique, emplacement_actuel })} />
          <Input label="Nouvel emplacement" value={logistique.nouvel_emplacement} onChange={(nouvel_emplacement) => setLogistique({ ...logistique, nouvel_emplacement })} />
          <Input label="Mouvement (interne/externe)" value={logistique.mouvement_type} onChange={(mouvement_type) => setLogistique({ ...logistique, mouvement_type })} />
          <Input label="N° transport" value={logistique.transport_number} onChange={(transport_number) => setLogistique({ ...logistique, transport_number })} />
          <Input label="Chauffeur (ID employé)" value={logistique.driver_id} onChange={(driver_id) => setLogistique({ ...logistique, driver_id })} />
          <Input label="Véhicule (ID)" value={logistique.vehicle_id} onChange={(vehicle_id) => setLogistique({ ...logistique, vehicle_id })} />
          <Input label="Pont bascule (ID)" value={logistique.weighbridge_id} onChange={(weighbridge_id) => setLogistique({ ...logistique, weighbridge_id })} />
          <Input label="Poids final brut" value={logistique.poids_final_brut} onChange={(poids_final_brut) => setLogistique({ ...logistique, poids_final_brut })} />
          <Input label="Poids final tare" value={logistique.poids_final_tare} onChange={(poids_final_tare) => setLogistique({ ...logistique, poids_final_tare })} />
          <Input label="Poids final net" value={logistique.poids_final_net} onChange={(poids_final_net) => setLogistique({ ...logistique, poids_final_net })} />
          <Input label="N° scellé (QR)" value={logistique.seal_number} onChange={(seal_number) => setLogistique({ ...logistique, seal_number })} />
        </div>
      </Section>

      <Section title="6) Valeur économique" subtitle="Perte/gain et impact marge">
        <div className="mobile-grid">
          <Input label="Valeur avant (CHF/tonne)" value={eco.valeur_avant} onChange={(valeur_avant) => setEco({ ...eco, valeur_avant })} />
          <Input label="Valeur après (CHF/tonne)" value={eco.valeur_apres} onChange={(valeur_apres) => setEco({ ...eco, valeur_apres })} />
          <Input label="Perte / gain" value={eco.perte_gain} onChange={(perte_gain) => setEco({ ...eco, perte_gain })} />
          <Input label="Responsable validation" value={eco.responsable_validation} onChange={(responsable_validation) => setEco({ ...eco, responsable_validation })} />
          <Input label="Cause économique" value={eco.cause_economique} onChange={(cause_economique) => setEco({ ...eco, cause_economique })} />
          <Input label="Impact marge" value={eco.impact_marge} onChange={(impact_marge) => setEco({ ...eco, impact_marge })} />
        </div>
      </Section>

      <Section title="7) Sécurité & environnement (HSE)" subtitle="Risques, EPI, anomalies">
        <div className="mobile-grid">
          <Input label="Risques (chimique, coupure, ADR...)" value={hse.risques_identifies} onChange={(risques_identifies) => setHse({ ...hse, risques_identifies })} />
          <Input label="EPI requis" value={hse.epis_requis} onChange={(epis_requis) => setHse({ ...hse, epis_requis })} />
          <Input label="Procédure suivie" value={hse.procedure_suivie} onChange={(procedure_suivie) => setHse({ ...hse, procedure_suivie })} />
          <Checkbox label="Anomalie signalée" checked={hse.anomalie_signalee} onChange={(anomalie_signalee) => setHse({ ...hse, anomalie_signalee })} />
          <Input label="Déclaration sécurité" value={hse.declaration_securite} onChange={(declaration_securite) => setHse({ ...hse, declaration_securite })} />
        </div>
      </Section>

      <Section title="8) Résumé & export" subtitle="PDF + bordereau VeVA archivés 10 ans (placeholder PDF)">
        <div className="actions stack-mobile">
          <button className="btn-secondary" onClick={() => handlePreview()} disabled={loading}>
            <Eye size={16} />
            Prévisualiser PDF
          </button>
          <button className="btn-secondary" onClick={() => handleSave(false)} disabled={loading}>
            <FileDown size={16} />
            Sauvegarder brouillon
          </button>
          <button className="btn-primary" onClick={() => handleSave(true)} disabled={loading}>
            <Send size={16} />
            Sauvegarder & archiver
          </button>
        </div>
        <p className="hint">
          Les pièces (PDF/VeVA) sont générées côté serveur (placeholders) et archivées 10 ans.
        </p>
      </Section>
    </div>
  );
};

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="card section-card">
    <div className="card-header">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
    <div className="card-body">{children}</div>
  </div>
);

type InputProps = {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
};

const Input = ({ label, value, onChange, placeholder, type = 'text' }: InputProps) => (
  <div className="form-group">
    <label>{label}</label>
    <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <div className="form-group">
    <label>{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sélectionner</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

const Checkbox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="checkbox-row">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

const FilePicker = ({ label, onChange, files }: { label: string; onChange: (files: FileList | null) => void; files: FileWithPreview[] }) => (
  <div className="form-group">
    <label>{label}</label>
    <div className="file-drop">
      <Upload size={16} />
      <span>Ajouter des fichiers</span>
      <input type="file" accept="image/*" multiple onChange={(e) => onChange(e.target.files)} />
    </div>
    <Chips files={files} />
  </div>
);

const Chips = ({ files }: { files: FileWithPreview[] }) => (
  <div className="photo-list">
    {files.map((f, i) => (
      <div key={`${f.name}-${i}`} className="photo-chip">
        {f.name}
      </div>
    ))}
  </div>
);

// Fonction pour compresser une image base64 avant de l'ajouter au PDF
// Améliorée pour gérer Samsung, Oppo et autres appareils Android
const compressImageBase64 = async (base64Data: string, maxWidth = 1400, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Normaliser le format base64 (supprimer les espaces, retours à la ligne, etc.)
    let normalizedBase64 = base64Data.trim();
    
    // Si ce n'est pas une data URL, essayer de la créer
    if (!normalizedBase64.startsWith('data:')) {
      // Essayer différents formats MIME courants pour Android
      const possibleFormats = ['image/jpeg', 'image/png', 'image/webp'];
      let found = false;
      for (const format of possibleFormats) {
        try {
          const testData = `data:${format};base64,${normalizedBase64}`;
          const testImg = new window.Image();
          testImg.onload = () => {
            found = true;
            normalizedBase64 = testData;
          };
          testImg.onerror = () => {};
          testImg.src = testData;
        } catch {}
      }
      // Par défaut, utiliser JPEG
      if (!found) {
        normalizedBase64 = `data:image/jpeg;base64,${normalizedBase64}`;
      }
    }
    
    const img = new window.Image();
    img.crossOrigin = 'anonymous'; // Important pour certains navigateurs Android
    
    // Timeout de sécurité (5 secondes)
    const timeout = setTimeout(() => {
      console.warn('Timeout compression image');
      resolve(normalizedBase64);
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.warn('Impossible d\'obtenir le contexte canvas');
          resolve(normalizedBase64);
          return;
        }
        
        // Corriger l'orientation si nécessaire (pour Samsung/Oppo)
        ctx.save();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Toujours convertir en JPEG pour compatibilité maximale
        const result = canvas.toDataURL('image/jpeg', quality);
        if (result && result.length > 100) {
          resolve(result);
        } else {
          console.warn('Compression échouée, utilisation de l\'image originale');
          resolve(normalizedBase64);
        }
      } catch (err) {
        console.warn('Erreur lors de la compression:', err);
        resolve(normalizedBase64);
      }
    };
    
    img.onerror = (err) => {
      clearTimeout(timeout);
      console.warn('Erreur chargement image pour compression:', err, normalizedBase64.substring(0, 100));
      // Essayer quand même avec l'image originale
      resolve(normalizedBase64);
    };
    
    img.src = normalizedBase64;
  });
};

const buildTemplatePdf = async (templateConfig: PdfTemplateConfig | null, data: any) => {
  if (!templateConfig) {
    throw new Error('Template PDF introuvable.');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  const margin = 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const safeWidth = pageWidth - margin * 2;

  // Récupération des palettes par zone
  const headerPalette = getZonePalette(templateConfig, 'header');
  const bodyPalette = getZonePalette(templateConfig, 'body');
  const highlightPalette = getZonePalette(templateConfig, 'highlight');

  // Conversion RGB pour jsPDF
  const rgbToArray = (rgb: [number, number, number]) => rgb;
  const applyColor = (rgb: [number, number, number]) => {
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  };
  const applyFillColor = (rgb: [number, number, number]) => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  };

  // Définition des couleurs de titre pour réutilisation
  const bodyTitleColor = rgbToArray(bodyPalette.title);

  // ========== HEADER ==========
  // Zone 1 - En-tête avec TOUTES les propriétés de la zone header
  const headerBg = rgbToArray(headerPalette.background);
  const headerTextColor = rgbToArray(headerPalette.text); // Texte général (blanc #ffffff)
  const headerTitleColor = rgbToArray(headerPalette.title); // Titre/accent (noir #000000 mais sur fond noir, on utilise textColor)
  const headerSubtitleColor = rgbToArray(headerPalette.subtitle); // Sous-titre (gris clair #d1d5db)
  
  const headerHeight = 100;
  
  // Fond de l'en-tête (barre noire en haut) - utilise backgroundColor de Zone 1
  applyFillColor(headerBg);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  let y = margin;
  
  // Logo Retripa à gauche (sur fond header)
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

  // Titre principal - Sur fond noir, utiliser textColor (blanc) au lieu de titleColor (noir)
  // Si titleColor est noir sur fond noir, utiliser textColor pour la visibilité
  const headerBgIsDark = headerBg[0] < 128 && headerBg[1] < 128 && headerBg[2] < 128;
  const headerTitleIsDark = headerTitleColor[0] < 128 && headerTitleColor[1] < 128 && headerTitleColor[2] < 128;
  const titleColorToUse = (headerBgIsDark && headerTitleIsDark) ? headerTextColor : headerTitleColor;
  
  applyColor(titleColorToUse);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const titleX = margin + 130;
  const titleY = y + 20;
  doc.text(templateConfig?.title || 'Déclassement de matières', titleX, titleY);
  
  // Sous-titre - utilise subtitleColor de la zone header (#d1d5db)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  applyColor(headerSubtitleColor);
  doc.text(templateConfig?.subtitle || 'Rapport de tri', titleX, titleY + 18);
  
  // Date ouverture (sinon fallback now) en français à droite, fuseau utilisateur
  const tz = getUserTimeZone();
  const refDate = data.lot_entry_at ? toZonedDate(new Date(data.lot_entry_at), tz) : toZonedDate(new Date(), tz);
  const weekday = refDate.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: tz });
  const day = refDate.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: tz });
  const month = refDate.toLocaleDateString('fr-FR', { month: 'long', timeZone: tz });
  const year = refDate.toLocaleDateString('fr-FR', { year: 'numeric', timeZone: tz });
  const hours = refDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  const dateStr = `${weekday}, ${day} ${month} ${year} à ${hours}`;
  applyColor(headerSubtitleColor);
  doc.setFontSize(10);
  const dateWidth = doc.getTextWidth(dateStr);
  doc.text(dateStr, pageWidth - margin - dateWidth, titleY + 18);

  // Position de départ pour le contenu (après l'en-tête)
  y = headerHeight + margin;

  // ========== SECTION CLIENT (Zone highlight) ==========
  const highlightBg = rgbToArray(highlightPalette.background);
  const highlightTitleColor = rgbToArray(highlightPalette.title);
  const highlightTextColor = rgbToArray(highlightPalette.text);

  y += 10;
  const sectionPadding = 12;

  // Préparer les lignes client (UNIQUEMENT les infos essentielles)
  const clientLines: string[] = [];
  const clientName = data.lot_origin_client_name || data.lot_origin_client_id || '—';
  if (clientName && clientName !== '—') {
    clientLines.push(`Nom de l'entreprise : ${clientName}`);
  }
  if (data.lot_origin_client_address && data.lot_origin_client_address.trim() !== '') {
    clientLines.push(`Adresse : ${data.lot_origin_client_address}`);
  }
  // Vérifier vehicle_plate avec différentes variantes possibles
  const vehiclePlate = data.vehicle_plate || data.vehiclePlate || '';
  if (vehiclePlate && String(vehiclePlate).trim() !== '') {
    clientLines.push(`Plaque véhicule : ${String(vehiclePlate).trim()}`);
  }
  // Ajouter aussi le n° de bon (slip_number)
  const slipNumber = data.slip_number || data.slipNumber || '';
  if (slipNumber && String(slipNumber).trim() !== '') {
    clientLines.push(`N° de bon : ${String(slipNumber).trim()}`);
  }

  const clientLineHeight = 14;
  const clientCardHeight = sectionPadding * 2 + clientLines.length * clientLineHeight + 14; // +14 pour le titre

  // Fond et cadre
  applyFillColor(highlightBg);
  doc.setDrawColor(highlightTextColor[0], highlightTextColor[1], highlightTextColor[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, safeWidth, clientCardHeight, 6, 6, 'FD');

  // Titre "Client"
  applyColor(bodyPalette.title); // bleu
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Client', margin + sectionPadding, y + 20);

  // Informations client
  applyColor(highlightTextColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  let infoY = y + 34;
  clientLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, safeWidth - sectionPadding * 2);
    doc.text(wrapped, margin + sectionPadding, infoY);
    infoY += clientLineHeight;
  });

  y += clientCardHeight + 6;

  // ========== SECTION MATIÈRES DÉCLARÉES (Zone highlight) ==========
  y += 10;
  
  // Fond bleu clair pour section Matières (encadré auto-ajusté)
  const colX = [
    margin + sectionPadding,
    margin + sectionPadding + 150,
    margin + sectionPadding + 500
  ];
  const headers = ['Code matières', 'Description matières', 'Matières en %'];

  // Ligne 1 : matières entrante (annoncée)
  const codeEntree = data.lot_id || data.lot_internal_code || '—';
  const descEntree = data.lot_quality_grade || data.lot_filiere || '—';

  // % déclassé / % bon
  const ratioNum = parseFloat((data.motive_ratio || '').toString().replace('%', '').trim());
  const isValidRatio = !isNaN(ratioNum);
  const pctDeclasse = isValidRatio ? `${Math.max(0, Math.min(100, ratioNum))}%` : '—';
  const pctBon = isValidRatio ? `${Math.max(0, Math.min(100, 100 - ratioNum))}%` : '—';

  // Ligne 2 : matières déclassée (SEULEMENT la matière, rien d'autre)
  const codeDecl = data.declassed_material_code || '—';
  const descDecl = data.declassed_material || '—';

  // Calcul hauteur dynamique avec wrapping
  const lineH = 14;
  const descEntreeWrapped = doc.splitTextToSize(descEntree, colX[2] - colX[1] - 6);
  const descDeclWrapped = doc.splitTextToSize(descDecl, colX[2] - colX[1] - 6);
  const headerH = lineH;
  const row1H = Math.max(lineH, descEntreeWrapped.length * lineH);
  const row2H = Math.max(lineH, descDeclWrapped.length * lineH);
  const sectionHeightMat = sectionPadding * 2 + headerH + row1H + row2H + 8; // marge interne

  applyFillColor(highlightBg);
  doc.setDrawColor(highlightTextColor[0], highlightTextColor[1], highlightTextColor[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, safeWidth, sectionHeightMat, 6, 6, 'FD');

  // Titre "Matières constatées"
  applyColor(highlightTitleColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  applyColor(bodyPalette.title); // titres en bleu (palette body/title)
  doc.text('Matières constatées', margin + sectionPadding, y + 20);

  // Tableau matières
  applyColor(highlightTextColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  infoY = y + 34;

  doc.setFont('helvetica', 'bold');
  doc.text(headers[0], colX[0], infoY);
  doc.text(headers[1], colX[1], infoY);
  doc.text(headers[2], colX[2], infoY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  infoY += lineH;
  // Ligne annoncée
  doc.text(codeEntree, colX[0], infoY);
  doc.text(descEntreeWrapped, colX[1], infoY);
  doc.text(pctBon, colX[2], infoY, { align: 'right' });

  // Ligne déclassée
  infoY += row1H;
  doc.text(codeDecl, colX[0], infoY);
  doc.text(descDeclWrapped, colX[1], infoY);
  doc.text(pctDeclasse, colX[2], infoY, { align: 'right' });

  y += sectionHeightMat + 8;

  // ========== SECTION DÉCLASSEMENT MATIÈRES (Zone 2: Motif & preuves) ==========
  y += 10;
  
  // Collecter les données de la zone 2 qui sont renseignées
  const motifData: Array<{ label: string; value: string }> = [];
  
  if (data.motive_principal && String(data.motive_principal).trim() !== '' && data.motive_principal !== 'À compléter') {
    motifData.push({ label: 'Motif principal', value: String(data.motive_principal).trim() });
  }
  
  if (data.incident_number && String(data.incident_number).trim() !== '') {
    motifData.push({ label: 'N° incident interne', value: String(data.incident_number).trim() });
  }
  
  if (data.controller_name && String(data.controller_name).trim() !== '') {
    motifData.push({ label: 'Contrôleur', value: String(data.controller_name).trim() });
  }
  
  if (data.controller_signature && String(data.controller_signature).trim() !== '') {
    motifData.push({ label: 'Signature (SwissID)', value: String(data.controller_signature).trim() });
  }
  
  if (data.motive_ratio && String(data.motive_ratio).trim() !== '') {
    let ratioValue = String(data.motive_ratio).trim();
    // S'assurer que le symbole % est présent
    if (!ratioValue.includes('%')) {
      ratioValue = `${ratioValue}%`;
    }
    // Ajouter "en : [matière déclassée]" après le pourcentage
    const matiereDeclassee = data.declassed_material && String(data.declassed_material).trim() !== ''
      ? String(data.declassed_material).trim()
      : '';
    const valueWithMatiere = matiereDeclassee 
      ? `${ratioValue} en : ${matiereDeclassee}`
      : ratioValue;
    motifData.push({ label: '% déclassé', value: valueWithMatiere });
  }
  
  if (data.sorting_time_minutes && String(data.sorting_time_minutes).trim() !== '') {
    motifData.push({ label: 'Temps de tri', value: `${String(data.sorting_time_minutes).trim()} min` });
  }
  
  if (data.machines_used && Array.isArray(data.machines_used) && data.machines_used.length > 0) {
    const machinesStr = data.machines_used.filter((m: any) => m && String(m).trim() !== '').join(', ');
    if (machinesStr) {
      motifData.push({ label: 'Machines utilisées', value: machinesStr });
    }
  }
  
  if (data.motive_description && String(data.motive_description).trim() !== '') {
    motifData.push({ label: 'Description détaillée', value: String(data.motive_description).trim() });
  }
  
  // Afficher la section seulement si au moins un champ est renseigné
  if (motifData.length > 0) {
    const motifColX = [
      margin + sectionPadding,
      margin + sectionPadding + 200
    ];
    const motifLineH = 14;
    const motifTitleH = 20;
    
    // Calculer la hauteur dynamique avec wrapping pour les valeurs
    let motifSectionHeight = sectionPadding * 2 + motifTitleH;
    motifData.forEach((item) => {
      const wrapped = doc.splitTextToSize(item.value, safeWidth - motifColX[1] - sectionPadding);
      motifSectionHeight += Math.max(motifLineH, wrapped.length * motifLineH) + 2;
    });
    
    // Fond et cadre pour section Déclassement matières
    applyFillColor(highlightBg);
    doc.setDrawColor(highlightTextColor[0], highlightTextColor[1], highlightTextColor[2]);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, safeWidth, motifSectionHeight, 6, 6, 'FD');
    
    // Titre "Déclassement matières" - en bleu
    applyColor(bodyTitleColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Déclassement matières', margin + sectionPadding, y + 18);
    
    // Tableau des données (avec espace après le titre)
    applyColor(highlightTextColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    let motifY = y + motifTitleH + 12; // Augmenté de 8 à 12 pour plus d'espace
    
    motifData.forEach((item) => {
      // Label en gras
      doc.setFont('helvetica', 'bold');
      doc.text(item.label + ' :', motifColX[0], motifY);
      
      // Valeur en normal (avec wrapping)
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(item.value, safeWidth - motifColX[1] - sectionPadding);
      doc.text(wrapped, motifColX[1], motifY);
      
      motifY += Math.max(motifLineH, wrapped.length * motifLineH) + 4;
    });
    
    y += motifSectionHeight + 8;
  }

  // ========== SECTION PHOTOS ==========
  y += 10;
  const photos = (data.photos_avant || data.photos_apres || data.photos || []).map((p: any, idx: number) => ({
    src: p,
    label: `Photo ${idx + 1}`
  }));
  const photoWidth = (safeWidth - 20) / 2;
  const photoHeight = 90;
  const sectionPaddingPhotos = 12;
  const rows = Math.max(1, Math.ceil(Math.min(photos.length, 4) / 2));
  const titleBlockH = 24;
  const photosBlockH = rows * (photoHeight + 30);
  const sectionHeightPhotos = sectionPaddingPhotos * 2 + titleBlockH + photosBlockH;

  // Cadre photos
  applyFillColor(highlightBg);
  doc.setDrawColor(highlightTextColor[0], highlightTextColor[1], highlightTextColor[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, safeWidth, sectionHeightPhotos, 6, 6, 'FD');

  // Titre "Photos" - en bleu
  applyColor(bodyTitleColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Photos', margin + sectionPaddingPhotos, y + 18);

  // Grille photos à l'intérieur du cadre
  let photoY = y + sectionPaddingPhotos + titleBlockH;
  for (let i = 0; i < Math.min(photos.length, 4); i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + sectionPaddingPhotos + col * (photoWidth + 20);
    const currentY = photoY + row * (photoHeight + 30);

    try {
      let imgData: string | null = null;
      const photoSrc = photos[i].src;
      
      // Normaliser la source de la photo (supprimer espaces, retours à la ligne)
      const normalizedSrc = typeof photoSrc === 'string' ? photoSrc.trim().replace(/\s+/g, '') : photoSrc;
      
      // Si c'est déjà une data URL base64, l'utiliser directement
      if (typeof normalizedSrc === 'string' && normalizedSrc.startsWith('data:image/')) {
        imgData = normalizedSrc;
      } else if (typeof normalizedSrc === 'string' && normalizedSrc.length > 100) {
        // Essayer de détecter si c'est du base64 pur (sans préfixe data:)
        const base64Pattern = /^[A-Za-z0-9+/=]+$/;
        const withoutPrefix = normalizedSrc.replace(/^data:image\/[a-z]+;base64,/, '');
        
        if (base64Pattern.test(withoutPrefix) && withoutPrefix.length > 50) {
          // C'est probablement du base64, utiliser JPEG par défaut (le plus compatible avec Android)
          // La fonction compressImageBase64 essaiera automatiquement différents formats si nécessaire
          imgData = `data:image/jpeg;base64,${withoutPrefix}`;
        } else {
          // Sinon, essayer resolveTemplateImage
          imgData = await resolveTemplateImage(normalizedSrc);
        }
      } else {
        // Essayer resolveTemplateImage
        imgData = await resolveTemplateImage(normalizedSrc);
      }
      
      if (imgData) {
        // Compresser l'image avant de l'ajouter au PDF pour réduire la taille
        imgData = await compressImageBase64(imgData, 1400, 0.75);
        
        const imgProps = (doc as any).getImageProperties(imgData);
        const aspectRatio = imgProps.width / imgProps.height;
        let w = photoWidth;
        let h = photoWidth / aspectRatio;
        
        if (h > photoHeight) {
          h = photoHeight;
          w = photoHeight * aspectRatio;
        }
        
        const centerX = x + (photoWidth - w) / 2;
        // Déterminer le format d'image (JPEG, PNG, etc.)
        const imageFormat = imgData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(imgData, imageFormat, centerX, currentY, w, h);
        
        // Label sous la photo
        const bodyTextColor = rgbToArray(bodyPalette.text);
        applyColor(bodyTextColor);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(photos[i].label, x + photoWidth / 2 - doc.getTextWidth(photos[i].label) / 2, currentY + h + 12);
      } else {
        // Aucune image trouvée
        const bodyTextColor = rgbToArray(bodyPalette.text);
        applyColor(bodyTextColor);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${photos[i].label} (image non disponible)`, x, currentY + 14);
      }
    } catch (err) {
      console.warn('Erreur chargement photo:', err, photos[i].src);
      const bodyTextColor = rgbToArray(bodyPalette.text);
      applyColor(bodyTextColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${photos[i].label} (erreur: ${err instanceof Error ? err.message : 'inconnue'})`, x, currentY + 14);
    }
  }

  // ========== FOOTER ==========
  const footerBase = pageHeight - 60;
  const footerY = Math.max(footerBase, y + sectionHeightPhotos + 10);
  const footerLines = getFooterLines(templateConfig);
  
  // Contact Retripa à gauche - Zone 1 (Header) - utilise subtitleColor (#d1d5db gris clair)
  // Mais sur fond blanc, utiliser une couleur plus foncée pour la lisibilité
  const footerTextColor = rgbToArray(headerPalette.subtitle);
  // Si subtitleColor est trop clair pour fond blanc, utiliser body textColor
  const footerIsLight = footerTextColor[0] > 200 && footerTextColor[1] > 200 && footerTextColor[2] > 200;
  const footerColorToUse = footerIsLight ? rgbToArray(bodyPalette.text) : footerTextColor;
  applyColor(footerColorToUse);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  if (footerLines.length > 0) {
    footerLines.forEach((line, idx) => {
      doc.text(line, margin, footerY + idx * 11);
    });
  }

  // Logos de certification à droite (SGS, etc.) - placeholder
  // Note: Ces logos devraient être dans le template ou configurés séparément
  const certLogoSize = 20;
  const certX = pageWidth - margin - certLogoSize * 3 - 20;
  
  // Placeholder pour logos de certification (SGS, etc.)
  // Si vous avez des logos de certification dans le template, ajoutez-les ici
  if (templateConfig?.footerLogo) {
    try {
      const img = await resolveTemplateImage(templateConfig.footerLogo);
      if (img) {
        // Afficher le logo 3 fois (comme dans l'exemple)
        for (let i = 0; i < 3; i++) {
          doc.addImage(img, 'PNG', certX + i * (certLogoSize + 10), footerY, certLogoSize, certLogoSize);
        }
      }
    } catch (err) {
      console.warn('Erreur chargement logo footer:', err);
    }
  }

  return doc;
};

export default DeclassementPage;

