import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { Plus, Trash2, Upload, FileDown, Send } from 'lucide-react';

import { Api, type PdfTemplateConfig } from '../lib/api';
import { usePdfTemplate } from '../hooks/usePdfTemplate';
import { openPdfPreview } from '../utils/pdfPreview';
import { getFooterLines, getTemplateColors, resolveTemplateImage } from '../utils/pdfTemplate';

type DeclassementEntry = {
  id: string;
  sourceMaterial: string;
  targetMaterial: string;
  ratio: string;
  notes: string;
};

const createEntry = (): DeclassementEntry => ({
  id: Math.random().toString(36).slice(2),
  sourceMaterial: '',
  targetMaterial: '',
  ratio: '',
  notes: ''
});

const MAX_TOTAL_PHOTO_BYTES = 33 * 1024 * 1024;

const DeclassementPage = () => {
  const [dateTime, setDateTime] = useState(() => getSwissDateTimeInputValue());
  const [companyName, setCompanyName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [slipNumber, setSlipNumber] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [entries, setEntries] = useState<DeclassementEntry[]>([createEntry()]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const { config: templateConfig, loading: templateLoading } = usePdfTemplate('declassement');

  const formattedDate = useMemo(() => {
    try {
      return new Date(dateTime).toLocaleString('fr-CH', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'Europe/Zurich'
      });
    } catch {
      return dateTime;
    }
  }, [dateTime]);

  const updateEntry = (id: string, field: keyof DeclassementEntry, value: string) => {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, createEntry()]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => (prev.length === 1 ? prev : prev.filter((entry) => entry.id !== id)));
  };

  const handlePhotosChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const incoming = Array.from(event.target.files);
      setPhotos((prev) => {
        const currentSize = prev.reduce((sum, file) => sum + file.size, 0);
        let running = currentSize;
        const accepted: File[] = [];

        for (const file of incoming) {
          if (running + file.size > MAX_TOTAL_PHOTO_BYTES) {
            toast.error('Le total des photos dépasserait 33 MB. Veuillez réduire ou compresser vos fichiers.');
            break;
          }
          accepted.push(file);
          running += file.size;
        }

        if (accepted.length === 0) {
          return prev;
        }
        return [...prev, ...accepted];
      });
      event.target.value = '';
    }
  };

  const getPdfInput = () => {
    if (!companyName && !vehiclePlate && !slipNumber) {
      toast.error('Renseignez au moins le nom de l\'entreprise, la plaque ou le numéro de bon.');
      return null;
    }
    if (!entries.some((entry) => entry.sourceMaterial && entry.targetMaterial)) {
      toast.error('Ajoutez au moins une matière à déclasser.');
      return null;
    }

    return {
      dateLabel: formattedDate,
      isoDateTime: dateTime,
      companyName,
      vehiclePlate,
      slipNumber,
      entries,
      generalNotes,
      photos
    };
  };

  const handlePreview = async () => {
    const pdfInput = getPdfInput();
    if (!pdfInput) return;

    try {
      const pdf = await buildPdf(pdfInput, templateConfig || undefined);
      openPdfPreview(pdf);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible de générer le PDF');
    }
  };

  const handleSubmit = async () => {
    const pdfInput = getPdfInput();
    if (!pdfInput) return;

    setLoading(true);
    try {
      const pdf = await buildPdf(pdfInput, templateConfig || undefined);

      await Api.sendDeclassement({
        dateTime,
        companyName,
        vehiclePlate,
        slipNumber,
        notes: generalNotes,
        entries: entries.map(({ sourceMaterial, targetMaterial, ratio, notes }) => ({
          sourceMaterial,
          targetMaterial,
          ratio,
          notes
        })),
        pdfBase64: pdf.base64,
        pdfFilename: pdf.filename,
        photos: []
      });

      toast.success('✅ Email envoyé avec succès ! Le rapport PDF (incluant les photos) a été transmis aux destinataires.', {
        duration: 5000
      });
      pdf.doc.save(pdf.filename);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible de générer le déclassement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="destruction-page">
      <div className="destruction-wrapper">
        <div className="destruction-card">
          <div className="destruction-card__header">
            <div>
              <p className="eyebrow">Matières</p>
              <h1>Déclassement de matières</h1>
              <p>Enregistrez vos déclassements, joignez des photos et envoyez le rapport par email.</p>
            </div>
            <div className="page-actions">
              <button type="button" className="btn btn-outline" onClick={handlePreview} disabled={loading || templateLoading}>
                <FileDown size={16} />
                Prévisualiser PDF
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading || templateLoading}>
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
            <div className="destruction-grid">
              <label className="destruction-field">
                <span>Date & heure</span>
                <input type="datetime-local" className="destruction-input" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
              </label>
              <label className="destruction-field">
                <span>Nom de l'entreprise</span>
                <input type="text" className="destruction-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Si pas de plaque" />
              </label>
              <label className="destruction-field">
                <span>Plaque du véhicule</span>
                <input type="text" className="destruction-input" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} placeholder="Si disponible" />
              </label>
              <label className="destruction-field">
                <span>Bon / Référence</span>
                <input type="text" className="destruction-input" value={slipNumber} onChange={(e) => setSlipNumber(e.target.value)} placeholder="Si disponible" />
              </label>
            </div>

            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>Matières concernées</h2>
                <button type="button" className="destruction-btn" onClick={addEntry}>
                  <Plus size={16} /> Ajouter
                </button>
              </div>

              <div className="declassement-table">
                {entries.map((entry, index) => (
                  <div key={entry.id} className="declassement-row">
                    <div>
                      <label>Mat. annoncée</label>
                      <input type="text" value={entry.sourceMaterial} onChange={(e) => updateEntry(entry.id, 'sourceMaterial', e.target.value)} />
                    </div>
                    <div>
                      <label>Déclassée en</label>
                      <input type="text" value={entry.targetMaterial} onChange={(e) => updateEntry(entry.id, 'targetMaterial', e.target.value)} />
                    </div>
                    <div>
                      <label>% ou durée</label>
                      <input type="text" value={entry.ratio} onChange={(e) => updateEntry(entry.id, 'ratio', e.target.value)} placeholder="Ex. 25% ou 1h30" />
                    </div>
                    <div>
                      <label>Observations</label>
                      <input type="text" value={entry.notes} onChange={(e) => updateEntry(entry.id, 'notes', e.target.value)} />
                    </div>
                    <button type="button" className="icon-button warn" onClick={() => removeEntry(entry.id)} disabled={entries.length === 1}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>Photos du déclassement</h2>
              </div>
              <label className="upload-field">
                <Upload size={18} />
                <span>Sélectionner des photos</span>
                <input type="file" accept="image/*" multiple onChange={handlePhotosChange} />
              </label>
              {photos.length > 0 && (
                <ul className="photo-list">
                  {photos.map((file) => (
                    <li key={file.name}>{file.name}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="destruction-section">
              <label className="destruction-field">
                <span>Notes générales</span>
                <textarea className="destruction-input" rows={4} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} />
              </label>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};

async function buildPdf({
  dateLabel,
  isoDateTime,
  companyName,
  vehiclePlate,
  slipNumber,
  entries,
  generalNotes,
  photos
}: {
  dateLabel: string;
  isoDateTime: string;
  companyName: string;
  vehiclePlate: string;
  slipNumber: string;
  entries: DeclassementEntry[];
  generalNotes: string;
  photos: File[];
}, template?: PdfTemplateConfig): Promise<{ doc: jsPDF; base64: string; filename: string }> {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    compress: true
  });
  const pageWidthValue = pageWidth(doc);
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const innerWidth = pageWidthValue - margin * 2;
  let y = margin;

  const fallbackFooterLines = [
    'Retripa Crissier S.A.',
    'Chemin de Mongevon 11 – 1023 Crissier',
    'T +41 21 637 66 66    info@retripa.ch    www.retripa.ch'
  ];
  const { accent: accentColor, primary: primaryColor } = getTemplateColors(template, {
    primary: [0, 0, 0],
    accent: [30, 64, 175]
  });
  const footerLines = getFooterLines(template, fallbackFooterLines);

  const ensureSpace = (needed: number, footerLogo: string | null) => {
    if (y + needed > pageHeight - margin - 30) {
      drawFooter(footerLogo);
      doc.addPage();
      y = margin;
    }
  };

  const drawClientSection = () => {
    const lines = [
      `Nom de l'entreprise : ${companyName || '—'}`,
      `Plaque véhicule : ${vehiclePlate || '—'}`,
      `Bon / Référence : ${slipNumber || '—'}`
    ];
    const blockHeight = 24 + lines.length * 6;
    ensureSpace(blockHeight + 8, footerLogo);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(margin, y, innerWidth, blockHeight, 3, 3);

    let innerY = y + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...accentColor);
    doc.text('Client', margin + 6, innerY);
    innerY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    lines.forEach((line) => {
      doc.text(line, margin + 6, innerY + 4);
      innerY += 6;
    });

    y += blockHeight + 8;
  };

  const drawSectionTitle = (label: string) => {
    ensureSpace(12, footerLogo);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...accentColor);
    doc.text(label, margin, y);
    doc.setTextColor(17, 24, 39);
    y += 6;
  };

  // Header band with logos
  const [headerLogo, footerLogo] = await Promise.all([
    resolveTemplateImage(template?.headerLogo, '/retripa-ln.jpg'),
    resolveTemplateImage(template?.footerLogo, '/sgs.png')
  ]);

  const drawFooter = (logo: string | null) => {
    const footerTop = pageHeight - 30;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, footerTop - 2, pageWidthValue - margin, footerTop - 2);

    const footerTextTop = footerTop + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    footerLines.forEach((line, index) => {
      doc.text(line, margin, footerTextTop + index * 5);
    });

    if (logo) {
      const logoSize = 16;
      const spacing = 4;
      const totalWidth = logoSize * 3 + spacing * 2;
      const firstX = pageWidthValue - margin - totalWidth;
      const logosY = footerTextTop - 3;
      for (let i = 0; i < 3; i += 1) {
        const x = firstX + i * (logoSize + spacing);
        doc.addImage(logo, 'PNG', x, logosY, logoSize, logoSize, undefined, 'FAST');
      }
    }
  };

  const headerHeight = 32;
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidthValue, headerHeight, 'F');

  if (headerLogo) {
    doc.addImage(headerLogo, 'JPEG', margin, 6, 42, 18, undefined, 'FAST');
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(template?.title || 'Déclassement de matières', pageWidthValue - margin, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  if (template?.subtitle) {
    doc.setFontSize(11);
    doc.text(template.subtitle, pageWidthValue - margin, 21, { align: 'right' });
    doc.setFontSize(10);
    doc.text(dateLabel, pageWidthValue - margin, 27, { align: 'right' });
  } else {
    doc.setFontSize(11);
    doc.text(dateLabel, pageWidthValue - margin, 22, { align: 'right' });
  }
  doc.setTextColor(17, 24, 39);
  y = headerHeight + 8;

  // Client section
  drawClientSection();

  // Entries section
  drawSectionTitle('Matières déclarées');

  const entryWidth = innerWidth;
  const entryX = margin;
  entries.forEach((entry, index) => {
    const linesSource = doc.splitTextToSize(entry.sourceMaterial || '—', entryWidth - 10);
    const linesTarget = doc.splitTextToSize(entry.targetMaterial || '—', entryWidth - 10);
    const ratioLine = entry.ratio ? `Taux / Durée : ${entry.ratio}` : null;
    const notesLines = entry.notes ? doc.splitTextToSize(entry.notes, entryWidth - 10) : [];

    // Calculer la hauteur réelle basée sur le contenu dessiné
    let contentHeight = 6; // padding top
    contentHeight += 4; // titre "Matière X"
    contentHeight += 5 + linesSource.length * 4; // Mat. annoncée
    contentHeight += 5 + linesTarget.length * 4; // Déclassée en
    if (ratioLine) {
      contentHeight += 5; // hauteur ligne texte
    }
    if (notesLines.length) {
      contentHeight += 2; // espace avant
      contentHeight += 4; // hauteur label "Observations :"
      contentHeight += notesLines.length * 4; // hauteur texte observations
    }
    contentHeight += 6; // padding bottom

    ensureSpace(contentHeight + 6, footerLogo);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(entryX, y, entryWidth, contentHeight, 3, 3);
    let innerY = y + 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Matière ${index + 1}`, entryX + 5, innerY);
    innerY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Mat. annoncée :', entryX + 5, innerY);
    doc.text(linesSource, entryX + 38, innerY);
    innerY += 5 + linesSource.length * 4;

    doc.text('Déclassée en :', entryX + 5, innerY);
    doc.text(linesTarget, entryX + 38, innerY);
    innerY += 5 + linesTarget.length * 4;

    if (ratioLine) {
      doc.text(ratioLine, entryX + 5, innerY);
      innerY += 5;
    }

    if (notesLines.length) {
      innerY += 2;
      doc.text('Observations :', entryX + 5, innerY);
      innerY += 4;
      doc.text(notesLines, entryX + 5, innerY);
      innerY += notesLines.length * 4;
    }

    y += contentHeight + 8;
  });

  // General notes
  if (generalNotes) {
    y += 8;
    drawSectionTitle('Notes générales');
    const lines = doc.splitTextToSize(generalNotes, innerWidth - 4);
    const notesHeight = lines.length * 5 + 12;
    ensureSpace(notesHeight, footerLogo);
    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(margin, y, innerWidth, notesHeight, 3, 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(lines, margin + 4, y + 8);
    y += notesHeight + 8;
  }

  // Photos grid
  if (photos.length > 0) {
    y += 4;
    drawSectionTitle('Photos');
    const columns = 3;
    const gap = 8;
    const photoWidth = (innerWidth - gap * (columns - 1)) / columns;
    const photoHeight = photoWidth * 0.65;

    for (let i = 0; i < photos.length; i += 1) {
      ensureSpace(photoHeight + 16, footerLogo);
      const columnIndex = i % columns;
      const rowIndex = Math.floor(i / columns);
      if (columnIndex === 0 && rowIndex > 0) {
        y += photoHeight + 12;
        ensureSpace(photoHeight + 16, footerLogo);
      }
      const x = margin + columnIndex * (photoWidth + gap);
      const dataUrl = await fileToCompressedDataUrl(photos[i]);
      doc.setDrawColor(209, 213, 219);
      doc.rect(x, y, photoWidth, photoHeight);
      doc.addImage(dataUrl, photos[i].type.includes('png') ? 'PNG' : 'JPEG', x + 1, y + 1, photoWidth - 2, photoHeight - 2, undefined, 'FAST');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Photo ${i + 1}`, x, y + photoHeight + 5);
    }
    y += photoHeight + 18;
  }

  // Footer on last page
  drawFooter(footerLogo);

  const formattedDate = new Intl.DateTimeFormat('fr-CH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(isoDateTime || Date.now()));
  const safeDate = formattedDate.replace(/\//g, '.').replace(/\s+/g, '_');
  const filename = `Déclassement_${safeDate}.pdf`;
  const base64 = doc.output('datauristring').split(',')[1] ?? '';

  return { doc, base64, filename };
}

function pageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

function getSwissDateTimeInputValue(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

async function fileToCompressedDataUrl(file: File, maxWidth = 1400, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas non supporté'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToCompressedBase64(file: File) {
  const dataUrl = await fileToCompressedDataUrl(file);
  return dataUrl.split(',')[1] ?? dataUrl;
}

export default DeclassementPage;

