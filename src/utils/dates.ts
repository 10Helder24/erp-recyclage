// Liste des jours fériés fixes du canton de Vaud
const FIXED_HOLIDAYS = [
  { day: 1, month: 1, name: 'Nouvel An' },
  { day: 2, month: 1, name: 'Saint-Berchtold' },
  { day: 1, month: 8, name: 'Fête nationale' },
  { day: 25, month: 12, name: 'Noël' }
] as const;

export type CantonCode = 'VD' | 'GE' | 'FR' | 'VS' | 'NE' | 'ZH' | 'BE' | 'TI' | 'JU';

const CANTON_SPECIFIC_HOLIDAYS: Record<CantonCode, Array<{ day: number; month: number; name: string }>> = {
  VD: [
    { day: 1, month: 5, name: 'Fête du Travail' }
    // Jeûne fédéral géré dynamiquement (3ᵉ lundi de septembre)
  ],
  GE: [
    { day: 1, month: 5, name: 'Fête du Travail' },
    { day: 14, month: 9, name: 'Jeûne genevois' },
    { day: 12, month: 12, name: 'Restauration de la République' }
  ],
  FR: [
    { day: 1, month: 5, name: 'Fête du Travail' },
    { day: 1, month: 11, name: 'Toussaint' }
  ],
  VS: [
    { day: 1, month: 5, name: 'Fête du Travail' },
    { day: 15, month: 8, name: 'Assomption' },
    { day: 1, month: 11, name: 'Toussaint' }
  ],
  NE: [
    { day: 1, month: 3, name: 'Indépendance neuchâteloise' },
    { day: 1, month: 5, name: 'Fête du Travail' }
  ],
  ZH: [
    { day: 1, month: 5, name: 'Fête du Travail' },
    { day: 17, month: 9, name: 'Knabenschiessen' }
  ],
  BE: [
    { day: 1, month: 5, name: 'Fête du Travail' },
    { day: 1, month: 11, name: 'Toussaint' }
  ],
  TI: [
    { day: 19, month: 3, name: 'Saint Joseph' },
    { day: 29, month: 6, name: 'Saint Pierre et Saint Paul' }
  ],
  JU: [
    { day: 1, month: 5, name: 'Fête du Travail' },
    { day: 23, month: 6, name: 'Fête du peuple jurassien' }
  ]
};

const getNthWeekdayOfMonth = (year: number, month: number, weekday: number, occurrence: number): Date => {
  const firstDay = new Date(year, month, 1);
  const firstWeekdayOffset = (weekday - firstDay.getDay() + 7) % 7;
  const day = 1 + firstWeekdayOffset + (occurrence - 1) * 7;
  return new Date(year, month, day);
};

export type HolidayInfo = {
  date: Date;
  name: string;
};

// Calcule la date de Pâques pour une année donnée (Algorithme de Meeus/Jones/Butcher)
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Ajoute un nombre de jours à une date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function buildHolidayInfos(year: number, canton: CantonCode): HolidayInfo[] {
  const easter = getEasterDate(year);
  const goodFriday = addDays(easter, -2);
  const easterMonday = addDays(easter, 1);
  const ascension = addDays(easter, 39);
  const whitMonday = addDays(easter, 50);
  const corpusChristi = addDays(easter, 60);
  const thirdSundayOfSeptember = getNthWeekdayOfMonth(year, 8, 0, 3);
  const federalFastMonday = addDays(thirdSundayOfSeptember, 1);

  const movable: HolidayInfo[] = [
    { date: goodFriday, name: 'Vendredi Saint' },
    { date: easterMonday, name: 'Lundi de Pâques' },
    { date: ascension, name: 'Ascension' },
    { date: whitMonday, name: 'Lundi de Pentecôte' },
    { date: corpusChristi, name: 'Fête-Dieu' },
    { date: federalFastMonday, name: 'Jeûne fédéral' }
  ];

  const fixed: HolidayInfo[] = FIXED_HOLIDAYS.map(({ day, month, name }) => ({
    date: new Date(year, month - 1, day),
    name
  }));

  const cantonFixedList = CANTON_SPECIFIC_HOLIDAYS[canton] ?? [];
  const cantonFixed: HolidayInfo[] = cantonFixedList.map(({ day, month, name }) => ({
    date: new Date(year, month - 1, day),
    name
  }));

  if (canton === 'VD') {
    cantonFixed.push({
      date: federalFastMonday,
      name: 'Jeûne fédéral'
    });
  }

  return [...fixed, ...movable, ...cantonFixed];
}

// Obtient tous les jours fériés pour une année donnée
export function getHolidayInfos(year: number, canton: CantonCode = 'VD'): HolidayInfo[] {
  return buildHolidayInfos(year, canton);
}

export function getHolidays(year: number, canton: CantonCode = 'VD'): Date[] {
  return getHolidayInfos(year, canton).map((holiday) => holiday.date);
}

// Vérifie si une date est un jour férié
export function isHoliday(date: Date, canton: CantonCode = 'VD'): boolean {
  return Boolean(getHolidayName(date, canton));
}

export function getHolidayName(date: Date, canton: CantonCode = 'VD'): string | null {
  const holidays = getHolidayInfos(date.getFullYear(), canton);
  const match = holidays.find(
    (holiday) =>
      holiday.date.getDate() === date.getDate() &&
      holiday.date.getMonth() === date.getMonth() &&
      holiday.date.getFullYear() === date.getFullYear()
  );
  return match?.name ?? null;
}

// Compte le nombre de jours ouvrables entre deux dates (excluant weekends et jours fériés)
export function getWorkingDays(startDate: Date, endDate: Date, canton: CantonCode = 'VD'): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Normaliser les dates pour éviter les problèmes d'heures
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    // Vérifier si ce n'est pas un weekend (0 = dimanche, 6 = samedi)
    if (!isDateWeekend(current)) {
      // Vérifier si ce n'est pas un jour férié
      if (!isHoliday(current, canton)) {
        workingDays++;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

export function calculateBusinessDays(start: Date | string, end: Date | string, canton: CantonCode = 'VD'): number {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  return getWorkingDays(startDate, endDate, canton);
}

export function getMonthDays(year: number, month: number): Date[] {
  const days = [];
  const date = new Date(year, month, 1);
  
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  
  return days;
}

// Renamed to avoid conflict with date-fns isWeekend
export function isDateWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

export const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];