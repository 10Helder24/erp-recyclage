const TYPE_LABELS_SERVER: Record<string, string> = {
  vacances: 'Vacances',
  maladie: 'Maladie',
  accident: 'Accident',
  deces: 'Décès',
  formation: 'Formation',
  heures_sup: 'Récup. heures',
  armee: 'Armée / PC'
};
const WORKFLOW_STEPS = ['manager', 'hr', 'director'] as const;
type WorkflowStep = (typeof WORKFLOW_STEPS)[number];
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';
import path from 'node:path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Charger d'abord le .env de la racine (DATABASE_URL, PORT)
dotenv.config();
// Puis charger server/.env pour les variables SMTP
dotenv.config({
  path: path.resolve(process.cwd(), 'server/.env')
});

const JWT_SECRET = process.env.JWT_SECRET || 'insecure-dev-secret';
const AUTH_SETUP_TOKEN = process.env.AUTH_SETUP_TOKEN;

// VAPID keys pour les notifications push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@retripa.com';

// Configurer web-push si les clés sont disponibles
let webpush: any = null;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush = require('web-push');
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('Notifications push configurées avec succès');
  } catch (error) {
    console.warn('web-push non disponible, les notifications push seront désactivées');
  }
}

import type { Leave, LeaveBalance, LeaveRequestPayload, LeaveStatus, LeaveType } from '../../src/types/leaves';
import { format, differenceInYears } from 'date-fns';
import { fr } from 'date-fns/locale';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined. Please add it to your .env file.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const run = async <T = any>(text: string, params: unknown[] = []): Promise<T[]> => {
  const result = await pool.query(text, params) as unknown as { rows: T[] };
  return result.rows;
};

const MAX_CUSTOMER_DOCUMENT_SIZE = Number(process.env.MAX_CUSTOMER_DOC_SIZE_MB ?? 10) * 1024 * 1024; // 10 Mo par défaut

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: string | null;
  contract_type: string | null;
  employment_status: string | null;
  work_rate: number | null;
  work_schedule: string | null;
  manager_name: string | null;
  location: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  work_permit: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  start_date: string | null;
  birth_date: string | null;
  birth_location: string | null;
  personal_email: string | null;
  personal_phone: string | null;
  nationality: string | null;
  marital_status: string | null;
  dependent_children: string | null;
  id_document_number: string | null;
  ahv_number: string | null;
  iban: string | null;
  created_at: string | null;
};

type LeaveRow = Leave & { employee: EmployeeRow };
type LeaveBalanceRow = LeaveBalance & { employee: EmployeeRow };

type UserRole = 'admin' | 'manager' | 'user';

type MapVehicle = {
  id: string;
  internal_number: string | null;
  plate_number: string | null;
};

type MapRouteStopRow = {
  route_id: string;
  route_status: string | null;
  path: any | null;
  stop_id: string;
  order_index: number;
  estimated_time: string | null;
  stop_status: string | null;
  notes: string | null;
  completed_at: string | null;
  customer_name: string | null;
  customer_address: string | null;
  latitude: number | null;
  longitude: number | null;
  risk_level: string | null;
  vehicle_id: string | null;
  internal_number: string | null;
  plate_number: string | null;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  full_name: string | null;
  department: string | null;
  manager_name: string | null;
  permissions: string[] | null;
  reset_token: string | null;
  reset_token_expires: string | null;
  created_at: string | null;
};

type AuthPayload = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  department: string | null;
  manager_name: string | null;
  permissions: string[] | null;
};

type AuthenticatedRequest = express.Request & { auth?: AuthPayload; user?: AuthPayload };

const mapEmployeeRow = (row: EmployeeRow) => ({
  id: row.id,
  employee_code: row.employee_code,
  first_name: row.first_name,
  last_name: row.last_name,
  email: row.email,
  phone: row.phone,
  department: row.department,
  role: row.role,
  contract_type: row.contract_type,
  employment_status: row.employment_status,
  work_rate: row.work_rate,
  work_schedule: row.work_schedule,
  manager_name: row.manager_name,
  location: row.location,
  address_line1: row.address_line1,
  address_line2: row.address_line2,
  postal_code: row.postal_code,
  city: row.city,
  country: row.country,
  work_permit: row.work_permit,
  emergency_contact_name: row.emergency_contact_name,
  emergency_contact_phone: row.emergency_contact_phone,
  notes: row.notes,
  start_date: row.start_date,
  birth_date: row.birth_date,
  created_at: row.created_at,
  birth_location: row.birth_location,
  personal_email: row.personal_email,
  personal_phone: row.personal_phone,
  nationality: row.nationality,
  marital_status: row.marital_status,
  dependent_children: row.dependent_children,
  id_document_number: row.id_document_number,
  ahv_number: row.ahv_number,
  iban: row.iban
});

const mapUserRow = (row: UserRow) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  role: row.role,
  department: row.department,
  manager_name: row.manager_name,
  permissions: row.permissions ?? [],
  created_at: row.created_at
});

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
const DEPOT_COORDS: [number, number] = [46.548452466797585, 6.572221457669403];
const DEFAULT_ROUTE_START_TIME = '08:00';

type TrafficWindow = {
  label: string;
  startHour: number;
  endHour: number;
  factor: number;
};

type TrafficZone = {
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  windows: TrafficWindow[];
};

const TRAFFIC_ZONES: TrafficZone[] = [
  {
    name: 'Lausanne / Crissier',
    latitude: 46.535,
    longitude: 6.6,
    radiusKm: 10,
    windows: [
      { label: 'matin', startHour: 6, endHour: 9, factor: 1.35 },
      { label: 'soir', startHour: 16, endHour: 19, factor: 1.4 }
    ]
  },
  {
    name: 'Genève centre',
    latitude: 46.2044,
    longitude: 6.1432,
    radiusKm: 8,
    windows: [
      { label: 'matin', startHour: 6.5, endHour: 9.5, factor: 1.45 },
      { label: 'soir', startHour: 15.5, endHour: 19.5, factor: 1.5 }
    ]
  },
  {
    name: 'Vevey / Riviera',
    latitude: 46.463,
    longitude: 6.84,
    radiusKm: 6,
    windows: [{ label: 'soir', startHour: 16, endHour: 18.5, factor: 1.25 }]
  }
];

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const sanitizeStartTime = (value?: string) => {
  if (value && /^\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  return DEFAULT_ROUTE_START_TIME;
};

const buildRouteStartDate = (date: string, startTime?: string) => {
  const time = sanitizeStartTime(startTime);
  return new Date(`${date}T${time}:00`);
};

const getTrafficImpact = (lat: number, lon: number, timestamp: Date) => {
  let factor = 1;
  let label: string | null = null;
  const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
  for (const zone of TRAFFIC_ZONES) {
    const distance = haversineKm(lat, lon, zone.latitude, zone.longitude);
    if (distance > zone.radiusKm) continue;
    for (const window of zone.windows) {
      if (hour >= window.startHour && hour <= window.endHour && window.factor > factor) {
        factor = window.factor;
        label = `${zone.name} (${window.label})`;
      }
    }
  }
  return { factor, label };
};

const roundNumber = (value: number, digits = 2) => {
  const power = Math.pow(10, digits);
  return Math.round(value * power) / power;
};

type OptimizationStopRow = {
  id: string;
  customer_name: string | null;
  latitude: number;
  longitude: number;
  order_index: number;
  risk_level: string | null;
};

type OptimizationStopSuggestion = {
  stop_id: string;
  customer_name: string | null;
  previous_order: number;
  suggested_order: number;
  eta: string | null;
  distance_km: number;
  travel_minutes: number;
  traffic_factor: number;
  traffic_label: string | null;
};

type OptimizationComputationResult = {
  suggestedStops: OptimizationStopSuggestion[];
  totalDistanceKm: number;
  totalDurationMin: number;
  trafficNotes: string[];
};

type OptimizationLeg = {
  distance: number; // meters
  duration: number; // seconds
};

type PdfTemplateZoneConfig = {
  backgroundColor?: string | null;
  textColor?: string | null;
  titleColor?: string | null;
  subtitleColor?: string | null;
  borderColor?: string | null;
};

type PdfTemplateZones = {
  header?: PdfTemplateZoneConfig;
  body?: PdfTemplateZoneConfig;
  highlight?: PdfTemplateZoneConfig;
};

type PdfTemplateConfig = {
  headerLogo?: string | null;
  footerLogo?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  title?: string | null;
  subtitle?: string | null;
  footerText?: string | null;
  customTexts?: Record<string, string>;
  zones?: PdfTemplateZones;
};

type PdfTemplateRow = {
  id: string;
  module: string;
  config: PdfTemplateConfig;
  updated_at: string;
  updated_by: string | null;
  updated_by_name: string | null;
};

const DEFAULT_PDF_TEMPLATES: Record<string, PdfTemplateConfig> = {
  declassement: {
    title: 'Déclassement de matières',
    subtitle: 'Rapport de tri',
    primaryColor: '#000000',
    accentColor: '#0ea5e9',
    footerText: 'Retripa SA · Service Qualité',
    zones: {
      header: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
        subtitleColor: '#d1d5db'
      },
      body: {
        textColor: '#111827',
        titleColor: '#1d4ed8'
      },
      highlight: {
        backgroundColor: '#e0f2fe',
        textColor: '#0f172a'
      }
    }
  },
  destruction: {
    title: 'Destruction de documents',
    subtitle: 'Certificat d’intervention',
    primaryColor: '#0f172a',
    accentColor: '#04b6d9',
    footerText: 'Confidentiel - usage interne',
    zones: {
      header: {
        backgroundColor: '#0f172a',
        textColor: '#ffffff',
        subtitleColor: '#8dd3f3'
      },
      body: {
        textColor: '#111827',
        titleColor: '#22c55e'
      },
      highlight: {
        backgroundColor: '#bbf7d0',
        textColor: '#0f172a'
      }
    }
  },
  leave: {
    title: 'Demande de congé',
    subtitle: 'Workflow digital',
    primaryColor: '#0f172a',
    accentColor: '#38bdf8',
    footerText: 'Validée électroniquement',
    zones: {
      header: {
        backgroundColor: '#0f172a',
        textColor: '#ffffff'
      },
      body: {
        textColor: '#111827',
        titleColor: '#0ea5e9'
      },
      highlight: {
        backgroundColor: '#e2e8f0',
        textColor: '#0f172a'
      }
    }
  },
  cdt: {
    title: 'Centre de tri - CDT',
    subtitle: 'Feuille de suivi',
    primaryColor: '#0f172a',
    accentColor: '#22d3ee',
    zones: {
      header: {
        backgroundColor: '#0f172a',
        textColor: '#ffffff'
      },
      body: {
        textColor: '#0f172a',
        titleColor: '#22d3ee'
      },
      highlight: {
        backgroundColor: '#22d3ee',
        textColor: '#ffffff'
      }
    }
  },
  inventory: {
    title: 'Inventaire Halle',
    subtitle: 'Export PDF',
    primaryColor: '#0f172a',
    accentColor: '#0ea5e9',
    zones: {
      header: {
        backgroundColor: '#0f172a',
        textColor: '#ffffff'
      },
      body: {
        textColor: '#0f172a',
        titleColor: '#0ea5e9'
      },
      highlight: {
        backgroundColor: '#e0f2fe',
        textColor: '#0f172a'
      }
    }
  },
  expedition: {
    title: 'Expéditions',
    subtitle: 'Plan de chargement',
    primaryColor: '#0f172a',
    accentColor: '#0ea5e9',
    zones: {
      header: {
        backgroundColor: '#0f172a',
        textColor: '#ffffff'
      },
      body: {
        textColor: '#0f172a',
        titleColor: '#0ea5e9'
      },
      highlight: {
        backgroundColor: '#f3f4f6',
        textColor: '#0f172a'
      }
    }
  }
};

const buildSuggestionFromLegs = (
  orderedStops: OptimizationStopRow[],
  legs: OptimizationLeg[],
  routeDate: string,
  startTime?: string
): OptimizationComputationResult => {
  const startDate = buildRouteStartDate(routeDate, startTime);
  let cursorTime = new Date(startDate);
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  const notes = new Set<string>();

  const suggestions: OptimizationStopSuggestion[] = orderedStops.map((stop, index) => {
    const leg = legs[index];
    const legDistanceKm = leg ? leg.distance / 1000 : 0;
    let legDurationMin = leg ? leg.duration / 60 : legDistanceKm * (60 / 45); // fallback 45 km/h
    if (Number.isNaN(legDurationMin)) {
      legDurationMin = 0;
    }

    const { factor, label } = getTrafficImpact(stop.latitude, stop.longitude, cursorTime);
    const adjustedDuration = legDurationMin * factor;
    const etaDate = new Date(cursorTime.getTime() + adjustedDuration * 60 * 1000);

    cursorTime = etaDate;
    totalDistanceKm += legDistanceKm;
    totalDurationMin += adjustedDuration;
    if (label) {
      notes.add(label);
    }

    return {
      stop_id: stop.id,
      customer_name: stop.customer_name,
      previous_order: stop.order_index,
      suggested_order: index + 1,
      eta: etaDate.toISOString(),
      distance_km: roundNumber(legDistanceKm, 2),
      travel_minutes: roundNumber(adjustedDuration, 1),
      traffic_factor: roundNumber(factor, 2),
      traffic_label: label
    };
  });

  return {
    suggestedStops: suggestions,
    totalDistanceKm: roundNumber(totalDistanceKm, 2),
    totalDurationMin: roundNumber(totalDurationMin, 1),
    trafficNotes: Array.from(notes)
  };
};

const buildHeuristicOptimization = (
  stops: OptimizationStopRow[],
  routeDate: string,
  startTime?: string
): OptimizationComputationResult => {
  const remaining = [...stops];
  const ordered: OptimizationStopRow[] = [];
  let currentLat = DEPOT_COORDS[0];
  let currentLon = DEPOT_COORDS[1];

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, idx) => {
      const dist = haversineKm(currentLat, currentLon, stop.latitude, stop.longitude);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = idx;
      }
    });
    const [nextStop] = remaining.splice(bestIndex, 1);
    ordered.push(nextStop);
    currentLat = nextStop.latitude;
    currentLon = nextStop.longitude;
  }

  const legs: OptimizationLeg[] = ordered.map((stop, index) => {
    const originLat = index === 0 ? DEPOT_COORDS[0] : ordered[index - 1].latitude;
    const originLon = index === 0 ? DEPOT_COORDS[1] : ordered[index - 1].longitude;
    const distanceKm = haversineKm(originLat, originLon, stop.latitude, stop.longitude);
    const durationMinutes = distanceKm * (60 / 40); // approx 40km/h en zone urbaine
    return { distance: distanceKm * 1000, duration: durationMinutes * 60 };
  });

  return buildSuggestionFromLegs(ordered, legs, routeDate, startTime);
};

const buildOsrmOptimization = async (
  stops: OptimizationStopRow[],
  routeDate: string,
  startTime?: string
): Promise<OptimizationComputationResult> => {
  const coords = [`${DEPOT_COORDS[1]},${DEPOT_COORDS[0]}`, ...stops.map((stop) => `${stop.longitude},${stop.latitude}`)];
  const url = `${OSRM_BASE_URL}/trip/v1/driving/${coords.join(';')}?source=first&roundtrip=false&overview=false&annotations=duration,distance`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM error: ${response.status}`);
  }
  const data = (await response.json()) as {
    code?: string;
    message?: string;
    trips?: Array<{
      legs: OptimizationLeg[];
      waypoint_order?: number[];
      distance: number;
      duration: number;
    }>;
    waypoints?: Array<{ waypoint_index: number }>;
  };
  if (data.code !== 'Ok' || !data.trips?.length) {
    throw new Error(`OSRM response invalid: ${data.message ?? 'unknown'}`);
  }
  const trip = data.trips[0];
  let order = trip.waypoint_order;
  if (!order && data.waypoints) {
    order = data.waypoints.map((wp) => wp.waypoint_index);
  }
  if (!order) {
    throw new Error('OSRM order missing');
  }
  const filteredOrder = order.filter((index) => index !== 0); // remove dépôt
  const orderedStops = filteredOrder.map((waypointIndex) => {
    const stop = stops[waypointIndex - 1];
    if (!stop) {
      throw new Error('OSRM waypoint index mismatch');
    }
    return stop;
  });

  return buildSuggestionFromLegs(orderedStops, trip.legs || [], routeDate, startTime);
};

const mergeZoneConfig = (
  base?: PdfTemplateZoneConfig,
  override?: PdfTemplateZoneConfig
): PdfTemplateZoneConfig | undefined => {
  if (!base && !override) {
    return undefined;
  }
  return {
    ...(base || {}),
    ...(override || {})
  };
};

const mergeZones = (
  base?: PdfTemplateZones,
  override?: PdfTemplateZones
): PdfTemplateZones | undefined => {
  if (!base && !override) {
    return undefined;
  }
  const mergedKeys = new Set<string>([
    ...Object.keys(base || {}),
    ...Object.keys(override || {})
  ]);
  const zones: PdfTemplateZones = {};
  mergedKeys.forEach((key) => {
    const zoneKey = key as keyof PdfTemplateZones;
    zones[zoneKey] = mergeZoneConfig(base?.[zoneKey], override?.[zoneKey]);
  });
  return zones;
};

const mergeTemplateConfig = (module: string, config?: PdfTemplateConfig | null): PdfTemplateConfig => {
  const base = DEFAULT_PDF_TEMPLATES[module] || {};
  const override = config || {};
  const merged: PdfTemplateConfig = {
    ...base,
    ...override
  };
  merged.zones = mergeZones(base.zones, override.zones);
  return merged;
};

const getPdfTemplate = async (module: string): Promise<PdfTemplateRow> => {
  const rows = await run<
    PdfTemplateRow & {
      updated_by_name: string | null;
    }
  >(
    `select t.id,
            t.module,
            t.config,
            t.updated_at,
            t.updated_by,
            u.full_name as updated_by_name
     from pdf_templates t
     left join users u on u.id = t.updated_by
     where module = $1`,
    [module]
  );
  if (!rows.length) {
    return {
      id: '',
      module,
      config: mergeTemplateConfig(module),
      updated_at: new Date().toISOString(),
      updated_by: null,
      updated_by_name: null
    };
  }
  return {
    ...rows[0],
    config: mergeTemplateConfig(module, rows[0].config)
  };
};

const upsertPdfTemplate = async (module: string, config: PdfTemplateConfig, userId?: string) => {
  const merged = mergeTemplateConfig(module, config);
  await run(
    `insert into pdf_templates (module, config, updated_by)
     values ($1, $2, $3)
     on conflict (module)
     do update set config = $2, updated_by = $3, updated_at = now()`,
    [module, merged, userId || null]
  );
  return getPdfTemplate(module);
};

type WorkflowPipelineStep = WorkflowStep | 'completed';

const getNextWorkflowStep = (current: WorkflowStep): WorkflowPipelineStep => {
  const idx = WORKFLOW_STEPS.indexOf(current);
  if (idx === -1 || idx === WORKFLOW_STEPS.length - 1) {
    return 'completed';
  }
  return WORKFLOW_STEPS[idx + 1];
};

const canUserApproveStep = (auth: AuthenticatedRequest['auth'], step: WorkflowStep) => {
  if (!auth) {
    return false;
  }
  if (auth.role === 'admin') {
    return true;
  }
  const permissions = auth.permissions ?? [];
  switch (step) {
    case 'manager':
      return auth.role === 'manager' || permissions.includes('approve_leave_manager');
    case 'hr':
      return permissions.includes('approve_leave_hr');
    case 'director':
      return permissions.includes('approve_leave_director');
    default:
      return false;
  }
};

const parseRecipients = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

const getWorkflowRecipients = (step: WorkflowStep) => {
  if (step === 'hr') {
    return parseRecipients(process.env.LEAVE_HR_RECIPIENTS ?? process.env.BREVO_SENDER_EMAIL);
  }
  if (step === 'director') {
    return parseRecipients(process.env.LEAVE_DIRECTION_RECIPIENTS ?? process.env.BREVO_SENDER_EMAIL);
  }
  return parseRecipients(process.env.LEAVE_MANAGER_RECIPIENTS ?? process.env.BREVO_SENDER_EMAIL);
};

const formatLeaveLines = (leaves: LeaveRow[]) =>
  leaves
    .map((leave) => {
      const name = `${leave.employee?.first_name ?? ''} ${leave.employee?.last_name ?? ''}`.trim();
      const start = format(new Date(leave.start_date), 'dd.MM.yyyy', { locale: fr });
      const end = format(new Date(leave.end_date), 'dd.MM.yyyy', { locale: fr });
      return `${name} · ${TYPE_LABELS_SERVER[leave.type as LeaveType] || leave.type} · ${start} → ${end}`;
    })
    .join('\n');

const notifyWorkflowStep = async (step: WorkflowStep, leaves: LeaveRow[]) => {
  const recipients = getWorkflowRecipients(step);
  if (!recipients.length) {
    return;
  }
  const subject =
    step === 'hr'
      ? 'Validation RH requise - Congés'
      : step === 'director'
        ? 'Validation Direction requise - Congés'
        : 'Validation manager requise - Congés';
  const text = [
    `Bonjour,`,
    '',
    `Une demande de congé nécessite une validation (${step.toUpperCase()}).`,
    '',
    formatLeaveLines(leaves),
    '',
    'Merci de traiter la demande dans l’ERP.'
  ].join('\n');
  await sendBrevoEmail({ to: recipients, subject, text });
};

const notifyApplicantDecision = async (leaves: LeaveRow[], decision: 'approve' | 'reject', stage: WorkflowStep) => {
  const emails = Array.from(
    new Set(
      leaves
        .map((leave) => leave.employee?.email?.trim())
        .filter((email): email is string => Boolean(email))
    )
  );
  if (!emails.length) {
    return;
  }
  const subject =
    decision === 'approve'
      ? 'Votre demande de congé a été approuvée'
      : 'Votre demande de congé a été refusée';
  const text = [
    `Bonjour,`,
    '',
    decision === 'approve'
      ? `Votre demande a été approuvée par la ${stage === 'director' ? 'direction' : 'hiérarchie'}.`
      : `Votre demande a été refusée lors de l'étape ${stage.toUpperCase()}.`,
    '',
    formatLeaveLines(leaves),
    '',
    'Merci de prendre note.'
  ].join('\n');
  await sendBrevoEmail({ to: emails, subject, text });
};

const fetchLeavesByGroup = async (groupIdentifier: string, hasGroup: boolean) => {
  if (hasGroup) {
    return run<LeaveRow>(`${leaveBaseSelect} where l.request_group_id = $1 order by l.start_date asc`, [groupIdentifier]);
  }
  return run<LeaveRow>(`${leaveBaseSelect} where l.id = $1`, [groupIdentifier]);
};

const canViewLeaveInbox = (auth?: AuthPayload) => {
  if (!auth) return false;
  if (auth.role === 'admin' || auth.role === 'manager') {
    return true;
  }
  const permissions = auth.permissions ?? [];
  return (
    permissions.includes('approve_leave_manager') ||
    permissions.includes('approve_leave_hr') ||
    permissions.includes('approve_leave_director')
  );
};

type AuditAction = 'create' | 'update' | 'delete';
const recordAuditLog = async ({
  entityType,
  entityId,
  action,
  req,
  before,
  after
}: {
  entityType: string;
  entityId?: string | null;
  action: AuditAction;
  req?: express.Request;
  before?: unknown;
  after?: unknown;
}) => {
  try {
    const auth = req ? (req as AuthenticatedRequest).auth : undefined;
    const userId = auth?.id ?? null;
    const userName = auth?.full_name ?? auth?.email ?? null;
    await run(
      `insert into audit_logs (id, entity_type, entity_id, action, changed_by, changed_by_name, before_data, after_data)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        entityType,
        entityId ?? null,
        action,
        userId,
        userName,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null
      ]
    );
  } catch (error) {
    console.error('[AUDIT] Impossible d’enregistrer le log', error);
  }
};

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Augmenter le timeout pour les requêtes longues (génération PDF avec images)
app.use((req, res, next) => {
  req.setTimeout(120000); // 2 minutes
  res.setTimeout(120000);
  next();
});

const hashPassword = (password: string) => bcrypt.hash(password, 10);
const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
const normalizeEmail = (value: string) => value.trim().toLowerCase();

type EmailAttachment = { name: string; content: string; type: string };

const sendBrevoEmail = async ({
  to,
  subject,
  text,
  attachments = []
}: {
  to: string[];
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}) => {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    throw new Error('Configuration Brevo manquante');
  }
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME || 'ERP Recyclage'
      },
      to: to.map((email) => ({ email })),
      subject,
      textContent: text,
      attachment: attachments.length
        ? attachments.map((file) => ({
            name: file.name,
            content: file.content,
            type: file.type
          }))
        : undefined
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Envoi email impossible (${response.status}): ${detail}`);
  }
};

const createAuthPayload = (user: UserRow): AuthPayload => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  role: user.role,
  department: user.department,
  manager_name: user.manager_name,
  permissions: user.permissions ?? []
});

const signToken = (payload: AuthPayload) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: '12h'
  });

const requireAuth =
  (options?: { roles?: UserRole[]; permissions?: string[] }): express.RequestHandler =>
  (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentification requise' });
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
      const authReq = req as AuthenticatedRequest;
      authReq.auth = payload;
      authReq.user = payload; // Pour compatibilité avec le code existant
      const roleOk = !options?.roles || options.roles.includes(payload.role);
      const permissionsList = payload.permissions ?? [];
      const permissionOk =
        !options?.permissions || options.permissions.some((perm) => permissionsList.includes(perm));
      if ((options?.roles || options?.permissions) && !(roleOk || permissionOk)) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
      next();
    } catch (error) {
      console.error('Auth error', error);
      return res.status(401).json({ message: 'Session expirée' });
    }
  };

const requireManagerAuth = requireAuth({ roles: ['admin', 'manager'] });
const requireAdminAuth = requireAuth({ roles: ['admin'] });

const adminOrSetupGuard: express.RequestHandler = (req, res, next) => {
  const setupToken = req.headers['x-setup-token'];
  if (setupToken && AUTH_SETUP_TOKEN && setupToken === AUTH_SETUP_TOKEN) {
    return next();
  }
  return requireAdminAuth(req, res, next);
};

const asyncHandler =
  (fn: express.RequestHandler): express.RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: 'Erreur serveur',
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  };

const leaveBaseSelect = `
  select
    l.id,
    l.employee_id,
    to_char(l.start_date, 'YYYY-MM-DD') as start_date,
    to_char(l.end_date, 'YYYY-MM-DD') as end_date,
    l.type,
    l.status,
    l.workflow_step,
    l.comment,
    l.signature,
    l.approved_by,
    l.approved_at,
    l.request_group_id,
    l.army_start_date,
    l.army_end_date,
    l.army_reference,
    l.manager_status,
    l.hr_status,
    l.director_status,
    l.manager_decision_at,
    l.hr_decision_at,
    l.director_decision_at,
    l.manager_decision_by,
    l.hr_decision_by,
    l.director_decision_by,
    l.manager_comment,
    l.hr_comment,
    l.director_comment,
    l.created_at,
    l.updated_at,
    json_build_object(
      'id', e.id,
      'first_name', e.first_name,
      'last_name', e.last_name,
      'email', e.email,
      'phone', e.phone,
      'department', e.department,
      'role', e.role,
      'manager_name', e.manager_name
    ) as employee
  from leaves l
  left join employees e on e.id = l.employee_id
`;

