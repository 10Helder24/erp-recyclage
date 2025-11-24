import { useMemo, useState } from 'react';

import { getHolidayName, isHoliday } from '../utils/dates';

type CellValue = {
  qty: string;
  note: string;
};

const EXPEDITION_ROWS = [
  '1.05 Saica',
  '1.04',
  '1.02 Saica',
  'NATRON 4.02',
  'AFNOR 3.10',
  'MARVINPAC 3.11',
  'BROYE (Chuv) 2.05',
  'ECRIT Blanc 3.05',
  'ECRIT Couleur 2.06',
  'CELLULOSE 3.08 Balles',
  'JOURNAUX',
  'INVENDUS 2.02',
  'ROGNURES JOURNAUX 2.03',
  'JOURNAUX',
  'BLANC 3.14',
  'BLANC 3.18',
  '1.11 EN VRAC TELA',
  '1.11 EN VRAC PERLEN'
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

const ExpeditionPage = () => {
  const [weekStart, setWeekStart] = useState(() => toInputValue(getMonday(new Date())));
  const [data, setData] = useState<Record<string, Record<string, CellValue[]>>>({});

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

  const ensureCellArray = (row: string, dayKey: string): CellValue[] => {
    const emptyArray: CellValue[] = [
      { qty: '', note: '' },
      { qty: '', note: '' }
    ];

    if (!data[row]) {
      return emptyArray;
    }
    if (!data[row][dayKey]) {
      return emptyArray;
    }

    const existing = data[row][dayKey];
    if (existing.length < 2) {
      return [...existing, ...emptyArray.slice(existing.length)];
    }
    return existing.slice(0, 2);
  };

  const updateCell = (row: string, dayKey: string, slotIndex: number, field: keyof CellValue, value: string) => {
    setData((prev) => {
      const rowData = prev[row] ? { ...prev[row] } : {};
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
        [row]: rowData
      };
    });
  };

  return (
    <section className="destruction-page">
      <div className="destruction-wrapper">
        <div className="destruction-card">
          <div className="destruction-card__header">
            <div>
              <p className="eyebrow">Inventaires</p>
              <h1>Expéditions</h1>
              <p>Semaine du {rangeLabel}</p>
            </div>
            <div className="page-actions">
              <label className="destruction-field" style={{ margin: 0 }}>
                <span>Début de semaine</span>
                <input type="date" className="destruction-input" value={weekStart} onChange={(e) => handleWeekChange(e.target.value)} />
              </label>
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
              {EXPEDITION_ROWS.map((row) => (
                <div className="expedition-grid expedition-grid-row" key={row}>
                  <div className="expedition-label">{row}</div>
                  {weekDays.map((day) => {
                    const dayKey = toInputValue(day);
                    const slots = ensureCellArray(row, dayKey);
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
                              onChange={(e) => updateCell(row, dayKey, slotIndex, 'qty', e.target.value)}
                            />
                            <input
                              type="text"
                              className="destruction-input"
                              placeholder="Transporteur"
                              value={slot.note}
                              onChange={(e) => updateCell(row, dayKey, slotIndex, 'note', e.target.value.toUpperCase())}
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

