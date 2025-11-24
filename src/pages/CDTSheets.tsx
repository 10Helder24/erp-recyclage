import React, { useMemo, useState } from 'react';
import { Download, Send, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';

import { Api } from '../lib/api';

interface SortingSheetProps {
  user: any;
  signOut: () => Promise<void>;
}

// Définition des types de bennes
const binTypes = [
  { name: 'Déchets Incinérables', defaultValue: '' },
  { name: 'Déchets encombrants', defaultValue: '' },
  { name: 'Bois broyé', defaultValue: '' },
  { name: 'Carton', defaultValue: '' },
  { name: 'Bois propre', defaultValue: '' },
  { name: 'Alu propre', defaultValue: '' },
  { name: 'Métaux ferreux', defaultValue: '' },
  { name: 'Ferraille propre', defaultValue: '' },
  { name: 'Ferraille legere', defaultValue: '' },
  { name: 'Feraille & bois sortie broyeur', defaultValue: '' },
  { name: 'Inox', defaultValue: '' },
  { name: 'Inerte', defaultValue: '' },
  { name: 'Pneus', defaultValue: '' },
  { name: 'Sagex', defaultValue: '' },
  { name: 'Verre plat (vitrage)', defaultValue: '' },
  { name: 'Verre bouteilles', defaultValue: '' },
  { name: 'Piles usagées', defaultValue: '' },
  { name: 'Batteries & Accus', defaultValue: '' },
  { name: 'Extincteurs', defaultValue: '' },
  { name: 'Néons', defaultValue: '' },
  { name: 'Moteurs', defaultValue: '' },
  { name: 'Câbles', defaultValue: '' },
  { name: 'Sens. Electromager petit', defaultValue: '' },
  { name: 'Swico Informatique', defaultValue: '' },
  { name: 'SENS. Machines/ four', defaultValue: '' },
  { name: 'Sens. Frigos', defaultValue: '' },
  { name: 'Déchets organiques', defaultValue: '' },
  { name: 'Textils', defaultValue: '' },
  { name: 'Biométhanisation', defaultValue: '' },
  { name: 'Huile minéral', defaultValue: '' },
  { name: 'Huile végétal', defaultValue: '' },
  { name: 'Bois à problème broyé', defaultValue: '' },
  { name: 'PET en balle', defaultValue: '' },
  { name: 'Alu en balle', defaultValue: '' },
];

const clientReturns = [
  { name: 'Retour Manor', defaultValue: '' },
  { name: 'Retrour Bell', defaultValue: '' },
  { name: 'Retour Ikéa', defaultValue: '' },
  { name: 'Retour swissport', defaultValue: '' },
  { name: 'THOMMEN Furler', defaultValue: '' },
];

// Styles pour le PDF - TODO: Réimplémenter avec jsPDF
/* const styles = StyleSheet.create({
  page: {
    padding: 6,
    fontSize: 7,
    backgroundColor: 'white',
  },
  header: {
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#e8e8e8',
    padding: 3,
  },
  headerDate: {
    marginTop: 2,
    fontSize: 8,
  },
  table: {
    marginBottom: 5,
    borderWidth: 0.5,
    borderColor: '#000',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    minHeight: 8,
    padding: 0,
  },
  tableHeader: {
    backgroundColor: '#e8e8e8',
  },
  tableCell: {
    borderRightWidth: 0.5,
    borderRightColor: '#000',
    padding: 1,
    justifyContent: 'center',
  },
  tableCellFirst: {
    width: '20%',
  },
  tableCellOther: {
    width: '10%',
    textAlign: 'center',
  },
  clientReturnsTitle: {
    marginTop: 5,
    marginBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    paddingBottom: 1,
    fontSize: 10,
    fontWeight: 'bold',
  },
  clientReturnsRow: {
    marginBottom: 2,
  },
}); */

// Composant PDF - TODO: Réimplémenter avec jsPDF
/* const PDFDocument = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      ...
    </Page>
  </Document>
); */

export default function CDTSheets({ user, signOut }: SortingSheetProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const currentDate = useMemo(
    () =>
      new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    []
  );

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDownload = (data: Record<string, string>, dateLabel: string) => {
    const pdf = buildCDTPdf(data, dateLabel);
    pdf.doc.save(pdf.filename);
  };

  const handlePreview = (data: Record<string, string>, dateLabel: string) => {
    try {
      const pdf = buildCDTPdf(data, dateLabel);
      const blobUrl = pdf.doc.output('bloburl') as unknown as string;
      window.open(blobUrl, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible de générer le PDF');
    }
  };

  const handleSendEmail = async (data: Record<string, string>, dateLabel: string) => {
    setLoading(true);
    try {
      const pdf = buildCDTPdf(data, dateLabel);
      await Api.sendCDT({
        dateLabel,
        formData: data,
        pdfBase64: pdf.base64,
        pdfFilename: pdf.filename
      });
      toast.success('✅ Email envoyé avec succès ! Le PDF a été transmis aux destinataires.', {
        duration: 5000
      });
      pdf.doc.save(pdf.filename);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible d\'envoyer le relevé.');
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
              <p className="eyebrow">Inventaires</p>
              <h1>Centre de tri</h1>
              <p>Relevé du: {currentDate}</p>
            </div>
            <div className="page-actions">
              <button
                onClick={() => handlePreview(formData, currentDate)}
                className="btn btn-outline"
                disabled={loading}
              >
                <FileText size={18} />
                Prévisualiser PDF
              </button>
              <button onClick={() => handleDownload(formData, currentDate)} className="btn btn-outline">
                <Download size={18} />
                Télécharger PDF
              </button>
              <button
                onClick={() => handleSendEmail(formData, currentDate)}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  'Envoi...'
                ) : (
                  <>
                    <Send size={18} />
                    Générer & envoyer
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="destruction-card__body">

            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>Types de bennes</h2>
              </div>
              <div className="calendar-table-wrapper">
                <table className="calendar-table">
                  <thead>
                    <tr>
                      <th>Type de bennes</th>
                      <th>7m3</th>
                      <th>10m3</th>
                      <th>20m3</th>
                      <th>36m3</th>
                      <th>24m3 compacteur</th>
                      <th>en benne</th>
                      <th>en vrac estimé</th>
                      <th>A vider sur site</th>
                    </tr>
                  </thead>
                  <tbody>
                    {binTypes.map((item, index) => (
                      <tr key={index}>
                        <td className="sticky">{item.name}</td>
                        {['7m3', '10m3', '20m3', '36m3', '24m3', 'benne', 'vrac', 'vider'].map((size) => (
                          <td key={size}>
                            <input
                              type="text"
                              className="destruction-input"
                              value={formData[`${item.name}_${size}`] || ''}
                              onChange={(e) => handleInputChange(`${item.name}_${size}`, e.target.value)}
                              placeholder="-"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="destruction-section">
              <div className="destruction-section__header">
                <h2>Retour matériel client</h2>
              </div>
              <div className="destruction-grid">
                {clientReturns.map((item, index) => (
                  <label key={index} className="destruction-field">
                    <span>{item.name}</span>
                    <input
                      type="text"
                      className="destruction-input"
                      value={formData[item.name] || item.defaultValue}
                      onChange={(e) => handleInputChange(item.name, e.target.value)}
                      placeholder="-"
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildCDTPdf(data: Record<string, string>, currentDateLabel: string) {
  const doc = new jsPDF('l', 'mm', 'a4');
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor('#4b5d16');
  doc.text('Centre de tri', margin, margin + 2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#111');
  doc.text(`Relevé du: ${currentDateLabel}`, pageWidth / 2, margin + 2, { align: 'center' });

  const headers = ['Type de bennes', '7m3', '10m3', '20m3', '36m3', '24m3 compacteur', 'en benne', 'en vrac estimé', 'A vider sur site'];

  const baseWidths = [58, 16, 16, 16, 16, 26, 16, 24, 24];
  const totalBaseWidth = baseWidths.reduce((sum, value) => sum + value, 0);
  const availableWidth = pageWidth - 2 * margin;
  const widthScale = availableWidth / totalBaseWidth;
  const columnsWidth = baseWidths.map((value) => value * widthScale);
  const rowHeight = 5;
  let y = margin + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  let x = margin;
  headers.forEach((header, idx) => {
    doc.setFillColor(230, 230, 230);
    doc.rect(x, y, columnsWidth[idx], rowHeight + 1, 'F');
    doc.setTextColor(0);
    doc.text(header, x + 1.5, y + rowHeight / 2 + 1.5);
    x += columnsWidth[idx];
  });
  y += rowHeight + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  const columnXPositions: number[] = [margin];
  columnsWidth.forEach((width, idx) => {
    columnXPositions[idx + 1] = columnXPositions[idx] + width;
  });
  const tableNaturalHeight = binTypes.length * rowHeight;
  const reservedHeight = 55; // espace pour la section retour client
  const maxTableHeight = pageHeight - margin - reservedHeight;
  const scaleFactor = Math.min(1, maxTableHeight / tableNaturalHeight);
  const tableWidth = columnXPositions[columnXPositions.length - 1] - margin;

  binTypes.forEach((row, rowIndex) => {
    const fillColor = rowIndex % 2 === 0 ? 252 : 240;
    doc.setFillColor(fillColor, fillColor, fillColor);
    const rowY = y + rowIndex * rowHeight * scaleFactor;
    doc.rect(margin, rowY, tableWidth, rowHeight * scaleFactor, 'F');
    doc.setDrawColor(200);
    doc.line(margin, rowY, margin + tableWidth, rowY);
    doc.line(margin, rowY + rowHeight * scaleFactor, margin + tableWidth, rowY + rowHeight * scaleFactor);

    doc.setTextColor(0);
    doc.text(row.name, margin + 1.5, rowY + (rowHeight * scaleFactor) / 2 + 1.5);

    let colIndex = 1;
    ['7m3', '10m3', '20m3', '36m3', '24m3', 'benne', 'vrac', 'vider'].forEach((size) => {
      const value = data[`${row.name}_${size}`] || '';
      if (value) {
        doc.text(value, columnXPositions[colIndex] + 1.5, rowY + (rowHeight * scaleFactor) / 2 + 1.5);
      }
      colIndex += 1;
    });
  });

  doc.setDrawColor(150);
  columnXPositions.forEach((xPos) => {
    doc.line(xPos, y, xPos, y + tableNaturalHeight * scaleFactor);
  });
  doc.line(margin, y, columnXPositions[columnXPositions.length - 1], y);
  doc.line(margin, y + tableNaturalHeight * scaleFactor, columnXPositions[columnXPositions.length - 1], y + tableNaturalHeight * scaleFactor);
  y = y + tableNaturalHeight * scaleFactor + 5;
  doc.setFillColor(214, 223, 235);
  doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Retour matériel client', margin + 2, y + 4.5);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  clientReturns.forEach((item) => {
    doc.setDrawColor(210);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 5);
    doc.text(`${item.name}`, margin + 2, y);
    doc.text(`${data[item.name] || '-'}`, pageWidth - margin - 2, y, { align: 'right' });
    y += 5;
  });
  const filename = `centre-de-tri_${new Date().toISOString().slice(0, 10)}.pdf`;
  const base64 = doc.output('datauristring').split(',')[1] ?? '';
  return { doc, base64, filename };
}