const ensureSchema = async () => {
  await run(`
    create table if not exists employees (
      id uuid primary key,
      employee_code text unique,
      first_name text not null,
      last_name text not null,
      email text not null unique,
      phone text,
      department text,
      role text,
      contract_type text,
      employment_status text,
      work_rate numeric,
      work_schedule text,
      manager_name text,
      location text,
      address_line1 text,
      address_line2 text,
      postal_code text,
      city text,
      country text,
      work_permit text,
      emergency_contact_name text,
      emergency_contact_phone text,
      notes text,
      start_date date,
      birth_date date,
      birth_location text,
      personal_email text,
      personal_phone text,
      nationality text,
      marital_status text,
      dependent_children text,
      id_document_number text,
      ahv_number text,
      iban text,
      created_at timestamptz not null default now()
    )
  `);

  await run(`alter table employees add column if not exists employee_code text`);
  await run(`alter table employees add column if not exists phone text`);
  await run(`alter table employees add column if not exists department text`);
  await run(`alter table employees add column if not exists role text`);
  await run(`alter table employees add column if not exists contract_type text`);
  await run(`alter table employees add column if not exists employment_status text`);
  await run(`alter table employees add column if not exists work_rate numeric`);
  await run(`alter table employees add column if not exists work_schedule text`);
  await run(`alter table employees add column if not exists manager_name text`);
  await run(`alter table employees add column if not exists location text`);
  await run(`alter table employees add column if not exists address_line1 text`);
  await run(`alter table employees add column if not exists address_line2 text`);
  await run(`alter table employees add column if not exists postal_code text`);
  await run(`alter table employees add column if not exists city text`);
  await run(`alter table employees add column if not exists country text`);
  await run(`alter table employees add column if not exists work_permit text`);
  await run(`alter table employees add column if not exists emergency_contact_name text`);
  await run(`alter table employees add column if not exists emergency_contact_phone text`);
  await run(`alter table employees add column if not exists notes text`);
  await run(`alter table employees add column if not exists start_date date`);
  await run(`alter table employees add column if not exists birth_date date`);
  await run(`alter table employees add column if not exists birth_location text`);
  await run(`alter table employees add column if not exists personal_email text`);
  await run(`alter table employees add column if not exists personal_phone text`);
  await run(`alter table employees add column if not exists nationality text`);
  await run(`alter table employees add column if not exists marital_status text`);
  await run(`alter table employees add column if not exists dependent_children text`);
  await run(`alter table employees add column if not exists id_document_number text`);
  await run(`alter table employees add column if not exists ahv_number text`);
  await run(`alter table employees add column if not exists iban text`);
  await run(`create unique index if not exists employees_employee_code_idx on employees(employee_code) where employee_code is not null`);

  await run(`
    create table if not exists leaves (
      id uuid primary key,
      employee_id uuid not null references employees(id) on delete cascade,
      type text not null,
      start_date date not null,
      end_date date not null,
      status text not null default 'en_attente' check (status in ('en_attente','approuve','refuse')),
      comment text,
      signature text,
      approved_by text,
      approved_at timestamptz,
      request_group_id uuid,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await run('create index if not exists leaves_employee_idx on leaves(employee_id)');
  await run('create index if not exists leaves_dates_idx on leaves(start_date, end_date)');
  await run(`alter table leaves drop constraint if exists leaves_type_check`);
  await run(
    `alter table leaves add constraint leaves_type_check check (type in ('vacances','maladie','accident','deces','formation','heures_sup','armee'))`
  );
  await run(`alter table leaves add column if not exists army_start_date date`);
  await run(`alter table leaves add column if not exists army_end_date date`);
  await run(`alter table leaves add column if not exists army_reference text`);
  await run(`alter table leaves add column if not exists workflow_step text not null default 'manager'`);
  await run(`alter table leaves add column if not exists manager_status text`);
  await run(`alter table leaves add column if not exists hr_status text`);
  await run(`alter table leaves add column if not exists director_status text`);
  await run(`alter table leaves add column if not exists manager_decision_at timestamptz`);
  await run(`alter table leaves add column if not exists hr_decision_at timestamptz`);
  await run(`alter table leaves add column if not exists director_decision_at timestamptz`);
  await run(`alter table leaves add column if not exists manager_decision_by uuid references users(id) on delete set null`);
  await run(`alter table leaves add column if not exists hr_decision_by uuid references users(id) on delete set null`);
  await run(`alter table leaves add column if not exists director_decision_by uuid references users(id) on delete set null`);
  await run(`alter table leaves add column if not exists manager_comment text`);
  await run(`alter table leaves add column if not exists hr_comment text`);
  await run(`alter table leaves add column if not exists director_comment text`);
  await run(
    `update leaves
     set workflow_step = 'completed'
     where coalesce(workflow_step, 'manager') <> 'completed'
       and status in ('approuve','refuse')`
  );

  await run(`
    create table if not exists leave_balances (
      id uuid primary key,
      employee_id uuid not null references employees(id) on delete cascade,
      year int not null,
      paid_leave_total int not null default 25,
      paid_leave_used int not null default 0,
      sick_leave_used int not null default 0,
      training_days_used int not null default 0,
      created_at timestamptz not null default now()
    )
  `);

  await run('create unique index if not exists leave_balances_employee_year_idx on leave_balances(employee_id, year)');

  await run(`
    create table if not exists user_locations (
      employee_id uuid primary key references employees(id) on delete cascade,
      latitude double precision not null,
      longitude double precision not null,
      last_update timestamptz not null default now()
    )
  `);
  await run('create index if not exists user_locations_last_update_idx on user_locations(last_update desc)');

  // Table pour l'historique des positions (pour le rejeu)
  await run(`
    create table if not exists user_location_history (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      latitude double precision not null,
      longitude double precision not null,
      recorded_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists user_location_history_employee_idx on user_location_history(employee_id, recorded_at desc)');
  await run('create index if not exists user_location_history_recorded_at_idx on user_location_history(recorded_at desc)');

  await run(`
    create table if not exists vehicles (
      id uuid primary key,
      internal_number text,
      plate_number text,
      created_at timestamptz not null default now()
    )
  `);

  await run(`
    create table if not exists customers (
      id uuid primary key,
      name text not null,
      address text,
      latitude double precision,
      longitude double precision,
      risk_level text,
      created_at timestamptz not null default now()
    )
  `);
  await run(`alter table customers add column if not exists risk_level text`);

  await run(`
    create table if not exists materials (
      id uuid primary key default gen_random_uuid(),
      famille text,
      numero text,
      abrege text,
      description text,
      unite text,
      me_bez text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists materials_abrege_idx on materials(abrege)');
  await run('create index if not exists materials_famille_idx on materials(famille)');

  // Tables pour la gestion des prix des matières
  await run(`
    create table if not exists price_sources (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      description text,
      source_type text not null default 'manual',
      created_at timestamptz not null default now()
    )
  `);
  
  // Insérer les sources par défaut
  await run(`
    insert into price_sources (name, description, source_type)
    values 
      ('Manuel', 'Prix saisi manuellement', 'manual'),
      ('Copacel', 'Prix importé depuis PDF Copacel', 'copacel'),
      ('EUWID', 'Prix importé depuis EUWID', 'euwid')
    on conflict (name) do nothing
  `);

  await run(`
    create table if not exists material_prices (
      id uuid primary key default gen_random_uuid(),
      material_id uuid not null references materials(id) on delete cascade,
      price_source_id uuid not null references price_sources(id) on delete restrict,
      price numeric(10,2) not null,
      price_min numeric(10,2),
      price_max numeric(10,2),
      currency text not null default 'CHF',
      valid_from date not null default current_date,
      valid_to date,
      comment text,
      imported_from_file text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now()
    )
  `);
  
  await run('create index if not exists material_prices_material_idx on material_prices(material_id, valid_from desc)');
  await run('create index if not exists material_prices_source_idx on material_prices(price_source_id)');
  await run('create index if not exists material_prices_valid_idx on material_prices(valid_from, valid_to)');

  await run(`
    create table if not exists customer_documents (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid not null references customers(id) on delete cascade,
      filename text not null,
      mimetype text,
      size bigint,
      file_data bytea,
      uploaded_by uuid references users(id) on delete set null,
      uploaded_by_name text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists customer_documents_customer_idx on customer_documents(customer_id, created_at desc)');

  await run(`
    create table if not exists routes (
      id uuid primary key,
      date date not null,
      vehicle_id uuid references vehicles(id) on delete set null,
      status text,
      path jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await run(`alter table routes add column if not exists status text`);
  await run(`alter table routes add column if not exists path jsonb`);

  await run(`
    create table if not exists route_stops (
      id uuid primary key,
      route_id uuid not null references routes(id) on delete cascade,
      customer_id uuid references customers(id) on delete set null,
      order_index int not null default 0,
      estimated_time timestamptz,
      status text,
      notes text,
      completed_at timestamptz
    )
  `);
  await run('create index if not exists route_stops_route_idx on route_stops(route_id)');
  await run(`alter table route_stops add column if not exists status text`);
  await run(`alter table route_stops add column if not exists completed_at timestamptz`);

  // Table pour les interventions/tickets
  await run(`
    create table if not exists interventions (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references customers(id) on delete set null,
      customer_name text not null,
      customer_address text,
      title text not null,
      description text,
      status text not null default 'pending',
      priority text not null default 'medium',
      created_by uuid references users(id) on delete set null,
      assigned_to uuid references employees(id) on delete set null,
      latitude double precision,
      longitude double precision,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists interventions_customer_idx on interventions(customer_id)');
  await run('create index if not exists interventions_status_idx on interventions(status)');
  await run('create index if not exists interventions_created_at_idx on interventions(created_at desc)');

  await run(`
    create table if not exists pdf_templates (
      id uuid primary key default gen_random_uuid(),
      module text not null unique,
      config jsonb not null default '{}'::jsonb,
      updated_by uuid references users(id) on delete set null,
      updated_at timestamptz not null default now()
    )
  `);
  await run('create unique index if not exists pdf_templates_module_idx on pdf_templates(module)');

  await run(`
    create table if not exists users (
      id uuid primary key,
      email text not null unique,
      password_hash text not null,
      role text not null default 'manager',
      full_name text,
      department text,
      manager_name text,
      permissions text[],
      reset_token text,
      reset_token_expires timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await run(`alter table users add column if not exists reset_token text`);
  await run(`alter table users add column if not exists reset_token_expires timestamptz`);
  await run(`alter table users add column if not exists permissions text[]`);

  await run(`
    create table if not exists audit_logs (
      id uuid primary key default gen_random_uuid(),
      entity_type text not null,
      entity_id uuid,
      action text not null,
      changed_by uuid references users(id) on delete set null,
      changed_by_name text,
      before_data jsonb,
      after_data jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id, created_at desc)');
  await run('create index if not exists audit_logs_created_idx on audit_logs(created_at desc)');

  // Tables pour la gestion des configurations d'inventaire
  await run(`
    create table if not exists inventory_materials (
      id uuid primary key default gen_random_uuid(),
      category text not null check (category in ('halle', 'plastiqueB', 'cdt', 'papier')),
      matiere text not null,
      num text,
      display_order integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists inventory_materials_category_idx on inventory_materials(category, display_order)');

  await run(`
    create table if not exists inventory_machines (
      id uuid primary key default gen_random_uuid(),
      num1 text not null,
      mac text not null,
      display_order integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists inventory_machines_display_order_idx on inventory_machines(display_order)');

  await run(`
    create table if not exists inventory_containers (
      id uuid primary key default gen_random_uuid(),
      type text not null,
      display_order integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists inventory_containers_display_order_idx on inventory_containers(display_order)');

  await run(`
    create table if not exists inventory_bags (
      id uuid primary key default gen_random_uuid(),
      type text not null,
      display_order integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists inventory_bags_display_order_idx on inventory_bags(display_order)');

  await run(`
    create table if not exists inventory_other_items (
      id uuid primary key default gen_random_uuid(),
      category text not null check (category in ('diesel', 'adBlue', 'filFer', 'eau')),
      subcategory text,
      label text not null,
      unit1 text,
      unit2 text,
      default_value1 numeric default 0,
      default_value2 numeric default 0,
      display_order integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists inventory_other_items_category_idx on inventory_other_items(category, display_order)');

  // Table pour sauvegarder les inventaires
  await run(`
    create table if not exists inventory_snapshots (
      id uuid primary key default gen_random_uuid(),
      report_date timestamptz not null,
      report_date_label text,
      halle_data jsonb not null,
      plastique_b_data jsonb not null,
      cdt_data jsonb not null,
      papier_data jsonb not null,
      machines_data jsonb not null,
      autres_data jsonb not null,
      containers_data jsonb not null,
      bags_data jsonb not null,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists inventory_snapshots_report_date_idx on inventory_snapshots(report_date desc)');
  await run('create index if not exists inventory_snapshots_created_at_idx on inventory_snapshots(created_at desc)');

  // Tables pour la gestion financière
  // Tarifs clients (contrats de prix)
  await run(`
    create table if not exists customer_pricing (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references customers(id) on delete cascade,
      material_id uuid references materials(id) on delete set null,
      price_per_unit numeric not null,
      unit text not null,
      min_quantity numeric,
      max_quantity numeric,
      valid_from date not null,
      valid_to date,
      contract_reference text,
      notes text,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists customer_pricing_customer_idx on customer_pricing(customer_id)');
  await run('create index if not exists customer_pricing_material_idx on customer_pricing(material_id)');
  await run('create index if not exists customer_pricing_valid_dates_idx on customer_pricing(valid_from, valid_to)');

  // Devis
  await run(`
    create table if not exists quotes (
      id uuid primary key default gen_random_uuid(),
      quote_number text unique not null,
      customer_id uuid references customers(id) on delete set null,
      customer_name text not null,
      customer_address text,
      status text not null default 'draft', -- draft, sent, accepted, rejected, expired
      issue_date date not null,
      expiry_date date,
      valid_until date,
      total_amount numeric not null default 0,
      total_tax numeric not null default 0,
      currency text not null default 'CHF',
      notes text,
      terms text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      approved_by uuid references users(id) on delete set null,
      approved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists quotes_customer_idx on quotes(customer_id)');
  await run('create index if not exists quotes_status_idx on quotes(status)');
  await run('create index if not exists quotes_issue_date_idx on quotes(issue_date desc)');

  // Lignes de devis
  await run(`
    create table if not exists quote_lines (
      id uuid primary key default gen_random_uuid(),
      quote_id uuid references quotes(id) on delete cascade,
      line_number integer not null,
      material_id uuid references materials(id) on delete set null,
      material_description text not null,
      quantity numeric not null,
      unit text not null,
      unit_price numeric not null,
      tax_rate numeric not null default 0,
      total_amount numeric not null,
      notes text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists quote_lines_quote_idx on quote_lines(quote_id)');

  // Factures
  await run(`
    create table if not exists invoices (
      id uuid primary key default gen_random_uuid(),
      invoice_number text unique not null,
      customer_id uuid references customers(id) on delete set null,
      customer_name text not null,
      customer_address text,
      customer_vat_number text,
      status text not null default 'draft', -- draft, sent, paid, overdue, cancelled
      issue_date date not null,
      due_date date not null,
      paid_date date,
      total_amount numeric not null default 0,
      total_tax numeric not null default 0,
      paid_amount numeric not null default 0,
      currency text not null default 'CHF',
      payment_terms text,
      notes text,
      reference text, -- Référence expédition ou autre
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists invoices_customer_idx on invoices(customer_id)');
  await run('create index if not exists invoices_status_idx on invoices(status)');
  await run('create index if not exists invoices_issue_date_idx on invoices(issue_date desc)');
  await run('create index if not exists invoices_due_date_idx on invoices(due_date)');

  // Lignes de facture
  await run(`
    create table if not exists invoice_lines (
      id uuid primary key default gen_random_uuid(),
      invoice_id uuid references invoices(id) on delete cascade,
      line_number integer not null,
      material_id uuid references materials(id) on delete set null,
      material_description text not null,
      quantity numeric not null,
      unit text not null,
      unit_price numeric not null,
      tax_rate numeric not null default 0,
      total_amount numeric not null,
      notes text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists invoice_lines_invoice_idx on invoice_lines(invoice_id)');

  // Paiements
  await run(`
    create table if not exists payments (
      id uuid primary key default gen_random_uuid(),
      invoice_id uuid references invoices(id) on delete cascade,
      payment_number text unique,
      amount numeric not null,
      payment_date date not null,
      payment_method text not null, -- bank_transfer, check, cash, card, other
      reference text, -- Référence de virement, chèque, etc.
      notes text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists payments_invoice_idx on payments(invoice_id)');
  await run('create index if not exists payments_payment_date_idx on payments(payment_date desc)');

  // Coûts d'interventions
  await run(`
    create table if not exists intervention_costs (
      id uuid primary key default gen_random_uuid(),
      intervention_id uuid references interventions(id) on delete cascade,
      fuel_cost numeric default 0,
      labor_cost numeric default 0,
      material_cost numeric default 0,
      other_costs numeric default 0,
      total_cost numeric not null default 0,
      notes text,
      calculated_at timestamptz not null default now(),
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists intervention_costs_intervention_idx on intervention_costs(intervention_id)');

  // Budgets par département
  await run(`
    create table if not exists department_budgets (
      id uuid primary key default gen_random_uuid(),
      department text not null,
      year integer not null,
      month integer,
      budgeted_amount numeric not null,
      actual_amount numeric not null default 0,
      category text, -- fuel, labor, materials, other
      notes text,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create unique index if not exists department_budgets_unique_idx on department_budgets(department, year, coalesce(month, -1), coalesce(category, \'\'))');
  await run('create index if not exists department_budgets_dept_year_idx on department_budgets(department, year, month)');

  // Tables pour la gestion avancée des stocks
  // Entrepôts
  await run(`
    create table if not exists warehouses (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      address text,
      location text,
      is_active boolean not null default true,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists warehouses_code_idx on warehouses(code)');
  await run('create index if not exists warehouses_active_idx on warehouses(is_active)');
  // Ajouter les colonnes pour les coordonnées et le type de dépôt
  await run('alter table warehouses add column if not exists latitude numeric');
  await run('alter table warehouses add column if not exists longitude numeric');
  await run('alter table warehouses add column if not exists is_depot boolean not null default false');
  await run('create index if not exists warehouses_depot_idx on warehouses(is_depot) where is_depot = true');

  // Seuils de stock par matière et entrepôt
  await run(`
    create table if not exists stock_thresholds (
      id uuid primary key default gen_random_uuid(),
      material_id uuid references materials(id) on delete cascade,
      warehouse_id uuid references warehouses(id) on delete cascade,
      min_quantity numeric not null default 0,
      max_quantity numeric,
      alert_enabled boolean not null default true,
      unit text,
      notes text,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(material_id, warehouse_id)
    )
  `);
  await run('create index if not exists stock_thresholds_material_idx on stock_thresholds(material_id)');
  await run('create index if not exists stock_thresholds_warehouse_idx on stock_thresholds(warehouse_id)');
  await run('create index if not exists stock_thresholds_alert_idx on stock_thresholds(alert_enabled) where alert_enabled = true');

  // Lots de stock
  await run(`
    create table if not exists stock_lots (
      id uuid primary key default gen_random_uuid(),
      lot_number text not null,
      material_id uuid references materials(id) on delete cascade,
      warehouse_id uuid references warehouses(id) on delete cascade,
      quantity numeric not null default 0,
      unit text,
      production_date date,
      expiry_date date,
      origin text,
      supplier_name text,
      batch_reference text,
      quality_status text,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists stock_lots_lot_number_idx on stock_lots(lot_number)');
  await run('create index if not exists stock_lots_material_idx on stock_lots(material_id)');
  await run('create index if not exists stock_lots_warehouse_idx on stock_lots(warehouse_id)');
  await run('create index if not exists stock_lots_expiry_idx on stock_lots(expiry_date) where expiry_date is not null');

  // Mouvements de stock (traçabilité)
  await run(`
    create table if not exists stock_movements (
      id uuid primary key default gen_random_uuid(),
      movement_type text not null check (movement_type in ('in', 'out', 'transfer', 'adjustment', 'production', 'consumption')),
      material_id uuid references materials(id) on delete set null,
      lot_id uuid references stock_lots(id) on delete set null,
      warehouse_id uuid references warehouses(id) on delete set null,
      from_warehouse_id uuid references warehouses(id) on delete set null,
      to_warehouse_id uuid references warehouses(id) on delete set null,
      quantity numeric not null,
      unit text,
      unit_price numeric,
      total_value numeric,
      reference_type text,
      reference_id uuid,
      origin text,
      destination text,
      treatment_stage text,
      notes text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists stock_movements_material_idx on stock_movements(material_id, created_at desc)');
  await run('create index if not exists stock_movements_lot_idx on stock_movements(lot_id)');
  await run('create index if not exists stock_movements_warehouse_idx on stock_movements(warehouse_id, created_at desc)');
  await run('create index if not exists stock_movements_type_idx on stock_movements(movement_type, created_at desc)');
  await run('create index if not exists stock_movements_reference_idx on stock_movements(reference_type, reference_id)');

  // Valorisation des stocks
  await run(`
    create table if not exists stock_valuations (
      id uuid primary key default gen_random_uuid(),
      material_id uuid references materials(id) on delete cascade,
      warehouse_id uuid references warehouses(id) on delete cascade,
      valuation_method text not null check (valuation_method in ('FIFO', 'LIFO', 'AVERAGE', 'SPECIFIC')),
      quantity numeric not null default 0,
      unit_cost numeric not null default 0,
      total_value numeric not null default 0,
      valuation_date date not null,
      notes text,
      calculated_at timestamptz not null default now(),
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(material_id, warehouse_id, valuation_date, valuation_method)
    )
  `);
  await run('create index if not exists stock_valuations_material_idx on stock_valuations(material_id, valuation_date desc)');
  await run('create index if not exists stock_valuations_warehouse_idx on stock_valuations(warehouse_id, valuation_date desc)');
  await run('create index if not exists stock_valuations_date_idx on stock_valuations(valuation_date desc)');

  // Réconciliations d'inventaire
  await run(`
    create table if not exists stock_reconciliations (
      id uuid primary key default gen_random_uuid(),
      warehouse_id uuid references warehouses(id) on delete cascade,
      material_id uuid references materials(id) on delete cascade,
      reconciliation_date date not null,
      theoretical_quantity numeric not null default 0,
      actual_quantity numeric not null default 0,
      difference numeric not null default 0,
      difference_percentage numeric,
      unit text,
      reason text,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
      approved_by uuid references users(id) on delete set null,
      approved_at timestamptz,
      notes text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists stock_reconciliations_warehouse_idx on stock_reconciliations(warehouse_id, reconciliation_date desc)');
  await run('create index if not exists stock_reconciliations_material_idx on stock_reconciliations(material_id, reconciliation_date desc)');
  await run('create index if not exists stock_reconciliations_date_idx on stock_reconciliations(reconciliation_date desc)');
  await run('create index if not exists stock_reconciliations_status_idx on stock_reconciliations(status)');

  // Prévisions de stock
  await run(`
    create table if not exists stock_forecasts (
      id uuid primary key default gen_random_uuid(),
      material_id uuid references materials(id) on delete cascade,
      warehouse_id uuid references warehouses(id) on delete cascade,
      forecast_date date not null,
      forecasted_quantity numeric not null,
      confidence_level numeric,
      forecast_method text,
      historical_period_months integer,
      notes text,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(material_id, warehouse_id, forecast_date)
    )
  `);
  await run('create index if not exists stock_forecasts_material_idx on stock_forecasts(material_id, forecast_date desc)');
  await run('create index if not exists stock_forecasts_warehouse_idx on stock_forecasts(warehouse_id, forecast_date desc)');
  await run('create index if not exists stock_forecasts_date_idx on stock_forecasts(forecast_date desc)');

  // Alertes de stock
  await run(`
    create table if not exists stock_alerts (
      id uuid primary key default gen_random_uuid(),
      material_id uuid references materials(id) on delete cascade,
      warehouse_id uuid references warehouses(id) on delete cascade,
      alert_type text not null check (alert_type in ('below_min', 'above_max', 'expiring_soon', 'expired', 'reconciliation_needed')),
      current_quantity numeric,
      threshold_value numeric,
      severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
      message text,
      is_resolved boolean not null default false,
      resolved_at timestamptz,
      resolved_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists stock_alerts_material_idx on stock_alerts(material_id, is_resolved, created_at desc)');
  await run('create index if not exists stock_alerts_warehouse_idx on stock_alerts(warehouse_id, is_resolved, created_at desc)');
  await run('create index if not exists stock_alerts_type_idx on stock_alerts(alert_type, is_resolved)');
  await run('create index if not exists stock_alerts_unresolved_idx on stock_alerts(is_resolved, created_at desc) where is_resolved = false');

  // CRM Tables
  // Ajouter des colonnes à la table customers pour le CRM
  await run(`alter table customers add column if not exists customer_type text default 'client' check (customer_type in ('prospect', 'client', 'inactive'))`);
  await run(`alter table customers add column if not exists segment text check (segment in ('A', 'B', 'C'))`);
  await run(`alter table customers add column if not exists email text`);
  await run(`alter table customers add column if not exists phone text`);
  await run(`alter table customers add column if not exists contact_person text`);
  await run(`alter table customers add column if not exists vat_number text`);
  await run(`alter table customers add column if not exists website text`);
  await run(`alter table customers add column if not exists industry text`);
  await run(`alter table customers add column if not exists annual_revenue numeric`);
  await run(`alter table customers add column if not exists employee_count integer`);
  await run(`alter table customers add column if not exists source text`); // Comment le client nous a trouvé
  await run(`alter table customers add column if not exists last_interaction_date date`);
  await run(`alter table customers add column if not exists next_follow_up_date date`);
  await run(`alter table customers add column if not exists total_revenue numeric default 0`);
  await run(`alter table customers add column if not exists total_volume numeric default 0`);
  await run(`alter table customers add column if not exists interaction_count integer default 0`);
  await run('create index if not exists customers_type_idx on customers(customer_type)');
  await run('create index if not exists customers_segment_idx on customers(segment)');
  await run('create index if not exists customers_next_followup_idx on customers(next_follow_up_date) where next_follow_up_date is not null');

  // Interactions avec les clients
  await run(`
    create table if not exists customer_interactions (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references customers(id) on delete cascade,
      interaction_type text not null check (interaction_type in ('call', 'email', 'meeting', 'visit', 'quote', 'invoice', 'complaint', 'other')),
      subject text,
      description text not null,
      outcome text,
      next_action text,
      next_action_date date,
      duration_minutes integer,
      location text,
      participants text[], -- Liste des participants
      related_entity_type text, -- quote, invoice, intervention, etc.
      related_entity_id uuid,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists customer_interactions_customer_idx on customer_interactions(customer_id, created_at desc)');
  await run('create index if not exists customer_interactions_type_idx on customer_interactions(interaction_type, created_at desc)');
  await run('create index if not exists customer_interactions_date_idx on customer_interactions(created_at desc)');
  await run('create index if not exists customer_interactions_next_action_idx on customer_interactions(next_action_date) where next_action_date is not null');

  // Contrats clients
  await run(`
    create table if not exists customer_contracts (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references customers(id) on delete cascade,
      contract_number text not null unique,
      contract_type text not null check (contract_type in ('service', 'supply', 'maintenance', 'other')),
      title text not null,
      description text,
      start_date date not null,
      end_date date,
      renewal_date date,
      auto_renewal boolean not null default false,
      value numeric,
      currency text default 'EUR',
      status text not null default 'active' check (status in ('draft', 'active', 'expired', 'cancelled', 'renewed')),
      terms text,
      notes text,
      signed_date date,
      signed_by text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists customer_contracts_customer_idx on customer_contracts(customer_id, status)');
  await run('create index if not exists customer_contracts_end_date_idx on customer_contracts(end_date) where end_date is not null');
  await run('create index if not exists customer_contracts_renewal_idx on customer_contracts(renewal_date) where renewal_date is not null');
  await run('create index if not exists customer_contracts_status_idx on customer_contracts(status)');

  // Opportunités commerciales
  await run(`
    create table if not exists customer_opportunities (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references customers(id) on delete cascade,
      title text not null,
      description text,
      stage text not null default 'prospecting' check (stage in ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
      probability integer check (probability >= 0 and probability <= 100),
      estimated_value numeric,
      currency text default 'EUR',
      expected_close_date date,
      actual_close_date date,
      win_reason text,
      loss_reason text,
      competitor text,
      source text,
      notes text,
      assigned_to uuid references users(id) on delete set null,
      assigned_to_name text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists customer_opportunities_customer_idx on customer_opportunities(customer_id, stage)');
  await run('create index if not exists customer_opportunities_stage_idx on customer_opportunities(stage, expected_close_date)');
  await run('create index if not exists customer_opportunities_assigned_idx on customer_opportunities(assigned_to)');
  await run('create index if not exists customer_opportunities_close_date_idx on customer_opportunities(expected_close_date) where expected_close_date is not null');

  // Notes et rappels clients
  await run(`
    create table if not exists customer_notes (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references customers(id) on delete cascade,
      note_type text not null default 'note' check (note_type in ('note', 'reminder', 'task', 'call_log')),
      title text,
      content text not null,
      is_reminder boolean not null default false,
      reminder_date timestamptz,
      is_completed boolean not null default false,
      completed_at timestamptz,
      priority text check (priority in ('low', 'medium', 'high', 'urgent')),
      tags text[],
      related_entity_type text,
      related_entity_id uuid,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists customer_notes_customer_idx on customer_notes(customer_id, created_at desc)');
  await run('create index if not exists customer_notes_reminder_idx on customer_notes(reminder_date, is_completed) where is_reminder = true and is_completed = false');
  await run('create index if not exists customer_notes_type_idx on customer_notes(note_type, created_at desc)');

  // Statistiques clients (calculées périodiquement)
  await run(`
    create table if not exists customer_statistics (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references customers(id) on delete cascade,
      period_start date not null,
      period_end date not null,
      total_revenue numeric not null default 0,
      total_volume numeric not null default 0,
      invoice_count integer not null default 0,
      average_invoice_value numeric,
      order_frequency numeric, -- Nombre de commandes par mois
      last_order_date date,
      first_order_date date,
      average_order_value numeric,
      total_interactions integer not null default 0,
      last_interaction_date date,
      churn_risk text check (churn_risk in ('low', 'medium', 'high')),
      lifetime_value numeric,
      calculated_at timestamptz not null default now(),
      unique(customer_id, period_start, period_end)
    )
  `);
  await run('create index if not exists customer_statistics_customer_idx on customer_statistics(customer_id, period_end desc)');
  await run('create index if not exists customer_statistics_period_idx on customer_statistics(period_start, period_end)');

  // Mobile App Tables
  // Photos d'interventions
  await run(`
    create table if not exists intervention_photos (
      id uuid primary key default gen_random_uuid(),
      intervention_id uuid references interventions(id) on delete cascade,
      photo_type text not null check (photo_type in ('before', 'after', 'other')),
      photo_data text not null, -- base64 encoded image
      mime_type text not null default 'image/jpeg',
      file_size integer,
      latitude double precision,
      longitude double precision,
      taken_at timestamptz not null default now(),
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists intervention_photos_intervention_idx on intervention_photos(intervention_id, photo_type)');
  await run('create index if not exists intervention_photos_taken_at_idx on intervention_photos(taken_at desc)');

  // Signatures électroniques
  await run(`
    create table if not exists intervention_signatures (
      id uuid primary key default gen_random_uuid(),
      intervention_id uuid references interventions(id) on delete cascade,
      signature_type text not null check (signature_type in ('customer', 'operator', 'witness')),
      signature_data text not null, -- base64 encoded signature image
      signer_name text,
      signer_role text,
      signed_at timestamptz not null default now(),
      latitude double precision,
      longitude double precision,
      ip_address text,
      device_info text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists intervention_signatures_intervention_idx on intervention_signatures(intervention_id)');
  await run('create index if not exists intervention_signatures_signed_at_idx on intervention_signatures(signed_at desc)');

  // Scans QR codes / codes-barres
  await run(`
    create table if not exists qr_scans (
      id uuid primary key default gen_random_uuid(),
      intervention_id uuid references interventions(id) on delete set null,
      scan_type text not null check (scan_type in ('qr_code', 'barcode', 'nfc')),
      code_value text not null,
      code_format text,
      material_id uuid references materials(id) on delete set null,
      lot_id uuid references stock_lots(id) on delete set null,
      description text,
      latitude double precision,
      longitude double precision,
      scanned_at timestamptz not null default now(),
      scanned_by uuid references users(id) on delete set null,
      scanned_by_name text,
      device_info text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists qr_scans_intervention_idx on qr_scans(intervention_id, scanned_at desc)');
  await run('create index if not exists qr_scans_code_idx on qr_scans(code_value)');
  await run('create index if not exists qr_scans_scanned_at_idx on qr_scans(scanned_at desc)');

  // Enregistrements vocaux (notes vocales)
  await run(`
    create table if not exists voice_notes (
      id uuid primary key default gen_random_uuid(),
      intervention_id uuid references interventions(id) on delete cascade,
      audio_data text not null, -- base64 encoded audio
      mime_type text not null default 'audio/webm',
      duration_seconds numeric,
      transcription text, -- transcription automatique si disponible
      latitude double precision,
      longitude double precision,
      recorded_at timestamptz not null default now(),
      recorded_by uuid references users(id) on delete set null,
      recorded_by_name text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists voice_notes_intervention_idx on voice_notes(intervention_id, recorded_at desc)');
  await run('create index if not exists voice_notes_recorded_at_idx on voice_notes(recorded_at desc)');

  // Synchronisation offline (pour le mode offline)
  await run(`
    create table if not exists offline_sync_queue (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references users(id) on delete cascade,
      entity_type text not null,
      entity_id uuid,
      action text not null check (action in ('create', 'update', 'delete')),
      payload jsonb not null,
      status text not null default 'pending' check (status in ('pending', 'synced', 'failed')),
      error_message text,
      retry_count integer not null default 0,
      created_at timestamptz not null default now(),
      synced_at timestamptz
    )
  `);
  await run('create index if not exists offline_sync_queue_user_idx on offline_sync_queue(user_id, status, created_at)');
  await run('create index if not exists offline_sync_queue_status_idx on offline_sync_queue(status, created_at)');

  // Notifications push (tokens des appareils)
  await run(`
    create table if not exists push_notification_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references users(id) on delete cascade,
      employee_id uuid references employees(id) on delete cascade,
      token text not null unique,
      device_type text check (device_type in ('ios', 'android', 'web')),
      device_info text,
      is_active boolean not null default true,
      last_used_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists push_tokens_user_idx on push_notification_tokens(user_id, is_active)');
  await run('create index if not exists push_tokens_employee_idx on push_notification_tokens(employee_id, is_active)');
  await run('create index if not exists push_tokens_token_idx on push_notification_tokens(token)');

  // Système d'alertes général
  await run(`
    create table if not exists alerts (
      id uuid primary key default gen_random_uuid(),
      alert_category text not null check (alert_category in ('security', 'operational', 'financial', 'hr')),
      alert_type text not null,
      severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
      title text not null,
      message text not null,
      entity_type text, -- 'intervention', 'vehicle', 'invoice', 'stock', 'employee', etc.
      entity_id uuid,
      related_data jsonb,
      is_resolved boolean not null default false,
      resolved_at timestamptz,
      resolved_by uuid references users(id) on delete set null,
      resolved_notes text,
      assigned_to uuid references users(id) on delete set null,
      due_date timestamptz,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists alerts_category_idx on alerts(alert_category, is_resolved, created_at desc)');
  await run('create index if not exists alerts_severity_idx on alerts(severity, is_resolved, created_at desc)');
  await run('create index if not exists alerts_entity_idx on alerts(entity_type, entity_id)');
  await run('create index if not exists alerts_unresolved_idx on alerts(is_resolved, created_at desc) where is_resolved = false');
  await run('create index if not exists alerts_assigned_idx on alerts(assigned_to, is_resolved)');
  await run('create index if not exists alerts_due_date_idx on alerts(due_date) where is_resolved = false');

  // Notifications (canaux d'envoi)
  await run(`
    create table if not exists notifications (
      id uuid primary key default gen_random_uuid(),
      alert_id uuid references alerts(id) on delete cascade,
      notification_type text not null check (notification_type in ('email', 'sms', 'push', 'in_app')),
      recipient_type text not null check (recipient_type in ('user', 'employee', 'role', 'all')),
      recipient_id uuid, -- user_id, employee_id, or null for role/all
      recipient_email text,
      recipient_phone text,
      status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'read')),
      sent_at timestamptz,
      delivered_at timestamptz,
      read_at timestamptz,
      error_message text,
      retry_count integer not null default 0,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists notifications_alert_idx on notifications(alert_id, status)');
  await run('create index if not exists notifications_recipient_idx on notifications(recipient_type, recipient_id, status)');
  await run('create index if not exists notifications_status_idx on notifications(status, created_at desc)');
  await run('create index if not exists notifications_type_idx on notifications(notification_type, status)');

  // Préférences de notifications par utilisateur
  await run(`
    create table if not exists user_notification_preferences (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references users(id) on delete cascade,
      alert_category text not null,
      notification_type text not null check (notification_type in ('email', 'sms', 'push', 'in_app')),
      enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(user_id, alert_category, notification_type)
    )
  `);
  await run('create index if not exists user_notification_prefs_user_idx on user_notification_preferences(user_id, alert_category)');

  // Configuration des destinataires par catégorie d'alerte
  await run(`
    create table if not exists alert_category_recipients (
      id uuid primary key default gen_random_uuid(),
      alert_category text not null check (alert_category in ('security', 'operational', 'financial', 'hr')),
      recipient_type text not null check (recipient_type in ('email', 'phone', 'role', 'department', 'user')),
      recipient_value text not null, -- email address, phone number, role name, department name, or user_id
      notification_types text[] not null default array['in_app']::text[],
      enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(alert_category, recipient_type, recipient_value)
    )
  `);
  await run('create index if not exists alert_category_recipients_category_idx on alert_category_recipients(alert_category, enabled)');

  // Ajouter des colonnes aux interventions pour le mobile
  await run(`alter table interventions add column if not exists start_time timestamptz`);
  await run(`alter table interventions add column if not exists end_time timestamptz`);
  await run(`alter table interventions add column if not exists arrival_latitude double precision`);
  await run(`alter table interventions add column if not exists arrival_longitude double precision`);
  await run(`alter table interventions add column if not exists arrival_time timestamptz`);
  await run(`alter table interventions add column if not exists completion_latitude double precision`);
  await run(`alter table interventions add column if not exists completion_longitude double precision`);
  await run(`alter table interventions add column if not exists completion_time timestamptz`);
  await run(`alter table interventions add column if not exists voice_note_id uuid references voice_notes(id) on delete set null`);
  await run('create index if not exists interventions_assigned_idx on interventions(assigned_to, status)');
};

// Fonction pour générer un numéro de facture séquentiel
const generateInvoiceNumber = async (prefix: string, year: number): Promise<string> => {
  const [result] = await run<{ max_num: string | null }>(
    `
    select max(
      case 
        when substring(invoice_number from '^${prefix}-${year}-(\\d+)$') is not null
        then substring(invoice_number from '^${prefix}-${year}-(\\d+)$')::integer
        else 0
      end
    ) as max_num
    from invoices
    where invoice_number like '${prefix}-${year}-%'
    `
  );
  const nextNum = (result?.max_num ? parseInt(result.max_num) : 0) + 1;
  return `${prefix}-${year}-${nextNum.toString().padStart(4, '0')}`;
};

// Fonction pour générer un numéro de devis séquentiel
const generateQuoteNumber = async (prefix: string, year: number): Promise<string> => {
  const [result] = await run<{ max_num: string | null }>(
    `
    select max(
      case 
        when substring(quote_number from '^${prefix}-${year}-(\\d+)$') is not null
        then substring(quote_number from '^${prefix}-${year}-(\\d+)$')::integer
        else 0
      end
    ) as max_num
    from quotes
    where quote_number like '${prefix}-${year}-%'
    `
  );
  const nextNum = (result?.max_num ? parseInt(result.max_num) : 0) + 1;
  return `${prefix}-${year}-${nextNum.toString().padStart(4, '0')}`;
};

const ensureEmployee = async (payload: LeaveRequestPayload): Promise<EmployeeRow> => {
  if (payload.employee_id) {
    const [employee] = await run<EmployeeRow>('select * from employees where id = $1', [payload.employee_id]);
    if (!employee) {
      throw new Error("Employé introuvable");
    }
    return employee;
  }

  if (!payload.email || !payload.first_name || !payload.last_name) {
    throw new Error('Email, prénom et nom sont requis pour créer un employé');
  }

  const [existing] = await run<EmployeeRow>('select * from employees where email = $1', [payload.email]);
  if (existing) {
    return existing;
  }

  throw new Error(
    "Employé introuvable. Merci d'ajouter l'employé dans la section RH avant de soumettre une demande de congé."
  );
};

app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    const [{ now }] = await run<{ now: string }>('select now() as now');
    res.json({ status: 'ok', dbTime: now });
  })
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        return res.status(400).json({ message: 'Email et mot de passe requis' });
      }
      const normalizedEmail = normalizeEmail(email);
      const [user] = await run<UserRow>('select * from users where lower(email) = $1', [normalizedEmail]);
      if (!user) {
        return res.status(401).json({ message: 'Identifiants invalides' });
      }
      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: 'Identifiants invalides' });
      }
      const payload = createAuthPayload(user);
      const token = signToken(payload);
      res.json({ token, user: mapUserRow(user) });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  })
);

app.get(
  '/api/auth/me',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Session expirée' });
    }
    const [user] = await run<UserRow>('select * from users where id = $1', [userId]);
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur introuvable' });
    }
    res.json({ user: mapUserRow(user) });
  })
);

app.post(
  '/api/auth/users',
  adminOrSetupGuard,
  asyncHandler(async (req, res) => {
    const { email, password, role = 'manager', full_name, department, manager_name, permissions } = req.body as {
      email?: string;
      password?: string;
      role?: UserRole;
      full_name?: string;
      department?: string | null;
      manager_name?: string | null;
      permissions?: string[];
    };
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir 8 caractères minimum' });
    }
    if (!['admin', 'manager', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }
    const normalizedEmail = normalizeEmail(email);
    const existing = await run<UserRow>('select * from users where lower(email) = $1', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Un utilisateur existe déjà avec cet email' });
    }
    const sanitizedPermissions = Array.isArray(permissions)
      ? permissions.filter((perm): perm is string => typeof perm === 'string')
      : [];
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    const [inserted] = await run<UserRow>(
      `insert into users (id, email, password_hash, role, full_name, department, manager_name, permissions)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`,
      [
        id,
        normalizedEmail,
        passwordHash,
        role,
        full_name ?? null,
        department ?? null,
        manager_name ?? null,
        sanitizedPermissions.length ? sanitizedPermissions : null
      ]
    );
    res.status(201).json({ user: mapUserRow(inserted) });
  })
);

app.post(
  '/api/auth/password/request',
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ message: 'Email requis' });
    }
    const normalizedEmail = normalizeEmail(email);
    const [user] = await run<UserRow>('select * from users where lower(email) = $1', [normalizedEmail]);
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return res.json({ message: 'Si un compte existe, un email a été envoyé.' });
    }
    const token = randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await run('update users set reset_token = $1, reset_token_expires = $2 where id = $3', [
      token,
      expires.toISOString(),
      user.id
    ]);
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const resetLink = `${baseUrl}?resetToken=${token}`;
    try {
      await sendBrevoEmail({
        to: [user.email],
        subject: 'Réinitialisation du mot de passe',
        text: [`Bonjour ${user.full_name ?? ''}`.trim(), '', 'Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :', resetLink, '', 'Le lien expire dans une heure.'].join(
          '\n'
        )
      });
    } catch (error) {
      console.error('Envoi email reset impossible', error);
      console.warn('[RESET PASSWORD] Lien de réinitialisation :', resetLink);
    }
    res.json({ message: 'Email de réinitialisation envoyé' });
  })
);

app.post(
  '/api/auth/password/reset',
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      return res.status(400).json({ message: 'Token et mot de passe requis' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir 8 caractères minimum' });
    }
    const [user] = await run<UserRow>('select * from users where reset_token = $1', [token]);
    if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ message: 'Lien invalide ou expiré' });
    }
    const passwordHash = await hashPassword(password);
    await run('update users set password_hash = $1, reset_token = null, reset_token_expires = null where id = $2', [
      passwordHash,
      user.id
    ]);
    res.json({ message: 'Mot de passe mis à jour' });
  })
);

app.get(
  '/api/auth/users',
  requireAdminAuth,
  asyncHandler(async (_req, res) => {
    const rows = await run<UserRow>('select * from users order by created_at desc');
    res.json(rows.map(mapUserRow));
  })
);

app.patch(
  '/api/auth/users/:id',
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role, full_name, department, manager_name, password, email, permissions } = req.body as {
      role?: UserRole;
      full_name?: string | null;
      department?: string | null;
      manager_name?: string | null;
      password?: string;
      email?: string;
      permissions?: string[];
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    if (email) {
      updates.push(`email = $${updates.length + 1}`);
      values.push(normalizeEmail(email));
    }
    if (role) {
      updates.push(`role = $${updates.length + 1}`);
      values.push(role);
    }
    if (typeof full_name !== 'undefined') {
      updates.push(`full_name = $${updates.length + 1}`);
      values.push(full_name);
    }
    if (typeof department !== 'undefined') {
      updates.push(`department = $${updates.length + 1}`);
      values.push(department);
    }
    if (typeof manager_name !== 'undefined') {
      updates.push(`manager_name = $${updates.length + 1}`);
      values.push(manager_name);
    }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: 'Le mot de passe doit contenir 8 caractères minimum' });
      }
      const passwordHash = await hashPassword(password);
      updates.push(`password_hash = $${updates.length + 1}`);
      values.push(passwordHash);
    }
    if (Array.isArray(permissions)) {
      const sanitizedPermissions = permissions.filter((perm): perm is string => typeof perm === 'string');
      updates.push(`permissions = $${updates.length + 1}`);
      values.push(sanitizedPermissions.length ? sanitizedPermissions : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification' });
    }

    const [updated] = await run<UserRow>(`update users set ${updates.join(', ')} where id = $${updates.length + 1} returning *`, [
      ...values,
      id
    ]);

    if (!updated) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    res.json({ user: mapUserRow(updated) });
  })
);

app.delete(
  '/api/auth/users/:id',
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [deleted] = await run<UserRow>('delete from users where id = $1 returning *', [id]);
    if (!deleted) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    res.json({ message: 'Utilisateur supprimé' });
  })
);

app.get(
  '/api/employees',
  asyncHandler(async (_req, res) => {
    const rows = await run<EmployeeRow>('select * from employees order by last_name, first_name');
    res.json(rows.map(mapEmployeeRow));
  })
);

app.post(
  '/api/employees',
  asyncHandler(async (req, res) => {
    const {
      employee_code,
      first_name,
      last_name,
      email,
      phone,
      department,
      role,
      contract_type,
      employment_status,
      work_rate,
      work_schedule,
      manager_name,
      location,
      address_line1,
      address_line2,
      postal_code,
      city,
      country,
      work_permit,
      emergency_contact_name,
      emergency_contact_phone,
      notes,
      start_date,
      birth_date,
      birth_location,
      personal_email,
      personal_phone,
      nationality,
      marital_status,
      dependent_children,
      id_document_number,
      ahv_number,
      iban
    } = req.body as Partial<EmployeeRow>;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ message: 'Prénom, nom et email sont requis' });
    }

    const id = randomUUID();
    const [inserted] = await run<EmployeeRow>(
      `insert into employees (
        id,
        employee_code,
        first_name,
        last_name,
        email,
        phone,
        department,
        role,
        contract_type,
        employment_status,
        work_rate,
        work_schedule,
        manager_name,
        location,
        address_line1,
        address_line2,
        postal_code,
        city,
        country,
        work_permit,
        emergency_contact_name,
        emergency_contact_phone,
        notes,
        start_date,
        birth_date,
        birth_location,
        personal_email,
        personal_phone,
        nationality,
        marital_status,
        dependent_children,
        id_document_number,
        ahv_number,
        iban
      )
       values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
       )
       returning *`,
      [
        id,
        employee_code ?? null,
        first_name,
        last_name,
        email,
        phone ?? null,
        department ?? null,
        role ?? null,
        contract_type ?? null,
        employment_status ?? null,
        work_rate ?? null,
        work_schedule ?? null,
        manager_name ?? null,
        location ?? null,
        address_line1 ?? null,
        address_line2 ?? null,
        postal_code ?? null,
        city ?? null,
        country ?? null,
        work_permit ?? null,
        emergency_contact_name ?? null,
        emergency_contact_phone ?? null,
        notes ?? null,
        start_date ?? null,
        birth_date ?? null,
        birth_location ?? null,
        personal_email ?? null,
        personal_phone ?? null,
        nationality ?? null,
        marital_status ?? null,
        dependent_children ?? null,
        id_document_number ?? null,
        ahv_number ?? null,
        iban ?? null
      ]
    );

    res.status(201).json(mapEmployeeRow(inserted));
  })
);

app.patch(
  '/api/employees/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      employee_code,
      first_name,
      last_name,
      email,
      phone,
      department,
      role,
      contract_type,
      employment_status,
      work_rate,
      work_schedule,
      manager_name,
      location,
      address_line1,
      address_line2,
      postal_code,
      city,
      country,
      work_permit,
      emergency_contact_name,
      emergency_contact_phone,
      notes,
      start_date,
      birth_date,
      birth_location,
      personal_email,
      personal_phone,
      nationality,
      marital_status,
      dependent_children,
      id_document_number,
      ahv_number,
      iban
    } = req.body as Partial<EmployeeRow>;

    const [updated] = await run<EmployeeRow>(
      `update employees set
        employee_code = coalesce($1, employee_code),
        first_name = coalesce($2, first_name),
        last_name = coalesce($3, last_name),
        email = coalesce($4, email),
        phone = $5,
        department = $6,
        role = $7,
        contract_type = $8,
        employment_status = $9,
        work_rate = $10,
        work_schedule = $11,
        manager_name = $12,
        location = $13,
        address_line1 = $14,
        address_line2 = $15,
        postal_code = $16,
        city = $17,
        country = $18,
        work_permit = $19,
        emergency_contact_name = $20,
        emergency_contact_phone = $21,
        notes = $22,
        start_date = $23,
        birth_date = $24,
        birth_location = $25,
        personal_email = $26,
        personal_phone = $27,
        nationality = $28,
        marital_status = $29,
        dependent_children = $30,
        id_document_number = $31,
        ahv_number = $32,
        iban = $33
       where id = $34
       returning *`,
      [
        employee_code ?? null,
        first_name ?? null,
        last_name ?? null,
        email ?? null,
        phone ?? null,
        department ?? null,
        role ?? null,
        contract_type ?? null,
        employment_status ?? null,
        work_rate ?? null,
        work_schedule ?? null,
        manager_name ?? null,
        location ?? null,
        address_line1 ?? null,
        address_line2 ?? null,
        postal_code ?? null,
        city ?? null,
        country ?? null,
        work_permit ?? null,
        emergency_contact_name ?? null,
        emergency_contact_phone ?? null,
        notes ?? null,
        start_date ?? null,
        birth_date ?? null,
        birth_location ?? null,
        personal_email ?? null,
        personal_phone ?? null,
        nationality ?? null,
        marital_status ?? null,
        dependent_children ?? null,
        id_document_number ?? null,
        ahv_number ?? null,
        iban ?? null,
        id
      ]
    );

    if (!updated) {
      return res.status(404).json({ message: 'Employé introuvable' });
    }

    res.json(mapEmployeeRow(updated));
  })
);

