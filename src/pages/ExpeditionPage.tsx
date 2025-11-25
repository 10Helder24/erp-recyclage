import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { FileDown, Send, Eye } from 'lucide-react';

import { getHolidayName, isHoliday } from '../utils/dates';
import { Api } from '../lib/api';
import { openPdfPreview } from '../utils/pdfPreview';

type CellValue = {
  qty: string;
  note: string;
};

type ExpeditionRow = {
  id: string;
  label: string;
};

const DEFAULT_ROWS: ExpeditionRow[] = [
  { id: '105-saica', label: '1.05 Saica' },
  { id: '104', label: '1.04' },
  { id: '102-saica', label: '1.02 Saica' },
  { id: 'natron', label: 'NATRON 4.02' },
  { id: 'afnor', label: 'AFNOR 3.10' },
  { id: 'marvinpac', label: 'MARVINPAC 3.11' },
  { id: 'broye', label: 'BROYE (Chuv) 2.05' },
  { id: 'ecrit-blanc', label: 'ECRIT Blanc 3.05' },
  { id: 'ecrit-couleur', label: 'ECRIT Couleur 2.06' },
  { id: 'cellulose', label: 'CELLULOSE 3.08 Balles' },
  { id: 'journaux-invendus', label: 'JOURNAUX INVENDUS 2.02' },
  { id: 'rognures', label: 'ROGNURES JOURNAUX 2.03' },
  { id: 'journaux-blanc', label: 'JOURNAUX BLANC 3.14' },
  { id: 'blanc-318', label: 'BLANC 3.18' },
  { id: 'vrac-tela', label: '1.11 EN VRAC TELA' },
  { id: 'vrac-perlen', label: '1.11 EN VRAC PERLEN' }
];

const formatter = new Intl.DateTimeFormat('fr-CH', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit'
});

const headerFormatter = new Intl.DateTimeFormat('fr-CH', {
  weekday: 'long'
});

