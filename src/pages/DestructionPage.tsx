import React from 'react';
import jsPDF from 'jspdf';
import { Camera, Plus, Trash2, FileText, X, Pencil, Image as ImageIcon, Send, Download } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import toast from 'react-hot-toast';
import { Api, type PdfTemplateConfig } from '../lib/api';
import { usePdfTemplate } from '../hooks/usePdfTemplate';
import { openPdfPreview } from '../utils/pdfPreview';
import { getFooterLines, getTemplateColors, resolveTemplateImage } from '../utils/pdfTemplate';

const LOGO_URL = '/logo-retripa.png';
const SGS_URL = '/sgs.png';

interface Marchandise {
  id: string;
  nom: string;
  reference: string;
  photoAvant?: File;
  photoApres?: File;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('DestructionMatieres error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="destruction-empty">
          <h2>Une erreur est survenue</h2>
          <p>Merci de recharger la page.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const DestructionMatieres: React.FC = () => {
  const [dateDestruction, setDateDestruction] = React.useState('');
  const [poidsTotal, setPoidsTotal] = React.useState('');
  const [client, setClient] = React.useState('');
  const [ticket, setTicket] = React.useState('');
  const [datePesage, setDatePesage] = React.useState('');
  const [marchandises, setMarchandises] = React.useState<Marchandise[]>([]);
  const [nomAgent, setNomAgent] = React.useState('');
  const [signatureType, setSignatureType] = React.useState<'draw' | 'upload'>('draw');
  const [signatureImage, setSignatureImage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const signatureRef = React.useRef<SignatureCanvas | null>(null);
  const { config: templateConfig, loading: templateLoading } = usePdfTemplate('destruction');

  const handleAddMarchandise = () => {
    setMarchandises((prev) => [...prev, { id: crypto.randomUUID(), nom: '', reference: '' }]);
  };

  const handleRemoveMarchandise = (id: string) => {
    setMarchandises((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMarchandiseChange = (id: string, field: 'nom' | 'reference', value: string) => {
    setMarchandises((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handlePhotoChange = (id: string, field: 'photoAvant' | 'photoApres', file: File) => {
    setMarchandises((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: file } : item))
    );
  };

  const handleRemovePhoto = (id: string, field: 'photoAvant' | 'photoApres') => {
    setMarchandises((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: undefined } : item))
    );
  };

  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => setSignatureImage(e.target?.result as string);
      reader.readAsDataURL(event.target.files[0]);
    }
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
    setSignatureImage(null);
  };

  const handleSaveSignature = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setSignatureImage(signatureRef.current.toDataURL('image/png'));
    }
  };

  const formatDateShort = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [yyyy, mm, dd] = value.split('-');
      return `${dd}.${mm}.${yyyy.slice(2)}`;
    }
    return value;
  };

  const formatDateLong = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [yyyy, mm, dd] = value.split('-');
      return `${dd}.${mm}.${yyyy}`;
    }
    return value;
  };

  const buildPDF = async (template?: PdfTemplateConfig): Promise<{ doc: jsPDF; base64: string; filename: string }> => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    const pageWidth = 210;
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const { primary, accent } = getTemplateColors(template, {
      primary: [0, 70, 32],
      accent: [0, 100, 0]
    });
    const footerLines = getFooterLines(template, [
      'Retripa Crissier S.A.',
      'Chemin de Mongevon 11 – 1023 Crissier',
      'T +41 21 637 66 66    info@retripa.ch    www.retripa.ch'
    ]);
    const [headerLogo, footerLogo] = await Promise.all([
      resolveTemplateImage(template?.headerLogo, LOGO_URL),
      resolveTemplateImage(template?.footerLogo, SGS_URL)
    ]);

    const inscriptionDate = formatDateLong(dateDestruction || new Date().toISOString().slice(0, 10));

    const drawHeader = () => {
      doc.setFillColor(...primary);
      doc.rect(0, 0, pageWidth, 22, 'F');
      if (headerLogo) {
        doc.addImage(headerLogo, 'PNG', margin, 4, 45, 14, undefined, 'FAST');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(template?.title || 'CERTIFICAT DE DESTRUCTION', pageWidth - margin, 12, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      if (template?.subtitle) {
        doc.setFontSize(10);
        doc.text(template.subtitle, pageWidth - margin, 18, { align: 'right' });
      }
      doc.setTextColor(0, 0, 0);
    };

    const drawFooter = () => {
      const footerTop = pageHeight - 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      footerLines.forEach((line, index) => {
        doc.text(line, margin, footerTop + index * 4);
      });
      doc.text(inscriptionDate, pageWidth - margin, pageHeight - 6, { align: 'right' });
      if (footerLogo) {
        const size = 12;
        const spacing = 6;
        const total = size * 3 + spacing * 2;
        const startX = pageWidth - margin - total;
        for (let i = 0; i < 3; i += 1) {
          doc.addImage(footerLogo, 'PNG', startX + i * (size + spacing), footerTop - 2, size, size, undefined, 'FAST');
        }
      }
    };

    drawHeader();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(24);
    doc.setTextColor(...accent);
    doc.text(template?.customTexts?.title || 'CERTIFICAT DE DESTRUCTION', pageWidth / 2, 60, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(11);
    doc.text(
      template?.subtitle ||
        "Le présent certificat justifie que Retripa Crissier SA a appliqué toutes les procédures nécessaires pour assurer la totale destruction de la marchandise énoncée ci-dessous.",
      pageWidth / 2,
      70,
      { align: 'center', maxWidth: 180 }
    );

    let y = 87;
    doc.setFontSize(11);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);

    // Ligne 1
    doc.rect(margin, y, 90, 10);
    doc.rect(margin + 90, y, 90, 10);
    doc.text('Date de destruction :', margin + 2, y + 7);
    doc.text('Poids total détruit :', margin + 92, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDateShort(dateDestruction), margin + 45, y + 7);
    doc.text(poidsTotal ? `${poidsTotal} kg` : '', margin + 135, y + 7);
    doc.setFont('helvetica', 'normal');

    // Ligne 2
    y += 10;
    doc.rect(margin, y, 180, 10);
    doc.text('Client :', margin + 2, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(client || '', margin + 25, y + 7);
    doc.setFont('helvetica', 'normal');

    // Ligne 3
    y += 10;
    doc.rect(margin, y, 90, 10);
    doc.rect(margin + 90, y, 90, 10);
    doc.text('N° de ticket :', margin + 2, y + 7);
    doc.text('Date du bon de pesage :', margin + 92, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(ticket || '', margin + 45, y + 7);
    doc.text(formatDateShort(datePesage), margin + 145, y + 7);
    doc.setFont('helvetica', 'normal');

    // Tableau marches
    y += 15;
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(margin, y, 180, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Description de la marchandise détruite', margin + 2, y + 7);
    doc.setFont('helvetica', 'normal');

    const drawDiagonal = (x1: number, y1: number, x2: number, y2: number) => {
      doc.setDrawColor(150, 150, 150);
      doc.line(x1, y1, x2, y2);
      doc.setDrawColor(0, 0, 0);
    };

    for (let i = 0; i < 3; i++) {
      y += 10;
      doc.rect(margin, y, 120, 10);
      doc.rect(margin + 120, y, 60, 10);
      const marchandise = marchandises[i];
      if (marchandise) {
        const nom = marchandise.nom?.trim();
        const ref = marchandise.reference?.trim();
        if (nom) {
          doc.text(`${i + 1})  ${nom}`, margin + 4, y + 7);
        } else {
          drawDiagonal(margin, y, margin + 120, y + 10);
        }
        if (ref) {
          doc.text(`Référence : ${ref}`, margin + 124, y + 7);
        } else {
          drawDiagonal(margin + 120, y, margin + 180, y + 10);
        }
      } else {
        drawDiagonal(margin, y, margin + 180, y + 10);
      }
    }

    const ySign = y + 25;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accent);
    doc.text('RETRIPA CRISSIER SA', margin, ySign + 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Nom : ${nomAgent}`, margin, ySign + 20);
    doc.text('Signature :', margin, ySign + 30);
    if (signatureImage) {
      doc.addImage(signatureImage, 'PNG', margin + 30, ySign + 22, 40, 12);
    }

    drawFooter();

    // Page 2
    doc.addPage();
    drawHeader();

    y = 55;
    doc.setFontSize(11);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(margin, y, 25, 10);
    doc.rect(margin + 25, y, 55, 10);
    doc.rect(margin + 80, y, 55, 10);
    doc.rect(margin + 135, y, 25, 10);
    doc.text('Date', margin + 2, y + 7);
    doc.text('Avant', margin + 40, y + 7);
    doc.text('Après', margin + 95, y + 7);
    doc.text('Détruit', margin + 140, y + 7);

    for (let i = 0; i < marchandises.length; i++) {
      y += 10;
      doc.rect(margin, y, 25, 45);
      doc.rect(margin + 25, y, 55, 45);
      doc.rect(margin + 80, y, 55, 45);
      doc.rect(margin + 135, y, 25, 45);

      const formattedDate = formatDateLong(dateDestruction || new Date().toISOString().slice(0, 10));
      doc.text(formattedDate, margin + 2, y + 25);
      doc.text('Détruit', margin + 140, y + 25);

      const marchandise = marchandises[i];
      if (marchandise?.photoAvant) {
        const imgAvant = await fileToCompressedBase64(marchandise.photoAvant);
        if (imgAvant) {
          doc.addImage(imgAvant, 'JPEG', margin + 27, y + 2, 51, 41);
        }
      }
      if (marchandise?.photoApres) {
        const imgApres = await fileToCompressedBase64(marchandise.photoApres);
        if (imgApres) {
          doc.addImage(imgApres, 'JPEG', margin + 82, y + 2, 51, 41);
        }
      }

      y += 45 - 10;
    }

    drawFooter();

    const filename = `certificat_destruction_${dateDestruction || new Date().toISOString().slice(0, 10)}.pdf`;
    const base64 = doc.output('datauristring').split(',')[1] ?? '';
    return { doc, base64, filename };
  };

  const handlePreview = async () => {
    if (!dateDestruction || !client || !nomAgent) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (!signatureImage) {
      toast.error('Veuillez ajouter une signature.');
      return;
    }

    try {
      const pdf = await buildPDF(templateConfig || undefined);
      openPdfPreview({ doc: pdf.doc as unknown as jsPDF, filename: pdf.filename });
    } catch (error) {
      toast.error((error as Error).message || 'Impossible de générer le PDF');
    }
  };

  const handleSendEmail = async () => {
    if (!dateDestruction || !client || !nomAgent) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (!signatureImage) {
      toast.error('Veuillez ajouter une signature.');
      return;
    }

    setLoading(true);
    try {
      const pdf = await buildPDF(templateConfig || undefined);

      await Api.sendDestruction({
        dateDestruction,
        poidsTotal,
        client,
        ticket,
        datePesage,
        marchandises: marchandises.map((m) => ({
          nom: m.nom,
          reference: m.reference
        })),
        nomAgent,
        pdfBase64: pdf.base64,
        pdfFilename: pdf.filename
      });

      toast.success('✅ Email envoyé avec succès ! Le certificat PDF (incluant les photos) a été transmis aux destinataires.', {
        duration: 5000
      });
      (pdf.doc as unknown as jsPDF).save(pdf.filename);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible d\'envoyer le certificat par email');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!dateDestruction || !client || !nomAgent) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (!signatureImage) {
      toast.error('Veuillez ajouter une signature.');
      return;
    }

    try {
      const pdf = await buildPDF(templateConfig || undefined);
      pdf.doc.save(pdf.filename);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible de générer le PDF');
    }
  };

  return (
    <div className="destruction-page">
      <div className="destruction-wrapper">
        <div className="destruction-card">
          <div className="destruction-card__header">
            <div>
              <p className="eyebrow">Traçabilité</p>
              <h1>Certificat de destruction matières</h1>
              <p>Centralisez la prise de photos, signatures et PDF officiels.</p>
            </div>
            <div className="page-actions">
              <button className="btn btn-outline" onClick={handlePreview} disabled={loading || templateLoading}>
                <Download size={16} />
                Prévisualiser PDF
              </button>
              <button className="btn btn-primary" onClick={handleSendEmail} disabled={loading || templateLoading}>
                {loading ? (
                  'Envoi...'
                ) : (
                  <>
                    <Send size={16} />
                    Générer & envoyer
                  </>
                )}
              </button>
              {templateLoading && <span className="pill">Préférences PDF…</span>}
            </div>
          </div>

          <div className="destruction-card__body">
            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>Informations générales</h2>
              </div>
              <div className="destruction-grid">
                <Field label="Date de destruction">
                  <input type="date" className="destruction-input" value={dateDestruction} onChange={(e) => setDateDestruction(e.target.value)} />
                </Field>
                <Field label="Poids total détruit (kg)">
                  <input type="number" className="destruction-input" value={poidsTotal} onChange={(e) => setPoidsTotal(e.target.value)} placeholder="Ex: 125" />
                </Field>
                <Field label="Client">
                  <input type="text" className="destruction-input" value={client} onChange={(e) => setClient(e.target.value)} />
                </Field>
                <Field label="N° de ticket">
                  <input type="text" className="destruction-input" value={ticket} onChange={(e) => setTicket(e.target.value)} />
                </Field>
                <Field label="Date du bon de pesage">
                  <input type="date" className="destruction-input" value={datePesage} onChange={(e) => setDatePesage(e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>Marchandises à détruire</h2>
                <button className="destruction-btn" onClick={handleAddMarchandise}>
                  <Plus size={16} /> Ajouter une marchandise
                </button>
              </div>

              {marchandises.length === 0 ? (
                <div className="destruction-empty">Ajoutez les items détruits pour générer le certificat.</div>
              ) : (
                <div className="destruction-items">
                  {marchandises.map((marchandise) => (
                    <div key={marchandise.id} className="destruction-item">
                      <div className="destruction-item__header">
                        <strong>Marchandise #{marchandise.id.slice(0, 4)}</strong>
                        <button className="icon-button reject" onClick={() => handleRemoveMarchandise(marchandise.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="destruction-grid">
                        <Field label="Nom">
                          <input
                            type="text"
                            className="destruction-input"
                            value={marchandise.nom}
                            onChange={(e) => handleMarchandiseChange(marchandise.id, 'nom', e.target.value)}
                          />
                        </Field>
                        <Field label="Référence">
                          <input
                            type="text"
                            className="destruction-input"
                            value={marchandise.reference}
                            onChange={(e) => handleMarchandiseChange(marchandise.id, 'reference', e.target.value)}
                          />
                        </Field>
                      </div>

                      <div className="destruction-photos">
                        <PhotoUpload
                          label="Photo avant destruction"
                          file={marchandise.photoAvant}
                          onSelect={(file) => handlePhotoChange(marchandise.id, 'photoAvant', file)}
                          onRemove={() => handleRemovePhoto(marchandise.id, 'photoAvant')}
                        />
                        <PhotoUpload
                          label="Photo après destruction"
                          file={marchandise.photoApres}
                          onSelect={(file) => handlePhotoChange(marchandise.id, 'photoApres', file)}
                          onRemove={() => handleRemovePhoto(marchandise.id, 'photoApres')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>Signature agent</h2>
              </div>
              <div className="destruction-grid">
                <Field label="Nom de l'agent">
                  <input type="text" className="destruction-input" value={nomAgent} onChange={(e) => setNomAgent(e.target.value)} />
                </Field>
              </div>

              <div className="signature-tabs">
                <button
                  type="button"
                  className={`signature-tab ${signatureType === 'draw' ? 'active' : ''}`}
                  onClick={() => setSignatureType('draw')}
                >
                  <Pencil size={16} /> Dessiner
                </button>
                <button
                  type="button"
                  className={`signature-tab ${signatureType === 'upload' ? 'active' : ''}`}
                  onClick={() => setSignatureType('upload')}
                >
                  <ImageIcon size={16} /> Télécharger
                </button>
              </div>

              {signatureType === 'draw' ? (
                <div className="signature-pad-container">
                  <SignatureCanvas
                    ref={signatureRef}
                    canvasProps={{ className: 'signature-canvas' }}
                  />
                  <div className="signature-actions">
                    <button type="button" className="destruction-btn secondary" onClick={handleClearSignature}>
                      Effacer
                    </button>
                    <button type="button" className="destruction-btn" onClick={handleSaveSignature}>
                      Enregistrer la signature
                    </button>
                  </div>
                </div>
              ) : (
                <div className="signature-upload">
                  <label className="photo-upload">
                    <span>Télécharger une image de signature</span>
                    <input type="file" accept="image/*" onChange={handleSignatureUpload} />
                  </label>
                </div>
              )}

              {signatureImage && (
                <div className="signature-preview">
                  <p>Aperçu :</p>
                  <div className="signature-preview__image">
                    <img src={signatureImage} alt="Signature" />
                    <button className="icon-button reject" onClick={handleClearSignature}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </section>

            <div className="destruction-footer">
              <button className="btn btn-outline large" onClick={handlePreview} disabled={loading}>
                <Download size={18} /> Prévisualiser PDF
              </button>
              <button className="btn btn-primary large" onClick={handleSendEmail} disabled={loading}>
                {loading ? (
                  'Envoi...'
                ) : (
                  <>
                    <Send size={18} /> Générer & envoyer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="destruction-field">
    <span>{label}</span>
    {children}
  </label>
);

const PhotoUpload = ({
  label,
  file,
  onSelect,
  onRemove
}: {
  label: string;
  file?: File;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) => (
  <div className="photo-field">
    <p>{label}</p>
    <label className="photo-upload">
      <Camera size={28} />
      <span>Télécharger une photo</span>
      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onSelect(e.target.files[0])} />
    </label>
    {file && (
      <div className="photo-preview">
        <img src={URL.createObjectURL(file)} alt={label} />
        <button className="icon-button reject" onClick={onRemove}>
          <X size={14} />
        </button>
      </div>
    )}
  </div>
);

async function fileToCompressedBase64(file: File, maxWidth = 1400, quality = 0.75): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

const DestructionMatieresWithBoundary: React.FC = () => (
  <ErrorBoundary>
    <DestructionMatieres />
  </ErrorBoundary>
);

export default DestructionMatieresWithBoundary;