app.get(
  '/api/leaves',
  asyncHandler(async (req, res) => {
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (Number.isFinite(month) && Number.isFinite(year)) {
      const rows = await run<LeaveRow>(
        `${leaveBaseSelect}
         where extract(month from l.start_date) = $1
           and extract(year from l.start_date) = $2
         order by l.start_date desc`,
        [month, year]
      );
      return res.json(rows);
    }

    const rows = await run<LeaveRow>(`${leaveBaseSelect} order by l.start_date desc`);
    res.json(rows);
  })
);

app.get(
  '/api/leaves/pending',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (!canViewLeaveInbox(authReq.auth)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    const rows = await run<LeaveRow>(
      `${leaveBaseSelect} where coalesce(l.workflow_step, 'manager') <> 'completed' order by l.start_date asc`
    );
    res.json(rows);
  })
);

// Dashboard KPIs endpoint
app.get(
  '/api/dashboard/kpis',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const period = (req.query.period as string) || 'month'; // day, week, month, year
    const today = new Date();
    let startDate: Date;
    let endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    switch (period) {
      case 'day':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
    }

    // 1. Volumes de matières traitées
    const inventorySnapshots = await run<{
      report_date: string;
      halle_data: any;
      plastique_b_data: any;
      cdt_data: any;
      papier_data: any;
    }>(
      `
      select report_date, halle_data, plastique_b_data, cdt_data, papier_data
      from inventory_snapshots
      where report_date >= $1 and report_date <= $2
      order by report_date desc
      `,
      [startDate.toISOString(), endDate.toISOString()]
    );

    let totalVolumes = {
      halle_bb: 0,
      plastique_balles: 0,
      cdt_m3: 0,
      papier_balles: 0
    };

    inventorySnapshots.forEach((snapshot) => {
      // Halle (BB)
      if (Array.isArray(snapshot.halle_data)) {
        snapshot.halle_data.forEach((item: any) => {
          totalVolumes.halle_bb += Number(item.bb || 0);
        });
      }
      // Plastique en balles
      if (Array.isArray(snapshot.plastique_b_data)) {
        snapshot.plastique_b_data.forEach((item: any) => {
          totalVolumes.plastique_balles += Number(item.balles || 0);
        });
      }
      // CDT (m³)
      if (Array.isArray(snapshot.cdt_data)) {
        snapshot.cdt_data.forEach((item: any) => {
          totalVolumes.cdt_m3 += Number(item.m3 || 0);
        });
      }
      // Papier en balles
      if (Array.isArray(snapshot.papier_data)) {
        snapshot.papier_data.forEach((item: any) => {
          const bal = Number(item.bal || 0);
          if (!isNaN(bal)) totalVolumes.papier_balles += bal;
        });
      }
    });

    // 2. Revenus générés par matière (basé sur les prix des matières)
    const materialPrices = await run<{
      material_id: string;
      price: number;
      material_abrege: string | null;
      material_description: string | null;
    }>(
      `
      select 
        mp.material_id,
        mp.price,
        m.abrege as material_abrege,
        m.description as material_description
      from material_prices mp
      inner join materials m on m.id = mp.material_id
      where mp.valid_from <= $1
        and (mp.valid_to is null or mp.valid_to >= $1)
        and mp.price > 0
      order by mp.created_at desc
      `,
      [today.toISOString()]
    );

    // Estimation des revenus (volumes × prix moyens)
    const estimatedRevenues = {
      total: 0,
      by_material: {} as Record<string, number>
    };

    // 3. Performance des équipes (basé sur les routes/interventions)
    const routesStats = await run<{
      total_routes: string;
      completed_routes: string;
      avg_duration_minutes: number;
    }>(
      `
      with route_durations as (
        select 
          r.id,
          extract(epoch from (max(rs.completed_at) - min(rs.completed_at))) / 60 as duration_minutes
        from routes r
        left join route_stops rs on rs.route_id = r.id
        where r.date >= $1 and r.date <= $2
          and rs.completed_at is not null
        group by r.id
        having count(rs.id) > 0
      )
      select 
        count(distinct r.id) as total_routes,
        count(distinct r.id) filter (where r.status = 'completed') as completed_routes,
        coalesce(avg(rd.duration_minutes), 0) as avg_duration_minutes
      from routes r
      left join route_durations rd on rd.id = r.id
      where r.date >= $1 and r.date <= $2
      `,
      [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]
    );

    const routesData = routesStats[0] || { total_routes: '0', completed_routes: '0', avg_duration_minutes: 0 };

    // 4. Interventions
    const interventionsStats = await run<{
      total: string;
      completed: string;
      pending: string;
      avg_time_hours: number;
    }>(
      `
      select 
        count(*) as total,
        count(*) filter (where i.status = 'completed') as completed,
        count(*) filter (where i.status = 'pending') as pending,
        avg(
          extract(epoch from (i.updated_at - i.created_at)) / 3600
        ) as avg_time_hours
      from interventions i
      where i.created_at >= $1 and i.created_at <= $2
      `,
      [startDate.toISOString(), endDate.toISOString()]
    );

    const interventionsData = interventionsStats[0] || {
      total: '0',
      completed: '0',
      pending: '0',
      avg_time_hours: 0
    };

    // 5. Taux de remplissage des véhicules (depuis logistics/kpis)
    const routeStopsData = await run<{
      route_id: string;
      total_stops: string;
      completed_stops: string;
    }>(
      `
      select 
        r.id as route_id,
        count(rs.id) as total_stops,
        count(rs.id) filter (where rs.completed_at is not null) as completed_stops
      from routes r
      left join route_stops rs on rs.route_id = r.id
      where r.date >= $1 and r.date <= $2
      group by r.id
      `,
      [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]
    );

    let totalFillRate = 0;
    let fillRateCount = 0;
    routeStopsData.forEach((row) => {
      const total = Number(row.total_stops) || 0;
      const completed = Number(row.completed_stops) || 0;
      if (total > 0) {
        totalFillRate += completed / total;
        fillRateCount += 1;
      }
    });

    const avgFillRate = fillRateCount > 0 ? Math.round((totalFillRate / fillRateCount) * 100) / 100 : 0;

    // 6. Évolution des volumes sur 12 mois (pour graphique)
    // On récupère les snapshots et on calcule côté serveur pour éviter les problèmes avec jsonb_array_elements
    const twelveMonthsAgo = new Date(today);
    twelveMonthsAgo.setMonth(today.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlySnapshots = await run<{
      report_date: string;
      halle_data: any;
      plastique_b_data: any;
      cdt_data: any;
      papier_data: any;
    }>(
      `
      select report_date, halle_data, plastique_b_data, cdt_data, papier_data
      from inventory_snapshots
      where report_date >= $1
      order by report_date asc
      `,
      [twelveMonthsAgo.toISOString()]
    );

    // Grouper par mois
    const monthlyVolumesMap = new Map<string, {
      halle_bb: number;
      plastique_balles: number;
      cdt_m3: number;
      papier_balles: number;
    }>();

    monthlySnapshots.forEach((snapshot) => {
      const month = new Date(snapshot.report_date).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyVolumesMap.has(month)) {
        monthlyVolumesMap.set(month, { halle_bb: 0, plastique_balles: 0, cdt_m3: 0, papier_balles: 0 });
      }
      const monthData = monthlyVolumesMap.get(month)!;

      // Halle
      if (Array.isArray(snapshot.halle_data)) {
        snapshot.halle_data.forEach((item: any) => {
          monthData.halle_bb += Number(item.bb || 0);
        });
      }
      // Plastique
      if (Array.isArray(snapshot.plastique_b_data)) {
        snapshot.plastique_b_data.forEach((item: any) => {
          monthData.plastique_balles += Number(item.balles || 0);
        });
      }
      // CDT
      if (Array.isArray(snapshot.cdt_data)) {
        snapshot.cdt_data.forEach((item: any) => {
          monthData.cdt_m3 += Number(item.m3 || 0);
        });
      }
      // Papier
      if (Array.isArray(snapshot.papier_data)) {
        snapshot.papier_data.forEach((item: any) => {
          const bal = Number(item.bal || 0);
          if (!isNaN(bal)) monthData.papier_balles += bal;
        });
      }
    });

    const monthlyVolumes = Array.from(monthlyVolumesMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 7. Répartition des matières par type (pour graphique)
    const materialDistribution = {
      halle: totalVolumes.halle_bb,
      plastique: totalVolumes.plastique_balles,
      cdt: totalVolumes.cdt_m3,
      papier: totalVolumes.papier_balles
    };

    const totalVolume = totalVolumes.halle_bb + totalVolumes.plastique_balles + totalVolumes.cdt_m3 + totalVolumes.papier_balles;

    res.json({
      period,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      volumes: {
        total: totalVolume,
        halle_bb: totalVolumes.halle_bb,
        plastique_balles: totalVolumes.plastique_balles,
        cdt_m3: totalVolumes.cdt_m3,
        papier_balles: totalVolumes.papier_balles
      },
      revenues: {
        estimated_total: estimatedRevenues.total,
        by_material: estimatedRevenues.by_material
      },
      performance: {
        routes: {
          total: Number(routesData.total_routes),
          completed: Number(routesData.completed_routes),
          completion_rate: routesData.total_routes !== '0' 
            ? Math.round((Number(routesData.completed_routes) / Number(routesData.total_routes)) * 100)
            : 0,
          avg_duration_minutes: Math.round(Number(routesData.avg_duration_minutes) || 0)
        },
        interventions: {
          total: Number(interventionsData.total),
          completed: Number(interventionsData.completed),
          pending: Number(interventionsData.pending),
          completion_rate: interventionsData.total !== '0'
            ? Math.round((Number(interventionsData.completed) / Number(interventionsData.total)) * 100)
            : 0,
          avg_time_hours: Math.round(Number(interventionsData.avg_time_hours) || 0)
        },
        vehicle_fill_rate: avgFillRate
      },
      charts: {
        monthly_evolution: monthlyVolumes,
        material_distribution: materialDistribution
      },
      alerts: [] // À implémenter plus tard
    });
  })
);

app.get(
  '/api/logistics/kpis',
  requireManagerAuth,
  asyncHandler(async (req, res) => {
    const start = typeof req.query.start === 'string' ? req.query.start : null;
    const end = typeof req.query.end === 'string' ? req.query.end : null;
    const today = new Date();
    const defaultEnd = end ?? new Date().toISOString().slice(0, 10);
    const defaultStart =
      start ?? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).toISOString().slice(0, 10);

    const rows = await run<{
      id: string;
      date: string;
      status: string | null;
      planned_stops: string;
      completed_stops: string;
      first_completed: string | null;
      last_completed: string | null;
    }>(
      `
      select
        r.id,
        r.date,
        r.status,
        count(rs.id) as planned_stops,
        count(rs.id) filter (where rs.completed_at is not null) as completed_stops,
        min(rs.completed_at) as first_completed,
        max(rs.completed_at) as last_completed
      from routes r
      left join route_stops rs on rs.route_id = r.id
      where ($1::date is null or r.date >= $1::date)
        and ($2::date is null or r.date <= $2::date)
      group by r.id, r.date, r.status
      order by r.date asc
      `,
      [defaultStart, defaultEnd]
    );

    const metrics = {
      start: defaultStart,
      end: defaultEnd,
      total_routes: 0,
      completed_routes: 0,
      status_breakdown: {} as Record<string, number>,
      rotations_per_day: {} as Record<string, number>,
      avg_fill_rate: 0,
      avg_route_duration_minutes: 0
    };

    let sumFillRate = 0;
    let fillRateCount = 0;
    let durationSum = 0;
    let durationCount = 0;

    rows.forEach((row) => {
      const planned = Number(row.planned_stops) || 0;
      const completed = Number(row.completed_stops) || 0;
      metrics.total_routes += 1;

      const status = row.status || 'pending';
      metrics.status_breakdown[status] = (metrics.status_breakdown[status] ?? 0) + 1;

      metrics.rotations_per_day[row.date] = (metrics.rotations_per_day[row.date] ?? 0) + 1;

      if (status === 'completed' || completed === planned) {
        metrics.completed_routes += 1;
      }

      if (planned > 0) {
        sumFillRate += completed / planned;
        fillRateCount += 1;
      }

      if (row.first_completed && row.last_completed) {
        const startTime = new Date(row.first_completed).getTime();
        const endTime = new Date(row.last_completed).getTime();
        if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime > startTime) {
          durationSum += (endTime - startTime) / (1000 * 60);
          durationCount += 1;
        }
      }
    });

    metrics.avg_fill_rate = fillRateCount > 0 ? Math.round((sumFillRate / fillRateCount) * 100) / 100 : 0;
    metrics.avg_route_duration_minutes =
      durationCount > 0 ? Math.round((durationSum / durationCount) * 10) / 10 : 0;

    res.json(metrics);
  })
);

app.get(
  '/api/leaves/calendar',
  asyncHandler(async (req, res) => {
    const { start, end } = req.query as { start?: string; end?: string };
    if (!start || !end) {
      return res.status(400).json({ message: 'start et end sont requis' });
    }

    const rows = await run<LeaveRow>(
      `${leaveBaseSelect}
       where l.start_date <= $1::date
         and l.end_date >= $2::date
       order by l.start_date asc`,
      [end, start]
    );

    res.json(rows);
  })
);

app.get(
  '/api/leave-balances',
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const employees = await run<EmployeeRow>('select * from employees order by last_name, first_name');

    if (employees.length === 0) {
      return res.json([]);
    }

    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));

    const yearStartStr = format(yearStart, 'yyyy-MM-dd');
    const yearEndStr = format(yearEnd, 'yyyy-MM-dd');

    const approvedLeaves = await run<Leave>(
      `select * from leaves
       where status = 'approuve'
         and type = 'vacances'
         and end_date >= $1
         and start_date <= $2`,
      [yearStartStr, yearEndStr]
    );

    const usageMap = new Map<string, number>();
    for (const leave of approvedLeaves) {
      const start = parseDateUtc(leave.start_date);
      const end = parseDateUtc(leave.end_date);
      if (!start || !end) continue;

      const overlapStart = start > yearStart ? start : yearStart;
      const overlapEnd = end < yearEnd ? end : yearEnd;
      if (overlapEnd < overlapStart) continue;

      const days = countBusinessDays(overlapStart, overlapEnd);
      if (days <= 0) continue;

      usageMap.set(leave.employee_id, (usageMap.get(leave.employee_id) ?? 0) + days);
    }

    // Récupérer les soldes ajustés depuis la table leave_balances
    const adjustedBalances = await run<LeaveBalanceRow>(
      'select * from leave_balances where year = $1',
      [year]
    );
    const adjustedMap = new Map<string, LeaveBalanceRow>();
    adjustedBalances.forEach((balance) => {
      adjustedMap.set(balance.employee_id, balance);
    });

    const balances: LeaveBalanceRow[] = employees.map((employee) => {
      const defaultTotal = calculateAnnualEntitlement(employee, year);
      const used = usageMap.get(employee.id) ?? 0;
      const adjusted = adjustedMap.get(employee.id);
      
      return {
        id: adjusted?.id ?? `${employee.id}-${year}`,
        employee_id: employee.id,
        year,
        paid_leave_total: adjusted?.paid_leave_total ?? defaultTotal,
        paid_leave_used: used,
        sick_leave_used: adjusted?.sick_leave_used ?? 0,
        training_days_used: adjusted?.training_days_used ?? 0,
        employee: mapEmployeeRow(employee)
      };
    });

    res.json(balances);
  })
);