function getMonday(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getIsoWeekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday=0, Sunday=6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

const ExpeditionPage = () => {
  const [weekStart, setWeekStart] = useState(() => toInputValue(getMonday(new Date())));
  const [rows, setRows] = useState<ExpeditionRow[]>(() => DEFAULT_ROWS.map((row) => ({ ...row })));
  const [data, setData] = useState<Record<string, Record<string, CellValue[]>>>({});
  const [loading, setLoading] = useState(false);

  const weekDays = useMemo(() => {
    const base = new Date(weekStart);
    return Array.from({ length: 5 }, (_, idx) => {
      const day = new Date(base);
      day.setDate(base.getDate() + idx);
      return day;
    });
  }, [weekStart]);

  const rangeLabel = useMemo(() => {
    if (!weekDays.length) return '';
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    const startText = formatter.format(first);
    const endText = new Intl.DateTimeFormat('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(last);
    return `${startText} · ${endText}`;
  }, [weekDays]);

  const weekNumber = useMemo(() => {
    if (!weekDays.length) return null;
    return getIsoWeekNumber(weekDays[0]);
  }, [weekDays]);

  const handleWeekChange = (value: string) => {
    const chosen = value ? new Date(value) : new Date();
    const monday = getMonday(chosen);
    setWeekStart(toInputValue(monday));
  };

  const holidays = useMemo(() => {
    const record: Record<
      string,
      {
        isHoliday: boolean;
        label: string | null;
      }
    > = {};

    weekDays.forEach((day) => {
      const key = toInputValue(day);
      record[key] = {
        isHoliday: isHoliday(day, 'VD'),
        label: getHolidayName(day, 'VD')
      };
    });

    return record;
  }, [weekDays]);

  const ensureCellArray = (rowId: string, dayKey: string): CellValue[] => {
    const emptyArray: CellValue[] = [
      { qty: '', note: '' },
      { qty: '', note: '' }
    ];

    if (!data[rowId]) {
      return emptyArray;
    }
    if (!data[rowId][dayKey]) {
      return emptyArray;
    }

    const existing = data[rowId][dayKey];
    if (existing.length < 2) {
      return [...existing, ...emptyArray.slice(existing.length)];
    }
    return existing.slice(0, 2);
  };

  const updateCell = (rowId: string, dayKey: string, slotIndex: number, field: keyof CellValue, value: string) => {
    setData((prev) => {
      const rowData = prev[rowId] ? { ...prev[rowId] } : {};
      const cellArray = rowData[dayKey]
        ? [...rowData[dayKey]]
        : [
            { qty: '', note: '' },
            { qty: '', note: '' }
          ];

      cellArray[slotIndex] = {
        ...cellArray[slotIndex],
        [field]: value
      };

      rowData[dayKey] = cellArray;
      return {
        ...prev,
        [rowId]: rowData
      };
    });
  };

  const handleRowLabelChange = (rowId: string, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, label: value } : row)));
  };

  const buildExpeditionPdf = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const margin = 5;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const currentWeekNumber = weekDays.length ? getIsoWeekNumber(weekDays[0]) : null;

    // Header - Green band
    doc.setFillColor(0, 100, 0); // Dark green
    doc.rect(0, 0, pageWidth, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    const weekLabel = currentWeekNumber ? ` S.${String(currentWeekNumber).padStart(2, '0')}` : '';
    const dateRangeText = `RETRIPA CRISSIER SA${weekLabel} du ${weekDays[0].getDate().toString().padStart(2, '0')}.${(weekDays[0].getMonth() + 1).toString().padStart(2, '0')} au ${weekDays[weekDays.length - 1].getDate().toString().padStart(2, '0')}.${(weekDays[weekDays.length - 1].getMonth() + 1).toString().padStart(2, '0')}.${weekDays[0].getFullYear()}`;
    doc.text(dateRangeText, pageWidth / 2, 7, { align: 'center' });

    let y = 15;
    const rowHeight = 8; // Increased to accommodate two slots
    const leftColWidth = 50;
    const dayColWidth = (pageWidth - margin * 2 - leftColWidth) / weekDays.length;
    const qtyColWidth = dayColWidth * 0.25; // Small column for quantity (25%)
    const transporterColWidth = dayColWidth * 0.75; // Large column for transporter (75%)
    const slotHeight = rowHeight / 2; // Each slot takes half the row height

    // Column headers
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    // Left column - EXPEDITIONS (blue)
    doc.setFillColor(0, 100, 200); // Blue
    doc.rect(margin, y, leftColWidth, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('EXPEDITIONS', margin + leftColWidth / 2, y + rowHeight / 2 + 1.5, { align: 'center' });

    // Day columns
    let x = margin + leftColWidth;
    weekDays.forEach((day) => {
      const dayKey = toInputValue(day);
      const isHolidayDay = Boolean(holidays[dayKey]?.isHoliday);
      const dayName = headerFormatter.format(day);
      const dayNum = day.getDate().toString().padStart(2, '0');

      doc.setFillColor(200, 0, 0); // Red background for all day headers
      doc.rect(x, y, dayColWidth, rowHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(`${dayName} ${dayNum}`, x + dayColWidth / 2, y + rowHeight / 2 + 0.5, { align: 'center' });
      if (isHolidayDay) {
        doc.setFontSize(7);
        doc.text('Ferié', x + dayColWidth / 2, y + rowHeight / 2 + 2.5, { align: 'center' });
      }
      x += dayColWidth;
    });

    y += rowHeight;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);

    rows.forEach((row, rowIndex) => {
      // Left column - row label
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, leftColWidth, rowHeight, 'FD');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);
      doc.text(row.label, margin + 2, y + rowHeight / 2 + 1.5);

      // Day columns
      x = margin + leftColWidth;
      weekDays.forEach((day) => {
        const dayKey = toInputValue(day);
        const isHolidayDay = Boolean(holidays[dayKey]?.isHoliday);
        const slots = ensureCellArray(row.id, dayKey);

        // Draw cell background
        if (isHolidayDay) {
          doc.setFillColor(240, 200, 200); // Light red for holiday cells
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.rect(x, y, dayColWidth, rowHeight, 'FD');

        // Draw vertical separator between qty and transporter columns
        doc.setDrawColor(0, 0, 0);
        doc.line(x + qtyColWidth, y, x + qtyColWidth, y + rowHeight);

        // Draw horizontal separator between the two slots
        doc.line(x, y + slotHeight, x + dayColWidth, y + slotHeight);

        // Draw content for each slot
        slots.forEach((slot, slotIndex) => {
          const slotY = y + slotIndex * slotHeight;
          
          // Quantity column (small)
          if (slot.qty) {
            doc.setTextColor(0, 0, 0);
            doc.text(slot.qty, x + qtyColWidth / 2, slotY + slotHeight / 2 + 1, { align: 'center' });
          }

          // Transporter column (large)
          if (slot.note) {
            doc.setTextColor(0, 0, 0);
            doc.text(slot.note, x + qtyColWidth + 1, slotY + slotHeight / 2 + 1, { 
              maxWidth: transporterColWidth - 2 
            });
          }
        });

        x += dayColWidth;
      });

      y += rowHeight;
    });

    const base64 = doc.output('datauristring').split(',')[1];
    const filename = `Expeditions_${weekDays[0].getDate().toString().padStart(2, '0')}.${(weekDays[0].getMonth() + 1).toString().padStart(2, '0')}.${weekDays[0].getFullYear()}.pdf`;

    return { doc, base64, filename };
  };

  const handlePreview = () => {
    try {
      const pdf = buildExpeditionPdf();
      openPdfPreview(pdf);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible de générer le PDF');
    }
  };

  const handleSendEmail = async () => {
    setLoading(true);
    try {
      const pdf = buildExpeditionPdf();
      const dateRangeText = `du ${weekDays[0].getDate().toString().padStart(2, '0')}.${(weekDays[0].getMonth() + 1).toString().padStart(2, '0')} au ${weekDays[weekDays.length - 1].getDate().toString().padStart(2, '0')}.${(weekDays[weekDays.length - 1].getMonth() + 1).toString().padStart(2, '0')}.${weekDays[0].getFullYear()}`;

      await Api.sendExpedition({
        dateRange: dateRangeText,
        weekStart: weekStart,
        data: data,
        pdfBase64: pdf.base64,
        pdfFilename: pdf.filename
      });

      toast.success('✅ Email envoyé avec succès !', { duration: 5000 });
    } catch (error) {
      toast.error((error as Error).message || 'Impossible d\'envoyer l\'email');
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
              <h1>Expéditions</h1>
              <p>
                Semaine {weekNumber ? `S.${String(weekNumber).padStart(2, '0')} · ` : ''}
                du {rangeLabel}
              </p>
            </div>
            <div className="page-actions">
              <label className="destruction-field" style={{ margin: 0 }}>
                <span>Début de semaine</span>
                <input type="date" className="destruction-input" value={weekStart} onChange={(e) => handleWeekChange(e.target.value)} />
              </label>
              <button onClick={handlePreview} className="btn btn-outline" disabled={loading}>
                <Eye size={18} />
                Prévisualiser PDF
              </button>
              <button onClick={handleSendEmail} className="btn btn-primary" disabled={loading}>
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
            <div className="expedition-controls">
              <p>Jours fériés</p>
              <div className="expedition-chips">
                {weekDays.map((day) => {
                  const key = toInputValue(day);
                  const holiday = holidays[key];
                  if (!holiday?.isHoliday) {
                    return null;
                  }
                  return (
                    <span key={key} className="expedition-chip active">
                      {headerFormatter.format(day)}
                      {holiday.label ? ` · ${holiday.label}` : ''}
                    </span>
                  );
                })}
                {!weekDays.some((day) => holidays[toInputValue(day)]?.isHoliday) ? <span className="expedition-chip muted">Aucun</span> : null}
              </div>
            </div>

            <div className="expedition-grid expedition-grid-header">
              <div className="expedition-header-title">Expéditions</div>
              {weekDays.map((day) => {
                const key = toInputValue(day);
                const hol = holidays[key];
                const classes = ['calendar-day-header'];
                if (hol?.isHoliday) classes.push('holiday');
                return (
                  <div key={key} className={classes.join(' ')}>
                    <div className="expedition-day">
                      <span className="day-name">{headerFormatter.format(day)}</span>
                      <span className="day-number">{day.getDate().toString().padStart(2, '0')}</span>
                      {hol?.isHoliday ? <span className="expedition-holiday-badge">Férié</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="expedition-rows">
              {rows.map((row) => (
                <div className="expedition-grid expedition-grid-row" key={row.id}>
                  <div className="expedition-label">
                    <input
                      type="text"
                      className="destruction-input expedition-label-input"
                      value={row.label}
                      onChange={(e) => handleRowLabelChange(row.id, e.target.value)}
                    />
                  </div>
                  {weekDays.map((day) => {
                    const dayKey = toInputValue(day);
                    const slots = ensureCellArray(row.id, dayKey);
                    const isHolidayDay = Boolean(holidays[dayKey]?.isHoliday);
                    return (
                      <div key={dayKey} className={`expedition-cell${isHolidayDay ? ' holiday' : ''}`}>
                        {slots.map((slot, slotIndex) => (
                          <div key={`${dayKey}-${slotIndex}`} className="expedition-slot">
                            <input
                              type="number"
                              className="destruction-input"
                              placeholder="Qté"
                              value={slot.qty}
                              onChange={(e) => updateCell(row.id, dayKey, slotIndex, 'qty', e.target.value)}
                            />
                            <input
                              type="text"
                              className="destruction-input"
                              placeholder="Transporteur"
                              value={slot.note}
                              onChange={(e) =>
                                updateCell(row.id, dayKey, slotIndex, 'note', e.target.value.toUpperCase())
                              }
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExpeditionPage;

