import type { jsPDF } from 'jspdf';

type PdfPayload = {
  doc: jsPDF;
  filename: string;
};

export const openPdfPreview = ({ doc, filename }: PdfPayload) => {
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    console.error('Impossible d’ouvrir le PDF', error);
    throw error;
  }
};