app.post(
  '/api/leaves',
  asyncHandler(async (req, res) => {
    const payload = req.body as LeaveRequestPayload;
    if (!payload.periods?.length) {
      return res.status(400).json({ message: 'Ajoutez au moins une période' });
    }

    const employee = await ensureEmployee(payload);
    const requestGroupId = randomUUID();

    const inserted: LeaveRow[] = [];
    for (const period of payload.periods) {
      if (!period.start_date || !period.end_date) {
        continue;
      }

      const leaveId = randomUUID();
      const [row] = await run<Leave>(
        `insert into leaves (
          id,
          employee_id,
          type,
          start_date,
          end_date,
          status,
          comment,
          signature,
          army_start_date,
          army_end_date,
          army_reference,
          request_group_id
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        returning *`,
        [
          leaveId,
          employee.id,
          period.type as LeaveType,
          period.start_date,
          period.end_date,
          'en_attente' satisfies LeaveStatus,
          payload.comment ?? null,
          payload.signature ?? null,
          payload.army_start_date ?? null,
          payload.army_end_date ?? null,
          payload.army_reference ?? null,
          requestGroupId
        ]
      );

      inserted.push({ ...(row as Leave), employee } as LeaveRow);
    }

    if (inserted.length) {
      await notifyWorkflowStep('manager', inserted);
    }

    res.status(201).json(inserted);
  })
);

app.patch(
  '/api/leaves/:id/status',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const auth = authReq.auth;
    const { id } = req.params;
    const { decision, status, signature, comment } = req.body as {
      decision?: 'approve' | 'reject';
      status?: LeaveStatus;
      signature?: string;
      comment?: string;
    };

    const effectiveDecision =
      decision ??
      (status === 'approuve' ? 'approve' : status === 'refuse' ? 'reject' : undefined);

    if (!effectiveDecision || (effectiveDecision !== 'approve' && effectiveDecision !== 'reject')) {
      return res.status(400).json({ message: 'Décision invalide' });
    }

    const [current] = await run<Leave>('select * from leaves where id = $1', [id]);
    if (!current) {
      return res.status(404).json({ message: 'Demande introuvable' });
    }

    const currentStep = (current.workflow_step as WorkflowStep) ?? 'manager';
    if (current.workflow_step === 'completed') {
      return res.status(400).json({ message: 'Flux d’approbation déjà terminé' });
    }
    if (!canUserApproveStep(auth, currentStep)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const groupIdentifier = current.request_group_id ?? current.id;
    const hasGroup = Boolean(current.request_group_id);

    const updates: string[] = ['updated_at = now()'];
    const values: unknown[] = [];

    const stageLabel = currentStep === 'director' ? 'direction' : currentStep;

    const pushValue = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (currentStep === 'manager') {
      updates.push(`manager_status = ${pushValue(effectiveDecision === 'approve' ? 'approved' : 'rejected')}`);
      updates.push(`manager_decision_by = ${pushValue(auth?.id ?? null)}`);
      updates.push('manager_decision_at = now()');
      updates.push(`manager_comment = ${pushValue(comment ?? null)}`);
    } else if (currentStep === 'hr') {
      updates.push(`hr_status = ${pushValue(effectiveDecision === 'approve' ? 'approved' : 'rejected')}`);
      updates.push(`hr_decision_by = ${pushValue(auth?.id ?? null)}`);
      updates.push('hr_decision_at = now()');
      updates.push(`hr_comment = ${pushValue(comment ?? null)}`);
    } else if (currentStep === 'director') {
      updates.push(`director_status = ${pushValue(effectiveDecision === 'approve' ? 'approved' : 'rejected')}`);
      updates.push(`director_decision_by = ${pushValue(auth?.id ?? null)}`);
      updates.push('director_decision_at = now()');
      updates.push(`director_comment = ${pushValue(comment ?? null)}`);
      if (signature) {
        updates.push(`signature = ${pushValue(signature)}`);
      }
    }

    let nextStep: WorkflowPipelineStep = current.workflow_step as WorkflowPipelineStep;

    if (effectiveDecision === 'approve') {
      nextStep = getNextWorkflowStep(currentStep);
      updates.push(`workflow_step = ${pushValue(nextStep)}`);
      if (nextStep === 'completed') {
        updates.push(`status = ${pushValue('approuve' satisfies LeaveStatus)}`);
        updates.push(`approved_by = ${pushValue(stageLabel)}`);
        updates.push('approved_at = now()');
      } else {
        updates.push(`status = ${pushValue('en_attente' satisfies LeaveStatus)}`);
      }
    } else {
      updates.push(`status = ${pushValue('refuse' satisfies LeaveStatus)}`);
      updates.push(`workflow_step = ${pushValue('completed')}`);
    }

    const whereClause = hasGroup ? 'request_group_id = $' : 'id = $';
    const identifierPosition = values.length + 1;
    const finalQuery = `update leaves set ${updates.join(', ')} where ${whereClause}${identifierPosition}`;
    values.push(groupIdentifier);

    await run(finalQuery, values);

    const updatedLeaves = await fetchLeavesByGroup(groupIdentifier, hasGroup);

    if (effectiveDecision === 'approve') {
      if (nextStep === 'completed') {
        await notifyApplicantDecision(updatedLeaves, 'approve', currentStep);
      } else if (nextStep !== 'manager') {
        await notifyWorkflowStep(nextStep as WorkflowStep, updatedLeaves);
      }
    } else {
      await notifyApplicantDecision(updatedLeaves, 'reject', currentStep);
    }

    res.json({ leaves: updatedLeaves });
  })
);

app.post(
  '/api/leaves/notify',
  requireManagerAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const { leaveIds, canton, pdfBase64, pdfFilename } = req.body as VacationNotificationPayload;
    if (!leaveIds?.length) {
      return res.status(400).json({ message: 'leaveIds requis' });
    }

    const placeholders = leaveIds.map((_, idx) => `$${idx + 1}`).join(',');
    const rows = await run<LeaveRow>(
      `${leaveBaseSelect}
       where l.id in (${placeholders})`,
      leaveIds
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Demandes introuvables' });
    }

    const baseRecipients =
      (process.env.VACANCES_RECIPIENTS || process.env.BREVO_SENDER_EMAIL || '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    const uniqueEmployeeEmails = Array.from(
      new Set(
        rows
          .map((leave) => leave.employee?.email?.trim())
          .filter((email): email is string => Boolean(email))
      )
    );

    const approverEmail = authReq.auth?.email?.trim();
    const mailsTo = [...baseRecipients, ...uniqueEmployeeEmails];
    if (approverEmail) {
      mailsTo.push(approverEmail);
    }
    const finalRecipients = mailsTo.filter((email): email is string => Boolean(email));

    const textBody = rows
      .map(
        (leave) =>
          `${leave.employee?.first_name || ''} ${leave.employee?.last_name || ''} · ${
            TYPE_LABELS_SERVER[leave.type as LeaveType] || leave.type
          } · ${format(new Date(leave.start_date), 'dd.MM.yyyy', { locale: fr })} → ${format(
            new Date(leave.end_date),
            'dd.MM.yyyy',
            { locale: fr }
          )}`
      )
      .join('\n');

    await sendBrevoEmail({
      to: finalRecipients,
      subject: `Congés approuvés (${rows.length}) - ${canton}`,
      text: textBody,
      attachments: pdfBase64
        ? [
            {
              name: pdfFilename || `conges-${Date.now()}.pdf`,
              content: pdfBase64,
              type: 'application/pdf'
            }
          ]
        : []
    });

    res.json({ message: 'Notifications envoyées' });
  })
);

app.delete(
  '/api/leaves/:id',
  requireManagerAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [deleted] = await run<{ id: string }>('delete from leaves where id = $1 returning id', [id]);
    if (!deleted) {
      return res.status(404).json({ message: 'Demande introuvable' });
    }
    res.status(204).send();
  })
);

app.post(
  '/api/leave-balances/recalculate',
  asyncHandler(async (_req, res) => {
    await run('select 1');
    res.json({ message: 'Recalcul déclenché (adapter selon votre logique business)' });
  })
);

app.patch(
  '/api/leave-balances/:employeeId/:year',
  requireManagerAuth,
  asyncHandler(async (req, res) => {
    const { employeeId, year } = req.params;
    const { paid_leave_total } = req.body as { paid_leave_total: number };
    const auth = (req as AuthenticatedRequest).auth;
    
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    if (typeof paid_leave_total !== 'number' || paid_leave_total < 0) {
      return res.status(400).json({ message: 'paid_leave_total doit être un nombre positif' });
    }

    // Vérifier que l'employé existe
    const [employee] = await run<EmployeeRow>('select * from employees where id = $1', [employeeId]);
    if (!employee) {
      return res.status(404).json({ message: 'Employé introuvable' });
    }

    // Vérifier que le manager peut modifier cet employé (même département ou admin)
    if (auth.role !== 'admin') {
      if (employee.department !== auth.department) {
        return res.status(403).json({ message: 'Vous ne pouvez modifier que les employés de votre département' });
      }
    }

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum)) {
      return res.status(400).json({ message: 'Année invalide' });
    }

    // Vérifier ou créer l'enregistrement dans leave_balances
    const existing = await run<LeaveBalanceRow>(
      'select * from leave_balances where employee_id = $1 and year = $2',
      [employeeId, yearNum]
    );

    let result: LeaveBalanceRow;
    if (existing.length > 0) {
      // Mettre à jour l'enregistrement existant
      const [updated] = await run<LeaveBalanceRow>(
        'update leave_balances set paid_leave_total = $1 where employee_id = $2 and year = $3 returning *',
        [paid_leave_total, employeeId, yearNum]
      );
      result = { ...updated, employee: mapEmployeeRow(employee) };
    } else {
      // Créer un nouvel enregistrement
      const id = randomUUID();
      const [created] = await run<LeaveBalanceRow>(
        `insert into leave_balances (id, employee_id, year, paid_leave_total, paid_leave_used, sick_leave_used, training_days_used)
         values ($1, $2, $3, $4, 0, 0, 0)
         returning *`,
        [id, employeeId, yearNum, paid_leave_total]
      );
      result = { ...created, employee: mapEmployeeRow(employee) };
    }
    res.json(result);
  })
);

type DeclassementEmailPayload = {
  dateTime: string;
  companyName?: string;
  vehiclePlate?: string;
  slipNumber?: string;
  notes?: string;
  entries: Array<{
    sourceMaterial: string;
    targetMaterial: string;
    ratio: string;
    notes: string;
  }>;
  pdfBase64: string;
  pdfFilename?: string;
  photos?: Array<{ filename?: string; mimeType?: string; base64: string }>;
};

app.post(
  '/api/declassements/send',
  asyncHandler(async (req, res) => {
    const { dateTime, companyName, vehiclePlate, slipNumber, notes, entries, pdfBase64, pdfFilename } =
      req.body as DeclassementEmailPayload;

    if (!pdfBase64) {
      return res.status(400).json({ message: 'PDF manquant' });
    }

    const recipients =
      (process.env.DECLASSEMENT_RECIPIENTS || process.env.BREVO_SENDER_EMAIL || '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    if (!recipients.length) {
      return res.status(500).json({ message: 'Aucun destinataire configuré' });
    }

    const entriesSummary =
      entries
        ?.map(
          (entry, idx) =>
            `${idx + 1}. ${entry.sourceMaterial || '-'} -> ${entry.targetMaterial || '-'} (${entry.ratio || '-'}) ${
              entry.notes ? `- ${entry.notes}` : ''
            }`
        )
        .join('\n') || '—';

    const textBody = [
      `Déclassement réalisé le : ${dateTime || new Date().toISOString()}`,
      companyName ? `Nom entreprise : ${companyName}` : null,
      vehiclePlate ? `Plaque véhicule : ${vehiclePlate}` : null,
      slipNumber ? `Bon / Référence : ${slipNumber}` : null,
      '',
      'Détails :',
      entriesSummary,
      '',
      `Notes : ${notes || '—'}`,
      '',
      'Le rapport PDF (incluant les photos) est joint à cet e-mail.'
    ].filter(Boolean).join('\n');

    await sendBrevoEmail({
      to: recipients,
      subject: `Déclassement matières - ${companyName || vehiclePlate || slipNumber || dateTime}`,
      text: textBody,
      attachments: [
        {
          name: pdfFilename || `declassement-${Date.now()}.pdf`,
          content: pdfBase64,
          type: 'application/pdf'
        }
      ]
    });

    res.json({ message: 'Email envoyé' });
  })
);

type DestructionEmailPayload = {
  dateDestruction: string;
  poidsTotal: string;
  client: string;
  ticket: string;
  datePesage: string;
  marchandises: Array<{
    nom: string;
    reference: string;
  }>;
  nomAgent: string;
  pdfBase64: string;
  pdfFilename: string;
};

type CDTSheetEmailPayload = {
  dateLabel: string;
  formData: Record<string, string>;
  pdfBase64: string;
  pdfFilename: string;
};

type InventoryEmailPayload = {
  dateLabel: string;
  pdfBase64: string;
  pdfFilename: string;
  excelBase64?: string;
  excelFilename?: string;
};

type ExpeditionEmailPayload = {
  dateRange: string;
  weekStart: string;
  data: Record<string, Record<string, Array<{ qty: string; note: string }>>>;
  pdfBase64: string;
  pdfFilename: string;
};

type VacationNotificationPayload = {
  leaveIds: string[];
  canton: string;
  pdfBase64?: string;
  pdfFilename?: string;
};

app.post(
  '/api/destructions/send',
  asyncHandler(async (req, res) => {
    const { dateDestruction, poidsTotal, client, ticket, datePesage, marchandises, nomAgent, pdfBase64, pdfFilename } =
      req.body as DestructionEmailPayload;

    if (!pdfBase64) {
      return res.status(400).json({ message: 'PDF manquant' });
    }

    const recipients =
      (process.env.DECLASSEMENT_RECIPIENTS || process.env.BREVO_SENDER_EMAIL || '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    if (!recipients.length) {
      return res.status(500).json({ message: 'Aucun destinataire configuré' });
    }

    const marchandisesSummary = marchandises
      .map((m, idx) => `${idx + 1}. ${m.nom || '—'} (Réf: ${m.reference || '—'})`)
      .join('\n');

    const textBody = [
      `Certificat de destruction généré le : ${new Date().toLocaleString('fr-CH')}`,
      `Date de destruction : ${dateDestruction || '—'}`,
      `Poids total détruit : ${poidsTotal || '—'} kg`,
      `Client : ${client || '—'}`,
      `N° de ticket : ${ticket || '—'}`,
      `Date du bon de pesage : ${datePesage || '—'}`,
      `Agent : ${nomAgent || '—'}`,
      '',
      'Marchandises détruites :',
      marchandisesSummary || '—',
      '',
      'Le certificat PDF (incluant les photos) est joint à cet e-mail.'
    ].join('\n');

    await sendBrevoEmail({
      to: recipients,
      subject: `Certificat de destruction - ${client || dateDestruction || 'Nouveau'}`,
      text: textBody,
      attachments: [
        {
          name: pdfFilename || `certificat_destruction_${Date.now()}.pdf`,
          content: pdfBase64,
          type: 'application/pdf'
        }
      ]
    });

    res.json({ message: 'Email envoyé' });
  })
);

app.post(
  '/api/cdt/send',
  asyncHandler(async (req, res) => {
    const { dateLabel, formData, pdfBase64, pdfFilename } = req.body as CDTSheetEmailPayload;

    if (!pdfBase64) {
      return res.status(400).json({ message: 'PDF manquant' });
    }

    const recipients =
      (process.env.DECLASSEMENT_RECIPIENTS || process.env.BREVO_SENDER_EMAIL || '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    if (!recipients.length) {
      return res.status(500).json({ message: 'Aucun destinataire configuré' });
    }

    const summary =
      Object.entries(formData)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `- ${key} : ${value}`)
        .join('\n') || 'Aucune donnée saisie.';

    const textBody = [
      `Relevé Centre de tri généré le : ${dateLabel || new Date().toLocaleString('fr-CH')}`,
      '',
      'Données saisies :',
      summary,
      '',
      'Le relevé PDF est joint à cet e-mail.'
    ].join('\n');

    await sendBrevoEmail({
      to: recipients,
      subject: `Relevé Centre de tri - ${dateLabel}`,
      text: textBody,
      attachments: [
        {
          name: pdfFilename || `centre-de-tri_${Date.now()}.pdf`,
          content: pdfBase64,
          type: 'application/pdf'
        }
      ]
    });

    res.json({ message: 'Email envoyé' });
  })
);

app.post(
  '/api/inventory/send',
  asyncHandler(async (req, res) => {
    const { dateLabel, pdfBase64, pdfFilename, excelBase64, excelFilename } = req.body as InventoryEmailPayload;

    if (!pdfBase64) {
      return res.status(400).json({ message: 'PDF manquant' });
    }

    const recipients =
      process.env.INVENTORY_RECIPIENTS ||
      process.env.CDT_RECIPIENTS ||
      process.env.DESTRUCTION_RECIPIENTS ||
      process.env.DECLASSEMENT_RECIPIENTS ||
      process.env.BREVO_SENDER_EMAIL;
    const to = recipients
      ?.split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    if (!to || !to.length) {
      return res.status(500).json({ message: 'Aucun destinataire configuré' });
    }

    const attachments: EmailAttachment[] = [
      {
        name: pdfFilename || `inventaire_${Date.now()}.pdf`,
        content: pdfBase64,
        type: 'application/pdf'
      }
    ];
    if (excelBase64) {
      attachments.push({
        name: excelFilename || `inventaire_${Date.now()}.xlsx`,
        content: excelBase64,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    }

    const textBody = [
      `Feuille d'inventaire générée le : ${dateLabel || new Date().toLocaleString('fr-CH')}`,
      '',
      'Le relevé PDF et le fichier Excel sont joints à cet e-mail.'
    ].join('\n');

    await sendBrevoEmail({
      to,
      subject: `Inventaire halle - ${dateLabel || 'Nouveau relevé'}`,
      text: textBody,
      attachments
    });

    res.json({ message: 'Email envoyé' });
  })
);

app.get(
  '/api/map/user-locations',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { department, role, manager } = req.query;
    const conditions: string[] = [];
    const params: string[] = [];
    if (typeof department === 'string' && department.trim().length > 0) {
      conditions.push(`lower(e.department) = lower($${params.length + 1})`);
      params.push(department.trim());
    }
    if (typeof role === 'string' && role.trim().length > 0) {
      conditions.push(`lower(e.role) = lower($${params.length + 1})`);
      params.push(role.trim());
    }
    if (typeof manager === 'string' && manager.trim().length > 0) {
      conditions.push(`lower(e.manager_name) = lower($${params.length + 1})`);
      params.push(manager.trim());
    }
    const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const rows = await run<
      {
        employee_id: string;
        latitude: number;
        longitude: number;
        last_update: string;
        first_name: string;
        last_name: string;
        email: string;
        department: string | null;
        role: string | null;
        manager_name: string | null;
      }
    >(
      `
        select ul.employee_id,
               ul.latitude,
               ul.longitude,
               ul.last_update,
               e.first_name,
               e.last_name,
               e.email,
               e.department,
               e.role,
               e.manager_name
        from user_locations ul
        join employees e on e.id = ul.employee_id
        ${whereClause}
        order by ul.last_update desc
      `,
      params
    );
    res.json(
      rows.map((row) => ({
        employee_id: row.employee_id,
        latitude: row.latitude,
        longitude: row.longitude,
        last_update: row.last_update,
        first_name: row.first_name,
        last_name: row.last_name,
        employee_email: row.email,
        department: row.department,
        role: row.role,
        manager_name: row.manager_name
      }))
    );
  })
);

app.post(
  '/api/map/user-locations',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const email = authReq.auth?.email;
    if (!email) {
      return res.status(401).json({ message: 'Session expirée' });
    }
    const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ message: 'Coordonnées invalides' });
    }
    // Chercher l'employé par email
    const [employee] = await run<{ id: string }>('select id from employees where lower(email) = lower($1)', [email]);
    if (!employee) {
      // Si l'utilisateur n'est pas un employé, on retourne un succès silencieux
      // pour éviter les erreurs répétées dans la console pour les admins/managers
      // mais on ne met pas à jour la position car il n'y a pas d'employé associé
      return res.json({ message: 'Position non mise à jour (utilisateur non-employé)', updated: false });
    }
    const now = new Date();
    // Mettre à jour la position actuelle pour les employés
    await run(
      `
        insert into user_locations(employee_id, latitude, longitude, last_update)
        values ($1, $2, $3, $4)
        on conflict (employee_id) do update
        set latitude = excluded.latitude,
            longitude = excluded.longitude,
            last_update = excluded.last_update
      `,
      [employee.id, latitude, longitude, now]
    );
    // Sauvegarder dans l'historique (toutes les 30 secondes max pour éviter trop de données)
    const [lastHistory] = await run<{ recorded_at: Date }>(
      `select recorded_at from user_location_history 
       where employee_id = $1 
       order by recorded_at desc limit 1`,
      [employee.id]
    );
    const shouldSaveHistory = !lastHistory || (now.getTime() - new Date(lastHistory.recorded_at).getTime()) > 30000;
    if (shouldSaveHistory) {
      await run(
        `insert into user_location_history(employee_id, latitude, longitude, recorded_at)
         values ($1, $2, $3, $4)`,
        [employee.id, latitude, longitude, now]
      );
    }
    res.json({ message: 'Position mise à jour', updated: true });
  })
);

app.get(
  '/api/map/vehicles',
  requireAuth(),
  asyncHandler(async (_req, res) => {
    const rows = await run<MapVehicle[]>(`select id, internal_number, plate_number from vehicles order by internal_number nulls last, plate_number`);
    res.json(rows);
  })
);

app.get(
  '/api/map/routes',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : null;
    const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : null;
    if (!date) {
      return res.status(400).json({ message: 'Paramètre "date" requis (YYYY-MM-DD)' });
    }
    const params: string[] = [date];
    let sql = `
      select r.id as route_id,
             r.status as route_status,
             r.path,
             rs.id as stop_id,
             rs.order_index,
             rs.estimated_time,
             rs.status as stop_status,
             rs.notes,
             rs.completed_at,
             c.name as customer_name,
             c.address as customer_address,
             c.latitude,
             c.longitude,
             c.risk_level,
             r.vehicle_id,
             v.internal_number,
             v.plate_number
      from routes r
      left join route_stops rs on rs.route_id = r.id
      left join customers c on c.id = rs.customer_id
      left join vehicles v on v.id = r.vehicle_id
      where r.date = $1
    `;
    if (vehicleId) {
      params.push(vehicleId);
      sql += ` and r.vehicle_id = $${params.length}`;
    }
    sql += ' order by r.vehicle_id nulls last, rs.order_index';
    const rows = await run<MapRouteStopRow>(sql, params);
    const routes = new Map<
      string,
      {
        id: string;
        status: string | null;
        path: Array<[number, number]>;
        vehicle_id: string | null;
        internal_number: string | null;
        plate_number: string | null;
        stops: Array<{
          id: string;
          order_index: number;
          estimated_time: string | null;
          status: string | null;
          notes: string | null;
          completed_at: string | null;
          customer_name: string | null;
          customer_address: string | null;
          latitude: number | null;
          longitude: number | null;
          risk_level: string | null;
        }>;
      }
    >();
    rows.forEach((row) => {
      if (!routes.has(row.route_id)) {
        routes.set(row.route_id, {
          id: row.route_id,
          status: row.route_status,
          path: Array.isArray(row.path) ? row.path : Array.isArray(row.path?.coordinates) ? row.path.coordinates : [],
          vehicle_id: row.vehicle_id,
          internal_number: row.internal_number,
          plate_number: row.plate_number,
          stops: []
        });
      }
      const route = routes.get(row.route_id)!;
      if (row.stop_id) {
        route.stops.push({
          id: row.stop_id,
          order_index: row.order_index,
          estimated_time: row.estimated_time,
          status: row.stop_status,
          notes: row.notes,
          completed_at: row.completed_at,
          customer_name: row.customer_name,
          customer_address: row.customer_address,
          latitude: row.latitude,
          longitude: row.longitude,
          risk_level: row.risk_level
        });
      }
    });
    res.json(Array.from(routes.values()));
  })
);

// Endpoint pour récupérer l'historique des positions (pour le rejeu)
app.get(
  '/api/map/user-locations/history',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : null;
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : null;
    const timeFrom = typeof req.query.timeFrom === 'string' ? req.query.timeFrom : '05:00';
    const timeTo = typeof req.query.timeTo === 'string' ? req.query.timeTo : '19:00';

    if (!date) {
      return res.status(400).json({ message: 'Paramètre "date" requis (YYYY-MM-DD)' });
    }

    const [dateFrom, dateTo] = [new Date(`${date}T${timeFrom}:00`), new Date(`${date}T${timeTo}:00`)];
    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
      return res.status(400).json({ message: 'Format de date/heure invalide' });
    }

    let sql = `
      select 
        ulh.id,
        ulh.employee_id,
        ulh.latitude,
        ulh.longitude,
        ulh.recorded_at,
        e.first_name,
        e.last_name,
        e.email,
        e.department,
        e.role,
        e.manager_name
      from user_location_history ulh
      join employees e on e.id = ulh.employee_id
      where ulh.recorded_at >= $1 and ulh.recorded_at <= $2
    `;
    const params: any[] = [dateFrom.toISOString(), dateTo.toISOString()];

    if (employeeId) {
      params.push(employeeId);
      sql += ` and ulh.employee_id = $${params.length}`;
    }

    sql += ' order by ulh.recorded_at asc';

    type HistoryRow = {
      id: string;
      employee_id: string;
      latitude: number;
      longitude: number;
      recorded_at: string;
      first_name: string;
      last_name: string;
      email: string;
      department: string | null;
      role: string | null;
      manager_name: string | null;
    };

    const rows = await run<HistoryRow>(sql, params);

    res.json(
      rows.map((row) => ({
        id: row.id,
        employee_id: row.employee_id,
        latitude: row.latitude,
        longitude: row.longitude,
        recorded_at: row.recorded_at,
        first_name: row.first_name,
        last_name: row.last_name,
        employee_email: row.email,
        department: row.department,
        role: row.role,
        manager_name: row.manager_name
      }))
    );
  })
);

// Endpoint pour créer une intervention depuis la carte
app.post(
  '/api/interventions',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Session expirée' });
    }

    const {
      customer_id,
      customer_name,
      customer_address,
      title,
      description,
      priority,
      assigned_to,
      latitude,
      longitude,
      notes
    } = req.body as {
      customer_id?: string;
      customer_name: string;
      customer_address?: string;
      title: string;
      description?: string;
      priority?: string;
      assigned_to?: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
    };

    if (!customer_name || !title) {
      return res.status(400).json({ message: 'Nom du client et titre requis' });
    }

    const [intervention] = await run<{ id: string }>(
      `
        insert into interventions (
          customer_id, customer_name, customer_address, title, description,
          priority, created_by, assigned_to, latitude, longitude, notes, status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
        returning id
      `,
      [
        customer_id || null,
        customer_name,
        customer_address || null,
        title,
        description || null,
        priority || 'medium',
        userId,
        assigned_to || null,
        latitude || null,
        longitude || null,
        notes || null
      ]
    );

    res.status(201).json({ id: intervention.id, message: 'Intervention créée avec succès' });
  })
);

// ==================== ENDPOINTS CLIENTS ====================
app.get(
  '/api/customers',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const rows = await run<{
      id: string;
      name: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      risk_level: string | null;
      created_at: string;
    }>('select * from customers order by name');
    res.json(rows);
  })
);

app.post(
  '/api/customers',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { name, address, latitude, longitude, risk_level } = req.body as {
      name: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      risk_level?: string;
    };
    if (!name) {
      return res.status(400).json({ message: 'Nom du client requis' });
    }
    const id = randomUUID();
    const [customer] = await run<{
      id: string;
      name: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      risk_level: string | null;
      created_at: string;
    }>(
      `insert into customers (id, name, address, latitude, longitude, risk_level)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [id, name, address || null, latitude || null, longitude || null, risk_level || null]
    );
    await recordAuditLog({ entityType: 'customer', entityId: customer.id, action: 'create', req, after: customer });
    res.status(201).json({ id: customer.id, message: 'Client créé avec succès' });
  })
);

app.patch(
  '/api/customers/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, address, latitude, longitude, risk_level } = req.body as {
      name?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      risk_level?: string;
    };
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(address);
    }
    if (latitude !== undefined) {
      updates.push(`latitude = $${paramIndex++}`);
      params.push(latitude);
    }
    if (longitude !== undefined) {
      updates.push(`longitude = $${paramIndex++}`);
      params.push(longitude);
    }
    if (risk_level !== undefined) {
      updates.push(`risk_level = $${paramIndex++}`);
      params.push(risk_level);
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' });
    }
    const [before] = await run('select * from customers where id = $1', [id]);
    if (!before) {
      return res.status(404).json({ message: 'Client introuvable' });
    }
    params.push(id);
    const [updated] = await run(`update customers set ${updates.join(', ')} where id = $${paramIndex} returning *`, params);
    await recordAuditLog({ entityType: 'customer', entityId: id, action: 'update', req, before, after: updated });
    res.json({ message: 'Client mis à jour avec succès' });
  })
);

app.delete(
  '/api/customers/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [before] = await run('select * from customers where id = $1', [id]);
    await run('delete from customers where id = $1', [id]);
    if (before) {
      await recordAuditLog({ entityType: 'customer', entityId: id, action: 'delete', req, before });
    }
    res.json({ message: 'Client supprimé avec succès' });
  })
);

// Materials API endpoints
app.get(
  '/api/materials',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const rows = await run<{
      id: string;
      famille: string | null;
      numero: string | null;
      abrege: string | null;
      description: string | null;
      unite: string | null;
      me_bez: string | null;
      created_at: string;
      updated_at: string;
    }>('select * from materials order by famille, abrege');
    res.json(rows);
  })
);

app.post(
  '/api/materials',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { famille, numero, abrege, description, unite, me_bez } = req.body as {
      famille?: string;
      numero?: string;
      abrege: string;
      description: string;
      unite: string;
      me_bez?: string;
    };
    if (!abrege || !description || !unite) {
      return res.status(400).json({ message: 'Abrégé, description et unité sont requis' });
    }
    const id = randomUUID();
    const [material] = await run<{
      id: string;
      famille: string | null;
      numero: string | null;
      abrege: string | null;
      description: string | null;
      unite: string | null;
      me_bez: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `insert into materials (id, famille, numero, abrege, description, unite, me_bez)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [id, famille || null, numero || null, abrege, description, unite, me_bez || null]
    );
    await recordAuditLog({ entityType: 'material', entityId: material.id, action: 'create', req, after: material });
    res.status(201).json({ id: material.id, message: 'Matière créée avec succès' });
  })
);

