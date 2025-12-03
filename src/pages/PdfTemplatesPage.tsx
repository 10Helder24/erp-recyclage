import { useEffect, useMemo, useState } from 'react';
import { Loader2, Images, Upload, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  Api,
  type PdfTemplate,
  type PdfTemplateConfig,
  type PdfTemplateZoneConfig
} from '../lib/api';

const MODULE_LABELS: Record<string, string> = {
  declassement: 'Déclassement de matières',
  destruction: 'Destruction matières',
  leave: 'Demandes de congé',
  cdt: 'CDT Sheets',
  inventory: 'Inventaire halle',
  expedition: 'Expéditions'
};

const ZONE_LABELS: Record<'header' | 'body' | 'highlight', string> = {
  header: 'Zone 1 · En-tête',
  body: 'Zone 2 · Corps / textes',
  highlight: 'Zone 3 · Surbrillance / tableaux'
};

const ZONE_FIELDS: Array<{
  field: keyof PdfTemplateZoneConfig;
  label: string;
  placeholder: string;
}> = [
  { field: 'backgroundColor', label: 'Fond', placeholder: '#0f172a' },
  { field: 'textColor', label: 'Texte', placeholder: '#ffffff' },
  { field: 'titleColor', label: 'Titre / accent', placeholder: '#22c55e' },
  { field: 'subtitleColor', label: 'Sous-titre', placeholder: '#94a3b8' }
];

const ZONE_KEYS: Array<'header' | 'body' | 'highlight'> = ['header', 'body', 'highlight'];

const EMPTY_CONFIG: PdfTemplateConfig = {
  headerLogo: '',
  footerLogo: '',
  title: '',
  subtitle: '',
  primaryColor: '',
  accentColor: '',
  footerText: '',
  customTexts: {},
  zones: {}
};