app.patch(
  '/api/materials/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { famille, numero, abrege, description, unite, me_bez } = req.body as {
      famille?: string;
      numero?: string;
      abrege?: string;
      description?: string;
      unite?: string;
      me_bez?: string;
    };
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (famille !== undefined) {
      updates.push(`famille = $${paramIndex++}`);
      params.push(famille);
    }
    if (numero !== undefined) {
      updates.push(`numero = $${paramIndex++}`);
      params.push(numero);
    }
    if (abrege !== undefined) {
      updates.push(`abrege = $${paramIndex++}`);
      params.push(abrege);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (unite !== undefined) {
      updates.push(`unite = $${paramIndex++}`);
      params.push(unite);
    }
    if (me_bez !== undefined) {
      updates.push(`me_bez = $${paramIndex++}`);
      params.push(me_bez);
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification à apporter' });
    }
    updates.push(`updated_at = now()`);
    params.push(id);
    const [before] = await run('select * from materials where id = $1', [id]);
    if (!before) {
      return res.status(404).json({ message: 'Matière introuvable' });
    }
    const [after] = await run(
      `update materials set ${updates.join(', ')} where id = $${paramIndex} returning *`,
      params
    );
    await recordAuditLog({ entityType: 'material', entityId: id, action: 'update', req, before, after });
    res.json({ message: 'Matière mise à jour avec succès' });
  })
);

app.delete(
  '/api/materials/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [before] = await run('select * from materials where id = $1', [id]);
    await run('delete from materials where id = $1', [id]);
    if (before) {
      await recordAuditLog({ entityType: 'material', entityId: id, action: 'delete', req, before });
    }
    res.json({ message: 'Matière supprimée avec succès' });
  })
);

// Material Prices API endpoints
type PriceSourceRow = {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  created_at: string;
};

type MaterialPriceRow = {
  id: string;
  material_id: string;
  price_source_id: string;
  price: number;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  comment: string | null;
  imported_from_file: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

app.get(
  '/api/materials/:id/prices',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run<MaterialPriceRow & { source_name: string }>(
      `select mp.*, ps.name as source_name
       from material_prices mp
       join price_sources ps on mp.price_source_id = ps.id
       where mp.material_id = $1
       order by mp.valid_from desc, mp.created_at desc`,
      [id]
    );
    res.json(rows);
  })
);

app.get(
  '/api/price-sources',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (_req, res) => {
    const rows = await run<PriceSourceRow>('select * from price_sources order by name');
    res.json(rows);
  })
);

app.post(
  '/api/materials/:id/prices',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const authReq = req as AuthenticatedRequest;
    const { price_source_id, price, price_min, price_max, currency, valid_from, valid_to, comment } = req.body as {
      price_source_id: string;
      price: number;
      price_min?: number;
      price_max?: number;
      currency?: string;
      valid_from?: string;
      valid_to?: string | null;
      comment?: string;
    };

    if (!price_source_id || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: 'Source et prix valide requis' });
    }

    // Vérifier que la matière existe
    const [material] = await run('select id from materials where id = $1', [id]);
    if (!material) {
      return res.status(404).json({ message: 'Matière introuvable' });
    }

    const priceId = randomUUID();
    const [created] = await run<MaterialPriceRow>(
      `insert into material_prices (
        id, material_id, price_source_id, price, price_min, price_max, currency, 
        valid_from, valid_to, comment, created_by, created_by_name
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      [
        priceId,
        id,
        price_source_id,
        price,
        price_min || null,
        price_max || null,
        currency || 'CHF',
        valid_from || new Date().toISOString().split('T')[0],
        valid_to || null,
        comment || null,
        authReq.auth?.id || null,
        authReq.auth?.full_name || null
      ]
    );
    res.status(201).json(created);
  })
);

app.patch(
  '/api/material-prices/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { price, price_min, price_max, currency, valid_from, valid_to, comment } = req.body as {
      price?: number;
      price_min?: number;
      price_max?: number;
      currency?: string;
      valid_from?: string;
      valid_to?: string | null;
      comment?: string;
    };

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      params.push(price);
    }
    if (price_min !== undefined) {
      updates.push(`price_min = $${paramIndex++}`);
      params.push(price_min);
    }
    if (price_max !== undefined) {
      updates.push(`price_max = $${paramIndex++}`);
      params.push(price_max);
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      params.push(currency);
    }
    if (valid_from !== undefined) {
      updates.push(`valid_from = $${paramIndex++}`);
      params.push(valid_from);
    }
    if (valid_to !== undefined) {
      updates.push(`valid_to = $${paramIndex++}`);
      params.push(valid_to);
    }
    if (comment !== undefined) {
      updates.push(`comment = $${paramIndex++}`);
      params.push(comment);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification' });
    }

    params.push(id);
    const [updated] = await run<MaterialPriceRow>(
      `update material_prices set ${updates.join(', ')} where id = $${paramIndex} returning *`,
      params
    );
    res.json(updated);
  })
);

app.delete(
  '/api/material-prices/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from material_prices where id = $1', [id]);
    res.json({ message: 'Prix supprimé avec succès' });
  })
);

// Import PDF Copacel
app.post(
  '/api/materials/import-copacel-pdf',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    
    // Pour l'instant, on accepte un JSON avec les prix extraits manuellement
    // TODO: Ajouter pdf-parse pour extraire automatiquement depuis le PDF
    const { prices, filename, valid_from } = req.body as {
      prices: Array<{
        abrege?: string;
        description?: string;
        price: number;
        price_min?: number;
        price_max?: number;
      }>;
      filename?: string;
      valid_from?: string;
    };

    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ message: 'Liste de prix requise' });
    }

    // Récupérer la source Copacel
    const [copacelSource] = await run<PriceSourceRow>(
      "select * from price_sources where name = 'Copacel'"
    );
    if (!copacelSource) {
      return res.status(500).json({ message: 'Source Copacel introuvable' });
    }

    const validFrom = valid_from || new Date().toISOString().split('T')[0];
    const results: Array<{ material_id: string; success: boolean; error?: string }> = [];
    const createdBy = authReq.auth?.id || null;
    const createdByName = authReq.auth?.full_name || null;

    for (const priceData of prices) {
      try {
        // Chercher la matière par abrégé ou description
        let material;
        if (priceData.abrege) {
          const [found] = await run<{ id: string }>(
            'select id from materials where lower(abrege) = lower($1)',
            [priceData.abrege]
          );
          material = found;
        }
        
        if (!material && priceData.description) {
          const [found] = await run<{ id: string }>(
            'select id from materials where lower(description) like lower($1)',
            [`%${priceData.description}%`]
          );
          material = found;
        }

        if (!material) {
          results.push({
            material_id: '',
            success: false,
            error: `Matière non trouvée: ${priceData.abrege || priceData.description}`
          });
          continue;
        }

        // Créer le prix
        const priceId = randomUUID();
        await run(
          `insert into material_prices (
            id, material_id, price_source_id, price, price_min, price_max, currency,
            valid_from, imported_from_file, created_by, created_by_name
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            priceId,
            material.id,
            copacelSource.id,
            priceData.price,
            priceData.price_min || null,
            priceData.price_max || null,
            'CHF',
            validFrom,
            filename || null,
            createdBy,
            createdByName
          ]
        );

        results.push({ material_id: material.id, success: true });
      } catch (error) {
        results.push({
          material_id: '',
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
    }

    res.json({
      message: `${results.filter(r => r.success).length} prix importés sur ${results.length}`,
      results
    });
  })
);

app.get(
  '/api/customers/:id/detail',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [customer] = await run('select * from customers where id = $1', [id]);
    if (!customer) {
      return res.status(404).json({ message: 'Client introuvable' });
    }
    const interventions = await run(
      `select i.*, u.full_name as created_by_name, e.first_name as assigned_first_name, e.last_name as assigned_last_name
       from interventions i
       left join users u on u.id = i.created_by
       left join employees e on e.id = i.assigned_to
       where i.customer_id = $1
       order by i.created_at desc
       limit 25`,
      [id]
    );
    const routeStops = await run(
      `select rs.*, r.date as route_date, r.status as route_status, v.internal_number, v.plate_number
       from route_stops rs
       join routes r on r.id = rs.route_id
       left join vehicles v on v.id = r.vehicle_id
       where rs.customer_id = $1
       order by r.date desc
       limit 20`,
      [id]
    );
    const documents = await run(
      `select id, filename, mimetype, size, uploaded_by, uploaded_by_name, created_at
       from customer_documents
       where customer_id = $1
       order by created_at desc`,
      [id]
    );
    const auditLogs = await run(
      `select id, entity_type, entity_id, action, changed_by, changed_by_name, before_data, after_data, created_at
       from audit_logs
       where entity_type = 'customer' and entity_id = $1
       order by created_at desc
       limit 30`,
      [id]
    );
    res.json({ customer, interventions, routeStops, documents, auditLogs });
  })
);

app.get(
  '/api/customers/:id/documents',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const documents = await run(
      `select id, filename, mimetype, size, uploaded_by, uploaded_by_name, created_at
       from customer_documents
       where customer_id = $1
       order by created_at desc`,
      [id]
    );
    res.json(documents);
  })
);

app.post(
  '/api/customers/:id/documents',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { filename, base64, mimetype } = req.body as { filename?: string; base64?: string; mimetype?: string };
    if (!filename || !base64) {
      return res.status(400).json({ message: 'Fichier invalide' });
    }
    const [customer] = await run('select id from customers where id = $1', [id]);
    if (!customer) {
      return res.status(404).json({ message: 'Client introuvable' });
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      return res.status(400).json({ message: 'Fichier non valide (base64)' });
    }
    if (!buffer.length) {
      return res.status(400).json({ message: 'Fichier vide' });
    }
    if (buffer.length > MAX_CUSTOMER_DOCUMENT_SIZE) {
      return res.status(400).json({ message: 'Fichier trop volumineux (10 Mo max par défaut)' });
    }
    const auth = (req as AuthenticatedRequest).auth;
    const [document] = await run(
      `insert into customer_documents (customer_id, filename, mimetype, size, file_data, uploaded_by, uploaded_by_name)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, filename, mimetype, size, uploaded_by, uploaded_by_name, created_at`,
      [
        id,
        filename,
        mimetype || null,
        buffer.length,
        buffer,
        auth?.id ?? null,
        auth?.full_name ?? auth?.email ?? null
      ]
    );
    await recordAuditLog({ entityType: 'customer_document', entityId: document.id, action: 'create', req, after: document });
    res.status(201).json({ document });
  })
);

app.get(
  '/api/customers/:customerId/documents/:documentId/download',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { customerId, documentId } = req.params;
    const [document] = await run<{ filename: string; mimetype: string | null; file_data: Buffer | null }>(
      `select filename, mimetype, file_data from customer_documents where id = $1 and customer_id = $2`,
      [documentId, customerId]
    );
    if (!document || !document.file_data) {
      return res.status(404).json({ message: 'Document introuvable' });
    }
    res.setHeader('Content-Type', document.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.send(document.file_data);
  })
);

app.delete(
  '/api/customers/:customerId/documents/:documentId',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { customerId, documentId } = req.params;
    const [document] = await run(
      `delete from customer_documents where id = $1 and customer_id = $2
       returning id, filename, mimetype, size, uploaded_by, uploaded_by_name, created_at`,
      [documentId, customerId]
    );
    if (!document) {
      return res.status(404).json({ message: 'Document introuvable' });
    }
    await recordAuditLog({ entityType: 'customer_document', entityId: documentId, action: 'delete', req, before: document });
    res.json({ message: 'Document supprimé' });
  })
);

app.get(
  '/api/audit-logs',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const entityType = (req.query.entity_type as string) ?? null;
    const entityId = (req.query.entity_id as string) ?? null;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    if (!entityType) {
      return res.status(400).json({ message: 'Paramètre entity_type requis' });
    }
    const params: unknown[] = [entityType];
    let sql = `select id, entity_type, entity_id, action, changed_by, changed_by_name, before_data, after_data, created_at
               from audit_logs
               where entity_type = $1`;
    if (entityId) {
      params.push(entityId);
      sql += ` and entity_id = $${params.length}`;
    }
    sql += ' order by created_at desc limit $' + (params.length + 1);
    params.push(limit);
    const logs = await run(sql, params);
    res.json(logs);
  })
);

// ==================== ENDPOINTS VÉHICULES ====================
app.get(
  '/api/vehicles',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const rows = await run<{
      id: string;
      internal_number: string | null;
      plate_number: string | null;
      created_at: string;
    }>('select * from vehicles order by internal_number nulls last, plate_number nulls last');
    res.json(rows);
  })
);

app.post(
  '/api/vehicles',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { internal_number, plate_number } = req.body as {
      internal_number?: string;
      plate_number?: string;
    };
    if (!internal_number && !plate_number) {
      return res.status(400).json({ message: 'Numéro interne ou plaque d\'immatriculation requis' });
    }
    const id = randomUUID();
    const [vehicle] = await run<{ id: string }>(
      `insert into vehicles (id, internal_number, plate_number)
       values ($1, $2, $3)
       returning id`,
      [id, internal_number || null, plate_number || null]
    );
    res.status(201).json({ id: vehicle.id, message: 'Véhicule créé avec succès' });
  })
);

app.patch(
  '/api/vehicles/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { internal_number, plate_number } = req.body as {
      internal_number?: string;
      plate_number?: string;
    };
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (internal_number !== undefined) {
      updates.push(`internal_number = $${paramIndex++}`);
      params.push(internal_number);
    }
    if (plate_number !== undefined) {
      updates.push(`plate_number = $${paramIndex++}`);
      params.push(plate_number);
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' });
    }
    params.push(id);
    await run(`update vehicles set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Véhicule mis à jour avec succès' });
  })
);

app.delete(
  '/api/vehicles/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from vehicles where id = $1', [id]);
    res.json({ message: 'Véhicule supprimé avec succès' });
  })
);

// ==================== ENDPOINTS INTERVENTIONS ====================
app.get(
  '/api/interventions',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const priority = typeof req.query.priority === 'string' ? req.query.priority : null;
    let sql = `
      select i.*,
             u.full_name as created_by_name,
             e.first_name || ' ' || e.last_name as assigned_to_name
      from interventions i
      left join users u on u.id = i.created_by
      left join employees e on e.id = i.assigned_to
    `;
    const conditions: string[] = [];
    const params: any[] = [];
    if (status) {
      conditions.push(`i.status = $${params.length + 1}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`i.priority = $${params.length + 1}`);
      params.push(priority);
    }
    if (conditions.length) {
      sql += ` where ${conditions.join(' and ')}`;
    }
    sql += ' order by i.created_at desc';
    const rows = await run<{
      id: string;
      customer_id: string | null;
      customer_name: string;
      customer_address: string | null;
      title: string;
      description: string | null;
      status: string;
      priority: string;
      created_by: string | null;
      assigned_to: string | null;
      latitude: number | null;
      longitude: number | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
      created_by_name: string | null;
      assigned_to_name: string | null;
    }>(sql, params);
    res.json(rows);
  })
);

app.patch(
  '/api/interventions/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, priority, assigned_to, notes } = req.body as {
      status?: string;
      priority?: string;
      assigned_to?: string;
      notes?: string;
    };
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(priority);
    }
    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      params.push(assigned_to);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' });
    }
    updates.push(`updated_at = now()`);
    params.push(id);
    await run(`update interventions set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Intervention mise à jour avec succès' });
  })
);

app.delete(
  '/api/interventions/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from interventions where id = $1', [id]);
    res.json({ message: 'Intervention supprimée avec succès' });
  })
);

// ==================== ENDPOINTS ROUTES ====================
app.get(
  '/api/routes',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : null;
    let sql = `
      select r.*,
             v.internal_number,
             v.plate_number
      from routes r
      left join vehicles v on v.id = r.vehicle_id
    `;
    const params: any[] = [];
    if (date) {
      sql += ` where r.date = $1`;
      params.push(date);
    }
    sql += ' order by r.date desc, r.created_at desc';
    const rows = await run<{
      id: string;
      date: string;
      vehicle_id: string | null;
      status: string | null;
      path: any;
      created_at: string;
      internal_number: string | null;
      plate_number: string | null;
    }>(sql, params);
    res.json(rows);
  })
);

app.post(
  '/api/routes',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { date, vehicle_id, status, path } = req.body as {
      date: string;
      vehicle_id?: string;
      status?: string;
      path?: Array<[number, number]>;
    };
    if (!date) {
      return res.status(400).json({ message: 'Date requise' });
    }
    const id = randomUUID();
    const [route] = await run<{ id: string }>(
      `insert into routes (id, date, vehicle_id, status, path)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [id, date, vehicle_id || null, status || 'pending', path ? JSON.stringify(path) : null]
    );
    res.status(201).json({ id: route.id, message: 'Route créée avec succès' });
  })
);

app.patch(
  '/api/routes/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { date, vehicle_id, status, path } = req.body as {
      date?: string;
      vehicle_id?: string;
      status?: string;
      path?: Array<[number, number]>;
    };
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (date !== undefined) {
      updates.push(`date = $${paramIndex++}`);
      params.push(date);
    }
    if (vehicle_id !== undefined) {
      updates.push(`vehicle_id = $${paramIndex++}`);
      params.push(vehicle_id);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (path !== undefined) {
      updates.push(`path = $${paramIndex++}`);
      params.push(JSON.stringify(path));
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' });
    }
    params.push(id);
    await run(`update routes set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Route mise à jour avec succès' });
  })
);

app.post(
  '/api/routes/:id/optimize',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['optimize_routes', 'edit_routes'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { apply, startTime } = (req.body ?? {}) as { apply?: boolean; startTime?: string };

    const [route] = await run<{ id: string; date: string }>('select id, date from routes where id = $1', [id]);
    if (!route) {
      return res.status(404).json({ message: 'Route introuvable' });
    }

    const stops = await run<
      OptimizationStopRow & {
        customer_address: string | null;
        latitude: number | null;
        longitude: number | null;
      }
    >(
      `select rs.id,
              rs.order_index,
              rs.notes,
              c.name as customer_name,
              c.address as customer_address,
              c.latitude,
              c.longitude,
              c.risk_level
       from route_stops rs
       left join customers c on c.id = rs.customer_id
       where rs.route_id = $1
       order by rs.order_index`,
      [id]
    );

    if (stops.length < 2) {
      return res.status(400).json({ message: 'Au moins deux arrêts sont requis pour optimiser la tournée' });
    }

    const withCoords = stops.filter((stop) => stop.latitude !== null && stop.longitude !== null) as OptimizationStopRow[];
    if (withCoords.length < 2) {
      return res.status(400).json({
        message: 'Coordonnées insuffisantes pour optimiser cette tournée. Complétez les adresses clients.'
      });
    }

    let optimization: OptimizationComputationResult;
    try {
      optimization = await buildOsrmOptimization(withCoords, route.date, startTime);
    } catch (error) {
      console.warn('OSRM optimization failed, fallback to heuristic', error);
      optimization = buildHeuristicOptimization(withCoords, route.date, startTime);
    }

    const missingStops = stops.filter((stop) => stop.latitude === null || stop.longitude === null);
    const suggestionWithMissing = [...optimization.suggestedStops];
    missingStops.forEach((stop, index) => {
      suggestionWithMissing.push({
        stop_id: stop.id,
        customer_name: stop.customer_name,
        previous_order: stop.order_index,
        suggested_order: suggestionWithMissing.length + 1,
        eta: null,
        distance_km: 0,
        travel_minutes: 0,
        traffic_factor: 1,
        traffic_label: 'Coordonnées manquantes'
      });
    });

    let applied = false;
    if (apply) {
      const orderedIds = suggestionWithMissing.map((stop) => stop.stop_id);
      await Promise.all(
        orderedIds.map((stopId, index) => run('update route_stops set order_index = $1 where id = $2', [index, stopId]))
      );
      applied = true;
    }

    return res.json({
      applied,
      suggestedStops: suggestionWithMissing,
      missingStops: missingStops.map((stop) => ({ id: stop.id, name: stop.customer_name })),
      totalDistanceKm: optimization.totalDistanceKm,
      totalDurationMin: optimization.totalDurationMin,
      trafficNotes: optimization.trafficNotes
    });
  })
);

// ==================== PDF Templates ====================
app.get(
  '/api/pdf-templates',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_pdf_templates', 'view_pdf_templates'] }),
  asyncHandler(async (_req, res) => {
    const rows = await run<
      PdfTemplateRow & {
        updated_by_name: string | null;
      }
    >(
      `select t.id,
              t.module,
              t.config,
              t.updated_at,
              t.updated_by,
              u.full_name as updated_by_name
       from pdf_templates t
       left join users u on u.id = t.updated_by`
    );
    const map = new Map<string, PdfTemplateRow>();
    rows.forEach((row) => {
      map.set(row.module, {
        ...row,
        config: mergeTemplateConfig(row.module, row.config)
      });
    });
    const modules = new Set<string>([
      ...Object.keys(DEFAULT_PDF_TEMPLATES),
      ...Array.from(map.keys())
    ]);
    const data = Array.from(modules).map((module) => {
      const row = map.get(module);
      if (row) {
        return row;
      }
      return {
        id: '',
        module,
        config: mergeTemplateConfig(module),
        updated_at: null,
        updated_by: null,
        updated_by_name: null
      };
    });
    res.json(data);
  })
);

app.get(
  '/api/pdf-templates/:module',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_pdf_templates', 'view_pdf_templates'] }),
  asyncHandler(async (req, res) => {
    const module = req.params.module;
    const template = await getPdfTemplate(module);
    res.json(template);
  })
);

app.put(
  '/api/pdf-templates/:module',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_pdf_templates'] }),
  asyncHandler(async (req, res) => {
    const module = req.params.module;
    const config = (req.body?.config ?? {}) as PdfTemplateConfig;
    if (config.headerLogo && !config.headerLogo.startsWith('data:') && !config.headerLogo.startsWith('http')) {
      return res.status(400).json({ message: 'Logo invalide (utiliser data URL ou lien http)' });
    }
    if (config.footerLogo && !config.footerLogo.startsWith('data:') && !config.footerLogo.startsWith('http')) {
      return res.status(400).json({ message: 'Logo invalide (utiliser data URL ou lien http)' });
    }
    const template = await upsertPdfTemplate(module, config, (req as AuthenticatedRequest).auth?.id);
    res.json(template);
  })
);

app.delete(
  '/api/routes/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from routes where id = $1', [id]);
    res.json({ message: 'Route supprimée avec succès' });
  })
);

// ==================== ENDPOINTS ARRÊTS DE ROUTE ====================
app.get(
  '/api/route-stops',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const route_id = typeof req.query.route_id === 'string' ? req.query.route_id : null;
    if (!route_id) {
      return res.status(400).json({ message: 'Route ID requis' });
    }
    const rows = await run<{
      id: string;
      route_id: string;
      customer_id: string | null;
      order_index: number;
      estimated_time: string | null;
      status: string | null;
      notes: string | null;
      completed_at: string | null;
      customer_name: string | null;
      customer_address: string | null;
      latitude: number | null;
      longitude: number | null;
      risk_level: string | null;
    }>(
      `select rs.*, c.name as customer_name, c.address as customer_address, c.latitude, c.longitude, c.risk_level
       from route_stops rs
       left join customers c on c.id = rs.customer_id
       where rs.route_id = $1
       order by rs.order_index`,
      [route_id]
    );
    res.json(rows);
  })
);

app.post(
  '/api/route-stops',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { route_id, customer_id, order_index, estimated_time, notes } = req.body as {
      route_id: string;
      customer_id?: string;
      order_index: number;
      estimated_time?: string;
      notes?: string;
    };
    if (!route_id) {
      return res.status(400).json({ message: 'Route ID requis' });
    }
    const id = randomUUID();
    const [stop] = await run<{ id: string }>(
      `insert into route_stops (id, route_id, customer_id, order_index, estimated_time, notes, status)
       values ($1, $2, $3, $4, $5, $6, 'pending')
       returning id`,
      [id, route_id, customer_id || null, order_index, estimated_time || null, notes || null]
    );
    res.status(201).json({ id: stop.id, message: 'Arrêt créé avec succès' });
  })
);

app.patch(
  '/api/route-stops/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { customer_id, order_index, estimated_time, status, notes, completed_at } = req.body as {
      customer_id?: string;
      order_index?: number;
      estimated_time?: string;
      status?: string;
      notes?: string;
      completed_at?: string;
    };
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (customer_id !== undefined) {
      updates.push(`customer_id = $${paramIndex++}`);
      params.push(customer_id);
    }
    if (order_index !== undefined) {
      updates.push(`order_index = $${paramIndex++}`);
      params.push(order_index);
    }
    if (estimated_time !== undefined) {
      updates.push(`estimated_time = $${paramIndex++}`);
      params.push(estimated_time);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }
    if (completed_at !== undefined) {
      updates.push(`completed_at = $${paramIndex++}`);
      params.push(completed_at);
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' });
    }
    params.push(id);
    await run(`update route_stops set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Arrêt mis à jour avec succès' });
  })
);

app.delete(
  '/api/route-stops/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from route_stops where id = $1', [id]);
    res.json({ message: 'Arrêt supprimé avec succès' });
  })
);

app.post(
  '/api/expeditions/send',
  asyncHandler(async (req, res) => {
    const { dateRange, pdfBase64, pdfFilename } = req.body as ExpeditionEmailPayload;

    if (!pdfBase64) {
      return res.status(400).json({ message: 'PDF manquant' });
    }

    const recipients =
      (process.env.DECLASSEMENT_RECIPIENTS || process.env.BREVO_SENDER_EMAIL || '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
    if (!recipients.length) {
      return res.status(500).json({ message: 'Aucun destinataire configuré' });
    }

    const textBody = [
      `Planification des expéditions générée le : ${new Date().toLocaleString('fr-CH')}`,
      `Période : ${dateRange || '—'}`,
      '',
      'Le planning PDF est joint à cet e-mail.'
    ].join('\n');

    await sendBrevoEmail({
      to: recipients,
      subject: `Expéditions - ${dateRange || 'Nouveau planning'}`,
      text: textBody,
      attachments: [
        {
          name: pdfFilename || `expeditions_${Date.now()}.pdf`,
          content: pdfBase64,
          type: 'application/pdf'
        }
      ]
    });

    res.json({ message: 'Email envoyé' });
  })
);

function parseDateUtc(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const str = String(value);
  const normalized = str.includes('T') ? str : `${str}T00:00:00Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function countBusinessDays(start: Date, end: Date): number {
  if (end < start) {
    return 0;
  }
  let count = 0;
  const current = new Date(start.getTime());
  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

function calculateYearsSince(dateStr: string | null | undefined, referenceDate: Date): number {
  const parsed = parseDateUtc(dateStr);
  if (!parsed) return 0;
  return differenceInYears(referenceDate, parsed);
}

function calculateAnnualEntitlement(employee: EmployeeRow, year: number): number {
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  let baseDays = 20;
  const age = calculateYearsSince(employee.birth_date, yearEnd);
  const seniority = calculateYearsSince(employee.start_date, yearEnd);
  if (age >= 50 || seniority >= 20) {
    baseDays = 25;
  }

  const startDate = parseDateUtc(employee.start_date);
  if (startDate) {
    const startYear = startDate.getUTCFullYear();
    if (startYear > year) {
      return 0;
    }
    if (startYear === year) {
      const monthsRemaining = 12 - startDate.getUTCMonth();
      const prorated = (baseDays * monthsRemaining) / 12;
      return Math.round(prorated * 100) / 100;
    }
  }

  return baseDays;
}

// Endpoints pour la gestion des configurations d'inventaire

// GET /api/inventory-config/materials - Récupérer toutes les matières configurées
app.get(
  '/api/inventory-config/materials',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  async (req, res) => {
    try {
      const { category, include_inactive } = req.query;
      let query = 'select * from inventory_materials';
      const params: any[] = [];
      const conditions: string[] = [];
      let paramIndex = 1;
      
      if (category) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(category);
      }
      
      if (include_inactive !== 'true') {
        conditions.push('is_active = true');
      }
      
      if (conditions.length > 0) {
        query += ' where ' + conditions.join(' and ');
      }
      
      query += ' order by category, display_order, matiere';
      
      const materials = await run(query, params);
      res.json(materials);
    } catch (error: any) {
      console.error('Error fetching inventory materials:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/inventory-config/materials - Créer une nouvelle matière
app.post(
  '/api/inventory-config/materials',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { category, matiere, num, display_order } = req.body;
      if (!category || !matiere) {
        return res.status(400).json({ error: 'Category et matiere sont requis' });
      }
      
      const [result] = await run(
        `insert into inventory_materials (id, category, matiere, num, display_order)
         values (gen_random_uuid(), $1, $2, $3, $4)
         returning *`,
        [category, matiere, num || null, display_order || 0]
      );
      res.json(result);
    } catch (error: any) {
      console.error('Error creating inventory material:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/inventory-config/materials/:id - Modifier une matière
app.patch(
  '/api/inventory-config/materials/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (req.body.category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        values.push(req.body.category);
      }
      if (req.body.matiere !== undefined) {
        updates.push(`matiere = $${paramIndex++}`);
        values.push(req.body.matiere);
      }
      if (req.body.num !== undefined) {
        updates.push(`num = $${paramIndex++}`);
        values.push(req.body.num);
      }
      if (req.body.display_order !== undefined) {
        updates.push(`display_order = $${paramIndex++}`);
        values.push(req.body.display_order);
      }
      if (req.body.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(req.body.is_active);
      }
      
      updates.push(`updated_at = now()`);
      values.push(id);
      
      const [result] = await run(
        `update inventory_materials set ${updates.join(', ')} where id = $${paramIndex} returning *`,
        values
      );
      
      if (!result) {
        return res.status(404).json({ error: 'Matière introuvable' });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Error updating inventory material:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/inventory-config/materials/:id - Supprimer une matière (soft delete par défaut, permanent si ?permanent=true)
app.delete(
  '/api/inventory-config/materials/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent } = req.query;
      
      if (permanent === 'true') {
        // Suppression définitive
        await run('delete from inventory_materials where id = $1', [id]);
        res.json({ message: 'Matière supprimée définitivement' });
      } else {
        // Soft delete
        const [result] = await run(
          'update inventory_materials set is_active = false, updated_at = now() where id = $1 returning *',
          [id]
        );
        
        if (!result) {
          return res.status(404).json({ error: 'Matière introuvable' });
        }
        
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error deleting inventory material:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/inventory-config/machines - Récupérer toutes les machines
app.get(
  '/api/inventory-config/machines',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  async (req, res) => {
    try {
      const { include_inactive } = req.query;
      let query = 'select * from inventory_machines';
      if (include_inactive !== 'true') {
        query += ' where is_active = true';
      }
      query += ' order by display_order, num1';
      const machines = await run(query);
      res.json(machines);
    } catch (error: any) {
      console.error('Error fetching inventory machines:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/inventory-config/machines - Créer une nouvelle machine
app.post(
  '/api/inventory-config/machines',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { num1, mac, display_order } = req.body;
      if (!num1 || !mac) {
        return res.status(400).json({ error: 'num1 et mac sont requis' });
      }
      
      const [result] = await run(
        `insert into inventory_machines (id, num1, mac, display_order)
         values (gen_random_uuid(), $1, $2, $3)
         returning *`,
        [num1, mac, display_order || 0]
      );
      res.json(result);
    } catch (error: any) {
      console.error('Error creating inventory machine:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/inventory-config/machines/:id - Modifier une machine
app.patch(
  '/api/inventory-config/machines/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (req.body.num1 !== undefined) {
        updates.push(`num1 = $${paramIndex++}`);
        values.push(req.body.num1);
      }
      if (req.body.mac !== undefined) {
        updates.push(`mac = $${paramIndex++}`);
        values.push(req.body.mac);
      }
      if (req.body.display_order !== undefined) {
        updates.push(`display_order = $${paramIndex++}`);
        values.push(req.body.display_order);
      }
      if (req.body.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(req.body.is_active);
      }
      
      updates.push(`updated_at = now()`);
      values.push(id);
      
      const [result] = await run(
        `update inventory_machines set ${updates.join(', ')} where id = $${paramIndex} returning *`,
        values
      );
      
      if (!result) {
        return res.status(404).json({ error: 'Machine introuvable' });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Error updating inventory machine:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/inventory-config/machines/:id - Supprimer une machine
app.delete(
  '/api/inventory-config/machines/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent } = req.query;
      
      if (permanent === 'true') {
        await run('delete from inventory_machines where id = $1', [id]);
        res.json({ message: 'Machine supprimée définitivement' });
      } else {
        const [result] = await run(
          'update inventory_machines set is_active = false, updated_at = now() where id = $1 returning *',
          [id]
        );
        
        if (!result) {
          return res.status(404).json({ error: 'Machine introuvable' });
        }
        
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error deleting inventory machine:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/inventory-config/containers - Récupérer tous les conteneurs
app.get(
  '/api/inventory-config/containers',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  async (req, res) => {
    try {
      const { include_inactive } = req.query;
      let query = 'select * from inventory_containers';
      if (include_inactive !== 'true') {
        query += ' where is_active = true';
      }
      query += ' order by display_order, type';
      const containers = await run(query);
      res.json(containers);
    } catch (error: any) {
      console.error('Error fetching inventory containers:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/inventory-config/containers - Créer un nouveau conteneur
app.post(
  '/api/inventory-config/containers',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { type, display_order } = req.body;
      if (!type) {
        return res.status(400).json({ error: 'type est requis' });
      }
      
      const [result] = await run(
        `insert into inventory_containers (id, type, display_order)
         values (gen_random_uuid(), $1, $2)
         returning *`,
        [type, display_order || 0]
      );
      res.json(result);
    } catch (error: any) {
      console.error('Error creating inventory container:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/inventory-config/containers/:id - Modifier un conteneur
app.patch(
  '/api/inventory-config/containers/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (req.body.type !== undefined) {
        updates.push(`type = $${paramIndex++}`);
        values.push(req.body.type);
      }
      if (req.body.display_order !== undefined) {
        updates.push(`display_order = $${paramIndex++}`);
        values.push(req.body.display_order);
      }
      if (req.body.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(req.body.is_active);
      }
      
      updates.push(`updated_at = now()`);
      values.push(id);
      
      const [result] = await run(
        `update inventory_containers set ${updates.join(', ')} where id = $${paramIndex} returning *`,
        values
      );
      
      if (!result) {
        return res.status(404).json({ error: 'Conteneur introuvable' });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Error updating inventory container:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/inventory-config/containers/:id - Supprimer un conteneur
app.delete(
  '/api/inventory-config/containers/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent } = req.query;
      
      if (permanent === 'true') {
        await run('delete from inventory_containers where id = $1', [id]);
        res.json({ message: 'Conteneur supprimé définitivement' });
      } else {
        const [result] = await run(
          'update inventory_containers set is_active = false, updated_at = now() where id = $1 returning *',
          [id]
        );
        
        if (!result) {
          return res.status(404).json({ error: 'Conteneur introuvable' });
        }
        
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error deleting inventory container:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/inventory-config/bags - Récupérer tous les sacs
app.get(
  '/api/inventory-config/bags',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  async (req, res) => {
    try {
      const { include_inactive } = req.query;
      let query = 'select * from inventory_bags';
      if (include_inactive !== 'true') {
        query += ' where is_active = true';
      }
      query += ' order by display_order, type';
      const bags = await run(query);
      res.json(bags);
    } catch (error: any) {
      console.error('Error fetching inventory bags:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/inventory-config/bags - Créer un nouveau sac
app.post(
  '/api/inventory-config/bags',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { type, display_order } = req.body;
      if (!type) {
        return res.status(400).json({ error: 'type est requis' });
      }
      
      const [result] = await run(
        `insert into inventory_bags (id, type, display_order)
         values (gen_random_uuid(), $1, $2)
         returning *`,
        [type, display_order || 0]
      );
      res.json(result);
    } catch (error: any) {
      console.error('Error creating inventory bag:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/inventory-config/bags/:id - Modifier un sac
app.patch(
  '/api/inventory-config/bags/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (req.body.type !== undefined) {
        updates.push(`type = $${paramIndex++}`);
        values.push(req.body.type);
      }
      if (req.body.display_order !== undefined) {
        updates.push(`display_order = $${paramIndex++}`);
        values.push(req.body.display_order);
      }
      if (req.body.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(req.body.is_active);
      }
      
      updates.push(`updated_at = now()`);
      values.push(id);
      
      const [result] = await run(
        `update inventory_bags set ${updates.join(', ')} where id = $${paramIndex} returning *`,
        values
      );
      
      if (!result) {
        return res.status(404).json({ error: 'Sac introuvable' });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Error updating inventory bag:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/inventory-config/bags/:id - Supprimer un sac
app.delete(
  '/api/inventory-config/bags/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent } = req.query;
      
      if (permanent === 'true') {
        await run('delete from inventory_bags where id = $1', [id]);
        res.json({ message: 'Sac supprimé définitivement' });
      } else {
        const [result] = await run(
          'update inventory_bags set is_active = false, updated_at = now() where id = $1 returning *',
          [id]
        );
        
        if (!result) {
          return res.status(404).json({ error: 'Sac introuvable' });
        }
        
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error deleting inventory bag:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/inventory-config/other-items - Récupérer tous les autres éléments
app.get(
  '/api/inventory-config/other-items',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  async (req, res) => {
    try {
      const { category, include_inactive } = req.query;
      let query = 'select * from inventory_other_items';
      const params: any[] = [];
      const conditions: string[] = [];
      let paramIndex = 1;
      
      if (category) {
        conditions.push(`category = $${paramIndex++}`);
        params.push(category);
      }
      
      if (include_inactive !== 'true') {
        conditions.push('is_active = true');
      }
      
      if (conditions.length > 0) {
        query += ' where ' + conditions.join(' and ');
      }
      
      query += ' order by category, display_order, label';
      
      const items = await run(query, params);
      res.json(items);
    } catch (error: any) {
      console.error('Error fetching inventory other items:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/inventory-config/other-items - Créer un nouvel élément
app.post(
  '/api/inventory-config/other-items',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { category, subcategory, label, unit1, unit2, default_value1, default_value2, display_order } = req.body;
      if (!category || !label) {
        return res.status(400).json({ error: 'category et label sont requis' });
      }
      
      const [result] = await run(
        `insert into inventory_other_items (id, category, subcategory, label, unit1, unit2, default_value1, default_value2, display_order)
         values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [category, subcategory || null, label, unit1 || null, unit2 || null, default_value1 || 0, default_value2 || 0, display_order || 0]
      );
      res.json(result);
    } catch (error: any) {
      console.error('Error creating inventory other item:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/inventory-config/other-items/:id - Modifier un élément
app.patch(
  '/api/inventory-config/other-items/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (req.body.category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        values.push(req.body.category);
      }
      if (req.body.subcategory !== undefined) {
        updates.push(`subcategory = $${paramIndex++}`);
        values.push(req.body.subcategory);
      }
      if (req.body.label !== undefined) {
        updates.push(`label = $${paramIndex++}`);
        values.push(req.body.label);
      }
      if (req.body.unit1 !== undefined) {
        updates.push(`unit1 = $${paramIndex++}`);
        values.push(req.body.unit1);
      }
      if (req.body.unit2 !== undefined) {
        updates.push(`unit2 = $${paramIndex++}`);
        values.push(req.body.unit2);
      }
      if (req.body.default_value1 !== undefined) {
        updates.push(`default_value1 = $${paramIndex++}`);
        values.push(req.body.default_value1);
      }
      if (req.body.default_value2 !== undefined) {
        updates.push(`default_value2 = $${paramIndex++}`);
        values.push(req.body.default_value2);
      }
      if (req.body.display_order !== undefined) {
        updates.push(`display_order = $${paramIndex++}`);
        values.push(req.body.display_order);
      }
      if (req.body.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(req.body.is_active);
      }
      
      updates.push(`updated_at = now()`);
      values.push(id);
      
      const [result] = await run(
        `update inventory_other_items set ${updates.join(', ')} where id = $${paramIndex} returning *`,
        values
      );
      
      if (!result) {
        return res.status(404).json({ error: 'Élément introuvable' });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Error updating inventory other item:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/inventory-config/other-items/:id - Supprimer un élément
app.delete(
  '/api/inventory-config/other-items/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent } = req.query;
      
      if (permanent === 'true') {
        await run('delete from inventory_other_items where id = $1', [id]);
        res.json({ message: 'Élément supprimé définitivement' });
      } else {
        const [result] = await run(
          'update inventory_other_items set is_active = false, updated_at = now() where id = $1 returning *',
          [id]
        );
        
        if (!result) {
          return res.status(404).json({ error: 'Élément introuvable' });
        }
        
        res.json(result);
      }
    } catch (error: any) {
      console.error('Error deleting inventory other item:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Endpoints pour sauvegarder et charger les inventaires

// GET /api/inventory-snapshots - Récupérer les inventaires (avec filtres optionnels)
app.get(
  '/api/inventory-snapshots',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  async (req, res) => {
    try {
      const { year, month, limit } = req.query;
      let query = 'select * from inventory_snapshots where 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (year) {
        query += ` and extract(year from report_date) = $${paramIndex++}`;
        params.push(parseInt(year as string));
      }
      if (month) {
        query += ` and extract(month from report_date) = $${paramIndex++}`;
        params.push(parseInt(month as string));
      }
      
      query += ' order by report_date desc, created_at desc';
      
      if (limit) {
        query += ` limit $${paramIndex++}`;
        params.push(parseInt(limit as string));
      }
      
      const snapshots = await run(query, params);
      res.json(snapshots);
    } catch (error: any) {
      console.error('Error fetching inventory snapshots:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/inventory-snapshots/:id - Récupérer un inventaire spécifique
app.get(
  '/api/inventory-snapshots/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [snapshot] = await run('select * from inventory_snapshots where id = $1', [id]);
      
      if (!snapshot) {
        return res.status(404).json({ error: 'Inventaire introuvable' });
      }
      
      res.json(snapshot);
    } catch (error: any) {
      console.error('Error fetching inventory snapshot:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/inventory-snapshots - Créer un nouvel inventaire
app.post(
  '/api/inventory-snapshots',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const {
        report_date,
        report_date_label,
        halle_data,
        plastique_b_data,
        cdt_data,
        papier_data,
        machines_data,
        autres_data,
        containers_data,
        bags_data
      } = req.body;
      
      if (!report_date || !halle_data || !plastique_b_data || !cdt_data || !papier_data || !machines_data || !autres_data || !containers_data || !bags_data) {
        return res.status(400).json({ error: 'Toutes les données sont requises' });
      }
      
      const createdBy = authReq.auth?.id || null;
      const createdByName = authReq.auth?.full_name || null;
      
      const [result] = await run(
        `insert into inventory_snapshots (
          id, report_date, report_date_label, halle_data, plastique_b_data, cdt_data, 
          papier_data, machines_data, autres_data, containers_data, bags_data,
          created_by, created_by_name
        )
        values (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        returning *`,
        [
          report_date,
          report_date_label || null,
          JSON.stringify(halle_data),
          JSON.stringify(plastique_b_data),
          JSON.stringify(cdt_data),
          JSON.stringify(papier_data),
          JSON.stringify(machines_data),
          JSON.stringify(autres_data),
          JSON.stringify(containers_data),
          JSON.stringify(bags_data),
          createdBy,
          createdByName
        ]
      );
      
      res.json(result);
    } catch (error: any) {
      console.error('Error creating inventory snapshot:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/inventory-snapshots/:id - Modifier un inventaire
app.patch(
  '/api/inventory-snapshots/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (req.body.report_date !== undefined) {
        updates.push(`report_date = $${paramIndex++}`);
        values.push(req.body.report_date);
      }
      if (req.body.report_date_label !== undefined) {
        updates.push(`report_date_label = $${paramIndex++}`);
        values.push(req.body.report_date_label);
      }
      if (req.body.halle_data !== undefined) {
        updates.push(`halle_data = $${paramIndex++}`);
        values.push(JSON.stringify(req.body.halle_data));
      }
      if (req.body.plastique_b_data !== undefined) {
        updates.push(`plastique_b_data = $${paramIndex++}`);
        values.push(JSON.stringify(req.body.plastique_b_data));
      }
      if (req.body.cdt_data !== undefined) {
        updates.push(`cdt_data = $${paramIndex++}`);
        values.push(JSON.stringify(req.body.cdt_data));
      }
      if (req.body.papier_data !== undefined) {
        updates.push(`papier_data = $${paramIndex++}`);
        values.push(JSON.stringify(req.body.papier_data));
      }
      if (req.body.machines_data !== undefined) {
        updates.push(`machines_data = $${paramIndex++}`);
        values.push(JSON.stringify(req.body.machines_data));
      }
      if (req.body.autres_data !== undefined) {
        updates.push(`autres_data = $${paramIndex++}`);
        values.push(JSON.stringify(req.body.autres_data));
      }
      if (req.body.containers_data !== undefined) {
        updates.push(`containers_data = $${paramIndex++}`);
        values.push(JSON.stringify(req.body.containers_data));
      }
      if (req.body.bags_data !== undefined) {
        updates.push(`bags_data = $${paramIndex++}`);
        values.push(JSON.stringify(req.body.bags_data));
      }
      
      updates.push(`updated_at = now()`);
      values.push(id);
      
      const [result] = await run(
        `update inventory_snapshots set ${updates.join(', ')} where id = $${paramIndex} returning *`,
        values
      );
      
      if (!result) {
        return res.status(404).json({ error: 'Inventaire introuvable' });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Error updating inventory snapshot:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/inventory-snapshots/:id - Supprimer un inventaire
app.delete(
  '/api/inventory-snapshots/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  async (req, res) => {
    try {
      const { id } = req.params;
      await run('delete from inventory_snapshots where id = $1', [id]);
      res.json({ message: 'Inventaire supprimé avec succès' });
    } catch (error: any) {
      console.error('Error deleting inventory snapshot:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================
// ENDPOINTS GESTION FINANCIÈRE
// ============================================

// GET /api/invoices - Liste des factures
app.get(
  '/api/invoices',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { status, customer_id, start_date, end_date } = req.query;
    let query = `
      select 
        i.*,
        c.name as customer_name_full,
        coalesce((
          select sum(p.amount) 
          from payments p 
          where p.invoice_id = i.id
        ), 0) as total_paid,
        (i.total_amount - coalesce((
          select sum(p.amount) 
          from payments p 
          where p.invoice_id = i.id
        ), 0)) as remaining_amount
      from invoices i
      left join customers c on c.id = i.customer_id
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` and i.status = $${paramIndex++}`;
      params.push(status);
    }
    if (customer_id) {
      query += ` and i.customer_id = $${paramIndex++}`;
      params.push(customer_id);
    }
    if (start_date) {
      query += ` and i.issue_date >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` and i.issue_date <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ` order by i.issue_date desc, i.invoice_number desc`;

    const invoices = await run(query, params);
    res.json(invoices);
  })
);

// GET /api/invoices/:id - Détails d'une facture avec lignes
app.get(
  '/api/invoices/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [invoice] = await run('select * from invoices where id = $1', [id]);
    if (!invoice) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }
    const lines = await run('select * from invoice_lines where invoice_id = $1 order by line_number', [id]);
    const payments = await run('select * from payments where invoice_id = $1 order by payment_date desc', [id]);
    res.json({ ...invoice, lines, payments });
  })
);

// POST /api/invoices - Créer une facture
app.post(
  '/api/invoices',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const {
      customer_id,
      customer_name,
      customer_address,
      customer_vat_number,
      issue_date,
      due_date,
      currency,
      payment_terms,
      notes,
      reference,
      lines
    } = req.body;

    if (!customer_name || !issue_date || !due_date || !lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }

    const year = new Date(issue_date).getFullYear();
    const invoiceNumber = await generateInvoiceNumber('FACT', year);

    // Calculer les totaux
    let totalAmount = 0;
    let totalTax = 0;
    lines.forEach((line: any) => {
      const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
      const taxAmount = lineTotal * (Number(line.tax_rate || 0) / 100);
      totalAmount += lineTotal;
      totalTax += taxAmount;
    });

    // Créer la facture
    const [invoice] = await run(
      `
      insert into invoices (
        invoice_number, customer_id, customer_name, customer_address, customer_vat_number,
        issue_date, due_date, total_amount, total_tax, currency, payment_terms, notes, reference,
        created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      returning *
      `,
      [
        invoiceNumber,
        customer_id || null,
        customer_name,
        customer_address || null,
        customer_vat_number || null,
        issue_date,
        due_date,
        totalAmount,
        totalTax,
        currency || 'CHF',
        payment_terms || null,
        notes || null,
        reference || null,
        user.id,
        user.full_name || user.email
      ]
    );

    // Créer les lignes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
      await run(
        `
        insert into invoice_lines (
          invoice_id, line_number, material_id, material_description,
          quantity, unit, unit_price, tax_rate, total_amount, notes
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          invoice.id,
          i + 1,
          line.material_id || null,
          line.material_description || '',
          line.quantity,
          line.unit || 'unité',
          line.unit_price,
          line.tax_rate || 0,
          lineTotal,
          line.notes || null
        ]
      );
    }

    res.json({ invoice, message: 'Facture créée avec succès' });
  })
);

// PATCH /api/invoices/:id - Mettre à jour une facture
app.patch(
  '/api/invoices/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'customer_id',
      'customer_name',
      'customer_address',
      'customer_vat_number',
      'status',
      'issue_date',
      'due_date',
      'paid_date',
      'currency',
      'payment_terms',
      'notes',
      'reference'
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    updates.push(`updated_at = now()`);
    params.push(id);
    await run(`update invoices set ${updates.join(', ')} where id = $${paramIndex}`, params);

    // Si le statut change à "paid", mettre à jour paid_date si nécessaire
    if (req.body.status === 'paid' && !req.body.paid_date) {
      await run(`update invoices set paid_date = current_date where id = $1`, [id]);
    }

    res.json({ message: 'Facture mise à jour avec succès' });
  })
);

// DELETE /api/invoices/:id - Supprimer une facture (soft delete)
app.delete(
  '/api/invoices/:id',
  requireAuth({ roles: ['admin'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run(`update invoices set status = 'cancelled' where id = $1`, [id]);
    res.json({ message: 'Facture annulée avec succès' });
  })
);

// GET /api/quotes - Liste des devis
app.get(
  '/api/quotes',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { status, customer_id } = req.query;
    let query = 'select * from quotes where 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` and status = $${paramIndex++}`;
      params.push(status);
    }
    if (customer_id) {
      query += ` and customer_id = $${paramIndex++}`;
      params.push(customer_id);
    }

    query += ' order by issue_date desc, quote_number desc';
    const quotes = await run(query, params);
    res.json(quotes);
  })
);

// GET /api/quotes/:id - Détails d'un devis avec lignes
app.get(
  '/api/quotes/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [quote] = await run('select * from quotes where id = $1', [id]);
    if (!quote) {
      return res.status(404).json({ error: 'Devis introuvable' });
    }
    const lines = await run('select * from quote_lines where quote_id = $1 order by line_number', [id]);
    res.json({ ...quote, lines });
  })
);

// POST /api/quotes - Créer un devis
app.post(
  '/api/quotes',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const {
      customer_id,
      customer_name,
      customer_address,
      issue_date,
      expiry_date,
      valid_until,
      currency,
      notes,
      terms,
      lines
    } = req.body;

    if (!customer_name || !issue_date || !lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }

    const year = new Date(issue_date).getFullYear();
    const quoteNumber = await generateQuoteNumber('DEV', year);

    // Calculer les totaux
    let totalAmount = 0;
    let totalTax = 0;
    lines.forEach((line: any) => {
      const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
      const taxAmount = lineTotal * (Number(line.tax_rate || 0) / 100);
      totalAmount += lineTotal;
      totalTax += taxAmount;
    });

    // Créer le devis
    const [quote] = await run(
      `
      insert into quotes (
        quote_number, customer_id, customer_name, customer_address,
        issue_date, expiry_date, valid_until, total_amount, total_tax, currency, notes, terms,
        created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      returning *
      `,
      [
        quoteNumber,
        customer_id || null,
        customer_name,
        customer_address || null,
        issue_date,
        expiry_date || null,
        valid_until || null,
        totalAmount,
        totalTax,
        currency || 'CHF',
        notes || null,
        terms || null,
        user.id,
        user.full_name || user.email
      ]
    );

    // Créer les lignes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
      await run(
        `
        insert into quote_lines (
          quote_id, line_number, material_id, material_description,
          quantity, unit, unit_price, tax_rate, total_amount, notes
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          quote.id,
          i + 1,
          line.material_id || null,
          line.material_description || '',
          line.quantity,
          line.unit || 'unité',
          line.unit_price,
          line.tax_rate || 0,
          lineTotal,
          line.notes || null
        ]
      );
    }

    res.json({ quote, message: 'Devis créé avec succès' });
  })
);

// PATCH /api/quotes/:id - Mettre à jour un devis
app.patch(
  '/api/quotes/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'customer_id',
      'customer_name',
      'customer_address',
      'status',
      'issue_date',
      'expiry_date',
      'valid_until',
      'currency',
      'notes',
      'terms',
      'approved_by',
      'approved_at'
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    updates.push(`updated_at = now()`);
    params.push(id);
    await run(`update quotes set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Devis mis à jour avec succès' });
  })
);

// DELETE /api/quotes/:id - Supprimer un devis
app.delete(
  '/api/quotes/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from quote_lines where quote_id = $1', [id]);
    await run('delete from quotes where id = $1', [id]);
    res.json({ message: 'Devis supprimé avec succès' });
  })
);

// POST /api/payments - Enregistrer un paiement
app.post(
  '/api/payments',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { invoice_id, amount, payment_date, payment_method, reference, notes } = req.body;

    if (!invoice_id || !amount || !payment_date || !payment_method) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }

    // Générer un numéro de paiement
    const year = new Date(payment_date).getFullYear();
    const [lastPayment] = await run<{ max_num: string | null }>(
      `
      select max(
        case 
          when substring(payment_number from '^PAY-${year}-(\\d+)$') is not null
          then substring(payment_number from '^PAY-${year}-(\\d+)$')::integer
          else 0
        end
      ) as max_num
      from payments
      where payment_number like 'PAY-${year}-%'
      `
    );
    const nextNum = (lastPayment?.max_num ? parseInt(lastPayment.max_num) : 0) + 1;
    const paymentNumber = `PAY-${year}-${nextNum.toString().padStart(4, '0')}`;

    // Créer le paiement
    const [payment] = await run(
      `
      insert into payments (
        invoice_id, payment_number, amount, payment_date, payment_method, reference, notes,
        created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        invoice_id,
        paymentNumber,
        amount,
        payment_date,
        payment_method,
        reference || null,
        notes || null,
        user.id,
        user.full_name || user.email
      ]
    );

    // Mettre à jour le montant payé de la facture
    const [invoicePayments] = await run<{ total_paid: number }>(
      `select coalesce(sum(amount), 0) as total_paid from payments where invoice_id = $1`,
      [invoice_id]
    );
    const totalPaid = Number(invoicePayments?.total_paid || 0);

    await run(`update invoices set paid_amount = $1, updated_at = now() where id = $2`, [totalPaid, invoice_id]);

    // Mettre à jour le statut de la facture si entièrement payée
    const [invoice] = await run<{ total_amount: number }>('select total_amount from invoices where id = $1', [invoice_id]);
    if (invoice && totalPaid >= Number(invoice.total_amount)) {
      await run(`update invoices set status = 'paid', paid_date = $1 where id = $2`, [payment_date, invoice_id]);
    } else if (invoice && totalPaid > 0) {
      await run(`update invoices set status = 'sent' where id = $1 and status = 'draft'`, [invoice_id]);
    }

    res.json({ payment, message: 'Paiement enregistré avec succès' });
  })
);

// GET /api/customer-pricing - Liste des tarifs clients
app.get(
  '/api/customer-pricing',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { customer_id, material_id } = req.query;
    let query = `
      select cp.*, c.name as customer_name, m.description as material_description, m.abrege as material_abrege
      from customer_pricing cp
      left join customers c on c.id = cp.customer_id
      left join materials m on m.id = cp.material_id
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (customer_id) {
      query += ` and cp.customer_id = $${paramIndex++}`;
      params.push(customer_id);
    }
    if (material_id) {
      query += ` and cp.material_id = $${paramIndex++}`;
      params.push(material_id);
    }

    query += ' order by cp.valid_from desc';
    const pricing = await run(query, params);
    res.json(pricing);
  })
);

// POST /api/customer-pricing - Créer un tarif client
app.post(
  '/api/customer-pricing',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const {
      customer_id,
      material_id,
      price_per_unit,
      unit,
      min_quantity,
      max_quantity,
      valid_from,
      valid_to,
      contract_reference,
      notes
    } = req.body;

    if (!customer_id || !price_per_unit || !unit || !valid_from) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }

    const [pricing] = await run(
      `
      insert into customer_pricing (
        customer_id, material_id, price_per_unit, unit, min_quantity, max_quantity,
        valid_from, valid_to, contract_reference, notes, created_by
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *
      `,
      [
        customer_id,
        material_id || null,
        price_per_unit,
        unit,
        min_quantity || null,
        max_quantity || null,
        valid_from,
        valid_to || null,
        contract_reference || null,
        notes || null,
        user.id
      ]
    );

    res.json({ pricing, message: 'Tarif créé avec succès' });
  })
);

// GET /api/intervention-costs/:intervention_id - Récupérer les coûts d'une intervention
app.get(
  '/api/intervention-costs/:intervention_id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_interventions'] }),
  asyncHandler(async (req, res) => {
    const { intervention_id } = req.params;
    const [costs] = await run('select * from intervention_costs where intervention_id = $1', [intervention_id]);
    res.json(costs || null);
  })
);

// POST /api/intervention-costs - Calculer/enregistrer les coûts d'une intervention
app.post(
  '/api/intervention-costs',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_interventions'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { intervention_id, fuel_cost, labor_cost, material_cost, other_costs, notes } = req.body;

    if (!intervention_id) {
      return res.status(400).json({ error: 'intervention_id requis' });
    }

    const totalCost = (Number(fuel_cost || 0) + Number(labor_cost || 0) + Number(material_cost || 0) + Number(other_costs || 0));

    // Vérifier si des coûts existent déjà
    const [existing] = await run('select id from intervention_costs where intervention_id = $1', [intervention_id]);

    if (existing) {
      await run(
        `
        update intervention_costs set
          fuel_cost = $1, labor_cost = $2, material_cost = $3, other_costs = $4,
          total_cost = $5, notes = $6, updated_at = now()
        where intervention_id = $7
        `,
        [fuel_cost || 0, labor_cost || 0, material_cost || 0, other_costs || 0, totalCost, notes || null, intervention_id]
      );
      res.json({ message: 'Coûts mis à jour avec succès' });
    } else {
      const [costs] = await run(
        `
        insert into intervention_costs (
          intervention_id, fuel_cost, labor_cost, material_cost, other_costs, total_cost, notes, created_by
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
        `,
        [intervention_id, fuel_cost || 0, labor_cost || 0, material_cost || 0, other_costs || 0, totalCost, notes || null, user.id]
      );
      res.json({ costs, message: 'Coûts enregistrés avec succès' });
    }
  })
);

// Stock Management Endpoints
// GET /api/stock/warehouses - Liste des entrepôts
app.get(
  '/api/stock/warehouses',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const warehouses = await run('select * from warehouses order by code');
    res.json(warehouses);
  })
);

// POST /api/stock/warehouses - Créer un entrepôt
app.post(
  '/api/stock/warehouses',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { code, name, address, location, latitude, longitude, is_depot, notes } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Code et nom requis' });
    }
    const [warehouse] = await run(
      'insert into warehouses (code, name, address, location, latitude, longitude, is_depot, notes) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *',
      [code, name, address || null, location || null, latitude || null, longitude || null, is_depot || false, notes || null]
    );
    res.status(201).json({ warehouse, message: 'Entrepôt créé avec succès' });
  })
);

// PATCH /api/stock/warehouses/:id - Mettre à jour un entrepôt
app.patch(
  '/api/stock/warehouses/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const allowedFields = ['code', 'name', 'address', 'location', 'latitude', 'longitude', 'is_depot', 'is_active', 'notes'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update warehouses set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Entrepôt mis à jour avec succès' });
  })
);

// DELETE /api/stock/warehouses/:id - Supprimer un entrepôt
app.delete(
  '/api/stock/warehouses/:id',
  requireAuth({ roles: ['admin'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from warehouses where id = $1', [id]);
    res.json({ message: 'Entrepôt supprimé avec succès' });
  })
);

// GET /api/stock/thresholds - Liste des seuils
app.get(
  '/api/stock/thresholds',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { material_id, warehouse_id } = req.query;
    let query = 'select * from stock_thresholds where 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (material_id) {
      query += ` and material_id = $${paramIndex++}`;
      params.push(material_id);
    }
    if (warehouse_id) {
      query += ` and warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }
    query += ' order by created_at desc';
    const thresholds = await run(query, params);
    res.json(thresholds);
  })
);

// POST /api/stock/thresholds - Créer un seuil
app.post(
  '/api/stock/thresholds',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { material_id, warehouse_id, min_quantity, max_quantity, alert_enabled, unit, notes } = req.body;
    if (!material_id || !warehouse_id || min_quantity === undefined) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }
    const [threshold] = await run(
      `insert into stock_thresholds (material_id, warehouse_id, min_quantity, max_quantity, alert_enabled, unit, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (material_id, warehouse_id) do update set
         min_quantity = excluded.min_quantity,
         max_quantity = excluded.max_quantity,
         alert_enabled = excluded.alert_enabled,
         unit = excluded.unit,
         notes = excluded.notes,
         updated_at = now()
       returning *`,
      [
        material_id,
        warehouse_id,
        min_quantity,
        max_quantity || null,
        alert_enabled !== false,
        unit || null,
        notes || null,
        user.id
      ]
    );
    res.status(201).json({ threshold, message: 'Seuil créé avec succès' });
  })
);

// PATCH /api/stock/thresholds/:id - Mettre à jour un seuil
app.patch(
  '/api/stock/thresholds/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const allowedFields = ['min_quantity', 'max_quantity', 'alert_enabled', 'unit', 'notes'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update stock_thresholds set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Seuil mis à jour avec succès' });
  })
);

// DELETE /api/stock/thresholds/:id - Supprimer un seuil
app.delete(
  '/api/stock/thresholds/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from stock_thresholds where id = $1', [id]);
    res.json({ message: 'Seuil supprimé avec succès' });
  })
);

// GET /api/stock/alerts - Liste des alertes
app.get(
  '/api/stock/alerts',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { material_id, warehouse_id, alert_type, is_resolved } = req.query;
    let query = 'select * from stock_alerts where 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (material_id) {
      query += ` and material_id = $${paramIndex++}`;
      params.push(material_id);
    }
    if (warehouse_id) {
      query += ` and warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }
    if (alert_type) {
      query += ` and alert_type = $${paramIndex++}`;
      params.push(alert_type);
    }
    if (is_resolved !== undefined) {
      query += ` and is_resolved = $${paramIndex++}`;
      params.push(is_resolved === 'true');
    }
    query += ' order by created_at desc';
    const alerts = await run(query, params);
    res.json(alerts);
  })
);