const PdfTemplatesPage = () => {
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [form, setForm] = useState<PdfTemplateConfig>(EMPTY_CONFIG);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchPdfTemplates();
      setTemplates(data);
      if (!selectedModule) {
        const firstModule = Object.keys(MODULE_LABELS)[0];
        setSelectedModule(firstModule || null);
      }
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les templates');
      if (!selectedModule) {
        const firstModule = Object.keys(MODULE_LABELS)[0];
        setSelectedModule(firstModule || null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const currentTemplate = useMemo(
    () => templates.find((tpl) => tpl.module === selectedModule),
    [templates, selectedModule]
  );

  useEffect(() => {
    if (selectedModule) {
      if (currentTemplate) {
        setForm({
          ...EMPTY_CONFIG,
          ...currentTemplate.config
        });
      } else {
        setForm(EMPTY_CONFIG);
      }
    }
  }, [currentTemplate, selectedModule]);

  const handleInputChange = (field: keyof PdfTemplateConfig, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomTextChange = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      customTexts: {
        ...(prev.customTexts || {}),
        [key]: value
      }
    }));
  };

  const handleZoneColorChange = (zone: 'header' | 'body' | 'highlight', field: keyof PdfTemplateZoneConfig, value: string) => {
    setForm((prev) => ({
      ...prev,
      zones: {
        ...(prev.zones || {}),
        [zone]: {
          ...(prev.zones?.[zone] || {}),
          [field]: value
        }
      }
    }));
  };

  const handleLogoUpload = async (field: 'headerLogo' | 'footerLogo', file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      handleInputChange(field, dataUrl);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de lire le fichier');
    }
  };

  // Notifier tous les onglets/fenêtres qu'un template a été mis à jour
  const notifyTemplateUpdate = () => {
    if (typeof window !== 'undefined') {
      // Utiliser localStorage pour notifier les autres onglets
      localStorage.setItem('pdf_template_updated', Date.now().toString());
      localStorage.removeItem('pdf_template_updated'); // Retirer immédiatement pour permettre de nouvelles notifications
      
      // Notifier aussi la fenêtre actuelle
      window.dispatchEvent(new Event('pdf_template_updated'));
    }
  };

  const handleSave = async () => {
    if (!selectedModule) return;
    try {
      setSaving(true);
      const updated = await Api.updatePdfTemplate(selectedModule, form);
      setTemplates((prev) => {
        const existing = prev.filter((tpl) => tpl.module !== updated.module);
        return [...existing, updated];
      });
      toast.success('Template enregistré');
      // Notifier tous les utilisateurs que le template a été mis à jour
      notifyTemplateUpdate();
    } catch (error) {
      console.error(error);
      toast.error('Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  if (loading && templates.length === 0) {
    return (
      <div className="destruction-page">
        <div className="destruction-card" style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 className="spinner" size={32} />
          <p style={{ marginTop: 12 }}>Chargement des templates...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="destruction-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">PDF & Exports</p>
          <h1>Templates personnalisables</h1>
          <p className="page-subtitle">Logo, couleurs et textes éditables par module.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline" onClick={loadTemplates}>
            <RefreshCw size={16} />
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="destruction-card">
        {templates.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
              Aucun template personnalisé. Les valeurs par défaut sont utilisées.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
              Sélectionnez un module ci-dessous pour personnaliser son template PDF.
            </p>
          </div>
        ) : null}
        <div className="templates-grid">
          {Object.keys(MODULE_LABELS).map((module) => {
            const template = templates.find((tpl) => tpl.module === module);
            return (
              <button
                key={module}
                type="button"
                className={`template-tile${selectedModule === module ? ' active' : ''}`}
                onClick={() => setSelectedModule(module)}
              >
                <div className="template-tile__icon">
                  <Images size={20} />
                </div>
                <div>
                  <strong>{MODULE_LABELS[module] || module}</strong>
                  <p>
                    {template?.updated_at
                      ? `Modifié le ${new Date(template.updated_at).toLocaleDateString('fr-CH')}`
                      : 'Version par défaut'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedModule && (
        <div className="destruction-card">
          <div className="destruction-card__header">
            <div>
              <h2>{MODULE_LABELS[selectedModule] || selectedModule}</h2>
              <p>
                {currentTemplate?.updated_at
                  ? `Dernière modification le ${new Date(currentTemplate.updated_at).toLocaleDateString('fr-CH')}`
                  : 'Personnalisez le template PDF pour ce module'}
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !selectedModule}>
              {saving ? (
                <>
                  <Loader2 className="spinner" size={16} />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Enregistrer
                </>
              )}
            </button>
          </div>

          <div className="template-form">
            <div className="template-form__column">
              <label className="destruction-field">
                <span>Logo entête</span>
                <div className="input-with-button">
                  <input
                    type="text"
                    className="destruction-input"
                    value={form.headerLogo || ''}
                    onChange={(e) => handleInputChange('headerLogo', e.target.value)}
                    placeholder="DataURL ou URL publique"
                  />
                  <label className="btn btn-outline">
                    <Upload size={16} />
                    Importer
                    <input type="file" accept="image/*" onChange={(e) => handleLogoUpload('headerLogo', e.target.files?.[0])} hidden />
                  </label>
                </div>
              </label>

              <label className="destruction-field">
                <span>Logo pied de page</span>
                <div className="input-with-button">
                  <input
                    type="text"
                    className="destruction-input"
                    value={form.footerLogo || ''}
                    onChange={(e) => handleInputChange('footerLogo', e.target.value)}
                    placeholder="DataURL ou URL publique"
                  />
                  <label className="btn btn-outline">
                    <Upload size={16} />
                    Importer
                    <input type="file" accept="image/*" onChange={(e) => handleLogoUpload('footerLogo', e.target.files?.[0])} hidden />
                  </label>
                </div>
              </label>

              <label className="destruction-field">
                <span>Titre</span>
                <input type="text" className="destruction-input" value={form.title || ''} onChange={(e) => handleInputChange('title', e.target.value)} />
              </label>

              <label className="destruction-field">
                <span>Sous-titre</span>
                <input type="text" className="destruction-input" value={form.subtitle || ''} onChange={(e) => handleInputChange('subtitle', e.target.value)} />
              </label>

              <label className="destruction-field">
                <span>Texte pied de page</span>
                <textarea className="destruction-input" rows={4} value={form.footerText || ''} onChange={(e) => handleInputChange('footerText', e.target.value)} placeholder="Texte libre, multi-lignes via Entrée" />
              </label>

              <label className="destruction-field">
                <span>Texte supplémentaire</span>
                <textarea className="destruction-input" rows={3} value={form.customTexts?.extra || ''} onChange={(e) => handleCustomTextChange('extra', e.target.value)} placeholder="Texte affiché dans certaines sections" />
              </label>

              <label className="destruction-field">
                <span>Texte zone 2 (corps du document)</span>
                <textarea
                  className="destruction-input"
                  rows={4}
                  value={form.customTexts?.body || ''}
                  onChange={(e) => handleCustomTextChange('body', e.target.value)}
                  placeholder="Texte affiché dans la zone 2 (par défaut : paragraphe standard)."
                />
              </label>
            </div>
          </div>

        <div className="template-zones-section">
          <div className="destruction-section__header" style={{ marginBottom: 12 }}>
            <div>
              <h3>Couleurs par zones</h3>
              <p>Personnalisez les couleurs de l’en-tête, du contenu et des encadrés pour chaque module PDF.</p>
            </div>
          </div>
          <div className="template-zone-grid">
            {ZONE_KEYS.map((zoneKey) => (
              <div key={zoneKey} className="template-zone-card">
                <h4>{ZONE_LABELS[zoneKey]}</h4>
                <p>Fond, texte et accents utilisés dans cette zone.</p>
                {ZONE_FIELDS.map(({ field, label, placeholder }) => {
                  const value = form.zones?.[zoneKey]?.[field] || '';
                  const colorInputValue = value || '#000000';
                  return (
                    <label key={field} className="destruction-field template-color-field">
                      <span>{label}</span>
                      <div className="input-with-button">
                        <input
                          type="color"
                          className="color-input"
                          style={{ width: 56, flexShrink: 0 }}
                          value={colorInputValue}
                          onChange={(e) => handleZoneColorChange(zoneKey, field, e.target.value)}
                        />
                        <input
                          type="text"
                          className="destruction-input"
                          value={value}
                          placeholder={placeholder}
                          onChange={(e) => handleZoneColorChange(zoneKey, field, e.target.value)}
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        </div>
      )}
    </section>
  );
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default PdfTemplatesPage;