// PATCH /api/stock/alerts/:id/resolve - Résoudre une alerte
app.patch(
  '/api/stock/alerts/:id/resolve',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user as AuthPayload;
    await run('update stock_alerts set is_resolved = true, resolved_at = now(), resolved_by = $1 where id = $2', [
      user.id,
      id
    ]);
    res.json({ message: 'Alerte résolue avec succès' });
  })
);

// Stock Lots Endpoints
// GET /api/stock/lots - Liste des lots
app.get(
  '/api/stock/lots',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { material_id, warehouse_id, lot_number } = req.query;
    let query = 'select * from stock_lots where 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (material_id) {
      query += ` and material_id = $${paramIndex++}`;
      params.push(material_id);
    }
    if (warehouse_id) {
      query += ` and warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }
    if (lot_number) {
      query += ` and lot_number ilike $${paramIndex++}`;
      params.push(`%${lot_number}%`);
    }
    query += ' order by created_at desc';
    const lots = await run(query, params);
    res.json(lots);
  })
);

// POST /api/stock/lots - Créer un lot
app.post(
  '/api/stock/lots',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const {
      lot_number,
      material_id,
      warehouse_id,
      quantity,
      unit,
      production_date,
      expiry_date,
      origin,
      supplier_name,
      batch_reference,
      quality_status,
      notes
    } = req.body;
    if (!lot_number || !material_id || !warehouse_id || quantity === undefined) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }
    const [lot] = await run(
      `insert into stock_lots (
        lot_number, material_id, warehouse_id, quantity, unit, production_date, expiry_date,
        origin, supplier_name, batch_reference, quality_status, notes
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      [
        lot_number,
        material_id,
        warehouse_id,
        quantity,
        unit || null,
        production_date || null,
        expiry_date || null,
        origin || null,
        supplier_name || null,
        batch_reference || null,
        quality_status || null,
        notes || null
      ]
    );
    res.status(201).json({ lot, message: 'Lot créé avec succès' });
  })
);

// PATCH /api/stock/lots/:id - Mettre à jour un lot
app.patch(
  '/api/stock/lots/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const allowedFields = [
      'lot_number',
      'quantity',
      'unit',
      'production_date',
      'expiry_date',
      'origin',
      'supplier_name',
      'batch_reference',
      'quality_status',
      'notes'
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update stock_lots set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Lot mis à jour avec succès' });
  })
);

// DELETE /api/stock/lots/:id - Supprimer un lot
app.delete(
  '/api/stock/lots/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from stock_lots where id = $1', [id]);
    res.json({ message: 'Lot supprimé avec succès' });
  })
);

// Stock Movements Endpoints
// GET /api/stock/movements - Liste des mouvements
app.get(
  '/api/stock/movements',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { material_id, warehouse_id, lot_id, movement_type, start_date, end_date } = req.query;
    let query = 'select * from stock_movements where 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (material_id) {
      query += ` and material_id = $${paramIndex++}`;
      params.push(material_id);
    }
    if (warehouse_id) {
      query += ` and (warehouse_id = $${paramIndex} or from_warehouse_id = $${paramIndex} or to_warehouse_id = $${paramIndex})`;
      params.push(warehouse_id);
      paramIndex++;
    }
    if (lot_id) {
      query += ` and lot_id = $${paramIndex++}`;
      params.push(lot_id);
    }
    if (movement_type) {
      query += ` and movement_type = $${paramIndex++}`;
      params.push(movement_type);
    }
    if (start_date) {
      query += ` and created_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` and created_at <= $${paramIndex++}`;
      params.push(end_date);
    }
    query += ' order by created_at desc limit 1000';
    const movements = await run(query, params);
    res.json(movements);
  })
);

// POST /api/stock/movements - Créer un mouvement
app.post(
  '/api/stock/movements',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const {
      movement_type,
      material_id,
      lot_id,
      warehouse_id,
      from_warehouse_id,
      to_warehouse_id,
      quantity,
      unit,
      unit_price,
      reference_type,
      reference_id,
      origin,
      destination,
      treatment_stage,
      notes
    } = req.body;
    if (!movement_type || quantity === undefined) {
      return res.status(400).json({ error: 'Type de mouvement et quantité requis' });
    }
    const totalValue = unit_price && quantity ? unit_price * quantity : null;
    const [movement] = await run(
      `insert into stock_movements (
        movement_type, material_id, lot_id, warehouse_id, from_warehouse_id, to_warehouse_id,
        quantity, unit, unit_price, total_value, reference_type, reference_id,
        origin, destination, treatment_stage, notes, created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      returning *`,
      [
        movement_type,
        material_id || null,
        lot_id || null,
        warehouse_id || null,
        from_warehouse_id || null,
        to_warehouse_id || null,
        quantity,
        unit || null,
        unit_price || null,
        totalValue,
        reference_type || null,
        reference_id || null,
        origin || null,
        destination || null,
        treatment_stage || null,
        notes || null,
        user.id,
        user.full_name || null
      ]
    );
    res.status(201).json({ movement, message: 'Mouvement enregistré avec succès' });
  })
);

// Stock Reconciliations Endpoints
// GET /api/stock/reconciliations - Liste des réconciliations
app.get(
  '/api/stock/reconciliations',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { warehouse_id, material_id, status, start_date, end_date } = req.query;
    let query = 'select * from stock_reconciliations where 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (warehouse_id) {
      query += ` and warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }
    if (material_id) {
      query += ` and material_id = $${paramIndex++}`;
      params.push(material_id);
    }
    if (status) {
      query += ` and status = $${paramIndex++}`;
      params.push(status);
    }
    if (start_date) {
      query += ` and reconciliation_date >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` and reconciliation_date <= $${paramIndex++}`;
      params.push(end_date);
    }
    query += ' order by reconciliation_date desc, created_at desc';
    const reconciliations = await run(query, params);
    res.json(reconciliations);
  })
);

// POST /api/stock/reconciliations - Créer une réconciliation
app.post(
  '/api/stock/reconciliations',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const {
      warehouse_id,
      material_id,
      reconciliation_date,
      theoretical_quantity,
      actual_quantity,
      reason,
      unit,
      notes
    } = req.body;
    if (!warehouse_id || !material_id || !reconciliation_date || theoretical_quantity === undefined || actual_quantity === undefined) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }
    const difference = actual_quantity - theoretical_quantity;
    const differencePercentage =
      theoretical_quantity !== 0 ? ((difference / theoretical_quantity) * 100).toFixed(2) : null;
    const [reconciliation] = await run(
      `insert into stock_reconciliations (
        warehouse_id, material_id, reconciliation_date, theoretical_quantity, actual_quantity,
        difference, difference_percentage, unit, reason, notes, created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      [
        warehouse_id,
        material_id,
        reconciliation_date,
        theoretical_quantity,
        actual_quantity,
        difference,
        differencePercentage ? parseFloat(differencePercentage) : null,
        unit || null,
        reason || null,
        notes || null,
        user.id,
        user.full_name || null
      ]
    );
    res.status(201).json({ reconciliation, message: 'Réconciliation créée avec succès' });
  })
);

// PATCH /api/stock/reconciliations/:id - Mettre à jour une réconciliation
app.patch(
  '/api/stock/reconciliations/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user as AuthPayload;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const allowedFields = [
      'reconciliation_date',
      'theoretical_quantity',
      'actual_quantity',
      'reason',
      'unit',
      'notes',
      'status'
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    // Recalculer la différence si les quantités changent
    if (req.body.theoretical_quantity !== undefined || req.body.actual_quantity !== undefined) {
      const [current] = await run('select theoretical_quantity, actual_quantity from stock_reconciliations where id = $1', [
        id
      ]);
      const theoretical = req.body.theoretical_quantity ?? current.theoretical_quantity;
      const actual = req.body.actual_quantity ?? current.actual_quantity;
      const difference = actual - theoretical;
      const differencePercentage = theoretical !== 0 ? ((difference / theoretical) * 100).toFixed(2) : null;
      updates.push(`difference = $${paramIndex++}`);
      params.push(difference);
      updates.push(`difference_percentage = $${paramIndex++}`);
      params.push(differencePercentage ? parseFloat(differencePercentage) : null);
    }
    // Si le statut passe à "approved", enregistrer l'approbation
    if (req.body.status === 'approved') {
      updates.push(`approved_by = $${paramIndex++}`);
      params.push(user.id);
      updates.push(`approved_at = now()`);
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update stock_reconciliations set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Réconciliation mise à jour avec succès' });
  })
);

// Stock Valuations Endpoints
// GET /api/stock/valuations - Liste des valorisations
app.get(
  '/api/stock/valuations',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { material_id, warehouse_id, valuation_method, valuation_date } = req.query;
    let query = 'select * from stock_valuations where 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (material_id) {
      query += ` and material_id = $${paramIndex++}`;
      params.push(material_id);
    }
    if (warehouse_id) {
      query += ` and warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }
    if (valuation_method) {
      query += ` and valuation_method = $${paramIndex++}`;
      params.push(valuation_method);
    }
    if (valuation_date) {
      query += ` and valuation_date = $${paramIndex++}`;
      params.push(valuation_date);
    }
    query += ' order by valuation_date desc, calculated_at desc';
    const valuations = await run(query, params);
    res.json(valuations);
  })
);

// POST /api/stock/valuations/calculate - Calculer une valorisation
app.post(
  '/api/stock/valuations/calculate',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { material_id, warehouse_id, valuation_method, valuation_date } = req.body;
    if (!material_id || !warehouse_id || !valuation_method || !valuation_date) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }
    // Récupérer les mouvements d'entrée pour ce matériau et entrepôt jusqu'à la date de valorisation
    const movements = await run(
      `select * from stock_movements
       where material_id = $1
         and (warehouse_id = $2 or to_warehouse_id = $2)
         and movement_type in ('in', 'transfer')
         and created_at <= $3
       order by created_at ${valuation_method === 'LIFO' ? 'desc' : 'asc'}`,
      [material_id, warehouse_id, valuation_date]
    );
    // Calculer selon la méthode
    let totalQuantity = 0;
    let totalValue = 0;
    let unitCost = 0;
    if (valuation_method === 'FIFO' || valuation_method === 'LIFO') {
      // Calculer la quantité totale et la valeur totale
      movements.forEach((mov: any) => {
        totalQuantity += Number(mov.quantity || 0);
        totalValue += Number(mov.total_value || mov.unit_price * mov.quantity || 0);
      });
      unitCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;
    } else if (valuation_method === 'AVERAGE') {
      // Coût moyen pondéré
      let totalCost = 0;
      movements.forEach((mov: any) => {
        const qty = Number(mov.quantity || 0);
        const cost = Number(mov.unit_price || 0);
        totalQuantity += qty;
        totalCost += qty * cost;
      });
      unitCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      totalValue = totalCost;
    }
    // Enregistrer ou mettre à jour la valorisation
    const [valuation] = await run(
      `insert into stock_valuations (
        material_id, warehouse_id, valuation_method, quantity, unit_cost, total_value,
        valuation_date, created_by
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (material_id, warehouse_id, valuation_date, valuation_method) do update set
        quantity = excluded.quantity,
        unit_cost = excluded.unit_cost,
        total_value = excluded.total_value,
        calculated_at = now(),
        updated_at = now()
      returning *`,
      [material_id, warehouse_id, valuation_method, totalQuantity, unitCost, totalValue, valuation_date, user.id]
    );
    res.status(201).json({ valuation, message: 'Valorisation calculée avec succès' });
  })
);

// Stock Forecasts Endpoints
// GET /api/stock/forecasts - Liste des prévisions
app.get(
  '/api/stock/forecasts',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { material_id, warehouse_id, forecast_date } = req.query;
    let query = 'select * from stock_forecasts where 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (material_id) {
      query += ` and material_id = $${paramIndex++}`;
      params.push(material_id);
    }
    if (warehouse_id) {
      query += ` and warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }
    if (forecast_date) {
      query += ` and forecast_date = $${paramIndex++}`;
      params.push(forecast_date);
    }
    query += ' order by forecast_date desc, created_at desc';
    const forecasts = await run(query, params);
    res.json(forecasts);
  })
);

// POST /api/stock/forecasts - Créer une prévision
app.post(
  '/api/stock/forecasts',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const {
      material_id,
      warehouse_id,
      forecast_date,
      forecasted_quantity,
      confidence_level,
      forecast_method,
      historical_period_months,
      notes
    } = req.body;
    if (!material_id || !warehouse_id || !forecast_date || forecasted_quantity === undefined) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }
    const [forecast] = await run(
      `insert into stock_forecasts (
        material_id, warehouse_id, forecast_date, forecasted_quantity, confidence_level,
        forecast_method, historical_period_months, notes, created_by
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (material_id, warehouse_id, forecast_date) do update set
        forecasted_quantity = excluded.forecasted_quantity,
        confidence_level = excluded.confidence_level,
        forecast_method = excluded.forecast_method,
        historical_period_months = excluded.historical_period_months,
        notes = excluded.notes,
        updated_at = now()
      returning *`,
      [
        material_id,
        warehouse_id,
        forecast_date,
        forecasted_quantity,
        confidence_level || null,
        forecast_method || null,
        historical_period_months || null,
        notes || null,
        user.id
      ]
    );
    res.status(201).json({ forecast, message: 'Prévision créée avec succès' });
  })
);

// PATCH /api/stock/forecasts/:id - Mettre à jour une prévision
app.patch(
  '/api/stock/forecasts/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const allowedFields = [
      'forecast_date',
      'forecasted_quantity',
      'confidence_level',
      'forecast_method',
      'historical_period_months',
      'notes'
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update stock_forecasts set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Prévision mise à jour avec succès' });
  })
);

// DELETE /api/stock/forecasts/:id - Supprimer une prévision
app.delete(
  '/api/stock/forecasts/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from stock_forecasts where id = $1', [id]);
    res.json({ message: 'Prévision supprimée avec succès' });
  })
);

// ==================== CRM ENDPOINTS ====================
// Customer Interactions
// GET /api/customers/:id/interactions - Liste des interactions d'un client
app.get(
  '/api/customers/:id/interactions',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { interaction_type, limit } = req.query;
    let query = 'select * from customer_interactions where customer_id = $1';
    const params: any[] = [id];
    if (interaction_type) {
      query += ' and interaction_type = $2';
      params.push(interaction_type);
    }
    query += ' order by created_at desc';
    if (limit) {
      query += ` limit $${params.length + 1}`;
      params.push(parseInt(limit as string));
    } else {
      query += ' limit 100';
    }
    const interactions = await run(query, params);
    res.json(interactions);
  })
);

// POST /api/customers/:id/interactions - Créer une interaction
app.post(
  '/api/customers/:id/interactions',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const {
      interaction_type,
      subject,
      description,
      outcome,
      next_action,
      next_action_date,
      duration_minutes,
      location,
      participants,
      related_entity_type,
      related_entity_id
    } = req.body;
    if (!interaction_type || !description) {
      return res.status(400).json({ error: 'Type et description requis' });
    }
    const [interaction] = await run(
      `insert into customer_interactions (
        customer_id, interaction_type, subject, description, outcome, next_action, next_action_date,
        duration_minutes, location, participants, related_entity_type, related_entity_id,
        created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      returning *`,
      [
        id,
        interaction_type,
        subject || null,
        description,
        outcome || null,
        next_action || null,
        next_action_date || null,
        duration_minutes || null,
        location || null,
        participants || null,
        related_entity_type || null,
        related_entity_id || null,
        user.id,
        user.full_name || null
      ]
    );
    // Mettre à jour last_interaction_date du client
    await run('update customers set last_interaction_date = current_date, updated_at = now() where id = $1', [id]);
    res.status(201).json({ interaction, message: 'Interaction enregistrée avec succès' });
  })
);

// Customer Contracts
// GET /api/customers/:id/contracts - Liste des contrats d'un client
app.get(
  '/api/customers/:id/contracts',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.query;
    let query = 'select * from customer_contracts where customer_id = $1';
    const params: any[] = [id];
    if (status) {
      query += ' and status = $2';
      params.push(status);
    }
    query += ' order by start_date desc';
    const contracts = await run(query, params);
    res.json(contracts);
  })
);

// POST /api/customers/:id/contracts - Créer un contrat
app.post(
  '/api/customers/:id/contracts',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const {
      contract_number,
      contract_type,
      title,
      description,
      start_date,
      end_date,
      renewal_date,
      auto_renewal,
      value,
      currency,
      terms,
      notes,
      signed_date,
      signed_by
    } = req.body;
    if (!contract_number || !contract_type || !title || !start_date) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }
    const [contract] = await run(
      `insert into customer_contracts (
        customer_id, contract_number, contract_type, title, description, start_date, end_date,
        renewal_date, auto_renewal, value, currency, terms, notes, signed_date, signed_by,
        created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      returning *`,
      [
        id,
        contract_number,
        contract_type,
        title,
        description || null,
        start_date,
        end_date || null,
        renewal_date || null,
        auto_renewal !== false,
        value || null,
        currency || 'EUR',
        terms || null,
        notes || null,
        signed_date || null,
        signed_by || null,
        user.id,
        user.full_name || null
      ]
    );
    res.status(201).json({ contract, message: 'Contrat créé avec succès' });
  })
);

// PATCH /api/contracts/:id - Mettre à jour un contrat
app.patch(
  '/api/contracts/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const allowedFields = [
      'title',
      'description',
      'end_date',
      'renewal_date',
      'auto_renewal',
      'value',
      'status',
      'terms',
      'notes',
      'signed_date',
      'signed_by'
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update customer_contracts set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Contrat mis à jour avec succès' });
  })
);

// Customer Opportunities
// GET /api/customers/:id/opportunities - Liste des opportunités d'un client
app.get(
  '/api/customers/:id/opportunities',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { stage } = req.query;
    let query = 'select * from customer_opportunities where customer_id = $1';
    const params: any[] = [id];
    if (stage) {
      query += ' and stage = $2';
      params.push(stage);
    }
    query += ' order by created_at desc';
    const opportunities = await run(query, params);
    res.json(opportunities);
  })
);

// GET /api/opportunities - Liste de toutes les opportunités (pipeline)
app.get(
  '/api/opportunities',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { stage, assigned_to } = req.query;
    let query = 'select o.*, c.name as customer_name from customer_opportunities o left join customers c on c.id = o.customer_id where 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (stage) {
      query += ` and o.stage = $${paramIndex++}`;
      params.push(stage);
    }
    if (assigned_to) {
      query += ` and o.assigned_to = $${paramIndex++}`;
      params.push(assigned_to);
    }
    query += ' order by o.expected_close_date desc nulls last, o.created_at desc';
    const opportunities = await run(query, params);
    res.json(opportunities);
  })
);

// POST /api/customers/:id/opportunities - Créer une opportunité
app.post(
  '/api/customers/:id/opportunities',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const {
      title,
      description,
      stage,
      probability,
      estimated_value,
      currency,
      expected_close_date,
      source,
      notes,
      assigned_to
    } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Titre requis' });
    }
    const [assignedUser] = assigned_to
      ? await run('select full_name from users where id = $1', [assigned_to])
      : [null];
    const [opportunity] = await run(
      `insert into customer_opportunities (
        customer_id, title, description, stage, probability, estimated_value, currency,
        expected_close_date, source, notes, assigned_to, assigned_to_name,
        created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      returning *`,
      [
        id,
        title,
        description || null,
        stage || 'prospecting',
        probability || null,
        estimated_value || null,
        currency || 'EUR',
        expected_close_date || null,
        source || null,
        notes || null,
        assigned_to || null,
        assignedUser?.full_name || null,
        user.id,
        user.full_name || null
      ]
    );
    res.status(201).json({ opportunity, message: 'Opportunité créée avec succès' });
  })
);

// PATCH /api/opportunities/:id - Mettre à jour une opportunité
app.patch(
  '/api/opportunities/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const allowedFields = [
      'title',
      'description',
      'stage',
      'probability',
      'estimated_value',
      'expected_close_date',
      'actual_close_date',
      'win_reason',
      'loss_reason',
      'competitor',
      'source',
      'notes',
      'assigned_to'
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });
    // Si assigned_to change, mettre à jour assigned_to_name
    if (req.body.assigned_to !== undefined) {
      const [assignedUser] = req.body.assigned_to
        ? await run('select full_name from users where id = $1', [req.body.assigned_to])
        : [null];
      updates.push(`assigned_to_name = $${paramIndex++}`);
      params.push(assignedUser?.full_name || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update customer_opportunities set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Opportunité mise à jour avec succès' });
  })
);

// Customer Notes
// GET /api/customers/:id/notes - Liste des notes d'un client
app.get(
  '/api/customers/:id/notes',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { note_type, is_completed } = req.query;
    let query = 'select * from customer_notes where customer_id = $1';
    const params: any[] = [id];
    if (note_type) {
      query += ' and note_type = $2';
      params.push(note_type);
    }
    if (is_completed !== undefined) {
      query += ` and is_completed = $${params.length + 1}`;
      params.push(is_completed === 'true');
    }
    query += ' order by created_at desc';
    const notes = await run(query, params);
    res.json(notes);
  })
);

// GET /api/notes/reminders - Liste des rappels à venir
app.get(
  '/api/notes/reminders',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { days_ahead = 7 } = req.query;
    const reminders = await run(
      `select n.*, c.name as customer_name, c.id as customer_id
       from customer_notes n
       join customers c on c.id = n.customer_id
       where n.is_reminder = true
         and n.is_completed = false
         and n.reminder_date <= current_date + interval '${days_ahead} days'
       order by n.reminder_date asc`,
      []
    );
    res.json(reminders);
  })
);

// POST /api/customers/:id/notes - Créer une note
app.post(
  '/api/customers/:id/notes',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const {
      note_type,
      title,
      content,
      is_reminder,
      reminder_date,
      priority,
      tags,
      related_entity_type,
      related_entity_id
    } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Contenu requis' });
    }
    const [note] = await run(
      `insert into customer_notes (
        customer_id, note_type, title, content, is_reminder, reminder_date, priority,
        tags, related_entity_type, related_entity_id, created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      [
        id,
        note_type || 'note',
        title || null,
        content,
        is_reminder || false,
        reminder_date || null,
        priority || null,
        tags || null,
        related_entity_type || null,
        related_entity_id || null,
        user.id,
        user.full_name || null
      ]
    );
    // Si c'est un rappel, mettre à jour next_follow_up_date du client
    if (is_reminder && reminder_date) {
      await run('update customers set next_follow_up_date = $1, updated_at = now() where id = $2', [
        reminder_date,
        id
      ]);
    }
    res.status(201).json({ note, message: 'Note créée avec succès' });
  })
);

// PATCH /api/notes/:id - Mettre à jour une note
app.patch(
  '/api/notes/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const allowedFields = ['title', 'content', 'is_reminder', 'reminder_date', 'is_completed', 'priority', 'tags'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(req.body[field]);
      }
    });
    if (req.body.is_completed === true) {
      updates.push('completed_at = now()');
    } else if (req.body.is_completed === false) {
      updates.push('completed_at = null');
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update customer_notes set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Note mise à jour avec succès' });
  })
);

// DELETE /api/notes/:id - Supprimer une note
app.delete(
  '/api/notes/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from customer_notes where id = $1', [id]);
    res.json({ message: 'Note supprimée avec succès' });
  })
);

// Customer Statistics & Segmentation
// GET /api/customers/:id/statistics - Statistiques d'un client
app.get(
  '/api/customers/:id/statistics',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { period_start, period_end } = req.query;
    let startDate = period_start ? new Date(period_start as string) : new Date(new Date().getFullYear(), 0, 1);
    let endDate = period_end ? new Date(period_end as string) : new Date();

    // Calculer les statistiques depuis les données existantes
    const [invoiceStats] = await run(
      `select 
        count(*) as invoice_count,
        sum(total_amount) as total_revenue,
        avg(total_amount) as average_invoice_value,
        max(issue_date) as last_order_date,
        min(issue_date) as first_order_date
       from invoices
       where customer_id = $1
         and issue_date >= $2
         and issue_date <= $3`,
      [id, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]
    );

    const [interactionStats] = await run(
      `select 
        count(*) as total_interactions,
        max(created_at::date) as last_interaction_date
       from customer_interactions
       where customer_id = $1
         and created_at >= $2
         and created_at <= $3`,
      [id, startDate.toISOString(), endDate.toISOString()]
    );

    const [customer] = await run('select * from customers where id = $1', [id]);

    // Calculer la segmentation basée sur le revenu et la fréquence
    let segment = 'C';
    const totalRevenue = parseFloat(invoiceStats?.total_revenue || 0);
    const invoiceCount = parseInt(invoiceStats?.invoice_count || 0);
    const monthsDiff = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const orderFrequency = invoiceCount / monthsDiff;

    if (totalRevenue > 50000 && orderFrequency > 2) {
      segment = 'A';
    } else if (totalRevenue > 20000 || orderFrequency > 1) {
      segment = 'B';
    }

    res.json({
      period_start: startDate.toISOString().slice(0, 10),
      period_end: endDate.toISOString().slice(0, 10),
      total_revenue: totalRevenue,
      invoice_count: invoiceCount,
      average_invoice_value: parseFloat(invoiceStats?.average_invoice_value || 0),
      order_frequency: orderFrequency,
      last_order_date: invoiceStats?.last_order_date || null,
      first_order_date: invoiceStats?.first_order_date || null,
      total_interactions: parseInt(interactionStats?.total_interactions || 0),
      last_interaction_date: interactionStats?.last_interaction_date || null,
      segment,
      customer_type: customer?.customer_type || 'client'
    });
  })
);

// PATCH /api/customers/:id/segment - Mettre à jour la segmentation d'un client
app.patch(
  '/api/customers/:id/segment',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { segment, customer_type } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (segment !== undefined) {
      updates.push(`segment = $${paramIndex++}`);
      params.push(segment);
    }
    if (customer_type !== undefined) {
      updates.push(`customer_type = $${paramIndex++}`);
      params.push(customer_type);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update customers set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Segmentation mise à jour avec succès' });
  })
);

// ==================== MOBILE APP ENDPOINTS ====================
// Intervention Photos
// POST /api/interventions/:id/photos - Ajouter une photo
app.post(
  '/api/interventions/:id/photos',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const { photo_type, photo_data, mime_type, file_size, latitude, longitude } = req.body;
    if (!photo_type || !photo_data) {
      return res.status(400).json({ error: 'Type et données photo requis' });
    }
    const [photo] = await run(
      `insert into intervention_photos (
        intervention_id, photo_type, photo_data, mime_type, file_size, latitude, longitude,
        created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *`,
      [
        id,
        photo_type,
        photo_data,
        mime_type || 'image/jpeg',
        file_size || null,
        latitude || null,
        longitude || null,
        user.id,
        user.full_name || null
      ]
    );
    res.status(201).json({ photo, message: 'Photo enregistrée avec succès' });
  })
);

// GET /api/interventions/:id/photos - Liste des photos d'une intervention
app.get(
  '/api/interventions/:id/photos',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { photo_type } = req.query;
    let query = 'select id, intervention_id, photo_type, mime_type, file_size, latitude, longitude, taken_at, created_by_name, created_at from intervention_photos where intervention_id = $1';
    const params: any[] = [id];
    if (photo_type) {
      query += ' and photo_type = $2';
      params.push(photo_type);
    }
    query += ' order by taken_at desc';
    const photos = await run(query, params);
    res.json(photos);
  })
);

// GET /api/interventions/:id/photos/:photo_id - Récupérer une photo (avec données)
app.get(
  '/api/interventions/:id/photos/:photo_id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { photo_id } = req.params;
    const [photo] = await run('select * from intervention_photos where id = $1', [photo_id]);
    if (!photo) {
      return res.status(404).json({ error: 'Photo introuvable' });
    }
    res.json(photo);
  })
);

// DELETE /api/interventions/:id/photos/:photo_id - Supprimer une photo
app.delete(
  '/api/interventions/:id/photos/:photo_id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { photo_id } = req.params;
    await run('delete from intervention_photos where id = $1', [photo_id]);
    res.json({ message: 'Photo supprimée avec succès' });
  })
);

// Intervention Signatures
// POST /api/interventions/:id/signatures - Ajouter une signature
app.post(
  '/api/interventions/:id/signatures',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      signature_type,
      signature_data,
      signer_name,
      signer_role,
      latitude,
      longitude,
      ip_address,
      device_info
    } = req.body;
    if (!signature_type || !signature_data) {
      return res.status(400).json({ error: 'Type et données signature requis' });
    }
    const [signature] = await run(
      `insert into intervention_signatures (
        intervention_id, signature_type, signature_data, signer_name, signer_role,
        latitude, longitude, ip_address, device_info
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *`,
      [
        id,
        signature_type,
        signature_data,
        signer_name || null,
        signer_role || null,
        latitude || null,
        longitude || null,
        ip_address || null,
        device_info || null
      ]
    );
    res.status(201).json({ signature, message: 'Signature enregistrée avec succès' });
  })
);

// GET /api/interventions/:id/signatures - Liste des signatures d'une intervention
app.get(
  '/api/interventions/:id/signatures',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const signatures = await run(
      'select * from intervention_signatures where intervention_id = $1 order by signed_at desc',
      [id]
    );
    res.json(signatures);
  })
);

// QR Code Scans
// POST /api/interventions/:id/scans - Enregistrer un scan
app.post(
  '/api/interventions/:id/scans',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const {
      scan_type,
      code_value,
      code_format,
      material_id,
      lot_id,
      description,
      latitude,
      longitude,
      device_info
    } = req.body;
    if (!scan_type || !code_value) {
      return res.status(400).json({ error: 'Type et valeur du code requis' });
    }
    const [scan] = await run(
      `insert into qr_scans (
        intervention_id, scan_type, code_value, code_format, material_id, lot_id,
        description, latitude, longitude, scanned_by, scanned_by_name, device_info
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      [
        id,
        scan_type,
        code_value,
        code_format || null,
        material_id || null,
        lot_id || null,
        description || null,
        latitude || null,
        longitude || null,
        user.id,
        user.full_name || null,
        device_info || null
      ]
    );
    res.status(201).json({ scan, message: 'Scan enregistré avec succès' });
  })
);

// GET /api/interventions/:id/scans - Liste des scans d'une intervention
app.get(
  '/api/interventions/:id/scans',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const scans = await run('select * from qr_scans where intervention_id = $1 order by scanned_at desc', [id]);
    res.json(scans);
  })
);

// Voice Notes
// POST /api/interventions/:id/voice-notes - Enregistrer une note vocale
app.post(
  '/api/interventions/:id/voice-notes',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const { audio_data, mime_type, duration_seconds, transcription, latitude, longitude } = req.body;
    if (!audio_data) {
      return res.status(400).json({ error: 'Données audio requises' });
    }
    const [voiceNote] = await run(
      `insert into voice_notes (
        intervention_id, audio_data, mime_type, duration_seconds, transcription,
        latitude, longitude, recorded_by, recorded_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *`,
      [
        id,
        audio_data,
        mime_type || 'audio/webm',
        duration_seconds || null,
        transcription || null,
        latitude || null,
        longitude || null,
        user.id,
        user.full_name || null
      ]
    );
    // Mettre à jour l'intervention avec la note vocale
    await run('update interventions set voice_note_id = $1, updated_at = now() where id = $2', [
      voiceNote.id,
      id
    ]);
    res.status(201).json({ voice_note: voiceNote, message: 'Note vocale enregistrée avec succès' });
  })
);

// GET /api/interventions/:id/voice-notes - Liste des notes vocales d'une intervention
app.get(
  '/api/interventions/:id/voice-notes',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const voiceNotes = await run(
      'select id, intervention_id, mime_type, duration_seconds, transcription, recorded_at, recorded_by_name, created_at from voice_notes where intervention_id = $1 order by recorded_at desc',
      [id]
    );
    res.json(voiceNotes);
  })
);

// GET /api/interventions/:id/voice-notes/:note_id - Récupérer une note vocale (avec données audio)
app.get(
  '/api/interventions/:id/voice-notes/:note_id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { note_id } = req.params;
    const [voiceNote] = await run('select * from voice_notes where id = $1', [note_id]);
    if (!voiceNote) {
      return res.status(404).json({ error: 'Note vocale introuvable' });
    }
    res.json(voiceNote);
  })
);

// Offline Sync
// POST /api/mobile/sync - Synchroniser les données offline
app.post(
  '/api/mobile/sync',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { sync_items } = req.body as { sync_items: Array<{ entity_type: string; action: string; payload: any }> };
    if (!sync_items || !Array.isArray(sync_items)) {
      return res.status(400).json({ error: 'sync_items requis' });
    }
    const results: any[] = [];
    for (const item of sync_items) {
      try {
        // Traiter chaque élément selon son type
        let result: any = null;
        if (item.entity_type === 'intervention' && item.action === 'update') {
          const { id, ...updates } = item.payload;
          const updateFields: string[] = [];
          const params: any[] = [];
          let paramIndex = 1;
          Object.keys(updates).forEach((key) => {
            updateFields.push(`${key} = $${paramIndex++}`);
            params.push(updates[key]);
          });
          if (updateFields.length > 0) {
            updateFields.push('updated_at = now()');
            params.push(id);
            await run(`update interventions set ${updateFields.join(', ')} where id = $${paramIndex}`, params);
            result = { success: true, id };
          }
        } else if (item.entity_type === 'intervention_photo' && item.action === 'create') {
          const [photo] = await run(
            `insert into intervention_photos (
              intervention_id, photo_type, photo_data, mime_type, file_size, latitude, longitude,
              created_by, created_by_name
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            returning id`,
            [
              item.payload.intervention_id,
              item.payload.photo_type,
              item.payload.photo_data,
              item.payload.mime_type || 'image/jpeg',
              item.payload.file_size || null,
              item.payload.latitude || null,
              item.payload.longitude || null,
              user.id,
              user.full_name || null
            ]
          );
          result = { success: true, id: photo.id };
        }
        // Ajouter d'autres types d'entités selon les besoins
        results.push({ ...item, result });
      } catch (error: any) {
        results.push({ ...item, result: { success: false, error: error.message } });
      }
    }
    res.json({ results, message: 'Synchronisation terminée' });
  })
);

// GET /api/mobile/sync-queue - Récupérer la file de synchronisation
app.get(
  '/api/mobile/sync-queue',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const queue = await run(
      'select * from offline_sync_queue where user_id = $1 and status = $2 order by created_at',
      [user.id, 'pending']
    );
    res.json(queue);
  })
);

// Push Notifications
// GET /api/mobile/push-public-key - Récupérer la clé publique VAPID
app.get(
  '/api/mobile/push-public-key',
  requireAuth(),
  asyncHandler(async (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
      return res.status(503).json({ error: 'Notifications push non configurées' });
    }
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  })
);

// POST /api/mobile/push-token - Enregistrer un token de notification push
app.post(
  '/api/mobile/push-token',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { subscription, device_type, device_info, employee_id } = req.body;
    if (!subscription) {
      return res.status(400).json({ error: 'Subscription requis' });
    }
    const token = JSON.stringify(subscription);
    // Vérifier si le token existe déjà
    const [existing] = await run('select id from push_notification_tokens where token = $1', [token]);
    if (existing) {
      await run(
        'update push_notification_tokens set user_id = $1, employee_id = $2, device_type = $3, device_info = $4, is_active = true, last_used_at = now(), updated_at = now() where token = $5',
        [user.id, employee_id || null, device_type || null, device_info || null, token]
      );
      res.json({ message: 'Token mis à jour' });
    } else {
      await run(
        `insert into push_notification_tokens (
          user_id, employee_id, token, device_type, device_info
        ) values ($1, $2, $3, $4, $5)
        returning id`,
        [user.id, employee_id || null, token, device_type || null, device_info || null]
      );
      res.status(201).json({ message: 'Token enregistré' });
    }
  })
);

// POST /api/mobile/send-notification - Envoyer une notification push
app.post(
  '/api/mobile/send-notification',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    if (!webpush) {
      return res.status(503).json({ error: 'Notifications push non configurées' });
    }
    const { user_id, employee_id, title, body, data, url } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Titre et corps requis' });
    }
    // Récupérer les tokens de l'utilisateur ou de l'employé
    let query = 'select token from push_notification_tokens where is_active = true';
    const params: any[] = [];
    if (user_id) {
      query += ' and user_id = $1';
      params.push(user_id);
    } else if (employee_id) {
      query += ' and employee_id = $1';
      params.push(employee_id);
    } else {
      return res.status(400).json({ error: 'user_id ou employee_id requis' });
    }
    const tokens = await run<{ token: string }>(query, params);
    if (tokens.length === 0) {
      return res.status(404).json({ error: 'Aucun token trouvé' });
    }
    const payload = JSON.stringify({
      title,
      body,
      data: data || {},
      url: url || '/?page=mobile'
    });
    const results = await Promise.allSettled(
      tokens.map(async (tokenRow) => {
        try {
          const subscription = JSON.parse(tokenRow.token);
          await webpush.sendNotification(subscription, payload);
          return { success: true, token: tokenRow.token };
        } catch (error: any) {
          // Si le token est invalide, le désactiver
          if (error.statusCode === 410 || error.statusCode === 404) {
            await run('update push_notification_tokens set is_active = false where token = $1', [tokenRow.token]);
          }
          return { success: false, error: error.message, token: tokenRow.token };
        }
      })
    );
    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    res.json({
      message: `${successful}/${tokens.length} notification(s) envoyée(s)`,
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : { success: false, error: 'Erreur inconnue' }))
    });
  })
);

// Fonction helper pour envoyer une notification lors de la création d'une intervention
const sendInterventionNotification = async (interventionId: string, assignedTo: string | null) => {
  if (!webpush || !assignedTo) return;
  try {
    const tokens = await run<{ token: string }>(
      'select token from push_notification_tokens where employee_id = $1 and is_active = true',
      [assignedTo]
    );
    if (tokens.length === 0) return;
    const [intervention] = await run<{ title: string; customer_name: string }>(
      'select title, customer_name from interventions where id = $1',
      [interventionId]
    );
    if (!intervention) return;
    const payload = JSON.stringify({
      title: 'Nouvelle intervention assignée',
      body: `${intervention.title} - ${intervention.customer_name}`,
      data: { intervention_id: interventionId },
      url: '/?page=mobile'
    });
    await Promise.allSettled(
      tokens.map(async (tokenRow) => {
        try {
          const subscription = JSON.parse(tokenRow.token);
          await webpush.sendNotification(subscription, payload);
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await run('update push_notification_tokens set is_active = false where token = $1', [tokenRow.token]);
          }
        }
      })
    );
  } catch (error) {
    console.error('Erreur envoi notification intervention:', error);
  }
};

// PATCH /api/interventions/:id/geolocation - Mettre à jour la géolocalisation d'une intervention
app.patch(
  '/api/interventions/:id/geolocation',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { latitude, longitude, location_type } = req.body; // location_type: 'arrival', 'completion', 'current'
    if (latitude === undefined || longitude === undefined || !location_type) {
      return res.status(400).json({ error: 'Latitude, longitude et type requis' });
    }
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (location_type === 'arrival') {
      updates.push(`arrival_latitude = $${paramIndex++}`);
      params.push(latitude);
      updates.push(`arrival_longitude = $${paramIndex++}`);
      params.push(longitude);
      updates.push(`arrival_time = now()`);
    } else if (location_type === 'completion') {
      updates.push(`completion_latitude = $${paramIndex++}`);
      params.push(latitude);
      updates.push(`completion_longitude = $${paramIndex++}`);
      params.push(longitude);
      updates.push(`completion_time = now()`);
    }
    // Toujours mettre à jour latitude/longitude principales
    updates.push(`latitude = $${paramIndex++}`);
    params.push(latitude);
    updates.push(`longitude = $${paramIndex++}`);
    params.push(longitude);
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update interventions set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Géolocalisation mise à jour' });
  })
);

// PATCH /api/interventions/:id/timing - Mettre à jour les horaires d'une intervention
app.patch(
  '/api/interventions/:id/timing',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { start_time, end_time } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (start_time !== undefined) {
      updates.push(`start_time = $${paramIndex++}`);
      params.push(start_time);
    }
    if (end_time !== undefined) {
      updates.push(`end_time = $${paramIndex++}`);
      params.push(end_time);
      // Si end_time est défini, mettre le statut à 'completed'
      updates.push(`status = 'completed'`);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update interventions set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Horaires mis à jour' });
  })
);

// ==================== ENDPOINTS ALERTES ET NOTIFICATIONS ====================
// GET /api/alerts - Liste des alertes
app.get(
  '/api/alerts',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { category, severity, is_resolved, assigned_to, entity_type, entity_id } = req.query;
    let query = `
      select a.*,
             u1.full_name as created_by_name,
             u2.full_name as resolved_by_name,
             u3.full_name as assigned_to_name
      from alerts a
      left join users u1 on u1.id = a.created_by
      left join users u2 on u2.id = a.resolved_by
      left join users u3 on u3.id = a.assigned_to
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    if (category) {
      query += ` and a.alert_category = $${paramIndex++}`;
      params.push(category);
    }
    if (severity) {
      query += ` and a.severity = $${paramIndex++}`;
      params.push(severity);
    }
    if (is_resolved !== undefined) {
      query += ` and a.is_resolved = $${paramIndex++}`;
      params.push(is_resolved === 'true');
    }
    if (assigned_to) {
      query += ` and a.assigned_to = $${paramIndex++}`;
      params.push(assigned_to);
    }
    if (entity_type) {
      query += ` and a.entity_type = $${paramIndex++}`;
      params.push(entity_type);
    }
    if (entity_id) {
      query += ` and a.entity_id = $${paramIndex++}`;
      params.push(entity_id);
    }
    query += ' order by a.severity desc, a.created_at desc';
    const alerts = await run(query, params);
    res.json(alerts);
  })
);

// GET /api/alerts/:id - Détails d'une alerte
app.get(
  '/api/alerts/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [alert] = await run(
      `select a.*,
              u1.full_name as created_by_name,
              u2.full_name as resolved_by_name,
              u3.full_name as assigned_to_name
       from alerts a
       left join users u1 on u1.id = a.created_by
       left join users u2 on u2.id = a.resolved_by
       left join users u3 on u3.id = a.assigned_to
       where a.id = $1`,
      [id]
    );
    if (!alert) {
      return res.status(404).json({ error: 'Alerte introuvable' });
    }
    res.json(alert);
  })
);

// POST /api/alerts - Créer une alerte
app.post(
  '/api/alerts',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const {
      alert_category,
      alert_type,
      severity,
      title,
      message,
      entity_type,
      entity_id,
      related_data,
      assigned_to,
      due_date
    } = req.body;
    if (!alert_category || !alert_type || !title || !message) {
      return res.status(400).json({ error: 'Catégorie, type, titre et message requis' });
    }
    const [alert] = await run(
      `insert into alerts (
        alert_category, alert_type, severity, title, message,
        entity_type, entity_id, related_data, assigned_to, due_date, created_by
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *`,
      [
        alert_category,
        alert_type,
        severity || 'medium',
        title,
        message,
        entity_type || null,
        entity_id || null,
        related_data ? JSON.stringify(related_data) : null,
        assigned_to || null,
        due_date || null,
        user.id
      ]
    );
    res.status(201).json({ alert, message: 'Alerte créée avec succès' });
  })
);

// PATCH /api/alerts/:id - Mettre à jour une alerte
app.patch(
  '/api/alerts/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { severity, title, message, assigned_to, due_date, related_data } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (severity !== undefined) {
      updates.push(`severity = $${paramIndex++}`);
      params.push(severity);
    }
    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (message !== undefined) {
      updates.push(`message = $${paramIndex++}`);
      params.push(message);
    }
    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      params.push(assigned_to);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      params.push(due_date);
    }
    if (related_data !== undefined) {
      updates.push(`related_data = $${paramIndex++}`);
      params.push(JSON.stringify(related_data));
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    updates.push('updated_at = now()');
    params.push(id);
    await run(`update alerts set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Alerte mise à jour avec succès' });
  })
);

// PATCH /api/alerts/:id/resolve - Résoudre une alerte
app.patch(
  '/api/alerts/:id/resolve',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const { resolved_notes } = req.body;
    await run(
      'update alerts set is_resolved = true, resolved_at = now(), resolved_by = $1, resolved_notes = $2, updated_at = now() where id = $3',
      [user.id, resolved_notes || null, id]
    );
    res.json({ message: 'Alerte résolue avec succès' });
  })
);

// DELETE /api/alerts/:id - Supprimer une alerte
app.delete(
  '/api/alerts/:id',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from alerts where id = $1', [id]);
    res.json({ message: 'Alerte supprimée avec succès' });
  })
);

// POST /api/alerts/:id/notify - Envoyer des notifications pour une alerte
app.post(
  '/api/alerts/:id/notify',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { notification_types, recipient_ids, recipient_roles } = req.body;
    const [alert] = await run('select * from alerts where id = $1', [id]);
    if (!alert) {
      return res.status(404).json({ error: 'Alerte introuvable' });
    }
    const types = notification_types || ['in_app'];
    const notifications: any[] = [];
    // Créer les notifications selon les préférences
    // Pour simplifier, on crée des notifications in_app pour tous les utilisateurs
    if (recipient_ids && Array.isArray(recipient_ids)) {
      for (const userId of recipient_ids) {
        for (const notifType of types) {
          const [user] = await run('select email, full_name from users where id = $1', [userId]);
          if (user) {
            const [notif] = await run(
              `insert into notifications (
                alert_id, notification_type, recipient_type, recipient_id, recipient_email, status
              ) values ($1, $2, $3, $4, $5, $6)
              returning *`,
              [id, notifType, 'user', userId, user.email || null, 'pending']
            );
            notifications.push(notif);
          }
        }
      }
    }
    res.json({ notifications, message: 'Notifications créées' });
  })
);

// GET /api/notifications - Liste des notifications
app.get(
  '/api/notifications',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { status, notification_type, unread_only } = req.query;
    let query = `
      select n.*, a.title as alert_title, a.alert_category, a.severity
      from notifications n
      left join alerts a on a.id = n.alert_id
      where (n.recipient_type = 'user' and n.recipient_id = $1)
         or (n.recipient_type = 'all')
         or (n.recipient_type = 'role' and $2 = any(select unnest(permissions) from users where id = $1))
    `;
    const params: any[] = [user.id, user.role];
    let paramIndex = 3;
    if (status) {
      query += ` and n.status = $${paramIndex++}`;
      params.push(status);
    }
    if (notification_type) {
      query += ` and n.notification_type = $${paramIndex++}`;
      params.push(notification_type);
    }
    if (unread_only === 'true') {
      query += ` and n.read_at is null`;
    }
    query += ' order by n.created_at desc limit 100';
    const notifications = await run(query, params);
    res.json(notifications);
  })
);

// PATCH /api/notifications/:id/read - Marquer une notification comme lue
app.patch(
  '/api/notifications/:id/read',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    await run(
      'update notifications set read_at = now(), status = case when status = \'pending\' then \'delivered\' else status end where id = $1 and (recipient_type = \'user\' and recipient_id = $2 or recipient_type = \'all\')',
      [id, user.id]
    );
    res.json({ message: 'Notification marquée comme lue' });
  })
);

// GET /api/notification-preferences - Récupérer les préférences de notifications
app.get(
  '/api/notification-preferences',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Session expirée' });
    }
    const prefs = await run(
      'select * from user_notification_preferences where user_id = $1',
      [user.id]
    );
    res.json(prefs);
  })
);

// PATCH /api/notification-preferences - Mettre à jour les préférences
app.patch(
  '/api/notification-preferences',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Session expirée' });
    }
    const { preferences } = req.body; // Array of {alert_category, notification_type, enabled}
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'preferences doit être un tableau' });
    }
    for (const pref of preferences) {
      const { alert_category, notification_type, enabled } = pref;
      await run(
        `insert into user_notification_preferences (user_id, alert_category, notification_type, enabled)
         values ($1, $2, $3, $4)
         on conflict (user_id, alert_category, notification_type)
         do update set enabled = $4, updated_at = now()`,
        [user.id, alert_category, notification_type, enabled !== false]
      );
    }
    res.json({ message: 'Préférences mises à jour' });
  })
);

// GET /api/alert-category-recipients - Récupérer les destinataires par catégorie
app.get(
  '/api/alert-category-recipients',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const recipients = await run(
      'select * from alert_category_recipients order by alert_category, recipient_type, recipient_value'
    );
    res.json(recipients);
  })
);

// POST /api/alert-category-recipients - Créer un destinataire
app.post(
  '/api/alert-category-recipients',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
    if (!user || !hasRole(user, 'admin')) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const { alert_category, recipient_type, recipient_value, notification_types, enabled } = req.body;
    if (!alert_category || !recipient_type || !recipient_value) {
      return res.status(400).json({ error: 'alert_category, recipient_type et recipient_value sont requis' });
    }
    const [recipient] = await run(
      `insert into alert_category_recipients (alert_category, recipient_type, recipient_value, notification_types, enabled)
       values ($1, $2, $3, $4, $5)
       on conflict (alert_category, recipient_type, recipient_value)
       do update set notification_types = $4, enabled = $5, updated_at = now()
       returning *`,
      [
        alert_category,
        recipient_type,
        recipient_value,
        Array.isArray(notification_types) ? notification_types : ['in_app'],
        enabled !== false
      ]
    );
    res.status(201).json(recipient);
  })
);

// PATCH /api/alert-category-recipients/:id - Mettre à jour un destinataire
app.patch(
  '/api/alert-category-recipients/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
    if (!user || !hasRole(user, 'admin')) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const { id } = req.params;
    const { notification_types, enabled } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (notification_types !== undefined) {
      updates.push(`notification_types = $${paramIndex++}`);
      values.push(Array.isArray(notification_types) ? notification_types : ['in_app']);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(enabled !== false);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification à effectuer' });
    }
    updates.push(`updated_at = now()`);
    values.push(id);
    const [recipient] = await run(
      `update alert_category_recipients set ${updates.join(', ')} where id = $${paramIndex} returning *`,
      values
    );
    if (!recipient) {
      return res.status(404).json({ error: 'Destinataire introuvable' });
    }
    res.json(recipient);
  })
);

// DELETE /api/alert-category-recipients/:id - Supprimer un destinataire
app.delete(
  '/api/alert-category-recipients/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
    if (!user || !hasRole(user, 'admin')) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    const { id } = req.params;
    await run('delete from alert_category_recipients where id = $1', [id]);
    res.json({ message: 'Destinataire supprimé' });
  })
);

// Fonctions de génération automatique d'alertes
const generateAlerts = async () => {
  try {
    // 1. Alertes opérationnelles - Stocks faibles
    const lowStockAlerts = await run(`
      select st.material_id, st.warehouse_id, COALESCE(m.description, m.abrege) as material_name, w.name as warehouse_name,
             st.current_quantity, st.min_threshold
      from stock_thresholds st
      join materials m on m.id = st.material_id
      left join warehouses w on w.id = st.warehouse_id
      where st.current_quantity < st.min_threshold
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'stock'
            and a.entity_id = st.material_id
            and a.alert_type = 'low_stock'
            and a.is_resolved = false
        )
    `);
    for (const stock of lowStockAlerts) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'operational',
          'low_stock',
          stock.current_quantity < stock.min_threshold * 0.5 ? 'critical' : 'high',
          `Stock faible: ${stock.material_name}`,
          `Le stock de ${stock.material_name}${stock.warehouse_name ? ` dans ${stock.warehouse_name}` : ''} est en dessous du seuil minimum (${stock.current_quantity} < ${stock.min_threshold})`,
          'stock',
          stock.material_id,
          JSON.stringify({ warehouse_id: stock.warehouse_id, current_quantity: stock.current_quantity, min_threshold: stock.min_threshold })
        ]
      );
    }

    // 2. Alertes opérationnelles - Véhicules en retard
    const lateVehicles = await run(`
      select r.id, r.vehicle_id, v.plate_number, v.internal_number,
             r.date, r.estimated_completion_time, now() as current_time
      from routes r
      join vehicles v on v.id = r.vehicle_id
      where r.status = 'in_progress'
        and r.estimated_completion_time < now()
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'route'
            and a.entity_id = r.id
            and a.alert_type = 'vehicle_late'
            and a.is_resolved = false
        )
    `);
    for (const vehicle of lateVehicles) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'operational',
          'vehicle_late',
          'high',
          `Véhicule en retard: ${vehicle.plate_number || vehicle.internal_number || 'N/A'}`,
          `Le véhicule ${vehicle.plate_number || vehicle.internal_number || 'N/A'} est en retard sur sa tournée prévue`,
          'route',
          vehicle.id,
          JSON.stringify({ vehicle_id: vehicle.vehicle_id, estimated_completion: vehicle.estimated_completion_time })
        ]
      );
    }

    // 3. Alertes opérationnelles - Interventions urgentes
    const urgentInterventions = await run(`
      select i.id, i.title, i.customer_name, i.priority, i.created_at,
             extract(epoch from (now() - i.created_at)) / 3600 as hours_old
      from interventions i
      where i.status = 'pending'
        and i.priority = 'high'
        and i.created_at < now() - interval '2 hours'
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'intervention'
            and a.entity_id = i.id
            and a.alert_type = 'urgent_intervention'
            and a.is_resolved = false
        )
    `);
    for (const intervention of urgentInterventions) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'operational',
          'urgent_intervention',
          'critical',
          `Intervention urgente en attente: ${intervention.title}`,
          `L'intervention "${intervention.title}" pour ${intervention.customer_name} est en attente depuis ${Math.round(intervention.hours_old)} heures`,
          'intervention',
          intervention.id,
          JSON.stringify({ priority: intervention.priority, hours_old: intervention.hours_old })
        ]
      );
    }

    // 4. Alertes financières - Paiements en retard
    const overduePayments = await run(`
      select i.id, i.invoice_number, i.customer_name, i.total_amount, i.due_date,
             extract(epoch from (now() - i.due_date)) / 86400 as days_overdue
      from invoices i
      where i.status = 'sent'
        and i.due_date < now()
        and not exists (
          select 1 from payments p where p.invoice_id = i.id
        )
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'invoice'
            and a.entity_id = i.id
            and a.alert_type = 'overdue_payment'
            and a.is_resolved = false
        )
    `);
    for (const invoice of overduePayments) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data, due_date
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'financial',
          'overdue_payment',
          invoice.days_overdue > 30 ? 'critical' : invoice.days_overdue > 15 ? 'high' : 'medium',
          `Paiement en retard: ${invoice.invoice_number}`,
          `La facture ${invoice.invoice_number} pour ${invoice.customer_name} (${invoice.total_amount} €) est en retard de ${Math.round(invoice.days_overdue)} jours`,
          'invoice',
          invoice.id,
          JSON.stringify({ amount: invoice.total_amount, days_overdue: invoice.days_overdue }),
          invoice.due_date
        ]
      );
    }

    // 5. Alertes financières - Dépassement de budget
    const budgetOverruns = await run(`
      select db.id, db.department, db.category, db.budget_amount, db.month, db.year,
             coalesce(sum(ic.total_cost), 0) as actual_cost
      from department_budgets db
      left join intervention_costs ic on ic.created_at >= date_trunc('month', make_date(db.year, coalesce(db.month, 1), 1))
        and ic.created_at < date_trunc('month', make_date(db.year, coalesce(db.month, 1), 1)) + interval '1 month'
      where db.budget_amount > 0
        and (coalesce(sum(ic.total_cost), 0) > db.budget_amount * 1.1)
      group by db.id, db.department, db.category, db.budget_amount, db.month, db.year
      having not exists (
        select 1 from alerts a
        where a.entity_type = 'budget'
          and a.entity_id = db.id
          and a.alert_type = 'budget_overrun'
          and a.is_resolved = false
      )
    `);
    for (const budget of budgetOverruns) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'financial',
          'budget_overrun',
          budget.actual_cost > budget.budget_amount * 1.2 ? 'critical' : 'high',
          `Dépassement de budget: ${budget.department} - ${budget.category}`,
          `Le budget ${budget.category} du département ${budget.department} est dépassé (${budget.actual_cost.toFixed(2)} € / ${budget.budget_amount} €)`,
          'budget',
          budget.id,
          JSON.stringify({ department: budget.department, category: budget.category, budget_amount: budget.budget_amount, actual_cost: budget.actual_cost })
        ]
      );
    }

    // 6. Alertes RH - Absences non planifiées
    const unplannedAbsences = await run(`
      select e.id, e.first_name, e.last_name, e.department,
             l.start_date, l.end_date, l.type
      from employees e
      join leave_requests l on l.employee_id = e.id
      where l.status = 'approved'
        and l.start_date <= current_date
        and l.end_date >= current_date
        and l.type not in ('vacances', 'formation')
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'leave'
            and a.entity_id = l.id
            and a.alert_type = 'unplanned_absence'
            and a.is_resolved = false
        )
    `);
    for (const absence of unplannedAbsences) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'hr',
          'unplanned_absence',
          absence.type === 'maladie' ? 'high' : 'medium',
          `Absence non planifiée: ${absence.first_name} ${absence.last_name}`,
          `${absence.first_name} ${absence.last_name} (${absence.department}) est absent(e) pour ${absence.type} du ${absence.start_date} au ${absence.end_date}`,
          'leave',
          absence.id,
          JSON.stringify({ employee_name: `${absence.first_name} ${absence.last_name}`, department: absence.department, type: absence.type })
        ]
      );
    }

    // Envoyer automatiquement les notifications aux destinataires configurés
    await sendAlertNotificationsToRecipients();

    console.log('Alertes générées automatiquement');
  } catch (error) {
    console.error('Erreur génération alertes:', error);
  }
};

// Fonction pour envoyer les notifications aux destinataires configurés
const sendAlertNotificationsToRecipients = async () => {
  try {
    // Récupérer toutes les alertes non résolues créées récemment (dernières 5 minutes)
    const recentAlerts = await run(`
      select id, alert_category, severity, title, message
      from alerts
      where is_resolved = false
        and created_at > now() - interval '5 minutes'
    `);

    if (recentAlerts.length === 0) return;

    // Récupérer les destinataires configurés par catégorie
    const recipients = await run(`
      select * from alert_category_recipients
      where enabled = true
    `);

    for (const alert of recentAlerts) {
      const categoryRecipients = recipients.filter((r) => r.alert_category === alert.alert_category);

      for (const recipient of categoryRecipients) {
        const notificationTypes = recipient.notification_types || ['in_app'];
        let targetUsers: Array<{ id: string; email: string | null; phone: string | null }> = [];

        // Déterminer les utilisateurs cibles selon le type de destinataire
        if (recipient.recipient_type === 'email') {
          // Email direct
          const users = await run('select id, email, phone from users where email = $1', [recipient.recipient_value]);
          if (users.length > 0) {
            targetUsers.push(...users.map((u: any) => ({ id: u.id, email: u.email, phone: u.phone })));
          }
        } else if (recipient.recipient_type === 'phone') {
          // Téléphone direct (chercher dans employees)
          const employees = await run('select user_id, email, phone, personal_phone from employees where phone = $1 or personal_phone = $1', [recipient.recipient_value]);
          for (const emp of employees) {
            if (emp.user_id) {
              const users = await run('select id, email, phone from users where id = $1', [emp.user_id]);
              if (users.length > 0) {
                targetUsers.push({ id: users[0].id, email: users[0].email || emp.email, phone: emp.phone || emp.personal_phone });
              }
            }
          }
        } else if (recipient.recipient_type === 'role') {
          // Par rôle
          const users = await run('select id, email, phone from users where role = $1', [recipient.recipient_value]);
          targetUsers.push(...users.map((u: any) => ({ id: u.id, email: u.email, phone: u.phone })));
        } else if (recipient.recipient_type === 'department') {
          // Par département
          const users = await run('select id, email, phone from users where department = $1', [recipient.recipient_value]);
          targetUsers.push(...users.map((u: any) => ({ id: u.id, email: u.email, phone: u.phone })));
        } else if (recipient.recipient_type === 'user') {
          // Utilisateur spécifique
          const users = await run('select id, email, phone from users where id = $1', [recipient.recipient_value]);
          if (users.length > 0) {
            targetUsers.push(...users.map((u: any) => ({ id: u.id, email: u.email, phone: u.phone })));
          }
        }

        // Créer les notifications pour chaque utilisateur et chaque type
        for (const targetUser of targetUsers) {
          // Vérifier les préférences utilisateur
          for (const notifType of notificationTypes) {
            const prefs = await run(
              'select enabled from user_notification_preferences where user_id = $1 and alert_category = $2 and notification_type = $3',
              [targetUser.id, alert.alert_category, notifType]
            );
            // Si préférence existe et désactivée, ignorer
            if (prefs.length > 0 && !prefs[0].enabled) continue;

            // Créer la notification
            await run(
              `insert into notifications (
                alert_id, notification_type, recipient_type, recipient_id, recipient_email, recipient_phone, status
              ) values ($1, $2, $3, $4, $5, $6, $7)`,
              [
                alert.id,
                notifType,
                'user',
                targetUser.id,
                notifType === 'email' ? targetUser.email : null,
                notifType === 'sms' ? targetUser.phone : null,
                'pending'
              ]
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('Erreur envoi notifications aux destinataires:', error);
  }
};

// Planifier la génération automatique d'alertes toutes les heures
setInterval(() => {
  generateAlerts().catch(console.error);
}, 60 * 60 * 1000); // Toutes les heures

// Générer les alertes au démarrage
generateAlerts().catch(console.error);

const start = async () => {
  try {
    console.log('Initializing database schema...');
    await ensureSchema();
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
  
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start API server', error);
  process.exit(1);
});

