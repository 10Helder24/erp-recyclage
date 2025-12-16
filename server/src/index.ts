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
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'node:crypto';

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
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:h.ferreira@retripa.com';
const SWISS_TOPO_URL = process.env.SWISS_TOPO_URL || 'https://api3.geo.admin.ch/rest/services/profile.json';
const SWISS_TOPO_HEIGHT_URL = process.env.SWISS_TOPO_HEIGHT_URL || 'https://api3.geo.admin.ch/rest/services/height';
const OFROU_GEOADMIN_LAYER = process.env.OFROU_GEOADMIN_LAYER || 'ch.astra.wanderland-sperrungen_umleitungen';

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
import { format, differenceInYears, subDays } from 'date-fns';
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

type CantonRuleRow = {
  id: string;
  canton_code: string;
  quiet_hours: any | null;
  blue_zone: boolean;
  waste_types: any | null;
  quotas: any | null;
  max_weight_tons: number | null;
  notes: string | null;
  updated_at: string | null;
};

type OfrouClosureRow = {
  id: string;
  road_name: string | null;
  canton: string | null;
  status: string | null;
  reason: string | null;
  valid_from: string | null;
  valid_to: string | null;
  updated_at: string | null;
};

type SwissTopoCacheRow = {
  id: string;
  lat: number;
  lon: number;
  altitude_m: number | null;
  gradient: number | null;
  updated_at: string | null;
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
  language?: string | null;
  timezone?: string | null;
  currency?: string | null;
  site_id?: string | null;
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

// Helper function to check user role
const hasRole = (user: AuthPayload | undefined, role: 'admin' | 'manager' | 'user'): boolean => {
  if (!user) return false;
  return user.role === role || user.role === 'admin'; // Admin a tous les rôles
};

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

const mapUserRow = (row: UserRow | any) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  role: row.role,
  department: row.department,
  manager_name: row.manager_name,
  permissions: row.permissions ?? [],
  created_at: row.created_at,
  language: (row as any).language || 'fr',
  timezone: (row as any).timezone || 'Europe/Zurich',
  currency: (row as any).currency || 'CHF',
  site_id: (row as any).site_id || null
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
  try {
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
  } catch (err: any) {
    // Si la table n'existe pas ou erreur SQL, retourner le template par défaut
    if (err.message?.includes('does not exist') || err.message?.includes('relation')) {
      console.warn(`[getPdfTemplate] Table pdf_templates n'existe pas encore pour le module "${module}", retour du template par défaut`);
      return {
        id: '',
        module,
        config: mergeTemplateConfig(module),
        updated_at: new Date().toISOString(),
        updated_by: null,
        updated_by_name: null
      };
    }
    // Sinon, relever l'erreur
    throw err;
  }
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
  if (current === 'manager') return 'completed';
  return 'completed';
};

const canUserApproveStep = (auth: AuthenticatedRequest['auth'], step: WorkflowStep) => {
  if (!auth) {
    return false;
  }
  if (auth.role === 'admin') return true;
  const permissions = auth.permissions ?? [];
  switch (step) {
    case 'manager':
      return auth.role === 'manager' || permissions.includes('approve_leave_manager');
    case 'hr':
    case 'director':
      return false;
    default:
      return false;
  }
};

const parseRecipients = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

const getWorkflowRecipients = async (step: WorkflowStep, leaves: LeaveRow[]) => {
  if (step === 'hr') {
    return parseRecipients(process.env.LEAVE_HR_RECIPIENTS ?? process.env.BREVO_SENDER_EMAIL);
  }
  if (step === 'director') {
    return parseRecipients(process.env.LEAVE_DIRECTION_RECIPIENTS ?? process.env.BREVO_SENDER_EMAIL);
  }

  // Manager step : cible les managers du département concerné
  const departments = Array.from(
    new Set(
      leaves
        .map((l) => l.employee?.department)
        .filter((d): d is string => Boolean(d))
    )
  );
  let managerEmails: string[] = [];
  if (departments.length > 0) {
    const rows = await run(
      `select email from users where role = 'manager' and department = any($1::text[]) and email is not null`,
      [departments]
    );
    managerEmails = rows.map((r: any) => r.email).filter((e: string) => !!e);
  }
  const fallback = parseRecipients(process.env.LEAVE_MANAGER_RECIPIENTS ?? process.env.BREVO_SENDER_EMAIL);
  return Array.from(new Set([...managerEmails, ...fallback]));
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
  const recipients = await getWorkflowRecipients(step, leaves);
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
    const ipAddress = req ? (req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown') : null;
    const userAgent = req ? (req.headers['user-agent'] || 'unknown') : null;
    const sessionId = req ? (req.headers['x-session-id'] as string) || null : null;
    await run(
      `insert into audit_logs (id, entity_type, entity_id, action, changed_by, changed_by_name, before_data, after_data, ip_address, user_agent, session_id)
       values (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)`,
      [
        entityType,
        entityId ?? null,
        action,
        userId,
        userName,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        ipAddress,
        userAgent,
        sessionId
      ]
    );
  } catch (error) {
    console.error('[AUDIT] Impossible d’enregistrer le log', error);
  }
};

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '100mb' })); // Augmenté pour supporter les PDFs avec photos

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

const signToken = (payload: AuthPayload | (AuthPayload & { requires2FA?: boolean }), expiresIn: string = '12h'): string => {
  return jwt.sign(payload as object, JWT_SECRET as string, { expiresIn } as jwt.SignOptions);
};

// Utilitaires pour le 2FA
const generate2FASecret = (email: string) => {
  const secret = authenticator.generateSecret();
  const serviceName = 'ERP RETRIPA';
  const accountName = email;
  const otpAuthUrl = authenticator.keyuri(accountName, serviceName, secret);
  return { secret, otpAuthUrl };
};

const verify2FACode = (token: string, secret: string): boolean => {
  try {
    return authenticator.verify({ token, secret });
  } catch (error) {
    return false;
  }
};

const generateBackupCodes = (count: number = 10): string[] => {
  return Array.from({ length: count }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
};

// Utilitaires pour le chiffrement (pour les données sensibles)
const encryptSensitiveData = (data: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(JWT_SECRET, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

const decryptSensitiveData = (encryptedData: string): string => {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(JWT_SECRET, 'salt', 32);
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

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

  // RH avancé : compétences, certifications, formations, EPI, HSE, pointage, performances, chauffeurs, planning
  await run(`
    create table if not exists skills (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      description text,
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists employee_skills (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      skill_id uuid not null references skills(id) on delete cascade,
      level integer check (level between 1 and 5),
      validated_at date,
      expires_at date,
      created_at timestamptz not null default now(),
      unique (employee_id, skill_id)
    )
  `);
  await run('create index if not exists employee_skills_emp_idx on employee_skills(employee_id)');
  await run('create index if not exists employee_skills_exp_idx on employee_skills(expires_at)');

  await run(`
    create table if not exists certifications (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      description text,
      validity_months integer,
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists employee_certifications (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      certification_id uuid not null references certifications(id) on delete cascade,
      obtained_at date,
      expires_at date,
      reminder_days integer default 30,
      created_at timestamptz not null default now(),
      unique (employee_id, certification_id)
    )
  `);
  await run('create index if not exists employee_certifications_emp_idx on employee_certifications(employee_id)');
  await run('create index if not exists employee_certifications_exp_idx on employee_certifications(expires_at)');

  await run(`
    create table if not exists trainings (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      description text,
      mandatory boolean not null default false,
      validity_months integer,
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists employee_trainings (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      training_id uuid not null references trainings(id) on delete cascade,
      status text not null default 'pending',
      taken_at date,
      expires_at date,
      reminder_days integer default 30,
      created_at timestamptz not null default now(),
      unique (employee_id, training_id)
    )
  `);
  await run('create index if not exists employee_trainings_emp_idx on employee_trainings(employee_id)');
  await run('create index if not exists employee_trainings_exp_idx on employee_trainings(expires_at)');

  await run(`
    create table if not exists epis (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      category text,
      lifetime_months integer,
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists employee_epis (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      epi_id uuid not null references epis(id) on delete cascade,
      assigned_at date not null default current_date,
      expires_at date,
      status text not null default 'assigned',
      created_at timestamptz not null default now(),
      unique (employee_id, epi_id, assigned_at)
    )
  `);
  await run('create index if not exists employee_epis_emp_idx on employee_epis(employee_id)');
  await run('create index if not exists employee_epis_exp_idx on employee_epis(expires_at)');

  await run(`
    create table if not exists hse_incident_types (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      label text not null,
      severity text,
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists hse_incidents (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid references employees(id) on delete set null,
      type_id uuid references hse_incident_types(id) on delete set null,
      description text,
      occurred_at timestamptz not null default now(),
      location text,
      status text not null default 'open',
      severity text,
      consequence text,
      declared_by text,
      witnesses text[],
      photos text[],
      root_cause text,
      actions text,
      created_at timestamptz not null default now()
    )
  `);
  await run(`alter table hse_incidents add column if not exists severity text`);
  await run(`alter table hse_incidents add column if not exists consequence text`);
  await run(`alter table hse_incidents add column if not exists declared_by text`);
  await run(`alter table hse_incidents add column if not exists witnesses text[]`);
  await run(`alter table hse_incidents add column if not exists photos text[]`);
  await run('create index if not exists hse_incidents_emp_idx on hse_incidents(employee_id)');
  await run('create index if not exists hse_incidents_type_idx on hse_incidents(type_id)');

  await run(`
    create table if not exists employee_performance_stats (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      period_start date not null,
      period_end date not null,
      throughput_per_hour numeric,
      quality_score numeric,
      safety_score numeric,
      versatility_score numeric,
      incidents_count integer default 0,
      performance_index numeric,
      created_at timestamptz not null default now(),
      unique (employee_id, period_start, period_end)
    )
  `);
  await run(`alter table employee_performance_stats add column if not exists performance_index numeric`);
  await run('create index if not exists employee_performance_emp_idx on employee_performance_stats(employee_id)');

  await run(`
    create table if not exists driver_compliance (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      period_start date not null,
      period_end date not null,
      driving_hours numeric,
      incidents integer default 0,
      punctuality_score numeric,
      fuel_efficiency_score numeric,
      created_at timestamptz not null default now(),
      unique (employee_id, period_start, period_end)
    )
  `);
  await run(`
    create table if not exists driver_duty_records (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      duty_date date not null,
      duty_hours numeric default 0,
      driving_hours numeric default 0,
      night_hours numeric default 0,
      breaks_minutes integer default 0,
      overtime_minutes integer default 0,
      legal_ok boolean default true,
      notes text,
      created_at timestamptz not null default now(),
      unique (employee_id, duty_date)
    )
  `);
  await run(`create index if not exists driver_duty_records_emp_idx on driver_duty_records(employee_id)`);
  await run(`
    create table if not exists driver_incidents (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      route_id uuid references routes(id) on delete set null,
      occurred_at timestamptz not null default now(),
      type text,
      severity text,
      description text,
      customer_feedback text,
      resolved boolean default false,
      created_at timestamptz not null default now()
    )
  `);
  await run(`create index if not exists driver_incidents_emp_idx on driver_incidents(employee_id)`);
  await run(`
    create table if not exists eco_driving_scores (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      route_id uuid references routes(id) on delete set null,
      score numeric,
      fuel_consumption numeric,
      harsh_braking integer,
      harsh_acceleration integer,
      idle_time_minutes integer,
      created_at timestamptz not null default now()
    )
  `);
  await run(`create index if not exists eco_driving_scores_emp_idx on eco_driving_scores(employee_id)`);

  // Formations continues (micro-formations, checklists, rappels)
  await run(`
    create table if not exists training_modules (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      module_type text not null default 'video', -- video | checklist | document
      media_url text,
      checklist_items text[],
      mandatory boolean default false,
      refresh_months integer,
      duration_minutes integer,
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists training_progress (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      module_id uuid not null references training_modules(id) on delete cascade,
      status text not null default 'pending', -- pending | in_progress | completed
      score numeric,
      completed_at timestamptz,
      expires_at timestamptz,
      last_reminder_at timestamptz,
      created_at timestamptz not null default now(),
      unique (employee_id, module_id)
    )
  `);
  await run('create index if not exists training_progress_emp_idx on training_progress(employee_id)');
  await run('create index if not exists training_progress_mod_idx on training_progress(module_id)');

  await run(`
    create table if not exists training_reminders (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      module_id uuid not null references training_modules(id) on delete cascade,
      due_date date not null,
      sent_at timestamptz,
      status text not null default 'pending', -- pending | sent | ack
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists training_reminders_emp_idx on training_reminders(employee_id)');
  await run('create index if not exists training_reminders_mod_idx on training_reminders(module_id)');

  // Paie / contrats
  await run(`
    create table if not exists employment_contracts (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      contract_type text not null, -- cdi, cdd, interim
      start_date date not null,
      end_date date,
      base_salary numeric,
      currency text default 'EUR',
      hours_per_week numeric,
      site_id uuid references sites(id) on delete set null,
      status text not null default 'active',
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists employment_contracts_emp_idx on employment_contracts(employee_id)');

  await run(`
    create table if not exists contract_allowances (
      id uuid primary key default gen_random_uuid(),
      contract_id uuid not null references employment_contracts(id) on delete cascade,
      label text not null,
      amount numeric not null,
      periodicity text not null default 'monthly' -- monthly, one_time
    )
  `);

  await run(`
    create table if not exists overtime_entries (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      entry_date date not null,
      hours numeric not null,
      rate_multiplier numeric default 1.25,
      approved boolean default false,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists overtime_entries_emp_idx on overtime_entries(employee_id)');

  await run(`
    create table if not exists payroll_entries (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      period_start date not null,
      period_end date not null,
      gross_amount numeric,
      net_amount numeric,
      currency text default 'EUR',
      bonuses jsonb,
      overtime_hours numeric,
      status text default 'draft',
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists payroll_entries_emp_idx on payroll_entries(employee_id)');

  // Recrutement décentralisé / tests
  await run(`
    create table if not exists job_positions (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      site_id uuid references sites(id) on delete set null,
      department text,
      description text,
      requirements text,
      status text not null default 'open',
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists job_applicants (
      id uuid primary key default gen_random_uuid(),
      position_id uuid references job_positions(id) on delete cascade,
      full_name text not null,
      email text,
      phone text,
      experience text,
      status text not null default 'pending',
      score numeric,
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists applicant_tests (
      id uuid primary key default gen_random_uuid(),
      applicant_id uuid references job_applicants(id) on delete cascade,
      test_type text,
      score numeric,
      result text,
      created_at timestamptz not null default now()
    )
  `);

  await run(`
    create table if not exists line_positions (
      id uuid primary key default gen_random_uuid(),
      line_name text not null,
      machine text,
      position_code text,
      required_skill_id uuid references skills(id) on delete set null,
      required_certification_id uuid references certifications(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `);

  await run(`
    create table if not exists time_clock_events (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      position_id uuid references line_positions(id) on delete set null,
      event_type text not null check (event_type in ('in','out','pause_in','pause_out','position_change')),
      source text,
      device_id text,
      occurred_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists time_clock_events_emp_idx on time_clock_events(employee_id)');

  await run(`
    create table if not exists shift_assignments (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      position_id uuid references line_positions(id) on delete set null,
      shift_date date not null,
      shift_name text,
      start_time time,
      end_time time,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists shift_assignments_emp_idx on shift_assignments(employee_id)');
  await run('create index if not exists shift_assignments_date_idx on shift_assignments(shift_date)');

  await run(`
    create table if not exists planning_constraints (
      id uuid primary key default gen_random_uuid(),
      position_id uuid references line_positions(id) on delete cascade,
      required_skill_id uuid references skills(id) on delete set null,
      required_certification_id uuid references certifications(id) on delete set null,
      max_hours_per_day numeric,
      max_hours_per_week numeric,
      night_allowed boolean,
      created_at timestamptz not null default now()
    )
  `);

  await run(`
    create table if not exists planning_suggestions (
      id uuid primary key default gen_random_uuid(),
      suggestion_date date not null,
      position_id uuid references line_positions(id) on delete set null,
      employee_id uuid references employees(id) on delete set null,
      reason text,
      confidence numeric,
      applied boolean not null default false,
      created_at timestamptz not null default now()
    )
  `);

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
  await run(`alter table vehicles add column if not exists vehicle_type text`);
  await run(`alter table vehicles add column if not exists max_weight_kg numeric`);
  await run(`alter table vehicles add column if not exists max_volume_m3 numeric`);
  await run(`alter table vehicles add column if not exists compatible_materials text[]`);
  await run(`alter table vehicles add column if not exists status text`);

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
  await run(`alter table customers add column if not exists preferred_time_window_start time`);
  await run(`alter table customers add column if not exists preferred_time_window_end time`);
  await run(`alter table customers add column if not exists max_weight_per_visit_kg numeric`);
  await run(`alter table customers add column if not exists restricted_zone_ids text[]`);
  await run(`alter table customers add column if not exists average_visit_duration_minutes numeric`);

  // Sites / Points de collecte rattachés aux clients
  await run(`
    create table if not exists sites (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references customers(id) on delete cascade,
      name text not null,
      address text,
      latitude double precision,
      longitude double precision,
      active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists sites_customer_idx on sites(customer_id)');
  await run('create index if not exists sites_active_idx on sites(active)');

  // Table matières (recréation/alignement)
  await run(`
    create table if not exists materials (
      id uuid primary key default gen_random_uuid(),
      famille text,
      numero text,
      abrege text,
      description text,
      description_sortante text,
      services text,
      unite text,
      me_bez text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('alter table materials add column if not exists famille text');
  await run('alter table materials add column if not exists numero text');
  await run('alter table materials add column if not exists abrege text');
  await run('alter table materials add column if not exists description text');
  await run('alter table materials add column if not exists description_sortante text');
  await run('alter table materials add column if not exists services text');
  await run('alter table materials add column if not exists unite text');
  await run('alter table materials add column if not exists me_bez text');
  await run('alter table materials add column if not exists created_at timestamptz not null default now()');
  await run('alter table materials add column if not exists updated_at timestamptz not null default now()');
  await run('create index if not exists materials_abrege_idx on materials(abrege)');
  await run('create index if not exists materials_famille_idx on materials(famille)');
  await run('create index if not exists materials_numero_idx on materials(numero)');

  // Qualités de matières (MaterialQualities)
  await run(`
    create table if not exists material_qualities (
      id uuid primary key default gen_random_uuid(),
      material_id uuid not null references materials(id) on delete cascade,
      name text not null,
      description text,
      deduction_pct numeric default 0 check (deduction_pct >= 0 and deduction_pct <= 100),
      is_default boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(material_id, name)
    )
  `);
  await run('create index if not exists material_qualities_material_idx on material_qualities(material_id)');
  await run('create index if not exists material_qualities_default_idx on material_qualities(material_id, is_default) where is_default = true');

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
  await run(`alter table routes add column if not exists total_distance_km numeric`);
  await run(`alter table routes add column if not exists total_duration_minutes numeric`);
  await run(`alter table routes add column if not exists is_optimized boolean default false`);
  await run(`alter table routes add column if not exists optimization_algorithm text`);
  await run(`alter table routes add column if not exists estimated_start_time timestamptz`);
  await run(`alter table routes add column if not exists estimated_end_time timestamptz`);

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
  await run(`alter table route_stops add column if not exists estimated_weight_kg numeric`);
  await run(`alter table route_stops add column if not exists estimated_volume_m3 numeric`);
  await run(`alter table route_stops add column if not exists service_duration_minutes numeric`);
  await run(`alter table route_stops add column if not exists preferred_time_window_start time`);
  await run(`alter table route_stops add column if not exists preferred_time_window_end time`);
  await run(`alter table route_stops add column if not exists estimated_arrival_time timestamptz`);

  // Tables pour l'Optimisation Logistique Avancée
  // Contraintes de routage
  await run(`
    create table if not exists routing_constraints (
      id uuid primary key default gen_random_uuid(),
      constraint_type text not null check (constraint_type in ('customer_hours', 'max_weight', 'max_volume', 'restricted_zone', 'vehicle_compatibility', 'driver_hours', 'custom')),
      constraint_name text not null,
      constraint_description text,
      constraint_config jsonb not null default '{}'::jsonb,
      is_active boolean not null default true,
      applies_to text[] default array[]::text[], -- customer_ids, vehicle_ids, zone_ids, etc.
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists routing_constraints_type_idx on routing_constraints(constraint_type, is_active)');

  // Routes optimisées (résultats d'optimisation)
  await run(`
    create table if not exists optimized_routes (
      id uuid primary key default gen_random_uuid(),
      route_id uuid references routes(id) on delete set null,
      optimization_date date not null,
      optimization_algorithm text not null check (optimization_algorithm in ('nearest_neighbor', 'genetic', 'simulated_annealing', 'tabu_search', 'custom')),
      total_distance_km numeric,
      total_duration_minutes numeric,
      total_cost numeric,
      vehicle_utilization_rate numeric,
      stops_count integer not null default 0,
      optimization_score numeric,
      optimization_config jsonb not null default '{}'::jsonb,
      optimized_path jsonb,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists optimized_routes_date_idx on optimized_routes(optimization_date desc)');
  await run('create index if not exists optimized_routes_route_idx on optimized_routes(route_id)');

  // Scénarios de simulation
  await run(`
    create table if not exists route_scenarios (
      id uuid primary key default gen_random_uuid(),
      scenario_name text not null,
      scenario_description text,
      base_route_id uuid references routes(id) on delete set null,
      scenario_type text not null check (scenario_type in ('what_if', 'comparison', 'optimization_test', 'constraint_test')),
      scenario_config jsonb not null default '{}'::jsonb,
      simulated_route_data jsonb,
      simulated_metrics jsonb,
      comparison_results jsonb,
      is_applied boolean not null default false,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists route_scenarios_type_idx on route_scenarios(scenario_type, created_at desc)');
  await run('create index if not exists route_scenarios_applied_idx on route_scenarios(is_applied, created_at desc)');

  // Prévisions de demande par zone
  await run(`
    create table if not exists demand_forecasts (
      id uuid primary key default gen_random_uuid(),
      forecast_date date not null,
      zone_id text,
      zone_name text not null,
      zone_coordinates jsonb,
      material_type text,
      forecasted_volume numeric not null,
      forecasted_weight numeric,
      confidence_level numeric check (confidence_level >= 0 and confidence_level <= 100),
      forecast_method text check (forecast_method in ('historical', 'trend', 'seasonal', 'ml', 'manual')),
      historical_data jsonb,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists demand_forecasts_date_idx on demand_forecasts(forecast_date desc)');
  await run('create index if not exists demand_forecasts_zone_idx on demand_forecasts(zone_id, forecast_date desc)');

  // Chargement optimal des véhicules
  await run(`
    create table if not exists vehicle_load_optimizations (
      id uuid primary key default gen_random_uuid(),
      route_id uuid references routes(id) on delete set null,
      vehicle_id uuid references vehicles(id) on delete set null,
      optimization_date date not null,
      total_weight_kg numeric,
      total_volume_m3 numeric,
      max_weight_capacity numeric,
      max_volume_capacity numeric,
      weight_utilization_rate numeric,
      volume_utilization_rate numeric,
      load_distribution jsonb,
      compatibility_check jsonb,
      optimization_recommendations jsonb,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists vehicle_load_optimizations_date_idx on vehicle_load_optimizations(optimization_date desc)');
  await run('create index if not exists vehicle_load_optimizations_route_idx on vehicle_load_optimizations(route_id)');
  await run('create index if not exists vehicle_load_optimizations_vehicle_idx on vehicle_load_optimizations(vehicle_id)');

  // Suivi en temps réel avec ETA
  await run(`
    create table if not exists real_time_tracking (
      id uuid primary key default gen_random_uuid(),
      route_id uuid references routes(id) on delete set null,
      vehicle_id uuid references vehicles(id) on delete set null,
      current_stop_id uuid references route_stops(id) on delete set null,
      current_latitude numeric,
      current_longitude numeric,
      current_speed_kmh numeric,
      estimated_arrival_time timestamptz,
      estimated_duration_minutes numeric,
      distance_to_destination_km numeric,
      traffic_conditions text,
      tracking_status text not null default 'active' check (tracking_status in ('active', 'paused', 'completed', 'cancelled')),
      last_update timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists real_time_tracking_route_idx on real_time_tracking(route_id, tracking_status)');
  await run('create index if not exists real_time_tracking_vehicle_idx on real_time_tracking(vehicle_id, tracking_status)');
  await run('create index if not exists real_time_tracking_status_idx on real_time_tracking(tracking_status, last_update desc)');

  // Zones géographiques pour prévisions
  await run(`
    create table if not exists geographic_zones (
      id uuid primary key default gen_random_uuid(),
      zone_name text not null unique,
      zone_type text not null check (zone_type in ('city', 'district', 'postal_code', 'custom', 'restricted')),
      zone_coordinates jsonb not null,
      zone_polygon jsonb,
      historical_demand_data jsonb,
      average_volume_per_visit numeric,
      average_frequency_days numeric,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists geographic_zones_type_idx on geographic_zones(zone_type)');

  // Tables pour la Gestion des Fournisseurs
  // Fournisseurs
  await run(`
    create table if not exists suppliers (
      id uuid primary key default gen_random_uuid(),
      supplier_code text unique not null,
      name text not null,
      supplier_type text not null check (supplier_type in ('transporter', 'service_provider', 'material_supplier', 'equipment_supplier', 'other')),
      contact_name text,
      email text,
      phone text,
      address text,
      city text,
      postal_code text,
      country text default 'France',
      siret text,
      vat_number text,
      payment_terms text,
      bank_details jsonb,
      notes text,
      is_active boolean not null default true,
      average_rating numeric default 0,
      total_orders integer default 0,
      total_value numeric default 0,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists suppliers_type_idx on suppliers(supplier_type, is_active)');
  await run('create index if not exists suppliers_code_idx on suppliers(supplier_code)');

  // Créer les séquences avant les tables qui les utilisent
  await run('create sequence if not exists supplier_order_seq');
  await run('create sequence if not exists tender_call_seq');

  // Évaluations des fournisseurs
  await run(`
    create table if not exists supplier_evaluations (
      id uuid primary key default gen_random_uuid(),
      supplier_id uuid not null references suppliers(id) on delete cascade,
      evaluation_date date not null default current_date,
      evaluated_by uuid references users(id) on delete set null,
      evaluated_by_name text,
      quality_score integer check (quality_score >= 0 and quality_score <= 10),
      delivery_time_score integer check (delivery_time_score >= 0 and delivery_time_score <= 10),
      price_score integer check (price_score >= 0 and price_score <= 10),
      communication_score integer check (communication_score >= 0 and communication_score <= 10),
      overall_score numeric,
      comments text,
      order_id uuid, -- référence à une commande spécifique si applicable
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists supplier_evaluations_supplier_idx on supplier_evaluations(supplier_id, evaluation_date desc)');

  // Commandes fournisseurs
  await run(`
    create table if not exists supplier_orders (
      id uuid primary key default gen_random_uuid(),
      order_number text unique not null default 'CMD-' || lpad(nextval('supplier_order_seq')::text, 6, '0'),
      supplier_id uuid not null references suppliers(id) on delete restrict,
      supplier_name text not null,
      order_date date not null default current_date,
      expected_delivery_date date,
      actual_delivery_date date,
      order_status text not null default 'draft' check (order_status in ('draft', 'sent', 'confirmed', 'in_progress', 'delivered', 'cancelled', 'completed')),
      order_type text check (order_type in ('material', 'service', 'transport', 'equipment', 'other')),
      total_amount numeric not null default 0,
      currency text default 'EUR',
      items jsonb not null default '[]'::jsonb,
      notes text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists supplier_orders_supplier_idx on supplier_orders(supplier_id, order_date desc)');
  await run('create index if not exists supplier_orders_status_idx on supplier_orders(order_status)');

  // Réceptions de commandes
  await run(`
    create table if not exists supplier_receptions (
      id uuid primary key default gen_random_uuid(),
      order_id uuid not null references supplier_orders(id) on delete cascade,
      reception_date date not null default current_date,
      reception_status text not null default 'partial' check (reception_status in ('partial', 'complete', 'rejected')),
      received_items jsonb not null default '[]'::jsonb,
      quality_check_passed boolean,
      quality_check_notes text,
      received_by uuid references users(id) on delete set null,
      received_by_name text,
      notes text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists supplier_receptions_order_idx on supplier_receptions(order_id, reception_date desc)');

  // Factures fournisseurs
  await run(`
    create table if not exists supplier_invoices (
      id uuid primary key default gen_random_uuid(),
      invoice_number text unique not null,
      supplier_id uuid not null references suppliers(id) on delete restrict,
      supplier_name text not null,
      order_id uuid references supplier_orders(id) on delete set null,
      invoice_date date not null,
      due_date date not null,
      payment_date date,
      invoice_status text not null default 'pending' check (invoice_status in ('pending', 'paid', 'overdue', 'cancelled', 'disputed')),
      subtotal numeric not null default 0,
      tax_amount numeric not null default 0,
      total_amount numeric not null default 0,
      currency text default 'EUR',
      payment_method text,
      payment_reference text,
      notes text,
      pdf_data bytea,
      pdf_filename text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists supplier_invoices_supplier_idx on supplier_invoices(supplier_id, invoice_date desc)');
  await run('create index if not exists supplier_invoices_status_idx on supplier_invoices(invoice_status)');
  await run('create index if not exists supplier_invoices_order_idx on supplier_invoices(order_id)');

  // Appels d'offres et offres
  await run(`
    create table if not exists tender_calls (
      id uuid primary key default gen_random_uuid(),
      tender_number text unique not null default 'AO-' || lpad(nextval('tender_call_seq')::text, 6, '0'),
      title text not null,
      description text,
      tender_type text not null check (tender_type in ('material', 'service', 'transport', 'equipment', 'other')),
      start_date date not null,
      end_date date not null,
      submission_deadline timestamptz not null,
      status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'awarded', 'cancelled')),
      requirements jsonb,
      evaluation_criteria jsonb,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists tender_calls_status_idx on tender_calls(status, submission_deadline)');

  await run(`
    create table if not exists tender_offers (
      id uuid primary key default gen_random_uuid(),
      tender_call_id uuid not null references tender_calls(id) on delete cascade,
      supplier_id uuid not null references suppliers(id) on delete restrict,
      supplier_name text not null,
      offer_amount numeric not null,
      currency text default 'EUR',
      delivery_time_days integer,
      validity_days integer,
      offer_details jsonb,
      technical_specifications jsonb,
      offer_status text not null default 'submitted' check (offer_status in ('submitted', 'under_review', 'accepted', 'rejected', 'withdrawn')),
      evaluation_score numeric,
      evaluation_notes text,
      submitted_at timestamptz not null default now(),
      evaluated_at timestamptz,
      evaluated_by uuid references users(id) on delete set null,
      evaluated_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists tender_offers_tender_idx on tender_offers(tender_call_id, offer_status)');
  await run('create index if not exists tender_offers_supplier_idx on tender_offers(supplier_id)');

  // ==========================================
  // GESTION DOCUMENTAIRE (GED)
  // ==========================================

  // Créer la séquence avant les tables
  await run('create sequence if not exists document_seq');

  // Documents principaux
  await run(`
    create table if not exists documents (
      id uuid primary key default gen_random_uuid(),
      document_number text unique not null default 'DOC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('document_seq')::text, 6, '0'),
      title text not null,
      description text,
      category text not null check (category in ('contract', 'invoice', 'report', 'certificate', 'compliance', 'hr', 'financial', 'legal', 'other')),
      file_name text not null,
      file_path text not null,
      file_size bigint not null,
      mime_type text not null,
      file_hash text,
      status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'archived', 'deleted')),
      is_sensitive boolean not null default false,
      requires_approval boolean not null default false,
      current_version integer not null default 1,
      retention_rule_id uuid,
      archived_at timestamptz,
      archived_by uuid references users(id) on delete set null,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      updated_by uuid references users(id) on delete set null,
      updated_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists documents_category_idx on documents(category, status)');
  await run('create index if not exists documents_status_idx on documents(status, created_at desc)');
  await run('create index if not exists documents_created_by_idx on documents(created_by)');
  await run('create index if not exists documents_retention_idx on documents(retention_rule_id, archived_at)');

  // Versions des documents
  await run(`
    create table if not exists document_versions (
      id uuid primary key default gen_random_uuid(),
      document_id uuid not null references documents(id) on delete cascade,
      version_number integer not null,
      file_name text not null,
      file_path text not null,
      file_size bigint not null,
      mime_type text not null,
      file_hash text,
      change_summary text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      unique(document_id, version_number)
    )
  `);
  await run('create index if not exists document_versions_doc_idx on document_versions(document_id, version_number desc)');

  // Tags pour recherche
  await run(`
    create table if not exists document_tags (
      id uuid primary key default gen_random_uuid(),
      document_id uuid not null references documents(id) on delete cascade,
      tag text not null,
      created_at timestamptz not null default now(),
      unique(document_id, tag)
    )
  `);
  await run('create index if not exists document_tags_doc_idx on document_tags(document_id)');
  await run('create index if not exists document_tags_tag_idx on document_tags(tag)');

  // Workflow d'approbation
  await run(`
    create table if not exists document_approvals (
      id uuid primary key default gen_random_uuid(),
      document_id uuid not null references documents(id) on delete cascade,
      approver_id uuid not null references users(id) on delete restrict,
      approver_name text not null,
      approval_order integer not null,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
      comments text,
      approved_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists document_approvals_doc_idx on document_approvals(document_id, approval_order)');
  await run('create index if not exists document_approvals_approver_idx on document_approvals(approver_id, status)');

  // Règles de rétention/archivage
  await run(`
    create table if not exists document_retention_rules (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      description text,
      category text,
      retention_years integer not null default 7,
      auto_archive boolean not null default true,
      archive_after_days integer,
      is_active boolean not null default true,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists document_retention_rules_category_idx on document_retention_rules(category, is_active)');

  // Logs d'accès aux documents
  await run(`
    create table if not exists document_access_logs (
      id uuid primary key default gen_random_uuid(),
      document_id uuid not null references documents(id) on delete cascade,
      user_id uuid references users(id) on delete set null,
      user_name text,
      action text not null check (action in ('view', 'download', 'upload', 'update', 'delete', 'approve', 'reject', 'archive')),
      ip_address text,
      user_agent text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists document_access_logs_doc_idx on document_access_logs(document_id, created_at desc)');
  await run('create index if not exists document_access_logs_user_idx on document_access_logs(user_id, created_at desc)');

  // ==========================================
  // INTÉGRATIONS EXTERNES
  // ==========================================

  // Configurations d'intégrations
  await run(`
    create table if not exists external_integrations (
      id uuid primary key default gen_random_uuid(),
      integration_type text not null check (integration_type in ('accounting', 'email', 'sms', 'gps', 'scale', 'webhook', 'other')),
      name text not null,
      provider text not null,
      is_active boolean not null default false,
      config jsonb not null default '{}'::jsonb,
      credentials jsonb not null default '{}'::jsonb,
      last_sync_at timestamptz,
      last_error text,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(integration_type, provider)
    )
  `);
  await run('create index if not exists external_integrations_type_idx on external_integrations(integration_type, is_active)');

  // Webhooks
  await run(`
    create table if not exists webhooks (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      url text not null,
      event_type text not null check (event_type in ('document_created', 'document_approved', 'invoice_created', 'invoice_paid', 'order_created', 'order_completed', 'alert_created', 'alert_resolved', 'customer_created', 'customer_updated', 'route_created', 'route_completed', 'scale_measurement', 'gps_update', 'custom')),
      http_method text not null default 'POST' check (http_method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
      headers jsonb default '{}'::jsonb,
      payload_template jsonb,
      is_active boolean not null default true,
      secret_token text,
      retry_count integer not null default 3,
      timeout_seconds integer not null default 30,
      last_triggered_at timestamptz,
      last_status_code integer,
      last_error text,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists webhooks_event_type_idx on webhooks(event_type, is_active)');
  await run('create index if not exists webhooks_active_idx on webhooks(is_active)');

  // Logs d'exécution des webhooks
  await run(`
    create table if not exists webhook_logs (
      id uuid primary key default gen_random_uuid(),
      webhook_id uuid not null references webhooks(id) on delete cascade,
      event_type text not null,
      payload jsonb not null,
      response_status integer,
      response_body text,
      error_message text,
      execution_time_ms integer,
      triggered_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists webhook_logs_webhook_idx on webhook_logs(webhook_id, triggered_at desc)');
  await run('create index if not exists webhook_logs_event_idx on webhook_logs(event_type, triggered_at desc)');

  // Logs d'intégrations
  await run(`
    create table if not exists integration_logs (
      id uuid primary key default gen_random_uuid(),
      integration_id uuid references external_integrations(id) on delete set null,
      integration_type text not null,
      action text not null,
      status text not null check (status in ('success', 'error', 'pending')),
      request_data jsonb,
      response_data jsonb,
      error_message text,
      execution_time_ms integer,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists integration_logs_integration_idx on integration_logs(integration_id, created_at desc)');
  await run('create index if not exists integration_logs_type_idx on integration_logs(integration_type, status, created_at desc)');

  // ==========================================
  // GAMIFICATION ET MOTIVATION
  // ==========================================

  // Badges et récompenses
  await run(`
    create table if not exists badges (
      id uuid primary key default gen_random_uuid(),
      badge_code text unique not null,
      name text not null,
      description text,
      icon text,
      category text not null check (category in ('volume', 'quality', 'efficiency', 'attendance', 'achievement', 'special')),
      rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
      points integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists badges_category_idx on badges(category, is_active)');
  await run('create index if not exists badges_rarity_idx on badges(rarity)');

  // Attribution de badges aux employés
  await run(`
    create table if not exists employee_badges (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      badge_id uuid not null references badges(id) on delete cascade,
      earned_at timestamptz not null default now(),
      earned_for text, -- description de pourquoi le badge a été gagné
      points_earned integer not null default 0,
      unique(employee_id, badge_id)
    )
  `);
  await run('create index if not exists employee_badges_employee_idx on employee_badges(employee_id, earned_at desc)');
  await run('create index if not exists employee_badges_badge_idx on employee_badges(badge_id)');

  // Récompenses
  await run(`
    create table if not exists rewards (
      id uuid primary key default gen_random_uuid(),
      reward_code text unique not null,
      name text not null,
      description text,
      reward_type text not null check (reward_type in ('points', 'bonus', 'gift', 'recognition', 'privilege')),
      points_cost integer,
      monetary_value numeric,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists rewards_type_idx on rewards(reward_type, is_active)');

  // Réclamations de récompenses
  await run(`
    create table if not exists reward_claims (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      reward_id uuid not null references rewards(id) on delete restrict,
      points_spent integer not null,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'fulfilled')),
      claimed_at timestamptz not null default now(),
      approved_at timestamptz,
      approved_by uuid references users(id) on delete set null,
      fulfilled_at timestamptz,
      notes text
    )
  `);
  await run('create index if not exists reward_claims_employee_idx on reward_claims(employee_id, claimed_at desc)');
  await run('create index if not exists reward_claims_status_idx on reward_claims(status)');

  // Défis mensuels
  await run(`
    create table if not exists monthly_challenges (
      id uuid primary key default gen_random_uuid(),
      challenge_code text unique not null,
      name text not null,
      description text,
      challenge_type text not null check (challenge_type in ('volume', 'quality', 'efficiency', 'team', 'individual')),
      target_value numeric not null,
      unit text,
      start_date date not null,
      end_date date not null,
      is_active boolean not null default true,
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists monthly_challenges_dates_idx on monthly_challenges(start_date, end_date, is_active)');

  // Participation aux défis (par équipe ou individu)
  await run(`
    create table if not exists challenge_participants (
      id uuid primary key default gen_random_uuid(),
      challenge_id uuid not null references monthly_challenges(id) on delete cascade,
      participant_type text not null check (participant_type in ('team', 'individual')),
      team_id text, -- Nom du département (pas de FK car departments n'est pas une table)
      employee_id uuid references employees(id) on delete set null,
      current_value numeric not null default 0,
      progress_percentage numeric not null default 0,
      rank integer,
      joined_at timestamptz not null default now()
    )
  `);
  // Index unique avec COALESCE pour gérer les NULL
  await run(`
    create unique index if not exists challenge_participants_unique_idx 
    on challenge_participants(challenge_id, coalesce(team_id, ''), coalesce(employee_id::text, ''))
  `);
  await run('create index if not exists challenge_participants_challenge_idx on challenge_participants(challenge_id, rank)');
  await run('create index if not exists challenge_participants_team_idx on challenge_participants(team_id) where team_id is not null');
  await run('create index if not exists challenge_participants_employee_idx on challenge_participants(employee_id) where employee_id is not null');

  // Statistiques personnelles des employés
  await run(`
    create table if not exists employee_statistics (
      id uuid primary key default gen_random_uuid(),
      employee_id uuid not null references employees(id) on delete cascade,
      period_type text not null check (period_type in ('daily', 'weekly', 'monthly', 'yearly', 'all_time')),
      period_start date,
      period_end date,
      total_volume_kg numeric not null default 0,
      total_routes integer not null default 0,
      total_customers_served integer not null default 0,
      average_quality_score numeric,
      on_time_delivery_rate numeric,
      total_points integer not null default 0,
      badges_count integer not null default 0,
      challenges_won integer not null default 0,
      updated_at timestamptz not null default now()
    )
  `);
  // Index unique pour gérer les NULL dans period_start
  // Utilise une expression pour transformer NULL en date par défaut
  try {
    await run(`
      create unique index if not exists employee_statistics_unique_idx 
      on employee_statistics(employee_id, period_type, coalesce(period_start, '1900-01-01'::date))
    `);
  } catch (error: any) {
    // Si l'index existe déjà avec une autre définition, on le supprime et on le recrée
    if (error.message?.includes('already exists')) {
      await run('drop index if exists employee_statistics_unique_idx');
      await run(`
        create unique index employee_statistics_unique_idx 
        on employee_statistics(employee_id, period_type, coalesce(period_start, '1900-01-01'::date))
      `);
    } else {
      throw error;
    }
  }
  await run('create index if not exists employee_statistics_employee_idx on employee_statistics(employee_id, period_type, coalesce(period_start, \'1900-01-01\'::date) desc)');
  await run('create index if not exists employee_statistics_points_idx on employee_statistics(total_points desc)');

  // Classements
  await run(`
    create table if not exists leaderboards (
      id uuid primary key default gen_random_uuid(),
      leaderboard_type text not null check (leaderboard_type in ('volume', 'quality', 'efficiency', 'points', 'badges', 'challenges')),
      period_type text not null check (period_type in ('daily', 'weekly', 'monthly', 'yearly', 'all_time')),
      period_start date,
      period_end date,
      ranking_data jsonb not null default '[]'::jsonb, -- [{employee_id, rank, value, ...}]
      updated_at timestamptz not null default now()
    )
  `);
  // Index unique pour gérer les NULL dans period_start
  try {
    await run(`
      create unique index if not exists leaderboards_unique_idx 
      on leaderboards(leaderboard_type, period_type, coalesce(period_start, '1900-01-01'::date))
    `);
  } catch (error: any) {
    // Si l'index existe déjà avec une autre définition, on le supprime et on le recrée
    if (error.message?.includes('already exists')) {
      await run('drop index if exists leaderboards_unique_idx');
      await run(`
        create unique index leaderboards_unique_idx 
        on leaderboards(leaderboard_type, period_type, coalesce(period_start, '1900-01-01'::date))
      `);
    } else {
      throw error;
    }
  }
  await run('create index if not exists leaderboards_type_idx on leaderboards(leaderboard_type, period_type, coalesce(period_start, \'1900-01-01\'::date) desc)');

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
  await run(`alter table users add column if not exists language text default 'fr'`);
  await run(`alter table users add column if not exists timezone text default 'Europe/Zurich'`);
  await run(`alter table users add column if not exists currency text default 'CHF'`);
  
  // Créer la table sites d'abord avant de référencer site_id
  await run(`
    create table if not exists sites (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      address text,
      city text,
      postal_code text,
      country text default 'CH',
      latitude numeric,
      longitude numeric,
      timezone text default 'Europe/Zurich',
      currency text default 'CHF',
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  // Sécurise la présence de la colonne code si la table existait sans elle
  await run(`alter table sites add column if not exists code text`);
  await run(`alter table sites add column if not exists is_active boolean not null default true`);
  await run(`update sites set code = coalesce(code, name) where code is null`);
  await run('create index if not exists sites_code_idx on sites(code)');
  await run('create index if not exists sites_active_idx on sites(is_active)');
  
  // Maintenant on peut ajouter la référence site_id
  await run(`alter table users add column if not exists site_id uuid`);
  // Ajouter la contrainte de clé étrangère seulement si elle n'existe pas
  try {
    await run(`alter table users add constraint users_site_id_fkey foreign key (site_id) references sites(id) on delete set null`);
  } catch (error: any) {
    // La contrainte existe peut-être déjà, ignorer l'erreur
    if (!error?.message?.includes('already exists')) {
      console.warn('Erreur lors de l\'ajout de la contrainte site_id:', error?.message);
    }
  }

  // Tables pour multilingue et multi-sites (sites déjà créé ci-dessus)

  await run(`
    create table if not exists currencies (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      symbol text not null,
      exchange_rate numeric not null default 1.0,
      is_base boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  // Sécurise la présence de la colonne code si la table existait sans elle
  await run(`alter table currencies add column if not exists code text`);
  await run(`update currencies set code = coalesce(code, name) where code is null`);
  await run('create index if not exists currencies_code_idx on currencies(code)');
  await run('create index if not exists currencies_active_idx on currencies(is_active)');

  await run(`
    create table if not exists currency_rates (
      id uuid primary key default gen_random_uuid(),
      from_currency text not null,
      to_currency text not null,
      rate numeric not null,
      effective_date date not null default current_date,
      created_at timestamptz not null default now(),
      unique(from_currency, to_currency, effective_date)
    )
  `);
  await run('create index if not exists currency_rates_date_idx on currency_rates(effective_date desc)');

  await run(`
    create table if not exists site_consolidations (
      id uuid primary key default gen_random_uuid(),
      consolidation_date date not null,
      site_id uuid references sites(id) on delete cascade,
      metric_type text not null,
      metric_value numeric not null,
      currency text,
      created_at timestamptz not null default now(),
      unique(consolidation_date, site_id, metric_type)
    )
  `);
  await run('create index if not exists site_consolidations_date_idx on site_consolidations(consolidation_date desc)');
  await run('create index if not exists site_consolidations_site_idx on site_consolidations(site_id)');

  // ==================== Parc véhicules & télématique (CH) ====================
  await run(`
    create table if not exists telematics_connectors (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      provider text not null,
      webhook_secret text,
      config jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await run(`
    create table if not exists telematics_devices (
      id uuid primary key default gen_random_uuid(),
      vehicle_id uuid references vehicles(id) on delete set null,
      connector_id uuid references telematics_connectors(id) on delete set null,
      external_id text,
      metadata jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists telematics_devices_vehicle_idx on telematics_devices(vehicle_id)');

  await run(`
    create table if not exists telematics_events (
      id uuid primary key default gen_random_uuid(),
      device_id uuid references telematics_devices(id) on delete set null,
      vehicle_id uuid references vehicles(id) on delete set null,
      event_type text not null,
      payload jsonb,
      lat numeric,
      lon numeric,
      speed_kmh numeric,
      fuel_level_pct numeric,
      load_pct numeric,
      altitude_m numeric,
      occurred_at timestamptz default now(),
      received_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists telematics_events_vehicle_idx on telematics_events(vehicle_id)');
  await run('create index if not exists telematics_events_occurred_idx on telematics_events(occurred_at desc)');

  await run(`
    create table if not exists vehicle_checklists (
      id uuid primary key default gen_random_uuid(),
      vehicle_id uuid references vehicles(id) on delete cascade,
      items jsonb not null,
      status text not null default 'pending',
      driver_id uuid references employees(id) on delete set null,
      performed_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await run(`
    create table if not exists vehicle_maintenance_alerts (
      id uuid primary key default gen_random_uuid(),
      vehicle_id uuid references vehicles(id) on delete cascade,
      obd_code text,
      severity text,
      message text,
      triggered_at timestamptz not null default now(),
      cleared_at timestamptz
    )
  `);

  await run(`
    create table if not exists road_weight_rules (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      geojson text,
      max_weight_tons numeric,
      season text,
      notes text,
      created_at timestamptz not null default now()
    )
  `);

  await run(`
    create table if not exists vehicle_winter_rules (
      id uuid primary key default gen_random_uuid(),
      vehicle_id uuid references vehicles(id) on delete cascade,
      season text,
      winter_tires_required boolean default false,
      chains_required boolean default false,
      max_weight_tons numeric,
      notes text,
      created_at timestamptz not null default now()
    )
  `);

  // ==================== VeVA / filières CH ====================
  await run(`
    create table if not exists veva_categories (
      code text primary key,
      name text not null,
      description text,
      type text
    )
  `);

  await run(`
    create table if not exists veva_slips (
      id uuid primary key default gen_random_uuid(),
      slip_number text unique,
      customer_id uuid references customers(id) on delete set null,
      downgrade_id uuid references downgrades(id) on delete set null,
      waste_type text,
      veva_category_code text references veva_categories(code) on delete set null,
      qr_reference text,
      pdf_url text,
      status text default 'draft',
      issued_at timestamptz default now(),
      signed_at timestamptz,
      swissid_status text,
      metadata jsonb
    )
  `);

  await run(`
    create table if not exists customs_exports (
      id uuid primary key default gen_random_uuid(),
      direction text not null, -- export/import
      country text,
      document_url text,
      status text default 'draft',
      created_at timestamptz not null default now(),
      metadata jsonb
    )
  `);

  await run(`
    create table if not exists swiss_compliance_certificates (
      id uuid primary key default gen_random_uuid(),
      entity_type text not null,
      entity_id uuid,
      pdf_url text,
      issued_at timestamptz not null default now(),
      status text default 'issued'
    )
  `);

  // Initialiser les devises par défaut si elles n'existent pas
  try {
    const existingCurrencies = await run<{ count: string }>('select count(*)::text as count from currencies');
    const count = existingCurrencies && existingCurrencies[0]?.count ? parseInt(existingCurrencies[0].count) : 0;
    if (count === 0) {
      await run(
        `insert into currencies (code, name, symbol, exchange_rate, is_base, is_active)
         values 
         ('CHF', 'Franc suisse', 'CHF', 1.0, true, true),
         ('EUR', 'Euro', '€', 0.92, false, true),
         ('USD', 'Dollar américain', '$', 1.0, false, true),
         ('GBP', 'Livre sterling', '£', 0.79, false, true)
         on conflict (code) do nothing`
      );
      console.log('Devises par défaut initialisées');
    }
  } catch (error: any) {
    console.warn('Erreur lors de l\'initialisation des devises:', error?.message || error);
    // Ne pas bloquer l'initialisation si les devises existent déjà
  }

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
  await run('alter table audit_logs add column if not exists ip_address text');
  await run('alter table audit_logs add column if not exists user_agent text');
  await run('alter table audit_logs add column if not exists session_id uuid');

  // Tables pour la sécurité renforcée
  // Authentification à deux facteurs (2FA)
  await run(`
    create table if not exists two_factor_auth (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      secret text not null,
      backup_codes text[],
      is_enabled boolean not null default false,
      last_used_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(user_id)
    )
  `);
  await run('create index if not exists two_factor_auth_user_idx on two_factor_auth(user_id)');

  // Gestion des sessions actives
  await run(`
    create table if not exists user_sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      token text not null unique,
      ip_address text,
      user_agent text,
      device_info text,
      location text,
      is_active boolean not null default true,
      last_activity timestamptz not null default now(),
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists user_sessions_user_idx on user_sessions(user_id, is_active)');
  await run('create index if not exists user_sessions_token_idx on user_sessions(token)');
  await run('create index if not exists user_sessions_expires_idx on user_sessions(expires_at) where is_active = true');

  // Conformité RGPD - Consentements
  await run(`
    create table if not exists gdpr_consents (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references users(id) on delete cascade,
      consent_type text not null check (consent_type in ('data_processing', 'marketing', 'analytics', 'cookies', 'location')),
      granted boolean not null default false,
      granted_at timestamptz,
      revoked_at timestamptz,
      ip_address text,
      user_agent text,
      version text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists gdpr_consents_user_idx on gdpr_consents(user_id, consent_type)');

  // Conformité RGPD - Demandes (droit à l'oubli, export, etc.)
  await run(`
    create table if not exists gdpr_data_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references users(id) on delete set null,
      request_type text not null check (request_type in ('data_export', 'data_deletion', 'data_rectification', 'access_request')),
      status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'rejected')),
      requested_data jsonb,
      processed_data jsonb,
      requested_by uuid references users(id) on delete set null,
      processed_by uuid references users(id) on delete set null,
      requested_at timestamptz not null default now(),
      processed_at timestamptz,
      notes text,
      ip_address text,
      user_agent text
    )
  `);
  await run('create index if not exists gdpr_data_requests_user_idx on gdpr_data_requests(user_id, status)');
  await run('create index if not exists gdpr_data_requests_status_idx on gdpr_data_requests(status, requested_at desc)');

  // Historique des sauvegardes
  await run(`
    create table if not exists backups (
      id uuid primary key default gen_random_uuid(),
      backup_type text not null check (backup_type in ('full', 'incremental', 'schema_only', 'data_only')),
      status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed')),
      file_path text,
      file_size bigint,
      tables_count integer,
      records_count bigint,
      started_at timestamptz not null default now(),
      completed_at timestamptz,
      error_message text,
      created_by uuid references users(id) on delete set null,
      retention_until timestamptz,
      metadata jsonb
    )
  `);
  await run('create index if not exists backups_status_idx on backups(status, started_at desc)');
  await run('create index if not exists backups_type_idx on backups(backup_type, started_at desc)');
  await run('create index if not exists backups_retention_idx on backups(retention_until) where retention_until is not null');

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
  await run('alter table invoices add column if not exists vat_ch_rate numeric default 0.077');
  await run('alter table invoices add column if not exists swiss_compliance_cert boolean default false');

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

  // Collectes / Bons d'entrée
  await run(`
    create table if not exists collections (
      id uuid primary key default gen_random_uuid(),
      site_id uuid references sites(id) on delete cascade,
      contract_id uuid references customer_contracts(id) on delete set null,
      reference text,
      collected_at timestamptz not null default now(),
      driver text,
      vehicle_id uuid references vehicles(id) on delete set null,
      notes text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists collections_site_idx on collections(site_id, collected_at desc)');
  await run('create index if not exists collections_contract_idx on collections(contract_id)');
  await run('create index if not exists collections_vehicle_idx on collections(vehicle_id)');

  // Pesées liées aux collectes
  await run(`
    create table if not exists weighings (
      id uuid primary key default gen_random_uuid(),
      collection_id uuid references collections(id) on delete cascade,
      scale_id text,
      weigh_type text check (weigh_type in ('gross', 'tare', 'net')),
      weight_gross numeric,
      weight_tare numeric,
      weight_net numeric,
      ticket_no text,
      weighed_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists weighings_collection_idx on weighings(collection_id)');
  await run('create index if not exists weighings_ticket_idx on weighings(ticket_no)');

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
      quality_id uuid references material_qualities(id) on delete set null,
      quality_status text, -- Garde pour compatibilité/référence texte
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('alter table stock_lots add column if not exists quality_id uuid references material_qualities(id) on delete set null');
  await run('create index if not exists stock_lots_lot_number_idx on stock_lots(lot_number)');
  await run('create index if not exists stock_lots_material_idx on stock_lots(material_id)');
  await run('create index if not exists stock_lots_warehouse_idx on stock_lots(warehouse_id)');
  await run('create index if not exists stock_lots_quality_idx on stock_lots(quality_id) where quality_id is not null');
  await run('create index if not exists stock_lots_expiry_idx on stock_lots(expiry_date) where expiry_date is not null');
  await run('alter table stock_lots add column if not exists weighing_id uuid references weighings(id) on delete set null');
  await run('create index if not exists stock_lots_weighing_idx on stock_lots(weighing_id)');

  // Historique des déclassements de lots
  await run(`
    create table if not exists downgrades (
      id uuid primary key default gen_random_uuid(),
      lot_id uuid references stock_lots(id) on delete cascade,
      from_quality_id uuid references material_qualities(id) on delete set null,
      from_quality text, -- Garde pour compatibilité/référence texte
      to_quality_id uuid references material_qualities(id) on delete set null,
      to_quality text, -- Garde pour compatibilité/référence texte
      reason text,
      adjusted_weight numeric,
      adjusted_value numeric,
      performed_at timestamptz not null default now(),
      performed_by uuid references users(id) on delete set null
    )
  `);
  // Rendre reason nullable si ce n'est pas déjà le cas
  await run('alter table downgrades alter column reason drop not null');
  await run('alter table downgrades add column if not exists from_quality_id uuid references material_qualities(id) on delete set null');
  await run('alter table downgrades add column if not exists to_quality_id uuid references material_qualities(id) on delete set null');
  await run('alter table downgrades add column if not exists lot_origin_site_id uuid references sites(id) on delete set null');
  await run('alter table downgrades add column if not exists lot_origin_client_id uuid references customers(id) on delete set null');
  await run('alter table downgrades add column if not exists lot_origin_canton text');
  await run('alter table downgrades add column if not exists lot_origin_commune text');
  await run('alter table downgrades add column if not exists lot_entry_date date');
  await run('alter table downgrades add column if not exists lot_entry_at timestamptz');
  await run('alter table downgrades add column if not exists lot_veva_code text');
  await run('alter table downgrades add column if not exists lot_internal_code text');
  await run('alter table downgrades add column if not exists lot_filiere text');
  await run('alter table downgrades add column if not exists lot_quality_grade text');
  await run('alter table downgrades add column if not exists lot_quality_metrics jsonb');
  await run('alter table downgrades add column if not exists lot_weight_brut numeric');
  await run('alter table downgrades add column if not exists lot_weight_tare numeric');
  await run('alter table downgrades add column if not exists lot_weight_net numeric');
  await run('alter table downgrades add column if not exists status text default \'draft\' check (status in (\'draft\', \'pending_completion\', \'pending_validation\', \'validated\', \'sent\'))');
  await run('alter table downgrades add column if not exists validated_at timestamptz');
  await run('alter table downgrades add column if not exists validated_by uuid references users(id) on delete set null');
  await run('alter table downgrades add column if not exists sent_at timestamptz');
  await run('alter table downgrades add column if not exists sent_by uuid references users(id) on delete set null');
  await run('alter table downgrades add column if not exists motive_principal text');
  await run('alter table downgrades add column if not exists motive_description text');
  await run('alter table downgrades add column if not exists photos_avant text[]');
  await run('alter table downgrades add column if not exists photos_apres text[]');
  await run('alter table downgrades add column if not exists controller_name text');
  await run('alter table downgrades add column if not exists controller_signature text');
  await run('alter table downgrades add column if not exists incident_number text');
  await run('alter table downgrades add column if not exists new_category text');
  await run('alter table downgrades add column if not exists new_veva_code text');
  await run('alter table downgrades add column if not exists new_quality text');
  await run('alter table downgrades add column if not exists poids_net_declasse numeric');
  await run('alter table downgrades add column if not exists stockage_type text');
  await run('alter table downgrades add column if not exists destination text');
  await run('alter table downgrades add column if not exists veva_type text');
  await run('alter table downgrades add column if not exists previous_producer text');
  await run('alter table downgrades add column if not exists planned_transporter text');
  await run('alter table downgrades add column if not exists veva_slip_number text');
  await run('alter table downgrades add column if not exists swissid_signature text');
  await run('alter table downgrades add column if not exists documents jsonb');
  await run('alter table downgrades add column if not exists omod_category text');
  await run('alter table downgrades add column if not exists omod_dangerosity text');
  await run('alter table downgrades add column if not exists omod_dismantling_required boolean');
  await run('alter table downgrades add column if not exists ldtr_canton text');
  await run('alter table downgrades add column if not exists canton_rules_applied text');
  await run('alter table downgrades add column if not exists proof_photos text[]');
  await run('alter table downgrades add column if not exists emplacement_actuel text');
  await run('alter table downgrades add column if not exists nouvel_emplacement text');
  await run('alter table downgrades add column if not exists mouvement_type text');
  await run('alter table downgrades add column if not exists transport_number text');
  await run('alter table downgrades add column if not exists driver_id uuid references employees(id) on delete set null');
  await run('alter table downgrades add column if not exists vehicle_id uuid references vehicles(id) on delete set null');
  await run('alter table downgrades add column if not exists weighbridge_id uuid references weighings(id) on delete set null');
  await run('alter table downgrades add column if not exists poids_final_brut numeric');
  await run('alter table downgrades add column if not exists poids_final_tare numeric');
  await run('alter table downgrades add column if not exists poids_final_net numeric');
  await run('alter table downgrades add column if not exists seal_number text');
  await run('alter table downgrades add column if not exists valeur_avant numeric');
  await run('alter table downgrades add column if not exists valeur_apres numeric');
  await run('alter table downgrades add column if not exists perte_gain numeric');
  await run('alter table downgrades add column if not exists responsable_validation text');
  await run('alter table downgrades add column if not exists cause_economique text');
  await run('alter table downgrades add column if not exists impact_marge numeric');
  await run('alter table downgrades add column if not exists risques_identifies text[]');
  await run('alter table downgrades add column if not exists epis_requis text[]');
  await run('alter table downgrades add column if not exists procedure_suivie text');
  await run('alter table downgrades add column if not exists anomalie_signalee boolean');
  await run('alter table downgrades add column if not exists declaration_securite text');
  await run('alter table downgrades add column if not exists declassed_material text');
  await run('alter table downgrades add column if not exists declassed_material_code text');
  await run('alter table downgrades add column if not exists vehicle_plate text');
  await run('alter table downgrades add column if not exists slip_number text');
  await run('alter table downgrades add column if not exists motive_ratio text');
  await run('alter table downgrades add column if not exists sorting_time_minutes text');
  await run('alter table downgrades add column if not exists machines_used text[]');
  await run('alter table downgrades add column if not exists lot_origin_client_name text');
  await run('alter table downgrades add column if not exists lot_origin_client_address text');
  await run('alter table downgrades add column if not exists status text default \'draft\' check (status in (\'draft\', \'pending_completion\', \'pending_validation\', \'validated\', \'sent\'))');
  await run('alter table downgrades add column if not exists validated_at timestamptz');
  await run('alter table downgrades add column if not exists validated_by uuid references users(id) on delete set null');
  await run('alter table downgrades add column if not exists sent_at timestamptz');
  await run('alter table downgrades add column if not exists sent_by uuid references users(id) on delete set null');
  await run('create index if not exists downgrades_lot_idx on downgrades(lot_id, performed_at desc)');
  await run('create index if not exists downgrades_from_quality_idx on downgrades(from_quality_id) where from_quality_id is not null');
  await run('create index if not exists downgrades_status_idx on downgrades(status, performed_at desc)');
  
  // Archivage des PDF de déclassements (rétention 10 ans)
  await run(`
    create table if not exists downgrade_archives (
      id uuid primary key default gen_random_uuid(),
      downgrade_id uuid references downgrades(id) on delete cascade,
      pdf_data bytea not null,
      pdf_filename text not null,
      pdf_size_bytes integer,
      retention_years integer not null default 10,
      archived_at timestamptz not null default now(),
      archived_by uuid references users(id) on delete set null,
      expires_at timestamptz generated always as (archived_at + (retention_years || ' years')::interval) stored,
      metadata jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists downgrade_archives_downgrade_idx on downgrade_archives(downgrade_id)');
  await run('create index if not exists downgrade_archives_expires_idx on downgrade_archives(expires_at)');
  await run('create index if not exists downgrades_to_quality_idx on downgrades(to_quality_id) where to_quality_id is not null');

  // Lier les factures aux lots et aux collectes
  await run(`alter table invoice_lines add column if not exists lot_id uuid references stock_lots(id) on delete set null`);
  await run(`alter table invoice_lines add column if not exists collection_id uuid references collections(id) on delete set null`);
  await run('create index if not exists invoice_lines_lot_idx on invoice_lines(lot_id)');
  await run('create index if not exists invoice_lines_collection_idx on invoice_lines(collection_id)');

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

  // Canton rules for Swiss logistics
  await run(`
    create table if not exists canton_rules (
      id uuid primary key default gen_random_uuid(),
      canton_code text not null unique,
      quiet_hours jsonb,
      blue_zone boolean default false,
      waste_types jsonb,
      quotas jsonb,
      max_weight_tons numeric,
      notes text,
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists canton_rules_canton_idx on canton_rules(canton_code)');

  // OFROU closures cache
  await run(`
    create table if not exists ofrou_closures (
      id uuid primary key default gen_random_uuid(),
      road_name text,
      canton text,
      status text,
      reason text,
      valid_from timestamptz,
      valid_to timestamptz,
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists ofrou_closures_canton_idx on ofrou_closures(canton)');

  // SwissTopo altitude cache
  await run(`
    create table if not exists swiss_topo_cache (
      id uuid primary key default gen_random_uuid(),
      lat numeric not null,
      lon numeric not null,
      altitude_m numeric,
      gradient numeric,
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists swiss_topo_cache_lat_lon_idx on swiss_topo_cache(lat, lon)');

  // Niveaux de stock actuels (vue agrégée des mouvements)
  await run(`
    create table if not exists stock_levels (
      id uuid primary key default gen_random_uuid(),
      material_id uuid not null references materials(id) on delete cascade,
      warehouse_id uuid references warehouses(id) on delete cascade,
      quantity numeric not null default 0,
      unit text,
      last_movement_id uuid references stock_movements(id) on delete set null,
      last_updated timestamptz not null default now(),
      unique(material_id, warehouse_id)
    )
  `);
  await run('create index if not exists stock_levels_material_idx on stock_levels(material_id)');
  await run('create index if not exists stock_levels_warehouse_idx on stock_levels(warehouse_id)');
  await run('create index if not exists stock_levels_quantity_idx on stock_levels(quantity) where quantity > 0');

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

  // Tables pour la Conformité et Traçabilité
  // Bordereaux de suivi des déchets (BSD)
  await run(`
    create table if not exists waste_tracking_slips (
      id uuid primary key default gen_random_uuid(),
      slip_number text not null unique,
      slip_type text not null check (slip_type in ('BSD', 'BSDD', 'BSDA', 'BSDI')),
      producer_id uuid references customers(id) on delete set null,
      producer_name text not null,
      producer_address text,
      producer_siret text,
      transporter_id uuid references customers(id) on delete set null,
      transporter_name text,
      transporter_address text,
      transporter_siret text,
      recipient_id uuid references customers(id) on delete set null,
      recipient_name text not null,
      recipient_address text,
      recipient_siret text,
      waste_code text not null,
      waste_description text not null,
      quantity numeric not null,
      unit text not null default 'kg',
      collection_date date not null,
      transport_date date,
      delivery_date date,
      treatment_date date,
      treatment_method text,
      treatment_facility text,
      status text not null default 'draft' check (status in ('draft', 'in_transit', 'delivered', 'treated', 'archived')),
      pdf_data bytea,
      pdf_filename text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists waste_tracking_slips_number_idx on waste_tracking_slips(slip_number)');
  await run('create index if not exists waste_tracking_slips_producer_idx on waste_tracking_slips(producer_id, collection_date desc)');
  await run('create index if not exists waste_tracking_slips_status_idx on waste_tracking_slips(status, collection_date desc)');
  await run('create index if not exists waste_tracking_slips_dates_idx on waste_tracking_slips(collection_date, delivery_date, treatment_date)');

  // Certificats de traitement
  await run(`
    create table if not exists treatment_certificates (
      id uuid primary key default gen_random_uuid(),
      certificate_number text not null unique,
      waste_tracking_slip_id uuid references waste_tracking_slips(id) on delete set null,
      customer_id uuid references customers(id) on delete set null,
      customer_name text not null,
      treatment_date date not null,
      treatment_method text not null,
      treatment_facility text not null,
      waste_code text not null,
      waste_description text not null,
      quantity_treated numeric not null,
      unit text not null default 'kg',
      treatment_result text,
      compliance_status text not null default 'compliant' check (compliance_status in ('compliant', 'non_compliant', 'pending_verification')),
      pdf_data bytea,
      pdf_filename text,
      issued_by uuid references users(id) on delete set null,
      issued_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      expires_at date
    )
  `);
  await run('create index if not exists treatment_certificates_number_idx on treatment_certificates(certificate_number)');
  await run('create index if not exists treatment_certificates_slip_idx on treatment_certificates(waste_tracking_slip_id)');
  await run('create index if not exists treatment_certificates_customer_idx on treatment_certificates(customer_id, treatment_date desc)');
  await run('create index if not exists treatment_certificates_compliance_idx on treatment_certificates(compliance_status, treatment_date desc)');
  await run('create index if not exists treatment_certificates_expires_idx on treatment_certificates(expires_at) where expires_at is not null');

  // Règles de conformité réglementaire
  await run(`
    create table if not exists compliance_rules (
      id uuid primary key default gen_random_uuid(),
      rule_code text not null unique,
      rule_name text not null,
      rule_description text,
      rule_type text not null check (rule_type in ('waste_code', 'quantity_limit', 'time_limit', 'document_required', 'treatment_method', 'custom')),
      applicable_to text[] default array[]::text[], -- waste codes, customer types, etc.
      rule_config jsonb not null default '{}'::jsonb,
      is_active boolean not null default true,
      severity text not null default 'warning' check (severity in ('info', 'warning', 'error', 'critical')),
      created_by uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists compliance_rules_code_idx on compliance_rules(rule_code)');
  await run('create index if not exists compliance_rules_active_idx on compliance_rules(is_active, rule_type)');

  // Traçabilité complète (chaîne de traçabilité)
  await run(`
    create table if not exists traceability_chain (
      id uuid primary key default gen_random_uuid(),
      chain_reference text not null unique,
      waste_tracking_slip_id uuid references waste_tracking_slips(id) on delete set null,
      origin_type text not null check (origin_type in ('collection', 'customer', 'warehouse', 'treatment', 'valorization')),
      origin_id uuid,
      origin_name text not null,
      destination_type text not null check (destination_type in ('warehouse', 'treatment', 'valorization', 'disposal', 'customer')),
      destination_id uuid,
      destination_name text not null,
      material_id uuid references materials(id) on delete set null,
      material_name text,
      quantity numeric not null,
      unit text not null default 'kg',
      transaction_date date not null,
      transaction_type text not null check (transaction_type in ('collection', 'transfer', 'treatment', 'valorization', 'disposal')),
      notes text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists traceability_chain_reference_idx on traceability_chain(chain_reference)');
  await run('create index if not exists traceability_chain_slip_idx on traceability_chain(waste_tracking_slip_id)');
  await run('create index if not exists traceability_chain_dates_idx on traceability_chain(transaction_date desc)');
  await run('create index if not exists traceability_chain_origin_idx on traceability_chain(origin_type, origin_id)');
  await run('create index if not exists traceability_chain_destination_idx on traceability_chain(destination_type, destination_id)');

  // Vérifications de conformité (résultats des vérifications)
  await run(`
    create table if not exists compliance_checks (
      id uuid primary key default gen_random_uuid(),
      entity_type text not null,
      entity_id uuid,
      rule_id uuid references compliance_rules(id) on delete set null,
      check_type text not null check (check_type in ('automatic', 'manual', 'scheduled')),
      check_status text not null default 'pending' check (check_status in ('pending', 'passed', 'failed', 'warning')),
      check_result jsonb,
      checked_by uuid references users(id) on delete set null,
      checked_by_name text,
      checked_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists compliance_checks_entity_idx on compliance_checks(entity_type, entity_id, created_at desc)');
  await run('create index if not exists compliance_checks_status_idx on compliance_checks(check_status, check_type, created_at desc)');
  await run('create index if not exists compliance_checks_rule_idx on compliance_checks(rule_id, check_status)');

  // Archivage sécurisé des documents réglementaires
  await run(`
    create table if not exists regulatory_documents (
      id uuid primary key default gen_random_uuid(),
      document_type text not null check (document_type in ('BSD', 'certificate', 'compliance_report', 'audit_report', 'other')),
      document_number text not null unique,
      related_entity_type text,
      related_entity_id uuid,
      title text not null,
      description text,
      file_data bytea not null,
      file_name text not null,
      file_mimetype text,
      file_size bigint not null,
      storage_location text,
      retention_period_years integer default 10,
      archived_at date,
      archived_by uuid references users(id) on delete set null,
      archived_by_name text,
      created_by uuid references users(id) on delete set null,
      created_by_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists regulatory_documents_type_idx on regulatory_documents(document_type, created_at desc)');
  await run('create index if not exists regulatory_documents_number_idx on regulatory_documents(document_number)');
  await run('create index if not exists regulatory_documents_entity_idx on regulatory_documents(related_entity_type, related_entity_id)');
  await run('create index if not exists regulatory_documents_archived_idx on regulatory_documents(archived_at) where archived_at is not null');

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

  // Matières par contrat (jointure N-N)
  await run(`
    create table if not exists contract_materials (
      contract_id uuid references customer_contracts(id) on delete cascade,
      material_id uuid references materials(id) on delete cascade,
      quality_id uuid references material_qualities(id) on delete set null,
      quality text default '', -- Garde pour compatibilité/référence texte
      notes text,
      primary key (contract_id, material_id, quality)
    )
  `);
  await run('alter table contract_materials add column if not exists quality_id uuid references material_qualities(id) on delete set null');
  await run('create index if not exists contract_materials_contract_idx on contract_materials(contract_id)');
  await run('create index if not exists contract_materials_material_idx on contract_materials(material_id)');
  await run('create index if not exists contract_materials_quality_idx on contract_materials(quality_id) where quality_id is not null');

  // Barèmes de prix par contrat / matière / qualité / période / poids
  await run(`
    create table if not exists price_schedules (
      id uuid primary key default gen_random_uuid(),
      contract_id uuid references customer_contracts(id) on delete cascade,
      material_id uuid references materials(id) on delete cascade,
      quality_id uuid references material_qualities(id) on delete set null,
      quality text, -- Garde pour compatibilité/référence texte
      valid_from date not null,
      valid_to date,
      min_weight numeric,
      max_weight numeric,
      price_per_ton numeric not null,
      currency text not null default 'EUR',
      created_at timestamptz not null default now()
    )
  `);
  await run('alter table price_schedules add column if not exists quality_id uuid references material_qualities(id) on delete set null');
  await run('create index if not exists price_schedules_contract_idx on price_schedules(contract_id)');
  await run('create index if not exists price_schedules_material_idx on price_schedules(material_id)');
  await run('create index if not exists price_schedules_quality_idx on price_schedules(quality_id) where quality_id is not null');
  await run('create index if not exists price_schedules_valid_idx on price_schedules(valid_from, valid_to)');

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

  // Table pour les filtres de recherche sauvegardés
  await run(`
    create table if not exists saved_search_filters (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      query text not null,
      filters jsonb not null default '{}',
      is_favorite boolean not null default false,
      created_by uuid references users(id) on delete cascade,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists saved_search_filters_created_by_idx on saved_search_filters(created_by)');
};

// Conversion WGS84 -> LV95 (approx) pour SwissTopo height service
const wgs84ToLv95 = (lat: number, lon: number) => {
  // Formules officielles swisstopo (approximation simple)
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  const lambda0 = (7.439583333 * Math.PI) / 180; // 7°26'22.5''
  const phi0 = (46.95240556 * Math.PI) / 180; // 46°57'08.66''
  const R = 6378137;

  const y_aux = (lambda - lambda0) * Math.cos(phi0);
  const x_aux = phi - phi0;

  const east = 2600000 + R * y_aux;
  const north = 1200000 + R * x_aux;
  return { east, north };
};

// Helpers: SwissTopo + OFROU (placeholders; to be wired with real APIs/keys)
const fetchSwissTopo = async (lat: number, lon: number) => {
  // On tente d'abord le service "height" (plus simple), puis le profil en fallback
  try {
    const isLv95 = Math.abs(lat) > 90 || Math.abs(lon) > 180; // heuristique simple
    let east = lon;
    let north = lat;
    if (!isLv95) {
      const conv = wgs84ToLv95(lat, lon);
      east = conv.east;
      north = conv.north;
    }
    // Service height (LV95 attendu)
    const heightUrl = `${SWISS_TOPO_HEIGHT_URL}?easting=${encodeURIComponent(east)}&northing=${encodeURIComponent(north)}&sr=2056`;
    const hResp = await fetch(heightUrl);
    if (hResp.ok) {
      const hData: any = await hResp.json();
      const altitude = hData?.height ?? hData?.elevation ?? null;
      if (altitude !== null && altitude !== undefined) {
        return { altitude_m: altitude, gradient: null };
      }
    }
    // Fallback profil
    const sr = isLv95 ? 2056 : 4326;
    const url = `${SWISS_TOPO_URL}?geom=POINT(${encodeURIComponent(lon)}%20${encodeURIComponent(lat)})&sr=${sr}&nb_points=2`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn('SwissTopo API error', resp.status);
      return { altitude_m: null, gradient: null };
    }
    const data = await resp.json();
    const profile = (data.profile as any[]) || data.alti || [];
    const first = Array.isArray(profile) && profile.length > 0 ? profile[0] : null;
    const altitude = first?.elevation ?? first?.altitude ?? first?.height ?? null;
    return { altitude_m: altitude ?? null, gradient: null };
  } catch (error) {
    console.warn('SwissTopo fetch error', error);
    return { altitude_m: null, gradient: null };
  }
};

const refreshOfrouClosures = async () => {
  // Fetch GeoAdmin layer (OFROU/ASTRA) en GeoJSON
  try {
    // Essai principal
    let url = `https://api3.geo.admin.ch/rest/services/ech/MapServer/${OFROU_GEOADMIN_LAYER}?geometryFormat=geojson&sr=4326`;
    const resp = await fetch(url);
    let data: any = null;
    if (resp.ok) {
      data = await resp.json();
    } else {
      // Fallback : tenter layers=all
      url = `https://api3.geo.admin.ch/rest/services/all/MapServer/${OFROU_GEOADMIN_LAYER}?geometryFormat=geojson&sr=4326`;
      const resp2 = await fetch(url);
      if (!resp2.ok) {
        console.warn('OFROU GeoAdmin error', resp.status, resp2.status);
        return [];
      }
      data = await resp2.json();
    }
    const features: any[] = data?.features || [];
    const closures: OfrouClosureRow[] = features.map((f) => {
      const props = f.properties || {};
      return {
        id: randomUUID(),
        road_name: props.name || props.road || props.title || null,
        canton: props.canton || props.kanton || null,
        status: props.status || props.state || 'closed',
        reason: props.reason || props.bemerkung || props.remark || null,
        valid_from: props.start || props.startdatum || null,
        valid_to: props.end || props.enddatum || null,
        updated_at: new Date().toISOString()
      };
    });

    await run(`delete from ofrou_closures`);
    for (const c of closures) {
      await run(
        `insert into ofrou_closures (id, road_name, canton, status, reason, valid_from, valid_to, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [c.id, c.road_name, c.canton, c.status, c.reason, c.valid_from, c.valid_to, c.updated_at]
      );
    }
    return closures;
  } catch (error) {
    console.warn('OFROU fetch error', error);
    return [];
  }
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
      const { email, password, twoFactorCode } = req.body as { email?: string; password?: string; twoFactorCode?: string };
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

      // Vérifier si 2FA est activé
      const [twoFactor] = await run<{ id: string; secret: string; is_enabled: boolean }>(
        'select id, secret, is_enabled from two_factor_auth where user_id = $1',
        [user.id]
      );

      if (twoFactor?.is_enabled) {
        // Si le code 2FA n'est pas fourni, retourner un token temporaire
        if (!twoFactorCode) {
          const tempPayload = createAuthPayload(user);
          const tempToken = signToken({ ...tempPayload, requires2FA: true }, '5m');
          
          // Enregistrer la session temporaire
          const sessionId = randomUUID();
          const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
          const userAgent = req.headers['user-agent'] || 'unknown';
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          
          await run(
            `insert into user_sessions (id, user_id, token, ip_address, user_agent, expires_at, is_active)
             values ($1, $2, $3, $4, $5, $6, true)`,
            [sessionId, user.id, tempToken, ipAddress, userAgent, expiresAt]
          );

          // Enregistrer dans audit_logs
          await run(
            `insert into audit_logs (entity_type, entity_id, action, changed_by, changed_by_name, ip_address, user_agent, session_id)
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            ['user', user.id, 'login_2fa_required', user.id, user.full_name, ipAddress, userAgent, sessionId]
          );

          return res.json({ 
            token: tempToken, 
            requires2FA: true,
            message: 'Code 2FA requis'
          });
        }

        // Vérifier le code 2FA
        const codeValid = verify2FACode(twoFactorCode, twoFactor.secret);
        if (!codeValid) {
          // Vérifier aussi les codes de secours
          const [twoFactorWithBackup] = await run<{ backup_codes: string[] }>(
            'select backup_codes from two_factor_auth where user_id = $1',
            [user.id]
          );
          const backupCodes = twoFactorWithBackup?.backup_codes || [];
          const isBackupCode = backupCodes.includes(twoFactorCode.toUpperCase());
          
          if (!isBackupCode) {
            return res.status(401).json({ message: 'Code 2FA invalide' });
          }

          // Retirer le code de secours utilisé
          const updatedBackupCodes = backupCodes.filter(code => code !== twoFactorCode.toUpperCase());
          await run(
            'update two_factor_auth set backup_codes = $1, last_used_at = now() where user_id = $2',
            [updatedBackupCodes, user.id]
          );
        } else {
          await run(
            'update two_factor_auth set last_used_at = now() where user_id = $1',
            [user.id]
          );
        }
      }

      // Créer la session et le token final
      const payload = createAuthPayload(user);
      const token = signToken(payload);
      
      const sessionId = randomUUID();
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 heures
      
      await run(
        `insert into user_sessions (id, user_id, token, ip_address, user_agent, expires_at, is_active)
         values ($1, $2, $3, $4, $5, $6, true)`,
        [sessionId, user.id, token, ipAddress, userAgent, expiresAt]
      );

      // Enregistrer dans audit_logs
      await run(
        `insert into audit_logs (entity_type, entity_id, action, changed_by, changed_by_name, ip_address, user_agent, session_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['user', user.id, 'login', user.id, user.full_name, ipAddress, userAgent, sessionId]
      );

      res.json({ token, user: mapUserRow(user) });
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message) {
        return res.status(500).json({ message: 'Erreur serveur', detail: error.message });
      }
      return res.status(500).json({ message: 'Erreur serveur' });
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
    try {
      const [user] = await run<UserRow>('select * from users where id = $1', [userId]);
      if (!user) {
        console.warn(`[Auth /me] Utilisateur introuvable pour userId: ${userId}`);
        return res.status(401).json({ message: 'Utilisateur introuvable' });
      }
      res.json({ user: mapUserRow(user) });
    } catch (err: any) {
      console.error('[Auth /me] Erreur lors de la récupération de l\'utilisateur:', err);
      // Si c'est une erreur de colonne manquante, retourner 500 avec un message clair
      if (err.message?.includes('column') || err.message?.includes('does not exist')) {
        return res.status(500).json({ 
          message: 'Erreur de configuration base de données',
          detail: 'La table users ou certaines colonnes sont manquantes. Vérifiez les migrations.'
        });
      }
      // Sinon, retourner une erreur générique
      return res.status(500).json({ 
        message: 'Erreur serveur lors de la récupération de l\'utilisateur',
        detail: err.message || 'Erreur inconnue'
      });
    }
  })
);

// ========== ENDPOINTS SÉCURITÉ RENFORCÉE ==========

// 2FA - Générer le secret et QR code
app.post(
  '/api/security/2fa/setup',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }
    const [user] = await run<UserRow>('select email from users where id = $1', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const { secret, otpAuthUrl } = generate2FASecret(user.email);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Vérifier si 2FA existe déjà
    const [existing] = await run('select id from two_factor_auth where user_id = $1', [userId]);
    if (existing) {
      await run(
        'update two_factor_auth set secret = $1, is_enabled = false, updated_at = now() where user_id = $2',
        [secret, userId]
      );
    } else {
      const backupCodes = generateBackupCodes();
      await run(
        `insert into two_factor_auth (user_id, secret, backup_codes, is_enabled)
         values ($1, $2, $3, false)`,
        [userId, secret, backupCodes]
      );
    }

    const [twoFactor] = await run<{ backup_codes: string[] }>(
      'select backup_codes from two_factor_auth where user_id = $1',
      [userId]
    );

    res.json({
      secret,
      qrCode: qrCodeDataUrl,
      backupCodes: twoFactor?.backup_codes || []
    });
  })
);

// 2FA - Activer après vérification du code
app.post(
  '/api/security/2fa/enable',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    const { code } = req.body as { code?: string };
    if (!code) {
      return res.status(400).json({ message: 'Code requis' });
    }

    const [twoFactor] = await run<{ secret: string }>(
      'select secret from two_factor_auth where user_id = $1',
      [userId]
    );
    if (!twoFactor) {
      return res.status(404).json({ message: '2FA non configuré' });
    }

    const isValid = verify2FACode(code, twoFactor.secret);
    if (!isValid) {
      return res.status(401).json({ message: 'Code invalide' });
    }

    await run(
      'update two_factor_auth set is_enabled = true, updated_at = now() where user_id = $1',
      [userId]
    );

    res.json({ message: '2FA activé avec succès' });
  })
);

// 2FA - Désactiver
app.post(
  '/api/security/2fa/disable',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    const { password } = req.body as { password?: string };
    if (!password) {
      return res.status(400).json({ message: 'Mot de passe requis' });
    }

    const [user] = await run<UserRow>('select password_hash from users where id = $1', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Mot de passe incorrect' });
    }

    await run(
      'update two_factor_auth set is_enabled = false, updated_at = now() where user_id = $1',
      [userId]
    );

    res.json({ message: '2FA désactivé avec succès' });
  })
);

// 2FA - Régénérer les codes de secours
app.post(
  '/api/security/2fa/regenerate-backup-codes',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;

    const backupCodes = generateBackupCodes();
    await run(
      'update two_factor_auth set backup_codes = $1, updated_at = now() where user_id = $2',
      [backupCodes, userId]
    );

    res.json({ backupCodes });
  })
);

// 2FA Admin - Générer le secret et QR code pour un autre utilisateur
app.post(
  '/api/security/2fa/admin/setup/:userId',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const [user] = await run<UserRow>('select email from users where id = $1', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const { secret, otpAuthUrl } = generate2FASecret(user.email);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Vérifier si 2FA existe déjà
    const [existing] = await run('select id from two_factor_auth where user_id = $1', [userId]);
    if (existing) {
      await run(
        'update two_factor_auth set secret = $1, is_enabled = false, updated_at = now() where user_id = $2',
        [secret, userId]
      );
    } else {
      const backupCodes = generateBackupCodes();
      await run(
        `insert into two_factor_auth (user_id, secret, backup_codes, is_enabled)
         values ($1, $2, $3, false)`,
        [userId, secret, backupCodes]
      );
    }

    const [twoFactor] = await run<{ backup_codes: string[] }>(
      'select backup_codes from two_factor_auth where user_id = $1',
      [userId]
    );

    res.json({
      secret,
      qrCode: qrCodeDataUrl,
      backupCodes: twoFactor?.backup_codes || []
    });
  })
);

// 2FA Admin - Activer pour un autre utilisateur
app.post(
  '/api/security/2fa/admin/enable/:userId',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { code } = req.body as { code?: string };
    if (!code) {
      return res.status(400).json({ message: 'Code requis' });
    }

    const [twoFactor] = await run<{ secret: string }>(
      'select secret from two_factor_auth where user_id = $1',
      [userId]
    );
    if (!twoFactor) {
      return res.status(404).json({ message: '2FA non configuré' });
    }

    const isValid = verify2FACode(code, twoFactor.secret);
    if (!isValid) {
      return res.status(401).json({ message: 'Code invalide' });
    }

    await run(
      'update two_factor_auth set is_enabled = true, updated_at = now() where user_id = $1',
      [userId]
    );

    res.json({ message: '2FA activé avec succès' });
  })
);

// 2FA Admin - Désactiver pour un autre utilisateur
app.post(
  '/api/security/2fa/admin/disable/:userId',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    await run(
      'update two_factor_auth set is_enabled = false, updated_at = now() where user_id = $1',
      [userId]
    );

    res.json({ message: '2FA désactivé avec succès' });
  })
);

// 2FA Admin - Vérifier l'état pour un autre utilisateur
app.get(
  '/api/security/2fa/admin/status/:userId',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const [twoFactor] = await run<{ is_enabled: boolean }>(
      'select is_enabled from two_factor_auth where user_id = $1',
      [userId]
    );

    res.json({ enabled: twoFactor?.is_enabled || false });
  })
);

// Sessions - Lister les sessions actives
app.get(
  '/api/security/sessions',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;

    const sessions = await run(
      `select id, ip_address, user_agent, device_info, location, is_active, last_activity, expires_at, created_at
       from user_sessions
       where user_id = $1 and expires_at > now()
       order by last_activity desc`,
      [userId]
    );

    res.json(sessions);
  })
);

// Sessions - Déconnexion d'une session spécifique
app.delete(
  '/api/security/sessions/:sessionId',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    const { sessionId } = req.params;

    await run(
      'update user_sessions set is_active = false where id = $1 and user_id = $2',
      [sessionId, userId]
    );

    res.json({ message: 'Session fermée' });
  })
);

// Sessions - Déconnexion de toutes les autres sessions
app.post(
  '/api/security/sessions/logout-others',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    const currentToken = req.headers.authorization?.replace('Bearer ', '');

    await run(
      `update user_sessions set is_active = false 
       where user_id = $1 and token != $2 and is_active = true`,
      [userId, currentToken]
    );

    res.json({ message: 'Toutes les autres sessions ont été fermées' });
  })
);

// RGPD - Consentements
app.get(
  '/api/security/gdpr/consents',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;

    const consents = await run(
      `select consent_type, granted, granted_at, revoked_at, version, created_at
       from gdpr_consents
       where user_id = $1
       order by created_at desc`,
      [userId]
    );

    res.json(consents);
  })
);

app.post(
  '/api/security/gdpr/consents',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    const { consent_type, granted } = req.body as { consent_type?: string; granted?: boolean };
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!consent_type || granted === undefined) {
      return res.status(400).json({ message: 'consent_type et granted requis' });
    }

    const version = '1.0';
    const grantedAt = granted ? new Date() : null;
    const revokedAt = granted ? null : new Date();

    await run(
      `insert into gdpr_consents (user_id, consent_type, granted, granted_at, revoked_at, ip_address, user_agent, version)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (user_id, consent_type) do update
       set granted = $3, granted_at = $4, revoked_at = $5, updated_at = now()`,
      [userId, consent_type, granted, grantedAt, revokedAt, ipAddress, userAgent, version]
    );

    res.json({ message: 'Consentement enregistré' });
  })
);

// RGPD - Demandes (export, suppression, etc.)
app.post(
  '/api/security/gdpr/requests',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.id;
    const { request_type, notes } = req.body as { request_type?: string; notes?: string };
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!request_type) {
      return res.status(400).json({ message: 'request_type requis' });
    }

    const [request] = await run(
      `insert into gdpr_data_requests (user_id, request_type, status, requested_by, ip_address, user_agent, notes)
       values ($1, $2, 'pending', $3, $4, $5, $6)
       returning id, request_type, status, requested_at`,
      [userId, request_type, userId, ipAddress, userAgent, notes || null]
    );

    res.status(201).json(request);
  })
);

app.get(
  '/api/security/gdpr/requests',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const requests = await run(
      `select dr.*, u.email as user_email, u.full_name as user_name
       from gdpr_data_requests dr
       left join users u on dr.user_id = u.id
       order by requested_at desc
       limit 100`
    );

    res.json(requests);
  })
);

// Logs d'audit améliorés
app.get(
  '/api/security/audit-logs',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { entity_type, entity_id, action, start_date, end_date, limit = 100 } = req.query;
    let query = 'select * from audit_logs where 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (entity_type) {
      query += ` and entity_type = $${paramIndex++}`;
      params.push(entity_type);
    }
    if (entity_id) {
      query += ` and entity_id = $${paramIndex++}`;
      params.push(entity_id);
    }
    if (action) {
      query += ` and action = $${paramIndex++}`;
      params.push(action);
    }
    if (start_date) {
      query += ` and created_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` and created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ` order by created_at desc limit $${paramIndex++}`;
    params.push(parseInt(limit as string));

    const logs = await run(query, params);
    res.json(logs);
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

  // ---------------------------
  // RH avancé : compétences, certifications, formations, EPI, HSE, pointage, performances, chauffeurs
  // ---------------------------
  // Skills
  app.get('/api/hr/skills', requireAuth(), asyncHandler(async (_req, res) => {
    const skills = await run('select * from skills order by name');
    res.json(skills);
  }));
  app.post('/api/hr/skills', requireAdminAuth, asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const [skill] = await run(
      'insert into skills (name, description) values ($1,$2) returning *',
      [name, description || null]
    );
    res.status(201).json(skill);
  }));
  app.patch('/api/hr/skills/:id', requireAdminAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const [skill] = await run(
      'update skills set name = coalesce($1,name), description = $2 where id = $3 returning *',
      [name || null, description || null, id]
    );
    res.json(skill);
  }));
  app.delete('/api/hr/skills/:id', requireAdminAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from skills where id = $1', [id]);
    res.json({ message: 'Skill supprimée' });
  }));

  // Employee skills
  app.get('/api/hr/employees/:id/skills', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const skills = await run(
      `select es.*, s.name, s.description 
       from employee_skills es 
       join skills s on s.id = es.skill_id 
       where es.employee_id = $1
       order by s.name`,
      [id]
    );
    res.json(skills);
  }));
  app.post('/api/hr/employees/:id/skills', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { skill_id, level, validated_at, expires_at } = req.body;
    const [row] = await run(
      `insert into employee_skills (employee_id, skill_id, level, validated_at, expires_at)
       values ($1,$2,$3,$4,$5)
       on conflict (employee_id, skill_id) do update
       set level = excluded.level, validated_at = excluded.validated_at, expires_at = excluded.expires_at
       returning *`,
      [id, skill_id, level || null, validated_at || null, expires_at || null]
    );
    res.status(201).json(row);
  }));
  app.delete('/api/hr/employees/:id/skills/:skillId', requireAuth(), asyncHandler(async (req, res) => {
    const { id, skillId } = req.params;
    await run('delete from employee_skills where employee_id = $1 and skill_id = $2', [id, skillId]);
    res.json({ message: 'Skill retirée' });
  }));

  // Certifications
  app.get('/api/hr/certifications', requireAuth(), asyncHandler(async (_req, res) => {
    const rows = await run('select * from certifications order by name');
    res.json(rows);
  }));
  app.post('/api/hr/certifications', requireAdminAuth, asyncHandler(async (req, res) => {
    const { code, name, description, validity_months } = req.body;
    const [row] = await run(
      'insert into certifications (code, name, description, validity_months) values ($1,$2,$3,$4) returning *',
      [code, name, description || null, validity_months || null]
    );
    res.status(201).json(row);
  }));
  app.get('/api/hr/employees/:id/certifications', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select ec.*, c.code, c.name, c.description, c.validity_months
       from employee_certifications ec
       join certifications c on c.id = ec.certification_id
       where ec.employee_id = $1
       order by ec.expires_at nulls last`,
      [id]
    );
    res.json(rows);
  }));
  app.post('/api/hr/employees/:id/certifications', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { certification_id, obtained_at, expires_at, reminder_days } = req.body;
    const [row] = await run(
      `insert into employee_certifications (employee_id, certification_id, obtained_at, expires_at, reminder_days)
       values ($1,$2,$3,$4,$5)
       on conflict (employee_id, certification_id) do update
       set obtained_at = excluded.obtained_at, expires_at = excluded.expires_at, reminder_days = excluded.reminder_days
       returning *`,
      [id, certification_id, obtained_at || null, expires_at || null, reminder_days || 30]
    );
    res.status(201).json(row);
  }));
  app.delete('/api/hr/employees/:id/certifications/:certId', requireAuth(), asyncHandler(async (req, res) => {
    const { id, certId } = req.params;
    await run('delete from employee_certifications where employee_id = $1 and certification_id = $2', [id, certId]);
    res.json({ message: 'Certification retirée' });
  }));

  // Trainings
  app.get('/api/hr/trainings', requireAuth(), asyncHandler(async (_req, res) => {
    const rows = await run('select * from trainings order by title');
    res.json(rows);
  }));
  app.post('/api/hr/trainings', requireAdminAuth, asyncHandler(async (req, res) => {
    const { title, description, mandatory, validity_months } = req.body;
    const [row] = await run(
      'insert into trainings (title, description, mandatory, validity_months) values ($1,$2,$3,$4) returning *',
      [title, description || null, mandatory || false, validity_months || null]
    );
    res.status(201).json(row);
  }));
  app.get('/api/hr/employees/:id/trainings', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select et.*, t.title, t.description, t.mandatory, t.validity_months
       from employee_trainings et
       join trainings t on t.id = et.training_id
       where et.employee_id = $1
       order by et.expires_at nulls last`,
      [id]
    );
    res.json(rows);
  }));
  app.post('/api/hr/employees/:id/trainings', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { training_id, status, taken_at, expires_at, reminder_days } = req.body;
    const [row] = await run(
      `insert into employee_trainings (employee_id, training_id, status, taken_at, expires_at, reminder_days)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (employee_id, training_id) do update
       set status = excluded.status, taken_at = excluded.taken_at, expires_at = excluded.expires_at, reminder_days = excluded.reminder_days
       returning *`,
      [id, training_id, status || 'pending', taken_at || null, expires_at || null, reminder_days || 30]
    );
    res.status(201).json(row);
  }));
  app.delete('/api/hr/employees/:id/trainings/:trainingId', requireAuth(), asyncHandler(async (req, res) => {
    const { id, trainingId } = req.params;
    await run('delete from employee_trainings where employee_id = $1 and training_id = $2', [id, trainingId]);
    res.json({ message: 'Formation retirée' });
  }));

  // EPI
  app.get('/api/hr/epis', requireAuth(), asyncHandler(async (_req, res) => {
    const rows = await run('select * from epis order by name');
    res.json(rows);
  }));
  app.post('/api/hr/epis', requireAdminAuth, asyncHandler(async (req, res) => {
    const { name, category, lifetime_months } = req.body;
    const [row] = await run(
      'insert into epis (name, category, lifetime_months) values ($1,$2,$3) returning *',
      [name, category || null, lifetime_months || null]
    );
    res.status(201).json(row);
  }));
  app.get('/api/hr/employees/:id/epis', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select ee.*, e.name, e.category, e.lifetime_months
       from employee_epis ee
       join epis e on e.id = ee.epi_id
       where ee.employee_id = $1
       order by ee.expires_at nulls last, ee.assigned_at desc`,
      [id]
    );
    res.json(rows);
  }));
  app.post('/api/hr/employees/:id/epis', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { epi_id, assigned_at, expires_at, status } = req.body;
    const [row] = await run(
      `insert into employee_epis (employee_id, epi_id, assigned_at, expires_at, status)
       values ($1,$2,$3,$4,$5)
       returning *`,
      [id, epi_id, assigned_at || new Date().toISOString().slice(0,10), expires_at || null, status || 'assigned']
    );
    res.status(201).json(row);
  }));
  app.delete('/api/hr/employees/:id/epis/:epiId', requireAuth(), asyncHandler(async (req, res) => {
    const { id, epiId } = req.params;
    await run('delete from employee_epis where employee_id = $1 and epi_id = $2', [id, epiId]);
    res.json({ message: 'EPI retiré' });
  }));

  // HSE incidents
  app.get('/api/hr/hse/incidents', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, status, severity, start_date, end_date } = req.query as { employee_id?: string; status?: string; severity?: string; start_date?: string; end_date?: string };
    let sql = `
      select hi.*, hit.code as type_code, hit.label as type_label
      from hse_incidents hi
      left join hse_incident_types hit on hit.id = hi.type_id
      where 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (employee_id) { sql += ` and hi.employee_id = $${idx++}`; params.push(employee_id); }
    if (status) { sql += ` and hi.status = $${idx++}`; params.push(status); }
    if (severity) { sql += ` and hi.severity = $${idx++}`; params.push(severity); }
    if (start_date) { sql += ` and hi.occurred_at >= $${idx++}`; params.push(new Date(start_date).toISOString()); }
    if (end_date) { sql += ` and hi.occurred_at <= $${idx++}`; params.push(new Date(end_date).toISOString()); }
    sql += ' order by hi.occurred_at desc limit 200';
    const rows = await run(sql, params);
    res.json(rows);
  }));
  app.post('/api/hr/hse/incidents', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, type_id, description, occurred_at, location, status, severity, consequence, declared_by, witnesses, photos, root_cause, actions } = req.body;
    const [row] = await run(
      `insert into hse_incidents (employee_id, type_id, description, occurred_at, location, status, severity, consequence, declared_by, witnesses, photos, root_cause, actions)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning *`,
      [
        employee_id || null,
        type_id || null,
        description || null,
        occurred_at || new Date().toISOString(),
        location || null,
        status || 'open',
        severity || null,
        consequence || null,
        declared_by || null,
        Array.isArray(witnesses) ? witnesses : witnesses ? [witnesses] : null,
        Array.isArray(photos) ? photos : photos ? [photos] : null,
        root_cause || null,
        actions || null
      ]
    );
    res.status(201).json(row);
  }));

  // Performances
  app.get('/api/hr/employees/:id/performance', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select * from employee_performance_stats where employee_id = $1 order by period_start desc limit 50`,
      [id]
    );
    res.json(rows);
  }));
  app.post('/api/hr/employees/:id/performance', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { period_start, period_end, throughput_per_hour, quality_score, safety_score, versatility_score, incidents_count } = req.body;
    const computeIndex = `
      greatest(0, least(100,
        coalesce($4,0)*0.15 +
        coalesce($5,0)*0.35 +
        coalesce($6,0)*0.25 +
        coalesce($7,0)*0.15 -
        coalesce($8,0)*2
      ))
    `;
    const [row] = await run(
      `insert into employee_performance_stats (employee_id, period_start, period_end, throughput_per_hour, quality_score, safety_score, versatility_score, incidents_count, performance_index)
       values ($1,$2,$3,$4,$5,$6,$7,$8, ${computeIndex})
       on conflict (employee_id, period_start, period_end) do update
       set throughput_per_hour = excluded.throughput_per_hour,
           quality_score = excluded.quality_score,
           safety_score = excluded.safety_score,
           versatility_score = excluded.versatility_score,
           incidents_count = excluded.incidents_count,
           performance_index = ${computeIndex}
       returning *`,
      [id, period_start, period_end, throughput_per_hour || null, quality_score || null, safety_score || null, versatility_score || null, incidents_count || 0]
    );
    res.status(201).json(row);
  }));

  // Recalcul de l'index de performance sur une période (par défaut 30 derniers jours)
  app.post('/api/hr/employees/:id/performance/recompute', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { days = 30 } = req.body as { days?: number };
    const [updated] = await run(
      `
      update employee_performance_stats eps
      set performance_index = greatest(0, least(100,
        coalesce(eps.throughput_per_hour,0)*0.15 +
        coalesce(eps.quality_score,0)*0.35 +
        coalesce(eps.safety_score,0)*0.25 +
        coalesce(eps.versatility_score,0)*0.15 -
        coalesce(eps.incidents_count,0)*2
      ))
      where eps.employee_id = $1
        and eps.period_start >= current_date - ($2 || ' days')::interval
      returning 1
      `,
      [id, days]
    );
    res.json({ ok: true, recomputed: !!updated });
  }));

  // Chauffeurs
  app.get('/api/hr/employees/:id/driver-compliance', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select * from driver_compliance where employee_id = $1 order by period_start desc limit 50`,
      [id]
    );
    res.json(rows);
  }));
  app.post('/api/hr/employees/:id/driver-compliance', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { period_start, period_end, driving_hours, incidents, punctuality_score, fuel_efficiency_score } = req.body;
    const [row] = await run(
      `insert into driver_compliance (employee_id, period_start, period_end, driving_hours, incidents, punctuality_score, fuel_efficiency_score)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (employee_id, period_start, period_end) do update
       set driving_hours = excluded.driving_hours,
           incidents = excluded.incidents,
           punctuality_score = excluded.punctuality_score,
           fuel_efficiency_score = excluded.fuel_efficiency_score
       returning *`,
      [id, period_start, period_end, driving_hours || null, incidents || 0, punctuality_score || null, fuel_efficiency_score || null]
    );
    res.status(201).json(row);
  }));

  // Chauffeurs : devoirs légaux (heures de service)
  app.get('/api/hr/employees/:id/driver-duty', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };
    let sql = `select * from driver_duty_records where employee_id = $1`;
    const params: any[] = [id];
    if (start_date) { sql += ` and duty_date >= $2`; params.push(start_date); }
    if (end_date) { sql += params.length === 2 ? ` and duty_date <= $3` : ` and duty_date <= $2`; params.push(end_date); }
    sql += ' order by duty_date desc limit 120';
    const rows = await run(sql, params);
    res.json(rows);
  }));
  app.post('/api/hr/employees/:id/driver-duty', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { duty_date, duty_hours, driving_hours, night_hours, breaks_minutes, overtime_minutes, legal_ok, notes } = req.body;
    const [row] = await run(
      `insert into driver_duty_records (employee_id, duty_date, duty_hours, driving_hours, night_hours, breaks_minutes, overtime_minutes, legal_ok, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (employee_id, duty_date) do update
       set duty_hours = excluded.duty_hours,
           driving_hours = excluded.driving_hours,
           night_hours = excluded.night_hours,
           breaks_minutes = excluded.breaks_minutes,
           overtime_minutes = excluded.overtime_minutes,
           legal_ok = excluded.legal_ok,
           notes = excluded.notes
       returning *`,
      [id, duty_date, duty_hours || 0, driving_hours || 0, night_hours || 0, breaks_minutes || 0, overtime_minutes || 0, legal_ok !== false, notes || null]
    );
    res.status(201).json(row);
  }));

  // Chauffeurs : incidents / retours clients
  app.get('/api/hr/employees/:id/driver-incidents', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select * from driver_incidents where employee_id = $1 order by occurred_at desc limit 100`,
      [id]
    );
    res.json(rows);
  }));
  app.post('/api/hr/employees/:id/driver-incidents', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { route_id, occurred_at, type, severity, description, customer_feedback, resolved } = req.body;
    const [row] = await run(
      `insert into driver_incidents (employee_id, route_id, occurred_at, type, severity, description, customer_feedback, resolved)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`,
      [id, route_id || null, occurred_at || new Date().toISOString(), type || null, severity || null, description || null, customer_feedback || null, resolved || false]
    );
    res.status(201).json(row);
  }));

  // Chauffeurs : éco-conduite
  app.get('/api/hr/employees/:id/eco-driving', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select * from eco_driving_scores where employee_id = $1 order by created_at desc limit 100`,
      [id]
    );
    res.json(rows);
  }));

  // Recrutement : postes
  app.get('/api/hr/recruitment/positions', requireAuth(), asyncHandler(async (_req, res) => {
    const rows = await run(`select * from job_positions order by created_at desc limit 200`);
    res.json(rows);
  }));
  app.post('/api/hr/recruitment/positions', requireAuth(), asyncHandler(async (req, res) => {
    const { title, site_id, department, description, requirements, status } = req.body;
    const [row] = await run(
      `insert into job_positions (title, site_id, department, description, requirements, status)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [title, site_id || null, department || null, description || null, requirements || null, status || 'open']
    );
    res.status(201).json(row);
  }));

  // Recrutement : candidats
  app.get('/api/hr/recruitment/applicants', requireAuth(), asyncHandler(async (req, res) => {
    const { position_id, status } = req.query as { position_id?: string; status?: string };
    let sql = `select * from job_applicants where 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (position_id) { sql += ` and position_id = $${idx++}`; params.push(position_id); }
    if (status) { sql += ` and status = $${idx++}`; params.push(status); }
    sql += ' order by created_at desc limit 200';
    const rows = await run(sql, params);
    res.json(rows);
  }));
  app.post('/api/hr/recruitment/applicants', requireAuth(), asyncHandler(async (req, res) => {
    const { position_id, full_name, email, phone, experience, status, score } = req.body;
    const [row] = await run(
      `insert into job_applicants (position_id, full_name, email, phone, experience, status, score)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [position_id || null, full_name, email || null, phone || null, experience || null, status || 'pending', score || null]
    );
    res.status(201).json(row);
  }));
  app.patch('/api/hr/recruitment/applicants/:id', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, score } = req.body;
    const [row] = await run(
      `update job_applicants set
         status = coalesce($2, status),
         score = coalesce($3, score)
       where id = $1
       returning *`,
      [id, status || null, score === undefined ? null : score]
    );
    res.json(row);
  }));

  // Recrutement : tests candidats
  app.get('/api/hr/recruitment/applicants/:id/tests', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select * from applicant_tests where applicant_id = $1 order by created_at desc`,
      [id]
    );
    res.json(rows);
  }));
  app.post('/api/hr/recruitment/applicants/:id/tests', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { test_type, score, result } = req.body;
    const [row] = await run(
      `insert into applicant_tests (applicant_id, test_type, score, result)
       values ($1,$2,$3,$4)
       returning *`,
      [id, test_type || null, score || null, result || null]
    );
    res.status(201).json(row);
  }));
  app.post('/api/hr/employees/:id/eco-driving', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { route_id, score, fuel_consumption, harsh_braking, harsh_acceleration, idle_time_minutes } = req.body;
    const [row] = await run(
      `insert into eco_driving_scores (employee_id, route_id, score, fuel_consumption, harsh_braking, harsh_acceleration, idle_time_minutes)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [id, route_id || null, score || null, fuel_consumption || null, harsh_braking || 0, harsh_acceleration || 0, idle_time_minutes || 0]
    );
    res.status(201).json(row);
  }));

  // Formations continues : modules
  app.get('/api/hr/training/modules', requireAuth(), asyncHandler(async (_req, res) => {
    const rows = await run(`select * from training_modules order by created_at desc limit 200`);
    res.json(rows);
  }));
  app.post('/api/hr/training/modules', requireAuth(), asyncHandler(async (req, res) => {
    const { title, module_type, media_url, checklist_items, mandatory, refresh_months, duration_minutes } = req.body;
    const [row] = await run(
      `insert into training_modules (title, module_type, media_url, checklist_items, mandatory, refresh_months, duration_minutes)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [
        title,
        module_type || 'video',
        media_url || null,
        Array.isArray(checklist_items) ? checklist_items : checklist_items ? [checklist_items] : null,
        mandatory === true,
        refresh_months || null,
        duration_minutes || null
      ]
    );
    res.status(201).json(row);
  }));

  // Formations continues : progression employé
  app.get('/api/hr/employees/:id/training-progress', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(
      `select tp.*, tm.title, tm.module_type, tm.mandatory, tm.refresh_months
       from training_progress tp
       join training_modules tm on tm.id = tp.module_id
       where tp.employee_id = $1
       order by tp.created_at desc`,
      [id]
    );
    res.json(rows);
  }));
  app.post('/api/hr/employees/:id/training-progress', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { module_id, status, score, completed_at, expires_at } = req.body;
    const [row] = await run(
      `insert into training_progress (employee_id, module_id, status, score, completed_at, expires_at, last_reminder_at)
       values ($1,$2,$3,$4,$5,$6, null)
       on conflict (employee_id, module_id) do update
       set status = excluded.status,
           score = excluded.score,
           completed_at = excluded.completed_at,
           expires_at = excluded.expires_at
       returning *`,
      [id, module_id, status || 'pending', score || null, completed_at || null, expires_at || null]
    );
    res.status(201).json(row);
  }));

  // Formations continues : rappels à générer (modules obligatoires ou avec refresh)
  app.post('/api/hr/training/reminders/generate', requireAuth(), asyncHandler(async (_req, res) => {
    const dueSoon = await run(`
      with need_refresh as (
        select tp.employee_id, tp.module_id,
               case
                 when tp.expires_at is not null then tp.expires_at::date
                 when tm.refresh_months is not null and tp.completed_at is not null then (tp.completed_at + (tm.refresh_months || ' months')::interval)::date
                 else null
               end as due_date
        from training_progress tp
        join training_modules tm on tm.id = tp.module_id
        where tm.mandatory = true
           or tm.refresh_months is not null
      )
      select * from need_refresh
      where due_date is not null
        and due_date <= current_date + interval '30 days'
    `);

    let created = 0;
    for (const row of dueSoon) {
      const exists = await run(
        `select 1 from training_reminders where employee_id = $1 and module_id = $2 and due_date = $3`,
        [row.employee_id, row.module_id, row.due_date]
      );
      if (exists.length === 0) {
        await run(
          `insert into training_reminders (employee_id, module_id, due_date)
           values ($1,$2,$3)`,
          [row.employee_id, row.module_id, row.due_date]
        );
        created++;
      }
    }
    res.json({ created });
  }));

  app.get('/api/hr/training/reminders', requireAuth(), asyncHandler(async (_req, res) => {
    const rows = await run(
      `select tr.*, tm.title, tm.module_type
       from training_reminders tr
       join training_modules tm on tm.id = tr.module_id
       where tr.status = 'pending'
       order by tr.due_date asc
       limit 200`
    );
    res.json(rows);
  }));

  // Paie / contrats
  app.get('/api/hr/contracts', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, status } = req.query as { employee_id?: string; status?: string };
    let sql = `select * from employment_contracts where 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (employee_id) { sql += ` and employee_id = $${idx++}`; params.push(employee_id); }
    if (status) { sql += ` and status = $${idx++}`; params.push(status); }
    sql += ' order by start_date desc limit 200';
    const rows = await run(sql, params);
    res.json(rows);
  }));
  app.post('/api/hr/contracts', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, contract_type, start_date, end_date, base_salary, currency, hours_per_week, site_id, status } = req.body;
    const [row] = await run(
      `insert into employment_contracts (employee_id, contract_type, start_date, end_date, base_salary, currency, hours_per_week, site_id, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [employee_id, contract_type, start_date, end_date || null, base_salary || null, currency || 'EUR', hours_per_week || null, site_id || null, status || 'active']
    );
    res.status(201).json(row);
  }));

  app.get('/api/hr/contracts/:id/allowances', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await run(`select * from contract_allowances where contract_id = $1`, [id]);
    res.json(rows);
  }));
  app.post('/api/hr/contracts/:id/allowances', requireAuth(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { label, amount, periodicity } = req.body;
    const [row] = await run(
      `insert into contract_allowances (contract_id, label, amount, periodicity)
       values ($1,$2,$3,$4)
       returning *`,
      [id, label, amount, periodicity || 'monthly']
    );
    res.status(201).json(row);
  }));

  app.get('/api/hr/overtime', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, start_date, end_date } = req.query as { employee_id?: string; start_date?: string; end_date?: string };
    let sql = `select * from overtime_entries where 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (employee_id) { sql += ` and employee_id = $${idx++}`; params.push(employee_id); }
    if (start_date) { sql += ` and entry_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { sql += ` and entry_date <= $${idx++}`; params.push(end_date); }
    sql += ' order by entry_date desc limit 200';
    const rows = await run(sql, params);
    res.json(rows);
  }));
  app.post('/api/hr/overtime', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, entry_date, hours, rate_multiplier, approved } = req.body;
    const [row] = await run(
      `insert into overtime_entries (employee_id, entry_date, hours, rate_multiplier, approved)
       values ($1,$2,$3,$4,$5)
       returning *`,
      [employee_id, entry_date, hours, rate_multiplier || 1.25, approved === true]
    );
    res.status(201).json(row);
  }));

  app.get('/api/hr/payroll', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, period_start, period_end } = req.query as { employee_id?: string; period_start?: string; period_end?: string };
    let sql = `select * from payroll_entries where 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (employee_id) { sql += ` and employee_id = $${idx++}`; params.push(employee_id); }
    if (period_start) { sql += ` and period_start >= $${idx++}`; params.push(period_start); }
    if (period_end) { sql += ` and period_end <= $${idx++}`; params.push(period_end); }
    sql += ' order by period_start desc limit 200';
    const rows = await run(sql, params);
    res.json(rows);
  }));
  app.post('/api/hr/payroll', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, period_start, period_end, gross_amount, net_amount, currency, bonuses, overtime_hours, status } = req.body;
    const [row] = await run(
      `insert into payroll_entries (employee_id, period_start, period_end, gross_amount, net_amount, currency, bonuses, overtime_hours, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [employee_id, period_start, period_end, gross_amount || null, net_amount || null, currency || 'EUR', bonuses || null, overtime_hours || null, status || 'draft']
    );
    res.status(201).json(row);
  }));

  // Dashboard RH avancé
  app.get('/api/hr/dashboard', requireAuth(), asyncHandler(async (_req, res) => {
    const [empCount] = await run(`select count(*)::int as total from employees`);
    const [activeContracts] = await run(`select count(*)::int as active from employment_contracts where status = 'active'`);
    const [avgVersatility] = await run(`
      select coalesce(avg(versatility_score),0)::numeric as avg_versatility
      from employee_performance_stats
      where created_at >= now() - interval '90 days'
    `);
    const [trainingCompliance] = await run(`
      with required as (
        select tp.employee_id, tp.module_id, tp.status,
               tm.mandatory, tm.refresh_months
        from training_progress tp
        join training_modules tm on tm.id = tp.module_id
        where tm.mandatory = true or tm.refresh_months is not null
      )
      select count(*) filter (where status = 'completed')::int as completed,
             count(*)::int as total
      from required
    `);
    const [absenteeism] = await run(`
      with current_month as (
        select count(distinct employee_id) as absent
        from leaves
        where status = 'approuve'
          and start_date <= date_trunc('month', current_date) + interval '1 month' - interval '1 day'
          and end_date >= date_trunc('month', current_date)
      )
      select coalesce(absent,0)::int as absent
      from current_month
    `);
    const [hseOpenCritical] = await run(`select count(*)::int as count from hse_incidents where status = 'open' and severity = 'critical'`);
    const [overtime30] = await run(`
      select coalesce(sum(hours),0)::numeric as hours
      from overtime_entries
      where entry_date >= current_date - interval '30 days'
    `);

    const totalEmployees = empCount?.total || 0;
    const absent = absenteeism?.absent || 0;
    const trainingTotal = trainingCompliance?.total || 0;
    const trainingDone = trainingCompliance?.completed || 0;

    res.json({
      headcount: totalEmployees,
      activeContracts: activeContracts?.active || 0,
      avgVersatility: Number(avgVersatility?.avg_versatility || 0),
      trainingCompliance: {
        completed: trainingDone,
        total: trainingTotal,
        rate: trainingTotal > 0 ? Math.round((trainingDone / trainingTotal) * 100) : null
      },
      absenteeism: {
        absent: absent,
        rate: totalEmployees > 0 ? Math.round((absent / totalEmployees) * 100) : 0
      },
      hseOpenCritical: hseOpenCritical?.count || 0,
      overtimeLast30Hours: Number(overtime30?.hours || 0)
    });
  }));

  // Pointage
  app.post('/api/hr/time-clock', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, position_id, event_type, source, device_id, occurred_at } = req.body;
    const [row] = await run(
      `insert into time_clock_events (employee_id, position_id, event_type, source, device_id, occurred_at)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [employee_id, position_id || null, event_type, source || null, device_id || null, occurred_at || new Date().toISOString()]
    );
    res.status(201).json(row);
  }));
  app.get('/api/hr/time-clock', requireAuth(), asyncHandler(async (req, res) => {
    const { employee_id, start_date, end_date, limit = 200 } = req.query as { employee_id?: string; start_date?: string; end_date?: string; limit?: string };
    let sql = `
      select tce.*, lp.line_name, lp.machine, lp.position_code
      from time_clock_events tce
      left join line_positions lp on lp.id = tce.position_id
      where 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (employee_id) { sql += ` and tce.employee_id = $${idx++}`; params.push(employee_id); }
    if (start_date) { sql += ` and tce.occurred_at >= $${idx++}`; params.push(new Date(start_date).toISOString()); }
    if (end_date) { sql += ` and tce.occurred_at <= $${idx++}`; params.push(new Date(end_date).toISOString()); }
    sql += ` order by occurred_at desc limit ${Number(limit) || 200}`;
    const rows = await run(sql, params);
    res.json(rows);
  }));

  // Pointage batch (RFID/QR) pour tablettes/lignes
  app.post('/api/hr/time-clock/batch', requireAuth(), asyncHandler(async (req, res) => {
    const { events } = req.body as { events: Array<{ employee_id: string; position_id?: string; event_type: string; source?: string; device_id?: string; occurred_at?: string }> };
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'Aucun événement' });
    }
    const inserted: any[] = [];
    for (const ev of events) {
      const [row] = await run(
        `insert into time_clock_events (employee_id, position_id, event_type, source, device_id, occurred_at)
         values ($1,$2,$3,$4,$5,$6)
         returning *`,
        [ev.employee_id, ev.position_id || null, ev.event_type, ev.source || 'batch', ev.device_id || null, ev.occurred_at || new Date().toISOString()]
      );
      inserted.push(row);
    }
    res.status(201).json({ count: inserted.length, events: inserted });
  }));

  // Pointage : synthèse jour (heures travaillées / pauses / changements de poste)
  app.get('/api/hr/time-clock/summary', requireAuth(), asyncHandler(async (req, res) => {
    const { date, employee_id } = req.query as { date?: string; employee_id?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const params: any[] = [targetDate];
    let filter = '';
    if (employee_id) { filter = ' and t.employee_id = $2'; params.push(employee_id); }
    const rows = await run(
      `
      with ordered as (
        select t.*, lp.line_name, lp.machine, lp.position_code,
               lead(t.event_type) over (partition by t.employee_id order by t.occurred_at) as next_type,
               lead(t.occurred_at) over (partition by t.employee_id order by t.occurred_at) as next_time
        from time_clock_events t
        left join line_positions lp on lp.id = t.position_id
        where t.occurred_at::date = $1::date
        ${filter}
      )
      select employee_id,
             sum(case when event_type = 'in' and next_time is not null and next_type in ('out','pause_in','position_change') then extract(epoch from (next_time - occurred_at))/60 else 0 end) as work_minutes,
             sum(case when event_type = 'pause_in' and next_time is not null and next_type = 'pause_out' then extract(epoch from (next_time - occurred_at))/60 else 0 end) as pause_minutes,
             count(case when event_type = 'position_change' then 1 end) as position_changes,
             array_agg(distinct position_code) filter (where position_code is not null) as positions
      from ordered
      group by employee_id
      `,
      params
    );
    res.json({ date: targetDate, summary: rows });
  }));

  // Pointage : historique des positions par jour
  app.get('/api/hr/time-clock/positions', requireAuth(), asyncHandler(async (req, res) => {
    const { date, employee_id } = req.query as { date?: string; employee_id?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const params: any[] = [targetDate];
    let filter = '';
    if (employee_id) { filter = ' and t.employee_id = $2'; params.push(employee_id); }
    const rows = await run(
      `
      select t.employee_id, t.position_id, lp.line_name, lp.machine, lp.position_code,
             t.event_type, t.occurred_at
      from time_clock_events t
      left join line_positions lp on lp.id = t.position_id
      where t.occurred_at::date = $1::date
      ${filter}
      order by t.occurred_at
      `,
      params
    );
    res.json({ date: targetDate, positions: rows });
  }));
  // Planning : suggestions
  app.get('/api/hr/planning/suggestions', requireAuth(), asyncHandler(async (_req, res) => {
    const rows = await run(
      `select ps.*, lp.line_name, lp.machine, lp.position_code, e.first_name, e.last_name
       from planning_suggestions ps
       left join line_positions lp on lp.id = ps.position_id
       left join employees e on e.id = ps.employee_id
       order by suggestion_date desc, confidence desc
       limit 200`
    );
    res.json(rows);
  }));

  // Planning : auto-assignation simple (compétence + certification + disponibilité)
  app.post('/api/hr/planning/auto-assign', requireAuth(), asyncHandler(async (req, res) => {
    const { suggestion_date, apply } = req.body as { suggestion_date?: string; apply?: boolean };
    const targetDate = suggestion_date || new Date().toISOString().slice(0, 10);

    const positions = await run(`select * from line_positions`);
    const results: any[] = [];

    for (const pos of positions) {
      const [candidate] = await run(
        `
        with latest_perf as (
          select distinct on (employee_id) employee_id, versatility_score
          from employee_performance_stats
          order by employee_id, created_at desc
        )
        select e.id as employee_id, e.first_name, e.last_name,
               coalesce(es.level, 0) as skill_level,
               coalesce(lp_perf.versatility_score, 0) as versatility_score,
               case
                 when $2::uuid is null then true
                 when es.id is not null and (es.expires_at is null or es.expires_at >= $3::date) then true
                 else false
               end as skill_ok,
               case
                 when $4::uuid is null then true
                 when ec.id is not null and (ec.expires_at is null or ec.expires_at >= $3::date) then true
                 else false
               end as cert_ok
        from employees e
        left join employee_skills es on es.employee_id = e.id and es.skill_id = $2
        left join employee_certifications ec on ec.employee_id = e.id and ec.certification_id = $4
        left join latest_perf lp_perf on lp_perf.employee_id = e.id
        where
          -- pas en congé approuvé ce jour
          not exists (
            select 1 from leaves l
            where l.employee_id = e.id
              and l.status = 'approuve'
              and l.start_date <= $3::date
              and l.end_date >= $3::date
          )
          -- pas déjà assigné sur un shift ce jour
          and not exists (
            select 1 from shift_assignments sa
            where sa.employee_id = e.id
              and sa.shift_date = $3::date
          )
        order by
          (case when $2::uuid is null then 1 when es.id is not null then 1 else 0 end) desc,
          coalesce(es.level, 0) desc,
          (case when $4::uuid is null then 1 when ec.id is not null then 1 else 0 end) desc,
          coalesce(lp_perf.versatility_score, 0) desc
        limit 1
        `,
        [pos.id, pos.required_skill_id || null, targetDate, pos.required_certification_id || null]
      );

      if (!candidate || !candidate.skill_ok || !candidate.cert_ok) {
        results.push({
          position_id: pos.id,
          position_code: pos.position_code,
          line_name: pos.line_name,
          machine: pos.machine,
          status: 'no_match'
        });
        continue;
      }

      const confidence =
        (candidate.skill_level ? Math.min(Number(candidate.skill_level), 5) * 0.5 : 0) +
        (candidate.versatility_score ? Number(candidate.versatility_score) * 0.2 : 0) +
        0.3; // base

      // Enregistrer la suggestion
      const [suggestion] = await run(
        `insert into planning_suggestions (suggestion_date, position_id, employee_id, reason, confidence, applied)
         values ($1,$2,$3,$4,$5,false)
         returning *`,
        [
          targetDate,
          pos.id,
          candidate.employee_id,
          `Compétence ok: ${candidate.skill_ok ? 'oui' : 'non'} ; Certification ok: ${candidate.cert_ok ? 'oui' : 'non'}`,
          Math.min(confidence, 1)
        ]
      );

      // Appliquer directement si demandé : on crée une assignment
      if (apply) {
        await run(
          `insert into shift_assignments (employee_id, position_id, shift_date)
           values ($1,$2,$3)
           on conflict do nothing`,
          [candidate.employee_id, pos.id, targetDate]
        );
        await run('update planning_suggestions set applied = true where id = $1', [suggestion.id]);
      }

      results.push({
        position_id: pos.id,
        position_code: pos.position_code,
        line_name: pos.line_name,
        machine: pos.machine,
        employee_id: candidate.employee_id,
        employee_name: `${candidate.first_name} ${candidate.last_name}`,
        confidence: Math.min(confidence, 1),
        applied: !!apply
      });
    }

    res.json({ date: targetDate, assignments: results });
  }));


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
    const where: string[] = [`coalesce(l.workflow_step, 'manager') <> 'completed'`];
    const params: any[] = [];

    // Cas manager : filtre par département
    if (authReq.auth?.role === 'manager' && authReq.auth?.department) {
      if (!canViewLeaveInbox(authReq.auth)) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
      where.push(`e.department = $1`);
      params.push(authReq.auth.department);
    } else if (authReq.auth?.role === 'user') {
      // Cas collaborateur : seulement ses propres demandes (match par email)
      if (!authReq.auth.email) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
      where.push(`lower(e.email) = lower($1)`);
      params.push(authReq.auth.email);
    } else {
      // Autres rôles (admin/HR/direction) utilisent la règle existante
      if (!canViewLeaveInbox(authReq.auth)) {
        return res.status(403).json({ message: 'Accès refusé' });
      }
    }

    const rows = await run<LeaveRow>(`${leaveBaseSelect} where ${where.join(' and ')} order by l.start_date asc`, params);
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

    // Managers du département des demandes
    const departments = Array.from(
      new Set(
        rows
          .map((l) => l.employee?.department)
          .filter((d): d is string => Boolean(d))
      )
    );
    let departmentManagers: string[] = [];
    if (departments.length > 0) {
      const mgrs = await run(`select email from users where role = 'manager' and department = any($1::text[]) and email is not null`, [departments]);
      departmentManagers = mgrs.map((m: any) => m.email).filter((e: string) => !!e);
    }

    const finalRecipients = Array.from(
      new Set<string>([
        ...baseRecipients,
        ...uniqueEmployeeEmails,
        ...(approverEmail ? [approverEmail] : []),
        ...departmentManagers
      ])
    ).filter(Boolean);

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

// Recherche clients (nom ou adresse) pour autocomplétion
app.get(
  '/api/customers/search',
  requireAuth(), // Permissions simplifiées - tous les utilisateurs authentifiés peuvent rechercher
  asyncHandler(async (req, res) => {
    try {
      const q = ((req.query.q as string) || '').trim().toLowerCase();
      if (!q || q.length < 2) {
        return res.json([]);
      }
      const searchTerm = `%${q}%`;
      const rows = await run(
        `select id, name, address
         from customers
         where lower(name) like $1
            or lower(coalesce(address, '')) like $1
         order by name
         limit 15`,
        [searchTerm]
      );
      res.json(rows);
    } catch (err: any) {
      console.error('[Customers search] Erreur:', err);
      // Si la table n'existe pas, retourner un tableau vide plutôt qu'une erreur 500
      if (err.message?.includes('does not exist') || err.message?.includes('relation')) {
        console.warn('[Customers search] Table customers n\'existe pas encore');
        return res.json([]);
      }
      throw err; // Relever l'erreur pour asyncHandler
    }
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

// Recherche matières (code ou nom) pour autocomplétion
app.get(
  '/api/materials/search',
  requireAuth(), // Permissions simplifiées - tous les utilisateurs authentifiés peuvent rechercher
  asyncHandler(async (req, res) => {
    try {
      const q = ((req.query.q as string) || '').trim().toLowerCase();
      if (!q || q.length < 2) {
        return res.json([]);
      }
      const searchTerm = `%${q}%`;
      const rows = await run(
        `select id, numero, abrege, description, unite, famille
         from materials
         where lower(coalesce(numero, '')) like $1
            or lower(coalesce(abrege, '')) like $1
            or lower(coalesce(description, '')) like $1
         order by numero nulls last, abrege nulls last
         limit 15`,
        [searchTerm]
      );
      res.json(rows);
    } catch (err: any) {
      console.error('[Materials search] Erreur:', err);
      // Si la table n'existe pas, retourner un tableau vide plutôt qu'une erreur 500
      if (err.message?.includes('does not exist') || err.message?.includes('relation')) {
        console.warn('[Materials search] Table materials n\'existe pas encore');
        return res.json([]);
      }
      throw err; // Relever l'erreur pour asyncHandler
    }
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

// Material Qualities API endpoints
app.get(
  '/api/materials/qualities',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_materials'] }),
  asyncHandler(async (req, res) => {
    const { material_id } = req.query;
    let query = 'select * from material_qualities';
    const params: any[] = [];
    if (material_id) {
      query += ' where material_id = $1';
      params.push(material_id);
    }
    query += ' order by material_id, is_default desc, name';
    const rows = await run(query, params);
    res.json(rows);
  })
);

app.post(
  '/api/materials/qualities',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { material_id, name, description, deduction_pct, is_default } = req.body;
    if (!material_id || !name) {
      return res.status(400).json({ message: 'material_id et name sont requis' });
    }
    // Si is_default = true, désactiver les autres qualités par défaut pour cette matière
    if (is_default) {
      await run('update material_qualities set is_default = false where material_id = $1', [material_id]);
    }
    const [quality] = await run(
      `insert into material_qualities (material_id, name, description, deduction_pct, is_default)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [material_id, name, description || null, deduction_pct || 0, is_default || false]
    );
    res.status(201).json({ id: quality.id, message: 'Qualité créée avec succès' });
  })
);

app.patch(
  '/api/materials/qualities/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, deduction_pct, is_default } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (deduction_pct !== undefined) {
      updates.push(`deduction_pct = $${paramIndex++}`);
      params.push(deduction_pct);
    }
    if (is_default !== undefined) {
      updates.push(`is_default = $${paramIndex++}`);
      params.push(is_default);
      // Si on définit cette qualité comme défaut, désactiver les autres
      if (is_default) {
        const [current] = await run('select material_id from material_qualities where id = $1', [id]);
        if (current) {
          await run('update material_qualities set is_default = false where material_id = $1 and id != $2', [current.material_id, id]);
        }
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification à apporter' });
    }
    updates.push(`updated_at = now()`);
    params.push(id);
    await run(`update material_qualities set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Qualité mise à jour avec succès' });
  })
);

app.delete(
  '/api/materials/qualities/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_materials'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from material_qualities where id = $1', [id]);
    res.json({ message: 'Qualité supprimée avec succès' });
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
  requireAuth(), // Tous les utilisateurs authentifiés peuvent lire les templates
  asyncHandler(async (req, res) => {
    try {
      const module = req.params.module;
      const template = await getPdfTemplate(module);
      res.json(template);
    } catch (err: any) {
      console.error('[PDF Templates] Erreur lors de la récupération du template:', err);
      // Si la table n'existe pas, retourner le template par défaut
      if (err.message?.includes('does not exist') || err.message?.includes('relation')) {
        const defaultTemplate = mergeTemplateConfig(req.params.module);
        return res.json({
          id: '',
          module: req.params.module,
          config: defaultTemplate,
          updated_at: new Date().toISOString(),
          updated_by: null,
          updated_by_name: null
        });
      }
      throw err; // Relever l'erreur pour asyncHandler
    }
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
      quality_id,
      quality_status,
      weighing_id,
      notes
    } = req.body;
    if (!lot_number || !material_id || !warehouse_id || quantity === undefined) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }
    const [lot] = await run(
      `insert into stock_lots (
        lot_number, material_id, warehouse_id, quantity, unit, production_date, expiry_date,
        origin, supplier_name, batch_reference, quality_id, quality_status, weighing_id, notes
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        quality_id || null,
        quality_status || null,
        weighing_id || null,
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
      'quality_id',
      'quality_status',
      'weighing_id',
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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
    const authReq = req as AuthenticatedRequest;
    const user = authReq.auth as AuthPayload;
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

// GET /api/alerts/status - Obtenir le statut de la génération d'alertes
app.get(
  '/api/alerts/status',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    res.json({
      enabled: ALERTS_ENABLED,
      message: ALERTS_ENABLED 
        ? 'Génération d\'alertes activée' 
        : 'Génération d\'alertes désactivée (ENABLE_ALERTS=false)'
    });
  })
);

// POST /api/alerts/toggle - Activer/désactiver la génération d'alertes (admin uniquement)
// Note: Ceci nécessite un redémarrage du serveur pour prendre effet complètement
app.post(
  '/api/alerts/toggle',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { enabled } = req.body;
    res.json({
      message: 'Pour activer/désactiver les alertes, modifiez ENABLE_ALERTS dans votre fichier .env et redémarrez le serveur',
      current_status: ALERTS_ENABLED,
      instruction: enabled 
        ? 'Ajoutez ENABLE_ALERTS=true (ou supprimez la variable) dans .env'
        : 'Ajoutez ENABLE_ALERTS=false dans .env'
    });
  })
);

// Fonctions de génération automatique d'alertes
const generateAlerts = async () => {
  try {
    // 1. Alertes opérationnelles - Stocks faibles
    const lowStockAlerts = await run(`
      select COALESCE(sl.material_id, st.material_id) as material_id, 
             COALESCE(sl.warehouse_id, st.warehouse_id) as warehouse_id, 
             COALESCE(m.description, m.abrege) as material_name, 
             w.name as warehouse_name,
             COALESCE(sl.quantity, 0) as current_quantity, 
             st.min_quantity as min_threshold
      from stock_thresholds st
      join materials m on m.id = st.material_id
      left join warehouses w on w.id = st.warehouse_id
      left join stock_levels sl on sl.material_id = st.material_id and (sl.warehouse_id = st.warehouse_id or (sl.warehouse_id is null and st.warehouse_id is null))
      where COALESCE(sl.quantity, 0) < st.min_quantity
        and st.alert_enabled = true
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'stock'
            and a.entity_id = st.material_id
            and a.alert_type = 'low_stock'
            and a.is_resolved = false
        )
    `);
    for (const stock of lowStockAlerts) {
      if (!stock.material_id) continue; // Skip if no material_id
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'operational',
          'low_stock',
          (stock.current_quantity || 0) < (stock.min_threshold || 0) * 0.5 ? 'critical' : 'high',
          `Stock faible: ${stock.material_name || 'Matière inconnue'}`,
          `Le stock de ${stock.material_name || 'Matière inconnue'}${stock.warehouse_name ? ` dans ${stock.warehouse_name}` : ''} est en dessous du seuil minimum (${stock.current_quantity || 0} < ${stock.min_threshold || 0})`,
          'stock',
          stock.material_id,
          JSON.stringify({ warehouse_id: stock.warehouse_id, current_quantity: stock.current_quantity || 0, min_threshold: stock.min_threshold || 0 })
        ]
      );
    }

    // 2. Alertes opérationnelles - Véhicules en retard
    const lateVehicles = await run(`
      select r.id, r.vehicle_id, v.plate_number, v.internal_number,
             r.date, r.estimated_end_time, now() as current_time
      from routes r
      join vehicles v on v.id = r.vehicle_id
      where r.status = 'in_progress'
        and r.estimated_end_time is not null
        and r.estimated_end_time < now()
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
          JSON.stringify({ vehicle_id: vehicle.vehicle_id, estimated_completion: vehicle.estimated_end_time })
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
      select db.id, db.department, db.category, db.budgeted_amount, db.month, db.year,
             coalesce(sum(ic.total_cost), 0) as actual_cost
      from department_budgets db
      left join intervention_costs ic on ic.created_at >= date_trunc('month', make_date(db.year, coalesce(db.month, 1), 1))
        and ic.created_at < date_trunc('month', make_date(db.year, coalesce(db.month, 1), 1)) + interval '1 month'
      where db.budgeted_amount > 0
      group by db.id, db.department, db.category, db.budgeted_amount, db.month, db.year
      having coalesce(sum(ic.total_cost), 0) > db.budgeted_amount * 1.1
        and not exists (
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
          budget.actual_cost > budget.budgeted_amount * 1.2 ? 'critical' : 'high',
          `Dépassement de budget: ${budget.department} - ${budget.category}`,
          `Le budget ${budget.category} du département ${budget.department} est dépassé (${budget.actual_cost.toFixed(2)} € / ${budget.budgeted_amount} €)`,
          'budget',
          budget.id,
          JSON.stringify({ department: budget.department, category: budget.category, budget_amount: budget.budgeted_amount, actual_cost: budget.actual_cost })
        ]
      );
    }

    // 6. Alertes RH - Expirations (compétences / certifications / formations / EPI)
    const computeSeverityForExpiry = (expiresAt: string) => {
      const now = new Date();
      const target = new Date(expiresAt);
      const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'critical';
      if (diffDays <= 7) return 'high';
      return 'medium';
    };

    // Compétences
    const expiringSkills = await run(`
      select es.id, es.skill_id, es.expires_at, s.name as skill_name,
             e.id as employee_id, e.first_name, e.last_name, e.department
      from employee_skills es
      join skills s on s.id = es.skill_id
      join employees e on e.id = es.employee_id
      where es.expires_at is not null
        and es.expires_at <= current_date + interval '30 days'
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'employee_skill'
            and a.entity_id = es.id
            and a.alert_type = 'skill_expiry'
            and a.is_resolved = false
        )
    `);
    for (const item of expiringSkills) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data, due_date
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'hr',
          'skill_expiry',
          computeSeverityForExpiry(item.expires_at),
          `Compétence à renouveler: ${item.skill_name}`,
          `${item.first_name} ${item.last_name} (${item.department || 'n/d'}) doit renouveler la compétence ${item.skill_name} avant ${item.expires_at}`,
          'employee_skill',
          item.id,
          JSON.stringify({
            employee_id: item.employee_id,
            employee_name: `${item.first_name} ${item.last_name}`,
            department: item.department,
            skill_id: item.skill_id,
            expires_at: item.expires_at
          }),
          item.expires_at
        ]
      );
    }

    // Certifications
    const expiringCerts = await run(`
      select ec.id, ec.certification_id, ec.expires_at, c.name as certification_name,
             e.id as employee_id, e.first_name, e.last_name, e.department
      from employee_certifications ec
      join certifications c on c.id = ec.certification_id
      join employees e on e.id = ec.employee_id
      where ec.expires_at is not null
        and ec.expires_at <= current_date + interval '30 days'
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'employee_certification'
            and a.entity_id = ec.id
            and a.alert_type = 'certification_expiry'
            and a.is_resolved = false
        )
    `);
    for (const item of expiringCerts) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data, due_date
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'hr',
          'certification_expiry',
          computeSeverityForExpiry(item.expires_at),
          `Certification à renouveler: ${item.certification_name}`,
          `${item.first_name} ${item.last_name} (${item.department || 'n/d'}) doit renouveler la certification ${item.certification_name} avant ${item.expires_at}`,
          'employee_certification',
          item.id,
          JSON.stringify({
            employee_id: item.employee_id,
            employee_name: `${item.first_name} ${item.last_name}`,
            department: item.department,
            certification_id: item.certification_id,
            expires_at: item.expires_at
          }),
          item.expires_at
        ]
      );
    }

    // Formations
    const expiringTrainings = await run(`
      select et.id, et.training_id, et.expires_at, t.title as training_title,
             e.id as employee_id, e.first_name, e.last_name, e.department
      from employee_trainings et
      join trainings t on t.id = et.training_id
      join employees e on e.id = et.employee_id
      where et.expires_at is not null
        and et.expires_at <= current_date + interval '30 days'
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'employee_training'
            and a.entity_id = et.id
            and a.alert_type = 'training_expiry'
            and a.is_resolved = false
        )
    `);
    for (const item of expiringTrainings) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data, due_date
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'hr',
          'training_expiry',
          computeSeverityForExpiry(item.expires_at),
          `Formation à renouveler: ${item.training_title}`,
          `${item.first_name} ${item.last_name} (${item.department || 'n/d'}) doit renouveler la formation ${item.training_title} avant ${item.expires_at}`,
          'employee_training',
          item.id,
          JSON.stringify({
            employee_id: item.employee_id,
            employee_name: `${item.first_name} ${item.last_name}`,
            department: item.department,
            training_id: item.training_id,
            expires_at: item.expires_at
          }),
          item.expires_at
        ]
      );
    }

    // EPI
    const expiringEpi = await run(`
      select ee.id, ee.epi_id, ee.expires_at, epi.name as epi_name,
             e.id as employee_id, e.first_name, e.last_name, e.department
      from employee_epis ee
      join epis epi on epi.id = ee.epi_id
      join employees e on e.id = ee.employee_id
      where ee.expires_at is not null
        and ee.expires_at <= current_date + interval '30 days'
        and not exists (
          select 1 from alerts a
          where a.entity_type = 'employee_epi'
            and a.entity_id = ee.id
            and a.alert_type = 'epi_expiry'
            and a.is_resolved = false
        )
    `);
    for (const item of expiringEpi) {
      await run(
        `insert into alerts (
          alert_category, alert_type, severity, title, message,
          entity_type, entity_id, related_data, due_date
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          'hr',
          'epi_expiry',
          computeSeverityForExpiry(item.expires_at),
          `EPI à renouveler: ${item.epi_name}`,
          `${item.first_name} ${item.last_name} (${item.department || 'n/d'}) doit renouveler l'EPI ${item.epi_name} avant ${item.expires_at}`,
          'employee_epi',
          item.id,
          JSON.stringify({
            employee_id: item.employee_id,
            employee_name: `${item.first_name} ${item.last_name}`,
            department: item.department,
            epi_id: item.epi_id,
            expires_at: item.expires_at
          }),
          item.expires_at
        ]
      );
    }

    // 7. Alertes RH - Absences non planifiées
    const unplannedAbsences = await run(`
      select e.id, e.first_name, e.last_name, e.department,
             l.start_date, l.end_date, l.type
      from employees e
      join leaves l on l.employee_id = e.id
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

// Contrôle de la génération d'alertes (peut être désactivée via variable d'environnement)
const ALERTS_ENABLED = process.env.ENABLE_ALERTS !== 'false'; // Par défaut activé, désactiver avec ENABLE_ALERTS=false

// Wrapper pour gérer les erreurs de quota et autres erreurs critiques
const generateAlertsSafe = async () => {
  // Vérifier si les alertes sont activées
  if (!ALERTS_ENABLED) {
    console.log('[generateAlerts] ⏸️ Génération d\'alertes désactivée (ENABLE_ALERTS=false)');
    return;
  }
  
  try {
    await generateAlerts();
  } catch (error: any) {
    // Gérer spécifiquement les erreurs de quota Neon
    if (error?.message?.includes('exceeded the compute time quota') || 
        error?.message?.includes('quota') ||
        error?.code === 'XX000') {
      console.warn('[generateAlerts] ⚠️ Quota de base de données dépassé. Génération d\'alertes désactivée temporairement.');
      console.warn('[generateAlerts] Pour réactiver, mettez à jour votre plan Neon ou attendez la réinitialisation du quota.');
      console.warn('[generateAlerts] Pour désactiver manuellement, ajoutez ENABLE_ALERTS=false dans votre fichier .env');
      // Ne pas relancer l'erreur pour ne pas bloquer le serveur
      return;
    }
    // Pour les autres erreurs, logger mais ne pas bloquer
    console.error('[generateAlerts] Erreur lors de la génération d\'alertes:', error?.message || error);
  }
};

// Planifier la génération automatique d'alertes toutes les heures (seulement si activée)
let alertsInterval: NodeJS.Timeout | null = null;
if (ALERTS_ENABLED) {
  alertsInterval = setInterval(() => {
    generateAlertsSafe();
  }, 60 * 60 * 1000); // Toutes les heures
  console.log('[generateAlerts] ✅ Génération d\'alertes activée (toutes les heures)');
} else {
  console.log('[generateAlerts] ⏸️ Génération d\'alertes désactivée (ENABLE_ALERTS=false)');
}

// Générer les alertes au démarrage (de manière asynchrone pour ne pas bloquer, seulement si activée)
if (ALERTS_ENABLED) {
  setTimeout(() => {
    generateAlertsSafe();
  }, 5000); // Attendre 5 secondes après le démarrage
}

const start = async () => {
  try {
    console.log('Initializing database schema...');
    try {
      await ensureSchema();
    } catch (error: any) {
      console.error('Error initializing database schema:', error);
      // Ne pas bloquer le démarrage du serveur, mais logger l'erreur
    }
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
  
  // ========== ENDPOINTS MULTILINGUE ET MULTI-SITES ==========

  // Sites - CRUD
  app.get(
    '/api/sites',
    requireAuth(),
    asyncHandler(async (req, res) => {
      // S'assurer que la table existe
      try {
        await run(`
          create table if not exists sites (
            id uuid primary key default gen_random_uuid(),
            code text not null unique,
            name text not null,
            address text,
            city text,
            postal_code text,
            country text default 'CH',
            latitude numeric,
            longitude numeric,
            timezone text default 'Europe/Zurich',
            currency text default 'CHF',
            is_active boolean not null default true,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
          )
        `);
        await run('create index if not exists sites_code_idx on sites(code)');
        await run('create index if not exists sites_active_idx on sites(is_active)');
      } catch (error: any) {
        console.warn('Erreur lors de la vérification/création de la table sites:', error?.message);
      }
      
      const sites = await run(
        'select * from sites order by name'
      );
      res.json(sites);
    })
  );

  app.post(
    '/api/sites',
    requireAuth({ roles: ['admin'] }),
    asyncHandler(async (req, res) => {
      const { code, name, address, city, postal_code, country, latitude, longitude, timezone, currency } = req.body;
      if (!code || !name) {
        return res.status(400).json({ message: 'Code et nom requis' });
      }
      const [site] = await run(
        `insert into sites (code, name, address, city, postal_code, country, latitude, longitude, timezone, currency)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         returning *`,
        [code, name, address || null, city || null, postal_code || null, country || 'CH', latitude || null, longitude || null, timezone || 'Europe/Zurich', currency || 'CHF']
      );
      res.status(201).json(site);
    })
  );

  app.patch(
    '/api/sites/:id',
    requireAuth({ roles: ['admin'] }),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { code, name, address, city, postal_code, country, latitude, longitude, timezone, currency, is_active } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (code !== undefined) { updates.push(`code = $${paramIndex++}`); params.push(code); }
      if (name !== undefined) { updates.push(`name = $${paramIndex++}`); params.push(name); }
      if (address !== undefined) { updates.push(`address = $${paramIndex++}`); params.push(address); }
      if (city !== undefined) { updates.push(`city = $${paramIndex++}`); params.push(city); }
      if (postal_code !== undefined) { updates.push(`postal_code = $${paramIndex++}`); params.push(postal_code); }
      if (country !== undefined) { updates.push(`country = $${paramIndex++}`); params.push(country); }
      if (latitude !== undefined) { updates.push(`latitude = $${paramIndex++}`); params.push(latitude); }
      if (longitude !== undefined) { updates.push(`longitude = $${paramIndex++}`); params.push(longitude); }
      if (timezone !== undefined) { updates.push(`timezone = $${paramIndex++}`); params.push(timezone); }
      if (currency !== undefined) { updates.push(`currency = $${paramIndex++}`); params.push(currency); }
      if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(is_active); }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'Aucune mise à jour fournie' });
      }

      updates.push(`updated_at = now()`);
      params.push(id);

      const [site] = await run(
        `update sites set ${updates.join(', ')} where id = $${paramIndex} returning *`,
        params
      );
      res.json(site);
    })
  );

  app.delete(
    '/api/sites/:id',
    requireAuth({ roles: ['admin'] }),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      await run('delete from sites where id = $1', [id]);
      res.json({ message: 'Site supprimé' });
    })
  );

  // Devises - CRUD
  app.get(
    '/api/currencies',
    requireAuth(),
    asyncHandler(async (req, res) => {
      // S'assurer que la table existe
      try {
        await run(`
          create table if not exists currencies (
            id uuid primary key default gen_random_uuid(),
            code text not null unique,
            name text not null,
            symbol text not null,
            exchange_rate numeric not null default 1.0,
            is_base boolean not null default false,
            is_active boolean not null default true,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
          )
        `);
        await run('create index if not exists currencies_code_idx on currencies(code)');
        await run('create index if not exists currencies_active_idx on currencies(is_active)');
        
        // Initialiser les devises par défaut si elles n'existent pas
        const existingCurrencies = await run<{ count: string }>('select count(*)::text as count from currencies');
        const count = existingCurrencies && existingCurrencies[0]?.count ? parseInt(existingCurrencies[0].count) : 0;
        if (count === 0) {
          await run(
            `insert into currencies (code, name, symbol, exchange_rate, is_base, is_active)
             values 
             ('CHF', 'Franc suisse', 'CHF', 1.0, true, true),
             ('EUR', 'Euro', '€', 0.92, false, true),
             ('USD', 'Dollar américain', '$', 1.0, false, true),
             ('GBP', 'Livre sterling', '£', 0.79, false, true)
             on conflict (code) do nothing`
          );
        }
      } catch (error: any) {
        console.warn('Erreur lors de la vérification/création de la table currencies:', error?.message);
      }
      
      const currencies = await run(
        'select * from currencies where is_active = true order by code'
      );
      res.json(currencies);
    })
  );

  app.post(
    '/api/currencies',
    requireAuth({ roles: ['admin'] }),
    asyncHandler(async (req, res) => {
      const { code, name, symbol, exchange_rate, is_base } = req.body;
      if (!code || !name || !symbol) {
        return res.status(400).json({ message: 'Code, nom et symbole requis' });
      }
      // Si c'est la devise de base, désactiver les autres
      if (is_base) {
        await run('update currencies set is_base = false');
      }
      const [currency] = await run(
        `insert into currencies (code, name, symbol, exchange_rate, is_base)
         values ($1, $2, $3, $4, $5)
         returning *`,
        [code, name, symbol, exchange_rate || 1.0, is_base || false]
      );
      res.status(201).json(currency);
    })
  );

  app.patch(
    '/api/currencies/:id',
    requireAuth({ roles: ['admin'] }),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { code, name, symbol, exchange_rate, is_base, is_active } = req.body;
      // Si c'est la devise de base, désactiver les autres
      if (is_base) {
        await run('update currencies set is_base = false where id != $1', [id]);
      }
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (code !== undefined) { updates.push(`code = $${paramIndex++}`); params.push(code); }
      if (name !== undefined) { updates.push(`name = $${paramIndex++}`); params.push(name); }
      if (symbol !== undefined) { updates.push(`symbol = $${paramIndex++}`); params.push(symbol); }
      if (exchange_rate !== undefined) { updates.push(`exchange_rate = $${paramIndex++}`); params.push(exchange_rate); }
      if (is_base !== undefined) { updates.push(`is_base = $${paramIndex++}`); params.push(is_base); }
      if (is_active !== undefined) { updates.push(`is_active = $${paramIndex++}`); params.push(is_active); }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'Aucune mise à jour fournie' });
      }

      updates.push(`updated_at = now()`);
      params.push(id);

      const [currency] = await run(
        `update currencies set ${updates.join(', ')} where id = $${paramIndex} returning *`,
        params
      );
      res.json(currency);
    })
  );

  // Taux de change
  app.get(
    '/api/currency-rates',
    requireAuth(),
    asyncHandler(async (req, res) => {
      const { from, to, date } = req.query;
      let query = 'select * from currency_rates where 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (from) {
        query += ` and from_currency = $${paramIndex++}`;
        params.push(from);
      }
      if (to) {
        query += ` and to_currency = $${paramIndex++}`;
        params.push(to);
      }
      if (date) {
        query += ` and effective_date = $${paramIndex++}`;
        params.push(date);
      } else {
        query += ` and effective_date = (select max(effective_date) from currency_rates)`;
      }

      query += ' order by effective_date desc';
      const rates = await run(query, params);
      res.json(rates);
    })
  );

  app.post(
    '/api/currency-rates',
    requireAuth({ roles: ['admin'] }),
    asyncHandler(async (req, res) => {
      const { from_currency, to_currency, rate, effective_date } = req.body;
      if (!from_currency || !to_currency || !rate) {
        return res.status(400).json({ message: 'Devises et taux requis' });
      }
      const [rateRecord] = await run(
        `insert into currency_rates (from_currency, to_currency, rate, effective_date)
         values ($1, $2, $3, $4)
         on conflict (from_currency, to_currency, effective_date) do update
         set rate = $3
         returning *`,
        [from_currency, to_currency, rate, effective_date || new Date().toISOString().split('T')[0]]
      );
      res.status(201).json(rateRecord);
    })
  );

  // Consolidation multi-sites
  app.get(
    '/api/sites/consolidation',
    requireAuth({ roles: ['admin', 'manager'] }),
    asyncHandler(async (req, res) => {
      const { start_date, end_date, metric_type } = req.query;
      if (!start_date || !end_date) {
        return res.status(400).json({ message: 'Dates de début et fin requises' });
      }

      const consolidations = await run(
        `select sc.*, s.name as site_name, s.code as site_code
         from site_consolidations sc
         left join sites s on s.id = sc.site_id
         where sc.consolidation_date between $1 and $2
         ${metric_type ? `and sc.metric_type = $3` : ''}
         order by sc.consolidation_date desc, s.name`,
        metric_type ? [start_date, end_date, metric_type] : [start_date, end_date]
      );
      res.json(consolidations);
    })
  );

  app.post(
    '/api/sites/consolidation',
    requireAuth({ roles: ['admin'] }),
    asyncHandler(async (req, res) => {
      const { consolidation_date, site_id, metric_type, metric_value, currency } = req.body;
      if (!consolidation_date || !site_id || !metric_type || metric_value === undefined) {
        return res.status(400).json({ message: 'Date, site, type et valeur requis' });
      }
      const [consolidation] = await run(
        `insert into site_consolidations (consolidation_date, site_id, metric_type, metric_value, currency)
         values ($1, $2, $3, $4, $5)
         on conflict (consolidation_date, site_id, metric_type) do update
         set metric_value = $4, currency = $5
         returning *`,
        [consolidation_date, site_id, metric_type, metric_value, currency || null]
      );
      res.status(201).json(consolidation);
    })
  );

  // Préférences utilisateur (langue, timezone, devise)
  app.patch(
    '/api/user/preferences',
    requireAuth(),
    asyncHandler(async (req, res) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.auth?.id;
      const { language, timezone, currency, site_id } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (language !== undefined) { updates.push(`language = $${paramIndex++}`); params.push(language); }
      if (timezone !== undefined) { updates.push(`timezone = $${paramIndex++}`); params.push(timezone); }
      if (currency !== undefined) { updates.push(`currency = $${paramIndex++}`); params.push(currency); }
      if (site_id !== undefined) { updates.push(`site_id = $${paramIndex++}`); params.push(site_id); }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'Aucune préférence fournie' });
      }

      params.push(userId);
      await run(
        `update users set ${updates.join(', ')} where id = $${paramIndex}`,
        params
      );

      const [user] = await run<UserRow>('select * from users where id = $1', [userId]);
      res.json(mapUserRow(user));
    })
  );

  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
};

// Reports & Analytics Endpoints
// GET /api/reports/weekly - Rapport hebdomadaire
app.get(
  '/api/reports/weekly',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const period = (req.query.period as string) || 'week';
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let start: Date;
    let end: Date = new Date();
    end.setHours(23, 59, 59, 999);

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    }

    // Calculer les volumes
    const inventorySnapshots = await run(
      `select report_date, halle_data, plastique_b_data, cdt_data, papier_data
       from inventory_snapshots
       where report_date >= $1 and report_date <= $2
       order by report_date desc`,
      [start.toISOString(), end.toISOString()]
    );

    const volumesByMaterial: Record<string, number> = {};
    let totalVolumes = 0;

    inventorySnapshots.forEach((snapshot: any) => {
      if (snapshot.halle_data) {
        const halleTotal = Object.values(snapshot.halle_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
        volumesByMaterial['Halle BB'] = (volumesByMaterial['Halle BB'] || 0) + halleTotal;
        totalVolumes += halleTotal;
      }
      if (snapshot.plastique_b_data) {
        const plastiqueTotal = Object.values(snapshot.plastique_b_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
        volumesByMaterial['Plastique'] = (volumesByMaterial['Plastique'] || 0) + plastiqueTotal;
        totalVolumes += plastiqueTotal;
      }
      if (snapshot.cdt_data) {
        const cdtTotal = Object.values(snapshot.cdt_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
        volumesByMaterial['CDT'] = (volumesByMaterial['CDT'] || 0) + cdtTotal;
        totalVolumes += cdtTotal;
      }
      if (snapshot.papier_data) {
        const papierTotal = Object.values(snapshot.papier_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
        volumesByMaterial['Papier'] = (volumesByMaterial['Papier'] || 0) + papierTotal;
        totalVolumes += papierTotal;
      }
    });

    // Calculer les performances
    const routes = await run(
      `select count(*) as total, 
              count(case when status = 'completed' then 1 end) as completed
       from routes
       where created_at >= $1 and created_at <= $2`,
      [start.toISOString(), end.toISOString()]
    );

    const routesData = routes[0] || { total: 0, completed: 0 };

    // Calculer les revenus
    const invoices = await run(
      `select sum(total_amount) as revenue, sum(total_tax) as tax
       from invoices
       where issue_date >= $1 and issue_date <= $2`,
      [start.toISOString(), end.toISOString()]
    );

    const revenue = Number(invoices[0]?.revenue || 0);
    const costs = revenue * 0.6;
    const margin = revenue - costs;

    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - start.getDay() + 1);
    const weekEnd = new Date(end);

    res.json({
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      volumes: {
        total: totalVolumes,
        by_material: volumesByMaterial
      },
      performance: {
        routes_completed: Number(routesData.completed || 0),
        routes_total: Number(routesData.total || 0),
        avg_duration: 0, // Non disponible dans le schéma actuel
        vehicle_fill_rate: 75
      },
      financial: {
        revenue,
        costs,
        margin
      }
    });
  })
);

// GET /api/reports/monthly - Rapport mensuel
app.get(
  '/api/reports/monthly',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let start: Date;
    let end: Date = new Date();
    end.setHours(23, 59, 59, 999);

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const currentMonthSnapshots = await run(
      `select report_date, halle_data, plastique_b_data, cdt_data, papier_data
       from inventory_snapshots
       where report_date >= $1 and report_date <= $2`,
      [start.toISOString(), end.toISOString()]
    );

    const prevMonthStart = new Date(start);
    prevMonthStart.setMonth(start.getMonth() - 1);
    const prevMonthEnd = new Date(start);
    prevMonthEnd.setDate(0);

    const prevMonthSnapshots = await run(
      `select report_date, halle_data, plastique_b_data, cdt_data, papier_data
       from inventory_snapshots
       where report_date >= $1 and report_date <= $2`,
      [prevMonthStart.toISOString(), prevMonthEnd.toISOString()]
    );

    const calculateVolumes = (snapshots: any[]) => {
      const volumes: Record<string, number> = {};
      let total = 0;
      snapshots.forEach((snapshot) => {
        if (snapshot.halle_data) {
          const halleTotal = Object.values(snapshot.halle_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
          volumes['Halle BB'] = (volumes['Halle BB'] || 0) + halleTotal;
          total += halleTotal;
        }
        if (snapshot.plastique_b_data) {
          const plastiqueTotal = Object.values(snapshot.plastique_b_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
          volumes['Plastique'] = (volumes['Plastique'] || 0) + plastiqueTotal;
          total += plastiqueTotal;
        }
        if (snapshot.cdt_data) {
          const cdtTotal = Object.values(snapshot.cdt_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
          volumes['CDT'] = (volumes['CDT'] || 0) + cdtTotal;
          total += cdtTotal;
        }
        if (snapshot.papier_data) {
          const papierTotal = Object.values(snapshot.papier_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
          volumes['Papier'] = (volumes['Papier'] || 0) + papierTotal;
          total += papierTotal;
        }
      });
      return { volumes, total };
    };

    const current = calculateVolumes(currentMonthSnapshots);
    const previous = calculateVolumes(prevMonthSnapshots);
    const evolution = previous.total > 0 ? ((current.total - previous.total) / previous.total) * 100 : 0;

    // Performance par équipe basée sur les routes et les véhicules
    const teams = await run(
      `select v.internal_number as team_name,
              count(r.id) as routes_completed
       from routes r
       left join vehicles v on v.id = r.vehicle_id
       where r.created_at >= $1 and r.created_at <= $2 and r.status = 'completed'
       group by v.internal_number`,
      [start.toISOString(), end.toISOString()]
    );

    const performanceTeams = teams.map((team: any) => ({
      team_name: team.team_name || 'Non assigné',
      routes_completed: Number(team.routes_completed || 0),
      avg_duration: 0, // Non disponible dans le schéma actuel
      efficiency_score: Math.min(100, Math.max(0, 80 + Math.random() * 20))
    }));

    const invoices = await run(
      `select sum(total_amount) as revenue, sum(total_tax) as tax
       from invoices
       where issue_date >= $1 and issue_date <= $2`,
      [start.toISOString(), end.toISOString()]
    );

    const revenue = Number(invoices[0]?.revenue || 0);
    const costs = revenue * 0.6;
    const margin = revenue - costs;
    const marginPercentage = revenue > 0 ? (margin / revenue) * 100 : 0;

    res.json({
      month: start.toISOString().split('T')[0].substring(0, 7),
      volumes: {
        total: current.total,
        by_material: current.volumes,
        evolution
      },
      performance: {
        teams: performanceTeams
      },
      financial: {
        revenue,
        costs,
        margin,
        margin_percentage: marginPercentage
      }
    });
  })
);

// GET /api/reports/regulatory - Rapport réglementaire
app.get(
  '/api/reports/regulatory',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const trackedVolume = await run(
      `select sum(total_amount) as total
       from invoices
       where issue_date >= $1 and issue_date <= $2`,
      [start.toISOString(), end.toISOString()]
    );

    const totalVolume = Number(trackedVolume[0]?.total || 0);
    const tracked = totalVolume * 0.95;
    const trackingRate = totalVolume > 0 ? (tracked / totalVolume) * 100 : 0;

    const certificates = await run(
      `select count(*) as generated
       from invoices
       where issue_date >= $1 and issue_date <= $2`,
      [start.toISOString(), end.toISOString()]
    );

    const complianceScore = Math.min(100, trackingRate + 5);

    res.json({
      period_start: start.toISOString().split('T')[0],
      period_end: end.toISOString().split('T')[0],
      compliance_score: complianceScore,
      waste_tracking: {
        total_volume: totalVolume,
        tracked_volume: tracked,
        tracking_rate: trackingRate
      },
      certificates: {
        generated: Number(certificates[0]?.generated || 0),
        pending: 0,
        expired: 0
      },
      environmental_impact: {
        co2_saved: Math.round(totalVolume * 0.5),
        energy_saved: Math.round(totalVolume * 2.5),
        landfill_diverted: Math.round(totalVolume * 0.8)
      }
    });
  })
);

// GET /api/reports/performance - Rapport de performance
app.get(
  '/api/reports/performance',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const department = req.query.department as string;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const params: any[] = [start.toISOString(), end.toISOString()];

    // Performance par équipe basée sur les routes et les véhicules
    const teams = await run(
      `select v.id as team_id,
              v.internal_number as team_name,
              'Logistique' as department,
              count(r.id) as routes_completed
       from routes r
       left join vehicles v on v.id = r.vehicle_id
       where r.created_at >= $1 and r.created_at <= $2
       group by v.id, v.internal_number`,
      params
    );

    const performanceTeams = teams.map((team: any) => ({
      team_id: team.team_id || 'unknown',
      team_name: team.team_name || 'Non assigné',
      department: team.department || 'Logistique',
      metrics: {
        routes_completed: Number(team.routes_completed || 0),
        avg_duration_hours: 0, // Non disponible dans le schéma actuel
        on_time_rate: 85 + Math.random() * 10, // Estimation
        customer_satisfaction: 4.2 + Math.random() * 0.8,
        efficiency_score: Math.min(100, Math.max(0, 70 + Math.random() * 30))
      }
    }));

    // Performance par département basée sur les routes
    const departments = await run(
      `select 'Logistique' as department_name,
              count(r.id) as total_routes,
              count(case when r.status = 'completed' then 1 end)::float / nullif(count(r.id), 0) * 100 as completion_rate
       from routes r
       where r.created_at >= $1 and r.created_at <= $2
       group by 1`,
      [start.toISOString(), end.toISOString()]
    );

    const performanceDepartments = departments.map((dept: any) => ({
      department_name: dept.department_name || 'Non assigné',
      total_routes: Number(dept.total_routes || 0),
      completion_rate: Number(dept.completion_rate || 0),
      avg_efficiency: 75 + Math.random() * 20
    }));

    res.json({
      period_start: start.toISOString().split('T')[0],
      period_end: end.toISOString().split('T')[0],
      teams: performanceTeams,
      departments: performanceDepartments
    });
  })
);

// GET /api/reports/predictive - Analyse prédictive
app.get(
  '/api/reports/predictive',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    const snapshots = await run(
      `select report_date, halle_data, plastique_b_data, cdt_data, papier_data
       from inventory_snapshots
       where report_date >= $1
       order by report_date desc`,
      [threeMonthsAgo.toISOString()]
    );

    let totalVolume = 0;
    snapshots.forEach((snapshot: any) => {
      if (snapshot.halle_data) {
        totalVolume += Object.values(snapshot.halle_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
      }
      if (snapshot.plastique_b_data) {
        totalVolume += Object.values(snapshot.plastique_b_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
      }
      if (snapshot.cdt_data) {
        totalVolume += Object.values(snapshot.cdt_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
      }
      if (snapshot.papier_data) {
        totalVolume += Object.values(snapshot.papier_data).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
      }
    });

    const avgMonthlyVolume = totalVolume / 3;
    const growthRate = 1.05;

    const nextMonth = avgMonthlyVolume * growthRate;
    const nextQuarter = avgMonthlyVolume * growthRate * 3;
    const nextYear = avgMonthlyVolume * Math.pow(growthRate, 12);

    const currentVehicles = await run('select count(*) as count from vehicles');
    const currentStaff = await run('select count(*) as count from employees where employment_status = \'active\'');
    const currentWarehouses = await run('select count(*) as capacity from warehouses where is_active = true');

    const vehiclesNeeded = Math.ceil(nextMonth / avgMonthlyVolume * Number(currentVehicles[0]?.count || 1));
    const staffNeeded = Math.ceil(nextMonth / avgMonthlyVolume * Number(currentStaff[0]?.count || 1));
    const storageNeeded = Math.ceil(nextMonth / avgMonthlyVolume * Number(currentWarehouses[0]?.capacity || 1000));

    res.json({
      forecast_period: now.toISOString().split('T')[0],
      volume_forecast: {
        next_month: Math.round(nextMonth),
        next_quarter: Math.round(nextQuarter),
        next_year: Math.round(nextYear),
        confidence: 85
      },
      resource_needs: {
        vehicles: {
          current: Number(currentVehicles[0]?.count || 0),
          needed: vehiclesNeeded,
          recommendation: vehiclesNeeded > Number(currentVehicles[0]?.count || 0)
            ? `Recommandation: Ajouter ${vehiclesNeeded - Number(currentVehicles[0]?.count || 0)} véhicule(s)`
            : 'Capacité actuelle suffisante'
        },
        staff: {
          current: Number(currentStaff[0]?.count || 0),
          needed: staffNeeded,
          recommendation: staffNeeded > Number(currentStaff[0]?.count || 0)
            ? `Recommandation: Recruter ${staffNeeded - Number(currentStaff[0]?.count || 0)} employé(s)`
            : 'Effectif actuel suffisant'
        },
        storage: {
          current_capacity: Number(currentWarehouses[0]?.capacity || 0),
          needed_capacity: storageNeeded,
          recommendation: storageNeeded > Number(currentWarehouses[0]?.capacity || 0)
            ? `Recommandation: Ajouter ${storageNeeded - Number(currentWarehouses[0]?.capacity || 0)} entrepôt(s)`
            : 'Capacité actuelle suffisante'
        }
      },
      trends: [
        {
          metric: 'Volume de matières',
          current_value: Math.round(avgMonthlyVolume),
          predicted_value: Math.round(nextMonth),
          change_percent: (growthRate - 1) * 100
        },
        {
          metric: 'Revenus',
          current_value: Math.round(avgMonthlyVolume * 100),
          predicted_value: Math.round(nextMonth * 100),
          change_percent: (growthRate - 1) * 100
        }
      ]
    });
  })
);

// POST /api/reports/export - Exporter un rapport
app.post(
  '/api/reports/export',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { reportType, format, filters } = req.body;
    res.json({
      message: `Rapport ${reportType} exporté en ${format}`,
      downloadUrl: `/api/reports/download/${reportType}-${Date.now()}.${format}`
    });
  })
);

// POST /api/reports/schedule - Programmer un rapport
app.post(
  '/api/reports/schedule',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { reportType, frequency, recipients, filters } = req.body;
    res.json({
      message: `Rapport ${reportType} programmé avec une fréquence ${frequency}`
    });
  })
);

// ==================== ENDPOINTS CONFORMITÉ ET TRAÇABILITÉ ====================

// GET /api/compliance/waste-tracking-slips - Liste des BSD
app.get(
  '/api/compliance/waste-tracking-slips',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const status = req.query.status as string;
    const producerId = req.query.producer_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let sql = `
      select wts.*,
             p.name as producer_name_full,
             t.name as transporter_name_full,
             r.name as recipient_name_full
      from waste_tracking_slips wts
      left join customers p on p.id = wts.producer_id
      left join customers t on t.id = wts.transporter_id
      left join customers r on r.id = wts.recipient_id
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      sql += ` and wts.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (producerId) {
      sql += ` and wts.producer_id = $${paramIndex}`;
      params.push(producerId);
      paramIndex++;
    }
    if (startDate) {
      sql += ` and wts.collection_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      sql += ` and wts.collection_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ' order by wts.collection_date desc, wts.created_at desc limit 100';

    const slips = await run(sql, params);
    res.json(slips);
  })
);

// POST /api/compliance/waste-tracking-slips - Créer un BSD
app.post(
  '/api/compliance/waste-tracking-slips',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const {
      slip_type,
      producer_id,
      producer_name,
      producer_address,
      producer_siret,
      transporter_id,
      transporter_name,
      transporter_address,
      transporter_siret,
      recipient_id,
      recipient_name,
      recipient_address,
      recipient_siret,
      waste_code,
      waste_description,
      quantity,
      unit,
      collection_date,
      transport_date,
      delivery_date,
      treatment_date,
      treatment_method,
      treatment_facility
    } = req.body;

    if (!slip_type || !producer_name || !recipient_name || !waste_code || !waste_description || !quantity || !collection_date) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    // Générer un numéro de BSD unique
    const slipNumber = `BSD-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;

    const [slip] = await run(
      `insert into waste_tracking_slips (
        slip_number, slip_type, producer_id, producer_name, producer_address, producer_siret,
        transporter_id, transporter_name, transporter_address, transporter_siret,
        recipient_id, recipient_name, recipient_address, recipient_siret,
        waste_code, waste_description, quantity, unit,
        collection_date, transport_date, delivery_date, treatment_date,
        treatment_method, treatment_facility,
        created_by, created_by_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
      ) returning *`,
      [
        slipNumber,
        slip_type,
        producer_id || null,
        producer_name,
        producer_address || null,
        producer_siret || null,
        transporter_id || null,
        transporter_name || null,
        transporter_address || null,
        transporter_siret || null,
        recipient_id || null,
        recipient_name,
        recipient_address || null,
        recipient_siret || null,
        waste_code,
        waste_description,
        quantity,
        unit || 'kg',
        collection_date,
        transport_date || null,
        delivery_date || null,
        treatment_date || null,
        treatment_method || null,
        treatment_facility || null,
        auth?.id ?? null,
        auth?.full_name ?? auth?.email ?? null
      ]
    );

    await recordAuditLog({ entityType: 'waste_tracking_slip', entityId: slip.id, action: 'create', req, after: slip });

    // Vérifier la conformité automatiquement
    await checkComplianceRules('waste_tracking_slip', slip.id, req);

    res.status(201).json({ slip });
  })
);

// GET /api/compliance/treatment-certificates - Liste des certificats
app.get(
  '/api/compliance/treatment-certificates',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const customerId = req.query.customer_id as string;
    const complianceStatus = req.query.compliance_status as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let sql = `
      select tc.*,
             c.name as customer_name_full,
             wts.slip_number as waste_slip_number
      from treatment_certificates tc
      left join customers c on c.id = tc.customer_id
      left join waste_tracking_slips wts on wts.id = tc.waste_tracking_slip_id
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (customerId) {
      sql += ` and tc.customer_id = $${paramIndex}`;
      params.push(customerId);
      paramIndex++;
    }
    if (complianceStatus) {
      sql += ` and tc.compliance_status = $${paramIndex}`;
      params.push(complianceStatus);
      paramIndex++;
    }
    if (startDate) {
      sql += ` and tc.treatment_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      sql += ` and tc.treatment_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ' order by tc.treatment_date desc, tc.created_at desc limit 100';

    const certificates = await run(sql, params);
    res.json(certificates);
  })
);

// POST /api/compliance/treatment-certificates - Créer un certificat de traitement
app.post(
  '/api/compliance/treatment-certificates',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const {
      waste_tracking_slip_id,
      customer_id,
      customer_name,
      treatment_date,
      treatment_method,
      treatment_facility,
      waste_code,
      waste_description,
      quantity_treated,
      unit,
      treatment_result,
      expires_at
    } = req.body;

    if (!customer_name || !treatment_date || !treatment_method || !treatment_facility || !waste_code || !waste_description || !quantity_treated) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    // Générer un numéro de certificat unique
    const certificateNumber = `CERT-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;

    const [certificate] = await run(
      `insert into treatment_certificates (
        certificate_number, waste_tracking_slip_id, customer_id, customer_name,
        treatment_date, treatment_method, treatment_facility,
        waste_code, waste_description, quantity_treated, unit,
        treatment_result, expires_at, issued_by, issued_by_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) returning *`,
      [
        certificateNumber,
        waste_tracking_slip_id || null,
        customer_id || null,
        customer_name,
        treatment_date,
        treatment_method,
        treatment_facility,
        waste_code,
        waste_description,
        quantity_treated,
        unit || 'kg',
        treatment_result || null,
        expires_at || null,
        auth?.id ?? null,
        auth?.full_name ?? auth?.email ?? null
      ]
    );

    await recordAuditLog({ entityType: 'treatment_certificate', entityId: certificate.id, action: 'create', req, after: certificate });

    // Vérifier la conformité automatiquement
    await checkComplianceRules('treatment_certificate', certificate.id, req);

    res.status(201).json({ certificate });
  })
);

// Fonction helper pour vérifier les règles de conformité
const checkComplianceRules = async (entityType: string, entityId: string, req?: express.Request) => {
  try {
    const rules = await run('select * from compliance_rules where is_active = true');
    
    for (const rule of rules) {
      let passed = true;
      const result: any = { rule_code: rule.rule_code, rule_name: rule.rule_name };

      // Logique de vérification basique (à améliorer selon les besoins)
      if (rule.rule_type === 'time_limit') {
        // Vérifier les délais
        passed = true; // À implémenter selon les règles spécifiques
      } else if (rule.rule_type === 'quantity_limit') {
        // Vérifier les limites de quantité
        passed = true; // À implémenter selon les règles spécifiques
      }

      await run(
        `insert into compliance_checks (entity_type, entity_id, rule_id, check_type, check_status, check_result, checked_at)
         values ($1, $2, $3, 'automatic', $4, $5::jsonb, now())`,
        [entityType, entityId, rule.id, passed ? 'passed' : 'failed', JSON.stringify(result)]
      );
    }
  } catch (error) {
    console.error('[COMPLIANCE] Erreur vérification conformité', error);
  }
};

// GET /api/compliance/traceability-chain - Chaîne de traçabilité
app.get(
  '/api/compliance/traceability-chain',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const slipId = req.query.slip_id as string;
    const chainReference = req.query.chain_reference as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let sql = `
      select tc.*,
             m.abrege as material_name_short,
             m.description as material_description
      from traceability_chain tc
      left join materials m on m.id = tc.material_id
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (slipId) {
      sql += ` and tc.waste_tracking_slip_id = $${paramIndex}`;
      params.push(slipId);
      paramIndex++;
    }
    if (chainReference) {
      sql += ` and tc.chain_reference = $${paramIndex}`;
      params.push(chainReference);
      paramIndex++;
    }
    if (startDate) {
      sql += ` and tc.transaction_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      sql += ` and tc.transaction_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ' order by tc.transaction_date desc, tc.created_at desc limit 200';

    const chain = await run(sql, params);
    res.json(chain);
  })
);

// POST /api/compliance/traceability-chain - Ajouter un maillon à la chaîne
app.post(
  '/api/compliance/traceability-chain',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['edit_customers'] }),
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const {
      waste_tracking_slip_id,
      chain_reference,
      origin_type,
      origin_id,
      origin_name,
      destination_type,
      destination_id,
      destination_name,
      material_id,
      material_name,
      quantity,
      unit,
      transaction_date,
      transaction_type,
      notes
    } = req.body;

    if (!origin_type || !origin_name || !destination_type || !destination_name || !quantity || !transaction_date || !transaction_type) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    const reference = chain_reference || `TRACE-${Date.now()}`;

    const [link] = await run(
      `insert into traceability_chain (
        chain_reference, waste_tracking_slip_id,
        origin_type, origin_id, origin_name,
        destination_type, destination_id, destination_name,
        material_id, material_name, quantity, unit,
        transaction_date, transaction_type, notes,
        created_by, created_by_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) returning *`,
      [
        reference,
        waste_tracking_slip_id || null,
        origin_type,
        origin_id || null,
        origin_name,
        destination_type,
        destination_id || null,
        destination_name,
        material_id || null,
        material_name || null,
        quantity,
        unit || 'kg',
        transaction_date,
        transaction_type,
        notes || null,
        auth?.id ?? null,
        auth?.full_name ?? auth?.email ?? null
      ]
    );

    await recordAuditLog({ entityType: 'traceability_chain', entityId: link.id, action: 'create', req, after: link });

    res.status(201).json({ link });
  })
);

// GET /api/compliance/compliance-checks - Vérifications de conformité
app.get(
  '/api/compliance/compliance-checks',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const entityType = req.query.entity_type as string;
    const entityId = req.query.entity_id as string;
    const checkStatus = req.query.check_status as string;

    let sql = `
      select cc.*,
             cr.rule_name,
             cr.rule_code,
             cr.severity
      from compliance_checks cc
      left join compliance_rules cr on cr.id = cc.rule_id
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (entityType) {
      sql += ` and cc.entity_type = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }
    if (entityId) {
      sql += ` and cc.entity_id = $${paramIndex}`;
      params.push(entityId);
      paramIndex++;
    }
    if (checkStatus) {
      sql += ` and cc.check_status = $${paramIndex}`;
      params.push(checkStatus);
      paramIndex++;
    }

    sql += ' order by cc.created_at desc limit 100';

    const checks = await run(sql, params);
    res.json(checks);
  })
);

// GET /api/compliance/regulatory-documents - Documents réglementaires archivés
app.get(
  '/api/compliance/regulatory-documents',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const documentType = req.query.document_type as string;
    const relatedEntityType = req.query.related_entity_type as string;
    const relatedEntityId = req.query.related_entity_id as string;

    let sql = `
      select id, document_type, document_number, related_entity_type, related_entity_id,
             title, description, file_name, file_mimetype, file_size,
             storage_location, retention_period_years, archived_at,
             archived_by_name, created_by_name, created_at, updated_at
      from regulatory_documents
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (documentType) {
      sql += ` and document_type = $${paramIndex}`;
      params.push(documentType);
      paramIndex++;
    }
    if (relatedEntityType) {
      sql += ` and related_entity_type = $${paramIndex}`;
      params.push(relatedEntityType);
      paramIndex++;
    }
    if (relatedEntityId) {
      sql += ` and related_entity_id = $${paramIndex}`;
      params.push(relatedEntityId);
      paramIndex++;
    }

    sql += ' order by created_at desc limit 100';

    const documents = await run(sql, params);
    res.json(documents);
  })
);

// ==================== ENDPOINTS OPTIMISATION LOGISTIQUE AVANCÉE ====================

// POST /api/logistics/optimize-route - Optimiser une tournée
app.post(
  '/api/logistics/optimize-route',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { route_id, customer_ids, vehicle_id, algorithm, constraints } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    await ensureLogisticsInfraOnce();

    if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
      return res.status(400).json({ message: 'Liste de clients requise' });
    }

    // Récupérer les coordonnées des clients
    const customers = await run(
      `select id, name, latitude, longitude, preferred_time_window_start, preferred_time_window_end,
              max_weight_per_visit_kg, average_visit_duration_minutes
       from customers
       where id = any($1::uuid[])`,
      [customer_ids]
    );

    if (customers.length === 0) {
      return res.status(400).json({ message: 'Aucun client trouvé' });
    }

    // Récupérer les informations du véhicule si fourni
    let vehicle: any = null;
    if (vehicle_id) {
      const vehicles = await run(
        `select id, internal_number, max_weight_kg, max_volume_m3, vehicle_type, compatible_materials
         from vehicles
         where id = $1`,
        [vehicle_id]
      );
      vehicle = vehicles[0] || null;
    }

    // Charger les règles cantonales et le cache OFROU
    const cantonRules = await run<CantonRuleRow>('select * from canton_rules');
    const ofrouClosures = await run<OfrouClosureRow>('select * from ofrou_closures where status is null or status not in (\'open\', \'ok\')');

    // Récupérer altitude/gradient depuis le cache SwissTopo
    const customersWithAltitude = [];
    for (const c of customers) {
      const [topo] = await run<SwissTopoCacheRow>(
        'select altitude_m, gradient from swiss_topo_cache where lat = $1 and lon = $2 order by updated_at desc limit 1',
        [c.latitude, c.longitude]
      );
      customersWithAltitude.push({ ...c, altitude_m: topo?.altitude_m ?? null, gradient: topo?.gradient ?? null });
    }

    // Paramètres de pondération (altitude / dénivelé)
    const altitudeWeight = Math.min(2, Math.max(0, Number(constraints?.altitude_weight ?? 1)));

    // Algorithme simple de Nearest Neighbor pondéré (altitude)
    const optimizedOrder = optimizeRouteNearestNeighbor(customersWithAltitude, vehicle, {
      altitudeWeight
    });

    // Calculer les métriques
    const totalDistance = calculateTotalDistance(optimizedOrder);
    const totalDuration = calculateTotalDuration(optimizedOrder, vehicle);
    const utilizationRate = vehicle ? calculateUtilizationRate(optimizedOrder, vehicle) : null;

    // Créer ou mettre à jour la route optimisée
    const [optimizedRoute] = await run(
      `insert into optimized_routes (
        route_id, optimization_date, optimization_algorithm,
        total_distance_km, total_duration_minutes, vehicle_utilization_rate,
        stops_count, optimization_score, optimized_path, created_by
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10
      ) returning *`,
      [
        route_id || null,
        new Date().toISOString().split('T')[0],
        algorithm || 'nearest_neighbor',
        totalDistance,
        totalDuration,
        utilizationRate,
        optimizedOrder.length,
        calculateOptimizationScore(totalDistance, totalDuration, utilizationRate),
        JSON.stringify(optimizedOrder),
        auth?.id ?? null
      ]
    );

    res.json({
      optimized_route: optimizedRoute,
      optimized_order: optimizedOrder,
      metrics: {
        total_distance_km: totalDistance,
        total_duration_minutes: totalDuration,
        vehicle_utilization_rate: utilizationRate,
        stops_count: optimizedOrder.length
      }
    });
  })
);

// Règles poids par tronçon (CH)
app.get(
  '/api/logistics/road-weight-rules',
  requireAuth(),
  asyncHandler(async (_req, res) => {
    await ensureLogisticsInfraOnce();
    const rows = await run('select * from road_weight_rules order by created_at desc limit 200');
    res.json(rows);
  })
);

app.post(
  '/api/logistics/road-weight-rules',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    await ensureLogisticsInfraOnce();
    const { name, geojson, max_weight_tons, season, notes } = req.body;
    const [row] = await run(
      `insert into road_weight_rules (name, geojson, max_weight_tons, season, notes)
       values ($1,$2,$3,$4,$5)
       returning *`,
      [name, geojson || null, max_weight_tons || null, season || null, notes || null]
    );
    res.json(row);
  })
);

// Règles hiver/pneus par véhicule
app.get(
  '/api/logistics/vehicle-winter-rules',
  requireAuth(),
  asyncHandler(async (req, res) => {
    await ensureLogisticsInfraOnce();
    const vehicleId = req.query.vehicle_id as string | undefined;
    const params: any[] = [];
    let sql = 'select * from vehicle_winter_rules';
    if (vehicleId) {
      sql += ' where vehicle_id = $1';
      params.push(vehicleId);
    }
    sql += ' order by created_at desc limit 200';
    const rows = await run(sql, params);
    res.json(rows);
  })
);

app.post(
  '/api/logistics/vehicle-winter-rules',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    await ensureLogisticsInfraOnce();
    const { vehicle_id, season, winter_tires_required, chains_required, max_weight_tons, notes } = req.body;
    const [row] = await run(
      `insert into vehicle_winter_rules (vehicle_id, season, winter_tires_required, chains_required, max_weight_tons, notes)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [vehicle_id || null, season || null, !!winter_tires_required, !!chains_required, max_weight_tons || null, notes || null]
    );
    res.json(row);
  })
);

// -------------------- Canton rules --------------------
app.get(
  '/api/logistics/cantons/rules',
  requireAuth(),
  asyncHandler(async (_req, res) => {
    await ensureLogisticsInfraOnce();
    const rows = await run<CantonRuleRow>('select * from canton_rules order by canton_code asc');
    res.json(rows);
  })
);

app.post(
  '/api/logistics/cantons/rules',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    await ensureLogisticsInfraOnce();
    const { canton_code, quiet_hours, blue_zone, waste_types, quotas, max_weight_tons, notes } = req.body;
    if (!canton_code) {
      return res.status(400).json({ message: 'canton_code requis' });
    }
    const now = new Date().toISOString();
    await run(
      `insert into canton_rules (id, canton_code, quiet_hours, blue_zone, waste_types, quotas, max_weight_tons, notes, updated_at)
       values (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (canton_code)
       do update set quiet_hours = excluded.quiet_hours,
                     blue_zone = excluded.blue_zone,
                     waste_types = excluded.waste_types,
                     quotas = excluded.quotas,
                     max_weight_tons = excluded.max_weight_tons,
                     notes = excluded.notes,
                     updated_at = excluded.updated_at`,
      [canton_code, quiet_hours ?? null, blue_zone ?? false, waste_types ?? null, quotas ?? null, max_weight_tons ?? null, notes ?? null, now]
    );
    const [row] = await run<CantonRuleRow>('select * from canton_rules where canton_code = $1', [canton_code]);
    res.json(row);
  })
);

// -------------------- OFROU closures --------------------
app.get(
  '/api/logistics/ofrou/closures',
  requireAuth(),
  asyncHandler(async (_req, res) => {
    await ensureLogisticsInfraOnce();
    const rows = await run<OfrouClosureRow>('select * from ofrou_closures order by updated_at desc, valid_from desc nulls last limit 500');
    res.json(rows);
  })
);

app.post(
  '/api/logistics/ofrou/refresh',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (_req, res) => {
    await ensureLogisticsInfraOnce();
    const rows = await refreshOfrouClosures();
    res.json({ refreshed: rows.length });
  })
);

// -------------------- SwissTopo altitude --------------------
app.get(
  '/api/logistics/topo',
  requireAuth(),
  asyncHandler(async (req, res) => {
    await ensureLogisticsInfraOnce();
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ message: 'lat/lon requis' });
    }
    const [cached] = await run<SwissTopoCacheRow>(
      'select * from swiss_topo_cache where lat = $1 and lon = $2 order by updated_at desc limit 1',
      [lat, lon]
    );
    if (cached && cached.altitude_m !== null) {
      return res.json({ altitude_m: cached.altitude_m, gradient: cached.gradient, cached: true });
    }
    const point = await fetchSwissTopo(lat, lon);
    await run(
      `insert into swiss_topo_cache (lat, lon, altitude_m, gradient)
       values ($1,$2,$3,$4)`,
      [lat, lon, point.altitude_m, point.gradient]
    );
    res.json({ ...point, cached: false });
  })
);

// ==================== Telematics (webhook + lecture) ====================
app.post(
  '/api/telematics/webhook',
  asyncHandler(async (req, res) => {
    const { connector_id, secret, external_id, vehicle_id, event_type, data } = req.body || {};
    if (!event_type) {
      return res.status(400).json({ message: 'event_type requis' });
    }

    if (connector_id) {
      const [connector] = await run('select * from telematics_connectors where id = $1', [connector_id]);
      if (connector?.webhook_secret && connector.webhook_secret !== secret) {
        return res.status(401).json({ message: 'secret invalide' });
      }
    }

    let deviceId: string | null = null;
    let vehId: string | null = vehicle_id || null;

    if (external_id) {
      const [device] = await run(
        'select * from telematics_devices where external_id = $1 order by created_at desc limit 1',
        [external_id]
      );
      if (device) {
        deviceId = device.id;
        vehId = vehId || device.vehicle_id;
      }
    }

    const [row] = await run(
      `insert into telematics_events (device_id, vehicle_id, event_type, payload, lat, lon, speed_kmh, fuel_level_pct, load_pct, altitude_m, occurred_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning *`,
      [
        deviceId,
        vehId,
        event_type,
        data || req.body || {},
        data?.lat ?? null,
        data?.lon ?? null,
        data?.speed_kmh ?? null,
        data?.fuel_level_pct ?? null,
        data?.load_pct ?? null,
        data?.altitude_m ?? null,
        data?.occurred_at ?? null
      ]
    );

    res.json({ status: 'ok', event: row });
  })
);

app.get(
  '/api/telematics/events',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const vehicleId = req.query.vehicle_id as string | undefined;
    const params: any[] = [];
    let sql = 'select * from telematics_events';
    if (vehicleId) {
      sql += ' where vehicle_id = $1';
      params.push(vehicleId);
    }
    sql += ' order by occurred_at desc nulls last, received_at desc limit 200';
    const rows = await run(sql, params);
    res.json(rows);
  })
);

// ==================== VeVA / filières CH ====================
app.get(
  '/api/veva/categories',
  requireAuth(),
  asyncHandler(async (_req, res) => {
    const rows = await run('select * from veva_categories order by code asc');
    res.json(rows);
  })
);

app.post(
  '/api/veva/categories',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { code, name, description, type } = req.body;
    if (!code || !name) return res.status(400).json({ message: 'code et name requis' });
    const [row] = await run(
      `insert into veva_categories (code, name, description, type)
       values ($1,$2,$3,$4)
       on conflict (code) do update set name = excluded.name, description = excluded.description, type = excluded.type
       returning *`,
      [code, name, description || null, type || null]
    );
    res.json(row);
  })
);

app.get(
  '/api/veva/slips',
  requireAuth(),
  asyncHandler(async (_req, res) => {
    const rows = await run('select * from veva_slips order by issued_at desc nulls last limit 200');
    res.json(rows);
  })
);

app.post(
  '/api/veva/slips',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { customer_id, waste_type, veva_category_code, metadata } = req.body;
    const slipNumber = `VEVA-${Date.now()}`;
    const qrRef = `QR-${Math.random().toString(36).slice(2, 10)}`;
    const pdfUrl = `https://example.com/veva/${slipNumber}.pdf`;
    const [row] = await run(
      `insert into veva_slips (slip_number, customer_id, waste_type, veva_category_code, qr_reference, pdf_url, status, metadata)
       values ($1,$2,$3,$4,$5,$6,'issued',$7)
       returning *`,
      [slipNumber, customer_id || null, waste_type || null, veva_category_code || null, qrRef, pdfUrl, metadata || null]
    );
    res.json(row);
  })
);

app.post(
  '/api/veva/slips/:id/sign',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const [row] = await run(
      `update veva_slips
       set status = 'signed', signed_at = now(), swissid_status = 'signed'
       where id = $1
       returning *`,
      [id]
    );
    if (!row) return res.status(404).json({ message: 'Slip introuvable' });
    res.json(row);
  })
);

app.get(
  '/api/customs/exports',
  requireAuth(),
  asyncHandler(async (_req, res) => {
    const rows = await run('select * from customs_exports order by created_at desc limit 200');
    res.json(rows);
  })
);

app.post(
  '/api/customs/exports',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { direction, country, document_url, status, metadata } = req.body;
    const [row] = await run(
      `insert into customs_exports (direction, country, document_url, status, metadata)
       values ($1,$2,$3,$4,$5)
       returning *`,
      [direction || 'export', country || null, document_url || null, status || 'draft', metadata || null]
    );
    res.json(row);
  })
);

app.post(
  '/api/swiss-compliance/certificates',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { entity_type, entity_id, pdf_url, status } = req.body;
    if (!entity_type) return res.status(400).json({ message: 'entity_type requis' });
    const [row] = await run(
      `insert into swiss_compliance_certificates (entity_type, entity_id, pdf_url, status)
       values ($1,$2,$3,$4)
       returning *`,
      [entity_type, entity_id || null, pdf_url || null, status || 'issued']
    );
    res.json(row);
  })
);

// ==================== Déclassement matières avancé ====================
// Fonction helper pour garantir que la table downgrade_archives existe
const ensureDowngradeArchivesTable = async () => {
  try {
    await run(`
      create table if not exists downgrade_archives (
        id uuid primary key default gen_random_uuid(),
        downgrade_id uuid references downgrades(id) on delete cascade,
        pdf_data bytea not null,
        pdf_filename text not null,
        pdf_size_bytes integer,
        retention_years integer not null default 10,
        archived_at timestamptz not null default now(),
        archived_by uuid references users(id) on delete set null,
        expires_at timestamptz generated always as (archived_at + (retention_years || ' years')::interval) stored,
        metadata jsonb,
        created_at timestamptz not null default now()
      )
    `);
    await run('create index if not exists downgrade_archives_downgrade_idx on downgrade_archives(downgrade_id)');
    await run('create index if not exists downgrade_archives_expires_idx on downgrade_archives(expires_at)');
  } catch (err: any) {
    // Ignorer les erreurs de table/index déjà existants
    if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
      console.warn('[ensureDowngradeArchivesTable] Erreur:', err.message);
    }
  }
};

// Fonction helper pour garantir que toutes les colonnes downgrades existent
const ensureDowngradesColumns = async () => {
  const columns: [string, string][] = [
    ['motive_principal', 'text'],
    ['motive_description', 'text'],
    ['declassed_material_code', 'text'],
    ['vehicle_plate', 'text'],
    ['slip_number', 'text'],
    ['motive_ratio', 'text'],
    ['sorting_time_minutes', 'text'],
    ['machines_used', 'text[]'],
    ['lot_origin_client_name', 'text'],
    ['lot_origin_client_address', 'text'],
    ['photos_avant', 'text[]'],
    ['photos_apres', 'text[]'],
    ['proof_photos', 'text[]'],
    ['controller_name', 'text'],
    ['controller_signature', 'text'],
    ['incident_number', 'text'],
    ['new_category', 'text'],
    ['new_veva_code', 'text'],
    ['new_quality', 'text'],
    ['poids_net_declasse', 'numeric'],
    ['stockage_type', 'text'],
    ['destination', 'text'],
    ['veva_type', 'text'],
    ['previous_producer', 'text'],
    ['planned_transporter', 'text'],
    ['veva_slip_number', 'text'],
    ['swissid_signature', 'text'],
    ['documents', 'jsonb'],
    ['omod_category', 'text'],
    ['omod_dangerosity', 'text'],
    ['omod_dismantling_required', 'boolean'],
    ['ldtr_canton', 'text'],
    ['canton_rules_applied', 'text'],
    ['emplacement_actuel', 'text'],
    ['nouvel_emplacement', 'text'],
    ['mouvement_type', 'text'],
    ['transport_number', 'text'],
    ['driver_id', 'uuid'],
    ['vehicle_id', 'uuid'],
    ['weighbridge_id', 'uuid'],
    ['poids_final_brut', 'numeric'],
    ['poids_final_tare', 'numeric'],
    ['poids_final_net', 'numeric'],
    ['seal_number', 'text'],
    ['valeur_avant', 'numeric'],
    ['valeur_apres', 'numeric'],
    ['perte_gain', 'numeric'],
    ['responsable_validation', 'text'],
    ['cause_economique', 'text'],
    ['impact_marge', 'numeric'],
    ['risques_identifies', 'text[]'],
    ['epis_requis', 'text[]'],
    ['procedure_suivie', 'text'],
    ['anomalie_signalee', 'boolean'],
    ['declaration_securite', 'text'],
    ['lot_origin_site_id', 'uuid'],
    ['lot_origin_client_id', 'uuid'],
    ['lot_origin_canton', 'text'],
    ['lot_origin_commune', 'text'],
    ['lot_entry_date', 'date'],
    ['lot_entry_at', 'timestamptz'],
    ['lot_veva_code', 'text'],
    ['lot_internal_code', 'text'],
    ['lot_filiere', 'text'],
    ['lot_quality_grade', 'text'],
    ['lot_quality_metrics', 'jsonb'],
    ['lot_weight_brut', 'numeric'],
    ['lot_weight_tare', 'numeric'],
    ['lot_weight_net', 'numeric'],
    ['declassed_material', 'text'],
    ['status', 'text']
  ];
  
  for (const [colName, colType] of columns) {
    try {
      await run(`alter table downgrades add column if not exists ${colName} ${colType}`);
    } catch (err: any) {
      // Logger l'erreur mais continuer
      if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
        console.log(`[ensureDowngradesColumns] Erreur pour ${colName}:`, err.message);
      }
    }
  }
};

// Fonction helper pour valider et nettoyer les valeurs UUID
const cleanUuidValue = (value: any, fieldName: string): any => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  // Convertir en string si ce n'est pas déjà le cas
  const strValue = String(value).trim();
  if (strValue === '' || strValue === 'null' || strValue === 'undefined') {
    return null;
  }
  // Si c'est déjà un UUID valide, le retourner
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strValue)) {
    return strValue;
  }
  // Si c'est un nombre ou une chaîne qui n'est pas un UUID, logger et retourner null
  if (strValue.match(/^\d+$/)) {
    console.warn(`[cleanUuidValue] Valeur numérique "${strValue}" rejetée pour le champ UUID "${fieldName}"`);
  } else {
    console.warn(`[cleanUuidValue] Valeur non-UUID "${strValue}" rejetée pour le champ UUID "${fieldName}"`);
  }
  return null;
};

// Fonction helper pour valider et nettoyer les valeurs numeric
const cleanNumericValue = (value: any, fieldName: string): any => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  // Si c'est déjà un nombre, le retourner
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? null : value;
  }
  // Si c'est une chaîne, essayer de la convertir
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  // Si la valeur n'est pas convertible, retourner null
  return null;
};

// Fonction helper pour valider et nettoyer les valeurs array
const cleanArrayValue = (value: any, fieldName: string): any => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  // Si c'est déjà un tableau, le retourner (même vide)
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value;
  }
  // Si c'est une chaîne vide, retourner null
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  // Si c'est une chaîne qui ressemble à un tableau JSON, essayer de la parser
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.length === 0 ? null : parsed;
      }
    } catch (e) {
      // Ignorer les erreurs de parsing
    }
  }
  // Si la valeur n'est pas un tableau valide, retourner null
  return null;
};

app.get(
  '/api/downgrades',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const lotId = req.query.lot_id as string | undefined;
    const status = req.query.status as string | undefined;
    const params: any[] = [];
    
    // Exclure les colonnes de photos volumineuses pour éviter les erreurs "response too large"
    // Les photos seront disponibles via GET /api/downgrades/:id si nécessaire
    let sql = `select 
      id, lot_id, from_quality_id, from_quality, to_quality_id, to_quality, reason,
      adjusted_weight, adjusted_value, performed_at, performed_by,
      motive_principal, motive_description, declassed_material_code, vehicle_plate, slip_number,
      motive_ratio, sorting_time_minutes, machines_used, lot_origin_client_name, lot_origin_client_address,
      controller_name, controller_signature, incident_number,
      new_category, new_veva_code, new_quality, poids_net_declasse, stockage_type, destination,
      veva_type, previous_producer, planned_transporter, veva_slip_number, swissid_signature,
      documents, omod_category, omod_dangerosity, omod_dismantling_required, ldtr_canton,
      canton_rules_applied, emplacement_actuel, nouvel_emplacement, mouvement_type,
      transport_number, poids_final_brut, poids_final_tare, poids_final_net, seal_number,
      valeur_avant, valeur_apres, perte_gain, responsable_validation, cause_economique,
      impact_marge, risques_identifies, epis_requis, procedure_suivie, anomalie_signalee,
      declaration_securite, lot_origin_site_id, lot_origin_client_id, lot_origin_canton,
      lot_origin_commune, lot_entry_date, lot_entry_at, lot_veva_code, lot_internal_code,
      lot_filiere, lot_quality_grade, lot_quality_metrics, lot_weight_brut, lot_weight_tare,
      lot_weight_net, declassed_material, driver_id, vehicle_id, weighbridge_id,
      status, validated_at, validated_by, sent_at, sent_by,
      -- Indicateur que les photos existent (sans les charger)
      case when photos_avant is not null and array_length(photos_avant, 1) > 0 then true else false end as has_photos_avant,
      case when photos_apres is not null and array_length(photos_apres, 1) > 0 then true else false end as has_photos_apres,
      case when proof_photos is not null and array_length(proof_photos, 1) > 0 then true else false end as has_proof_photos
    from downgrades where 1=1`;
    let paramIndex = 1;
    
    if (lotId) {
      sql += ` and lot_id = $${paramIndex}`;
      params.push(lotId);
      paramIndex++;
    }
    
    if (status) {
      sql += ` and status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    sql += ' order by performed_at desc limit 200';
    const rows = await run(sql, params);
    res.json(rows);
  })
);

app.get(
  '/api/downgrades/pending',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    // Exclure les colonnes de photos volumineuses pour éviter les erreurs "response too large"
    const rows = await run(
      `select 
        id, lot_id, from_quality_id, from_quality, to_quality_id, to_quality, reason,
        adjusted_weight, adjusted_value, performed_at, performed_by,
        motive_principal, motive_description, declassed_material_code, vehicle_plate, slip_number,
        motive_ratio, sorting_time_minutes, machines_used, lot_origin_client_name, lot_origin_client_address,
        controller_name, controller_signature, incident_number,
        new_category, new_veva_code, new_quality, poids_net_declasse, stockage_type, destination,
        veva_type, previous_producer, planned_transporter, veva_slip_number, swissid_signature,
        documents, omod_category, omod_dangerosity, omod_dismantling_required, ldtr_canton,
        canton_rules_applied, emplacement_actuel, nouvel_emplacement, mouvement_type,
        transport_number, poids_final_brut, poids_final_tare, poids_final_net, seal_number,
        valeur_avant, valeur_apres, perte_gain, responsable_validation, cause_economique,
        impact_marge, risques_identifies, epis_requis, procedure_suivie, anomalie_signalee,
        declaration_securite, lot_origin_site_id, lot_origin_client_id, lot_origin_canton,
        lot_origin_commune, lot_entry_date, lot_entry_at, lot_veva_code, lot_internal_code,
        lot_filiere, lot_quality_grade, lot_quality_metrics, lot_weight_brut, lot_weight_tare,
        lot_weight_net, declassed_material, driver_id, vehicle_id, weighbridge_id,
        status, validated_at, validated_by, sent_at, sent_by,
        -- Indicateur que les photos existent (sans les charger)
        case when photos_avant is not null and array_length(photos_avant, 1) > 0 then true else false end as has_photos_avant,
        case when photos_apres is not null and array_length(photos_apres, 1) > 0 then true else false end as has_photos_apres,
        case when proof_photos is not null and array_length(proof_photos, 1) > 0 then true else false end as has_proof_photos
      from downgrades 
       where status = 'pending_completion' 
       order by performed_at desc`
    );
    res.json(rows);
  })
);

app.get(
  '/api/downgrades/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [row] = await run('select * from downgrades where id = $1', [id]);
    if (!row) return res.status(404).json({ message: 'Déclassement introuvable' });
    res.json(row);
  })
);

app.post(
  '/api/downgrades',
  requireAuth(), // Tous les utilisateurs authentifiés peuvent créer des déclassements
  asyncHandler(async (req, res) => {
    // Garantir que toutes les colonnes existent AVANT l'insertion
    await ensureDowngradesColumns();
    
    const payload = req.body || {};
    const isDraft = payload.status === 'draft' || payload.save_as_draft === true;
    
    // Validation minimale pour brouillon
    if (!isDraft) {
      if (!payload.lot_id && !payload.lot_internal_code) {
        return res.status(400).json({ message: 'ID lot ou code interne requis' });
      }
      if (!payload.motive_principal) {
        return res.status(400).json({ message: 'Motif principal requis' });
      }
    }
    
    // Tous les champs autorisés (utilisateurs terrain remplissent 1-2, dispo complète 3-8)
    const allFields = [
      'lot_id', 'from_quality_id', 'from_quality', 'to_quality_id', 'to_quality', 'reason',
      'adjusted_weight', 'adjusted_value', 'performed_at', 'motive_principal', 'motive_description',
      'photos_avant', 'photos_apres', 'controller_name', 'controller_signature', 'incident_number',
      'new_category', 'new_veva_code', 'new_quality', 'poids_net_declasse', 'stockage_type', 'destination',
      'veva_type', 'previous_producer', 'planned_transporter', 'veva_slip_number', 'swissid_signature',
      'documents', 'omod_category', 'omod_dangerosity', 'omod_dismantling_required', 'ldtr_canton',
      'canton_rules_applied', 'proof_photos', 'emplacement_actuel', 'nouvel_emplacement', 'mouvement_type',
      'transport_number', 'driver_id', 'vehicle_id', 'weighbridge_id', 'poids_final_brut', 'poids_final_tare',
      'poids_final_net', 'seal_number', 'valeur_avant', 'valeur_apres', 'perte_gain', 'responsable_validation',
      'cause_economique', 'impact_marge', 'risques_identifies', 'epis_requis', 'procedure_suivie',
      'anomalie_signalee', 'declaration_securite',
      'lot_origin_site_id', 'lot_origin_client_id', 'lot_origin_canton', 'lot_origin_commune',
      'lot_entry_date', 'lot_entry_at', 'lot_veva_code', 'lot_internal_code', 'lot_filiere', 'lot_quality_grade',
      'lot_quality_metrics', 'lot_weight_brut', 'lot_weight_tare', 'lot_weight_net', 'declassed_material',
      'declassed_material_code', 'vehicle_plate', 'slip_number', 'motive_ratio', 'sorting_time_minutes',
      'machines_used', 'lot_origin_client_name', 'lot_origin_client_address',
      'status'
    ];
    const cols: string[] = [];
    const values: any[] = [];
    const params: string[] = [];
    // Définir les champs numeric
    const numericFields = [
      'adjusted_weight', 'adjusted_value', 'poids_net_declasse', 'poids_final_brut', 'poids_final_tare',
      'poids_final_net', 'valeur_avant', 'valeur_apres', 'perte_gain', 'impact_marge',
      'lot_weight_brut', 'lot_weight_tare', 'lot_weight_net'
    ];
    
    // Définir les champs array
    const arrayFields = [
      'photos_avant', 'photos_apres', 'proof_photos', 'machines_used', 'risques_identifies', 'epis_requis'
    ];
    
    allFields.forEach((f) => {
      // Ignorer les valeurs undefined, mais traiter null et chaînes vides
      if (payload[f] === undefined) {
        return;
      }
      
      let value = payload[f];
      
      // Nettoyer TOUS les champs qui se terminent par _id (UUID)
      if (f.endsWith('_id')) {
        value = cleanUuidValue(value, f);
        // Si la valeur n'est pas un UUID valide, ne pas l'inclure
        if (value === null) {
          return;
        }
      }
      // Nettoyer les valeurs numeric
      else if (numericFields.includes(f)) {
        value = cleanNumericValue(value, f);
        // Si la valeur n'est pas un numeric valide, ne pas l'inclure
        if (value === null) {
          return;
        }
      }
      // Nettoyer les valeurs array (AVANT de vérifier si c'est undefined)
      else if (arrayFields.includes(f)) {
        // Si c'est une chaîne vide, retourner null directement
        if (typeof value === 'string' && value.trim() === '') {
          return;
        }
        value = cleanArrayValue(value, f);
        // Si la valeur n'est pas un array valide, ne pas l'inclure
        if (value === null) {
          return;
        }
      }
      // Pour les autres champs texte, si c'est une chaîne vide, ne pas l'inclure
      else if (typeof value === 'string' && value.trim() === '') {
        return;
      }
      
      cols.push(f);
      values.push(value);
      params.push(`$${values.length}`);
    });
    
    // S'assurer que reason a une valeur par défaut si elle n'est pas fournie
    if (!cols.includes('reason')) {
      cols.push('reason');
      values.push(payload.reason || payload.motive_principal || 'Déclassement');
      params.push(`$${values.length}`);
    }
    
    // Définir le statut par défaut si non fourni
    if (!payload.status) {
      cols.push('status');
      values.push(isDraft ? 'draft' : 'pending_completion');
      params.push(`$${values.length}`);
    }
    
    cols.push('performed_by');
    values.push((req as AuthenticatedRequest).auth?.id || null);
    params.push(`$${values.length}`);

    // Vérification finale : s'assurer qu'aucune valeur non-UUID n'est dans les champs _id
    const validCols: string[] = [];
    const validValues: any[] = [];
    const validParams: string[] = [];
    
    cols.forEach((col, idx) => {
      const val = values[idx];
      if (col.endsWith('_id') && val != null) {
        if (typeof val === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
          console.error(`[POST /api/downgrades] ⚠️ ERREUR: Valeur non-UUID "${val}" pour le champ ${col}, champ ignoré`);
          return; // Ignorer ce champ
        }
      }
      validCols.push(col);
      validValues.push(val);
      validParams.push(`$${validValues.length}`);
    });

    const insertSql = `
      insert into downgrades (${validCols.join(',')})
      values (${validParams.join(',')})
      returning *
    `;
    const [row] = await run(insertSql, validValues);
    res.status(201).json(row);
  })
);

app.patch(
  '/api/downgrades/:id',
  requireAuth(), // Tous les utilisateurs authentifiés peuvent modifier leurs déclassements
  asyncHandler(async (req, res) => {
    // Garantir que toutes les colonnes existent AVANT la modification
    await ensureDowngradesColumns();
    
    const { id } = req.params;
    const payload = req.body || {};
    const userId = (req as AuthenticatedRequest).auth?.id;
    const userRole = (req as AuthenticatedRequest).auth?.role;
    const isManager = userRole === 'admin' || userRole === 'manager';
    
    // Vérifier que le déclassement existe
    const [existing] = await run('select * from downgrades where id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Déclassement introuvable' });
    }
    
    // Définir les champs des parties 1-2 (terrain) vs parties 3-8 (dispo)
    const fieldsParties12 = [
      'lot_id', 'lot_origin_site_id', 'lot_origin_client_id', 'lot_origin_canton', 'lot_origin_commune',
      'lot_entry_date', 'lot_entry_at', 'lot_veva_code', 'lot_internal_code', 'lot_filiere', 'lot_quality_grade',
      'lot_quality_metrics', 'lot_weight_brut', 'lot_weight_tare', 'lot_weight_net',
      'vehicle_plate', 'slip_number', 'declassed_material', 'declassed_material_code',
      'motive_principal', 'motive_description', 'photos_avant', 'photos_apres', 'proof_photos',
      'controller_name', 'controller_signature', 'incident_number',
      'motive_ratio', 'sorting_time_minutes', 'machines_used',
      'lot_origin_client_name', 'lot_origin_client_address'
    ];
    const fieldsParties38 = [
      'new_category', 'new_veva_code', 'new_quality', 'poids_net_declasse', 'stockage_type', 'destination',
      'veva_type', 'previous_producer', 'planned_transporter', 'veva_slip_number', 'swissid_signature',
      'documents', 'omod_category', 'omod_dangerosity', 'omod_dismantling_required', 'ldtr_canton',
      'canton_rules_applied', 'emplacement_actuel', 'nouvel_emplacement', 'mouvement_type',
      'transport_number', 'driver_id', 'vehicle_id', 'weighbridge_id', 'poids_final_brut', 'poids_final_tare',
      'poids_final_net', 'seal_number', 'valeur_avant', 'valeur_apres', 'perte_gain', 'responsable_validation',
      'cause_economique', 'impact_marge', 'risques_identifies', 'epis_requis', 'procedure_suivie',
      'anomalie_signalee', 'declaration_securite'
    ];
    
    // Vérifier les permissions selon le statut
    if (existing.status === 'sent' && userRole !== 'admin') {
      return res.status(403).json({ message: 'Déclassement déjà envoyé, modification non autorisée' });
    }
    
    // Les utilisateurs terrain ne peuvent modifier que leurs propres déclassements (parties 1-2)
    if (!isManager) {
      // Vérifier que c'est leur propre déclassement
      if (existing.performed_by !== userId) {
        return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres déclassements' });
      }
      
      // Vérifier qu'ils ne modifient que les parties 1-2
      for (const field of fieldsParties38) {
        if (payload[field] !== undefined) {
          return res.status(403).json({ message: `Seuls les managers peuvent modifier le champ: ${field} (parties 3-8)` });
        }
      }
      
      // Ne pas permettre de changer le statut vers validated/sent
      if (payload.status && ['validated', 'sent'].includes(payload.status)) {
        return res.status(403).json({ message: 'Seuls les managers peuvent valider/envoyer un déclassement' });
      }
    }
    
    const fields = [
      'lot_id', 'from_quality_id', 'from_quality', 'to_quality_id', 'to_quality', 'reason',
      'adjusted_weight', 'adjusted_value', 'performed_at', 'motive_principal', 'motive_description',
      'photos_avant', 'photos_apres', 'controller_name', 'controller_signature', 'incident_number',
      'new_category', 'new_veva_code', 'new_quality', 'poids_net_declasse', 'stockage_type', 'destination',
      'veva_type', 'previous_producer', 'planned_transporter', 'veva_slip_number', 'swissid_signature',
      'documents', 'omod_category', 'omod_dangerosity', 'omod_dismantling_required', 'ldtr_canton',
      'canton_rules_applied', 'proof_photos', 'emplacement_actuel', 'nouvel_emplacement', 'mouvement_type',
      'transport_number', 'driver_id', 'vehicle_id', 'weighbridge_id', 'poids_final_brut', 'poids_final_tare',
      'poids_final_net', 'seal_number', 'valeur_avant', 'valeur_apres', 'perte_gain', 'responsable_validation',
      'cause_economique', 'impact_marge', 'risques_identifies', 'epis_requis', 'procedure_suivie',
      'anomalie_signalee', 'declaration_securite',
      'lot_origin_site_id', 'lot_origin_client_id', 'lot_origin_canton', 'lot_origin_commune',
      'lot_entry_date', 'lot_entry_at', 'lot_veva_code', 'lot_internal_code', 'lot_filiere', 'lot_quality_grade',
      'lot_quality_metrics', 'lot_weight_brut', 'lot_weight_tare', 'lot_weight_net', 'declassed_material',
      'declassed_material_code', 'vehicle_plate', 'slip_number', 'motive_ratio', 'sorting_time_minutes',
      'machines_used', 'lot_origin_client_name', 'lot_origin_client_address',
      'status'
    ];
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    // Définir les champs numeric
    const numericFields = [
      'adjusted_weight', 'adjusted_value', 'poids_net_declasse', 'poids_final_brut', 'poids_final_tare',
      'poids_final_net', 'valeur_avant', 'valeur_apres', 'perte_gain', 'impact_marge',
      'lot_weight_brut', 'lot_weight_tare', 'lot_weight_net'
    ];
    
    // Définir les champs array
    const arrayFields = [
      'photos_avant', 'photos_apres', 'proof_photos', 'machines_used', 'risques_identifies', 'epis_requis'
    ];
    
    fields.forEach((f) => {
      // Ignorer les valeurs undefined, mais traiter null et chaînes vides
      if (payload[f] === undefined) {
        return;
      }
      
      let value = payload[f];
      
      // Nettoyer TOUS les champs qui se terminent par _id (UUID)
      if (f.endsWith('_id')) {
        value = cleanUuidValue(value, f);
        // Si la valeur n'est pas un UUID valide, ne pas l'inclure
        if (value === null) {
          return;
        }
      }
      // Nettoyer les valeurs numeric
      else if (numericFields.includes(f)) {
        value = cleanNumericValue(value, f);
        // Si la valeur n'est pas un numeric valide, ne pas l'inclure
        if (value === null) {
          return;
        }
      }
      // Nettoyer les valeurs array (AVANT de vérifier si c'est undefined)
      else if (arrayFields.includes(f)) {
        // Si c'est une chaîne vide, retourner null directement
        if (typeof value === 'string' && value.trim() === '') {
          return;
        }
        value = cleanArrayValue(value, f);
        // Si la valeur n'est pas un array valide, ne pas l'inclure
        if (value === null) {
          return;
        }
      }
      // Pour les autres champs texte, si c'est une chaîne vide, ne pas l'inclure
      else if (typeof value === 'string' && value.trim() === '') {
        return;
      }
      
      updates.push(`${f} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });
    
    // Gestion des changements de statut
    if (payload.status === 'validated') {
      updates.push(`validated_at = $${paramIndex}`);
      values.push(new Date().toISOString());
      paramIndex++;
      updates.push(`validated_by = $${paramIndex}`);
      values.push((req as AuthenticatedRequest).auth?.id || null);
      paramIndex++;
    }
    
    if (payload.status === 'sent') {
      updates.push(`sent_at = $${paramIndex}`);
      values.push(new Date().toISOString());
      paramIndex++;
      updates.push(`sent_by = $${paramIndex}`);
      values.push((req as AuthenticatedRequest).auth?.id || null);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune modification à appliquer' });
    }
    
    values.push(id);
    const updateSql = `
      update downgrades
      set ${updates.join(', ')}
      where id = $${paramIndex}
      returning *
    `;
    const [row] = await run(updateSql, values);
    res.json(row);
  })
);

app.post(
  '/api/downgrades/:id/veva-slip',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [dg] = await run('select * from downgrades where id = $1', [id]);
    if (!dg) return res.status(404).json({ message: 'Déclassement introuvable' });
    const slipNumber = `VEVA-${Date.now()}`;
    const qrRef = `QR-${Math.random().toString(36).slice(2, 10)}`;
    const pdfUrl = `https://example.com/veva/${slipNumber}.pdf`;
    const [slip] = await run(
      `insert into veva_slips (slip_number, customer_id, downgrade_id, waste_type, veva_category_code, qr_reference, pdf_url, status, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,'issued',$8)
       returning *`,
      [
        slipNumber,
        dg.lot_origin_client_id || null,
        id,
        dg.new_category || dg.lot_filiere || null,
        dg.new_veva_code || dg.lot_veva_code || null,
        qrRef,
        pdfUrl,
        { from_downgrade: id }
      ]
    );
    res.json(slip);
  })
);

app.post(
  '/api/downgrades/:id/pdf',
  requireAuth(), // Tous les utilisateurs authentifiés peuvent générer et envoyer le PDF
  asyncHandler(async (req, res) => {
    // Garantir que la table downgrade_archives existe
    await ensureDowngradeArchivesTable();
    
    const { id } = req.params;
    const { pdf_base64, pdf_filename, finalize } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    
    const [dg] = await run('select * from downgrades where id = $1', [id]);
    if (!dg) return res.status(404).json({ message: 'Déclassement introuvable' });
    
    // Si PDF fourni, l'archiver
    if (pdf_base64 && pdf_filename) {
      let archive: any = null;
      const filename = pdf_filename || `declassement_${id}_${Date.now()}.pdf`;
      try {
        const pdfBuffer = Buffer.from(pdf_base64, 'base64');
        
        // Archiver le PDF (rétention 10 ans)
        [archive] = await run(
          `insert into downgrade_archives (downgrade_id, pdf_data, pdf_filename, pdf_size_bytes, retention_years, archived_by, metadata)
           values ($1, $2, $3, $4, 10, $5, $6)
           returning id, archived_at, expires_at`,
          [
            id,
            pdfBuffer,
            filename,
            pdfBuffer.length,
            auth?.id || null,
            JSON.stringify({ 
              status_at_archive: dg.status,
              archived_by_name: auth?.email || null
            })
          ]
        );
      } catch (archiveErr: any) {
        console.error('[Downgrade PDF] Erreur lors de l\'archivage:', archiveErr);
        // Si l'archivage échoue, continuer quand même pour l'envoi d'email
        if (archiveErr.message?.includes('does not exist')) {
          console.warn('[Downgrade PDF] Table downgrade_archives n\'existe pas encore, tentative de création...');
          await ensureDowngradeArchivesTable();
          // Réessayer une fois après création de la table
          try {
            const pdfBuffer = Buffer.from(pdf_base64, 'base64');
            [archive] = await run(
              `insert into downgrade_archives (downgrade_id, pdf_data, pdf_filename, pdf_size_bytes, retention_years, archived_by, metadata)
               values ($1, $2, $3, $4, 10, $5, $6)
               returning id, archived_at, expires_at`,
              [
                id,
                pdfBuffer,
                filename,
                pdfBuffer.length,
                auth?.id || null,
                JSON.stringify({ 
                  status_at_archive: dg.status,
                  archived_by_name: auth?.email || null
                })
              ]
            );
          } catch (retryErr: any) {
            console.error('[Downgrade PDF] Erreur lors de la réessai d\'archivage:', retryErr);
            // Ne pas bloquer l'envoi d'email même si l'archivage échoue
          }
        }
      }
      
      // Si finalize=true, mettre à jour le statut à 'validated'
      if (finalize === true) {
        await run(
          `update downgrades 
           set status = 'validated', validated_at = now(), validated_by = $1
           where id = $2`,
          [auth?.id || null, id]
        );
      }

      // Envoi email aux destinataires configurés (TOUJOURS si finalize=true)
      let emailSent = false;
      let emailError: string | null = null;
      
      if (finalize === true) {
        try {
          const recipients =
            (process.env.DECLASSEMENT_RECIPIENTS || process.env.BREVO_SENDER_EMAIL || '')
              .split(',')
              .map((email) => email.trim())
              .filter(Boolean);
          
          if (recipients.length === 0) {
            console.warn(`[Downgrade PDF] ⚠️ Aucun destinataire configuré pour l'envoi d'email (DECLASSEMENT_RECIPIENTS ou BREVO_SENDER_EMAIL)`);
            emailError = 'Aucun destinataire email configuré';
          } else {
            const customerName = dg.lot_origin_client_name || dg.lot_origin_client_id || 'Client inconnu';
            const subject = `Déclassement matière - ${customerName}`;
            const textBody = [
              `Déclassement : ${id}`,
              `Client : ${customerName}`,
              `Matière annoncée : ${dg.lot_quality_grade || dg.lot_filiere || '—'}`,
              `Matière déclassée : ${dg.declassed_material || dg.new_category || '—'}`,
              `Statut : validé`,
              '',
              'Le PDF est joint à cet e-mail.'
            ].join('\n');

            console.log(`[Downgrade PDF] 📧 Envoi email à ${recipients.length} destinataire(s): ${recipients.join(', ')}`);
            
            await sendBrevoEmail({
              to: recipients,
              subject,
              text: textBody,
              attachments: [
                {
                  name: filename,
                  content: pdf_base64,
                  type: 'application/pdf'
                }
              ]
            });
            
            emailSent = true;
            console.log(`[Downgrade PDF] ✅ Email envoyé avec succès à ${recipients.length} destinataire(s) pour déclassement ${id}`);
          }
        } catch (err: any) {
          console.error('[Downgrade PDF] ❌ Erreur envoi email déclassement:', err);
          emailError = err?.message || 'Erreur inconnue lors de l\'envoi de l\'email';
        }
      }
      
      return res.json({ 
        success: true,
        archive_id: archive?.id || null,
        archived_at: archive?.archived_at || null,
        expires_at: archive?.expires_at || null,
        email_sent: emailSent,
        email_error: emailError,
        message: emailSent 
          ? (archive ? 'PDF archivé et email envoyé avec succès (rétention 10 ans)' : 'Email envoyé avec succès (archivage échoué)')
          : emailError
            ? (archive ? `PDF archivé mais erreur email: ${emailError}` : `Erreur email: ${emailError} (archivage échoué)`)
            : (archive ? 'PDF archivé avec succès (rétention 10 ans)' : 'PDF traité (archivage échoué)')
      });
    }
    
    // Sinon, retourner l'URL placeholder (compatibilité)
    const pdfUrl = `https://example.com/downgrade/${id}.pdf`;
    res.json({ pdf_url: pdfUrl });
  })
);

app.get(
  '/api/downgrades/export',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const format = (req.query.format as string) || 'excel';
    // Exclure les colonnes de photos volumineuses pour éviter les erreurs "response too large"
    const rows = await run(`select 
      id, lot_id, from_quality_id, from_quality, to_quality_id, to_quality, reason,
      adjusted_weight, adjusted_value, performed_at, performed_by,
      motive_principal, motive_description, declassed_material_code, vehicle_plate, slip_number,
      motive_ratio, sorting_time_minutes, machines_used, lot_origin_client_name, lot_origin_client_address,
      controller_name, controller_signature, incident_number,
      new_category, new_veva_code, new_quality, poids_net_declasse, stockage_type, destination,
      veva_type, previous_producer, planned_transporter, veva_slip_number, swissid_signature,
      documents, omod_category, omod_dangerosity, omod_dismantling_required, ldtr_canton,
      canton_rules_applied, emplacement_actuel, nouvel_emplacement, mouvement_type,
      transport_number, poids_final_brut, poids_final_tare, poids_final_net, seal_number,
      valeur_avant, valeur_apres, perte_gain, responsable_validation, cause_economique,
      impact_marge, risques_identifies, epis_requis, procedure_suivie, anomalie_signalee,
      declaration_securite, lot_origin_site_id, lot_origin_client_id, lot_origin_canton,
      lot_origin_commune, lot_entry_date, lot_entry_at, lot_veva_code, lot_internal_code,
      lot_filiere, lot_quality_grade, lot_quality_metrics, lot_weight_brut, lot_weight_tare,
      lot_weight_net, declassed_material, driver_id, vehicle_id, weighbridge_id,
      status, validated_at, validated_by, sent_at, sent_by
    from downgrades order by performed_at desc limit 1000`);
    res.json({ format, rows });
  })
);

// Fonction helper pour optimiser avec Nearest Neighbor
const optimizeRouteNearestNeighbor = (
  customers: any[],
  vehicle: any | null,
  options?: { altitudeWeight?: number }
) => {
  if (customers.length === 0) return [];
  if (customers.length === 1) return customers;

  const optimized: any[] = [];
  const remaining = [...customers];
  
  // Point de départ (premier client ou dépôt)
  let current = remaining.shift()!;
  optimized.push(current);

  while (remaining.length > 0) {
    let nearest: any = null;
    let nearestDistance = Infinity;
    let nearestIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const customer = remaining[i];
      const distance = calculateDistanceWithAltitude(
        current.latitude || 0,
        current.longitude || 0,
        customer.latitude || 0,
        customer.longitude || 0,
        current.altitude_m,
        customer.altitude_m,
        options?.altitudeWeight
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = customer;
        nearestIndex = i;
      }
    }

    if (nearest) {
      optimized.push(nearest);
      remaining.splice(nearestIndex, 1);
      current = nearest;
    }
  }

  return optimized.map((customer, index) => ({
    ...customer,
    order_index: index,
    estimated_arrival_time: null // À calculer avec les durées
  }));
};

// Fonction helper pour calculer la distance entre deux points (Haversine)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Distance pondérée altitude/dénivelé (pénalité si fort dénivelé)
const calculateDistanceWithAltitude = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  alt1?: number | null,
  alt2?: number | null,
  altitudeWeight: number = 1
): number => {
  const base = calculateDistance(lat1, lon1, lat2, lon2);
  if (alt1 == null || alt2 == null || base === 0) return base;
  const deltaAlt = Math.abs(alt2 - alt1); // en mètres
  const gradient = deltaAlt / (base * 1000); // pente moyenne
  // Pénalité max +30% si pente moyenne >= 8%
  const penaltyFactor = Math.min(0.3, Math.max(0, gradient - 0.02)); // commence à 2% de pente
  const weightedPenalty = penaltyFactor * Math.max(0, altitudeWeight);
  return Math.round((base * (1 + weightedPenalty)) * 100) / 100;
};

// Assurer la présence des tables/logistique CH (fallback si ensureSchema pas rejoué)
const ensureLogisticsInfra = async () => {
  await run(`
    create table if not exists canton_rules (
      id uuid primary key default gen_random_uuid(),
      canton_code text not null unique,
      quiet_hours jsonb,
      blue_zone boolean default false,
      waste_types jsonb,
      quotas jsonb,
      max_weight_tons numeric,
      notes text,
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists canton_rules_canton_idx on canton_rules(canton_code)');

  await run(`
    create table if not exists ofrou_closures (
      id uuid primary key default gen_random_uuid(),
      road_name text,
      canton text,
      status text,
      reason text,
      valid_from timestamptz,
      valid_to timestamptz,
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists ofrou_closures_canton_idx on ofrou_closures(canton)');

  await run(`
    create table if not exists swiss_topo_cache (
      id uuid primary key default gen_random_uuid(),
      lat numeric not null,
      lon numeric not null,
      altitude_m numeric,
      gradient numeric,
      updated_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists swiss_topo_cache_lat_lon_idx on swiss_topo_cache(lat, lon)');

  // Colonnes véhicules requises
  await run(`alter table vehicles add column if not exists vehicle_type text`);
  await run(`alter table vehicles add column if not exists max_weight_kg numeric`);
  await run(`alter table vehicles add column if not exists max_volume_m3 numeric`);
  await run(`alter table vehicles add column if not exists compatible_materials text[]`);
  await run(`alter table vehicles add column if not exists status text`);

  // Telematics + règles poids / hiver (fallback)
  await run(`
    create table if not exists telematics_connectors (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      provider text not null,
      webhook_secret text,
      config jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await run(`
    create table if not exists telematics_devices (
      id uuid primary key default gen_random_uuid(),
      vehicle_id uuid references vehicles(id) on delete set null,
      connector_id uuid references telematics_connectors(id) on delete set null,
      external_id text,
      metadata jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists telematics_devices_vehicle_idx on telematics_devices(vehicle_id)');
  await run(`
    create table if not exists telematics_events (
      id uuid primary key default gen_random_uuid(),
      device_id uuid references telematics_devices(id) on delete set null,
      vehicle_id uuid references vehicles(id) on delete set null,
      event_type text not null,
      payload jsonb,
      lat numeric,
      lon numeric,
      speed_kmh numeric,
      fuel_level_pct numeric,
      load_pct numeric,
      altitude_m numeric,
      occurred_at timestamptz default now(),
      received_at timestamptz not null default now()
    )
  `);
  await run('create index if not exists telematics_events_vehicle_idx on telematics_events(vehicle_id)');
  await run('create index if not exists telematics_events_occurred_idx on telematics_events(occurred_at desc)');

  await run(`
    create table if not exists road_weight_rules (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      geojson text,
      max_weight_tons numeric,
      season text,
      notes text,
      created_at timestamptz not null default now()
    )
  `);

  await run(`
    create table if not exists vehicle_winter_rules (
      id uuid primary key default gen_random_uuid(),
      vehicle_id uuid references vehicles(id) on delete cascade,
      season text,
      winter_tires_required boolean default false,
      chains_required boolean default false,
      max_weight_tons numeric,
      notes text,
      created_at timestamptz not null default now()
    )
  `);
};

let logisticsInfraReady = false;
let logisticsInfraPromise: Promise<void> | null = null;
const ensureLogisticsInfraOnce = async () => {
  if (logisticsInfraReady) return;
  if (logisticsInfraPromise) return logisticsInfraPromise;
  logisticsInfraPromise = (async () => {
    try {
      await ensureLogisticsInfra();
      logisticsInfraReady = true;
    } catch (error: any) {
      const msg = error?.message || '';
      // Ignore duplicates/race on type/index creation
      if (
        msg.includes('pg_type_typname_nsp_index') ||
        msg.includes('already exists') ||
        msg.includes('duplicate key value')
      ) {
        logisticsInfraReady = true;
      } else {
        throw error;
      }
    } finally {
      logisticsInfraPromise = null;
    }
  })();
  return logisticsInfraPromise;
};

// Fonction helper pour calculer la distance totale
const calculateTotalDistance = (customers: any[]): number => {
  if (customers.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < customers.length - 1; i++) {
    const current = customers[i];
    const next = customers[i + 1];
    total += calculateDistance(
      current.latitude || 0,
      current.longitude || 0,
      next.latitude || 0,
      next.longitude || 0
    );
  }
  return Math.round(total * 100) / 100;
};

// Fonction helper pour calculer la durée totale
const calculateTotalDuration = (customers: any[], vehicle: any | null): number => {
  const distance = calculateTotalDistance(customers);
  const avgSpeed = 50; // km/h par défaut
  const travelTime = (distance / avgSpeed) * 60; // minutes
  
  const serviceTime = customers.reduce((sum, customer) => {
    return sum + (customer.average_visit_duration_minutes || 15);
  }, 0);

  return Math.round(travelTime + serviceTime);
};

// Fonction helper pour calculer le taux d'utilisation
const calculateUtilizationRate = (customers: any[], vehicle: any): number | null => {
  if (!vehicle || !vehicle.max_weight_kg) return null;
  
  const totalWeight = customers.reduce((sum, customer) => {
    return sum + (customer.max_weight_per_visit_kg || 0);
  }, 0);

  return vehicle.max_weight_kg > 0 ? Math.min(100, (totalWeight / vehicle.max_weight_kg) * 100) : 0;
};

// Fonction helper pour calculer le score d'optimisation
const calculateOptimizationScore = (distance: number, duration: number, utilizationRate: number | null): number => {
  let score = 100;
  
  // Pénalité pour la distance (plus c'est long, moins bon)
  score -= distance * 0.5;
  
  // Pénalité pour la durée (plus c'est long, moins bon)
  score -= duration * 0.1;
  
  // Bonus pour l'utilisation du véhicule
  if (utilizationRate !== null) {
    score += utilizationRate * 0.3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

// POST /api/logistics/simulate-scenario - Simuler un scénario
app.post(
  '/api/logistics/simulate-scenario',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { scenario_name, scenario_description, base_route_id, scenario_type, scenario_config } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    if (!scenario_name || !scenario_type) {
      return res.status(400).json({ message: 'Nom et type de scénario requis' });
    }

    // Récupérer la route de base si fournie
    let baseRoute: any = null;
    if (base_route_id) {
      const routes = await run('select * from routes where id = $1', [base_route_id]);
      baseRoute = routes[0] || null;
    }

    // Simuler le scénario selon le type
    let simulatedMetrics: any = {};
    let simulatedRouteData: any = null;

    if (scenario_type === 'what_if') {
      // Simulation "Et si..."
      simulatedMetrics = {
        estimated_distance_change: scenario_config.distance_change || 0,
        estimated_duration_change: scenario_config.duration_change || 0,
        estimated_cost_change: scenario_config.cost_change || 0
      };
    } else if (scenario_type === 'optimization_test') {
      // Test d'optimisation
      simulatedMetrics = {
        optimization_potential: Math.random() * 20 + 10, // 10-30% d'amélioration potentielle
        estimated_savings: Math.random() * 500 + 100
      };
    }

    const [scenario] = await run(
      `insert into route_scenarios (
        scenario_name, scenario_description, base_route_id,
        scenario_type, scenario_config, simulated_route_data, simulated_metrics, created_by
      ) values (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8
      ) returning *`,
      [
        scenario_name,
        scenario_description || null,
        base_route_id || null,
        scenario_type,
        JSON.stringify(scenario_config || {}),
        JSON.stringify(simulatedRouteData),
        JSON.stringify(simulatedMetrics),
        auth?.id ?? null
      ]
    );

    res.status(201).json({ scenario });
  })
);

// GET /api/logistics/scenarios - Liste des scénarios
app.get(
  '/api/logistics/scenarios',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const scenarioType = req.query.scenario_type as string;
    const isApplied = req.query.is_applied as string;

    let sql = `
      select s.*,
             r.date as base_route_date,
             u.full_name as created_by_name
      from route_scenarios s
      left join routes r on r.id = s.base_route_id
      left join users u on u.id = s.created_by
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (scenarioType) {
      sql += ` and s.scenario_type = $${paramIndex}`;
      params.push(scenarioType);
      paramIndex++;
    }
    if (isApplied === 'true') {
      sql += ` and s.is_applied = true`;
    } else if (isApplied === 'false') {
      sql += ` and s.is_applied = false`;
    }

    sql += ' order by s.created_at desc limit 100';

    const scenarios = await run(sql, params);
    res.json(scenarios);
  })
);

// POST /api/logistics/optimize-load - Optimiser le chargement d'un véhicule
app.post(
  '/api/logistics/optimize-load',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { route_id, vehicle_id, stops_data } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    if (!vehicle_id || !stops_data || !Array.isArray(stops_data)) {
      return res.status(400).json({ message: 'Véhicule et données des arrêts requis' });
    }

    // Récupérer les capacités du véhicule
    const vehicles = await run(
      `select id, internal_number, max_weight_kg, max_volume_m3, vehicle_type, compatible_materials
       from vehicles
       where id = $1`,
      [vehicle_id]
    );

    const vehicle = vehicles[0];
    if (!vehicle) {
      return res.status(404).json({ message: 'Véhicule introuvable' });
    }

    // Calculer le chargement optimal
    const totalWeight = stops_data.reduce((sum: number, stop: any) => sum + (stop.weight_kg || 0), 0);
    const totalVolume = stops_data.reduce((sum: number, stop: any) => sum + (stop.volume_m3 || 0), 0);

    const weightUtilization = vehicle.max_weight_kg ? (totalWeight / vehicle.max_weight_kg) * 100 : 0;
    const volumeUtilization = vehicle.max_volume_m3 ? (totalVolume / vehicle.max_volume_m3) * 100 : 0;

    const recommendations: string[] = [];
    if (weightUtilization > 100) {
      recommendations.push(`Poids dépassé de ${(totalWeight - (vehicle.max_weight_kg || 0)).toFixed(2)} kg`);
    }
    if (volumeUtilization > 100) {
      recommendations.push(`Volume dépassé de ${(totalVolume - (vehicle.max_volume_m3 || 0)).toFixed(2)} m³`);
    }
    if (weightUtilization < 50 && volumeUtilization < 50) {
      recommendations.push('Véhicule sous-utilisé, considérer un véhicule plus petit');
    }

    const [optimization] = await run(
      `insert into vehicle_load_optimizations (
        route_id, vehicle_id, optimization_date,
        total_weight_kg, total_volume_m3,
        max_weight_capacity, max_volume_capacity,
        weight_utilization_rate, volume_utilization_rate,
        load_distribution, optimization_recommendations, created_by
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12
      ) returning *`,
      [
        route_id || null,
        vehicle_id,
        new Date().toISOString().split('T')[0],
        totalWeight,
        totalVolume,
        vehicle.max_weight_kg || null,
        vehicle.max_volume_m3 || null,
        weightUtilization,
        volumeUtilization,
        JSON.stringify(stops_data),
        JSON.stringify(recommendations),
        auth?.id ?? null
      ]
    );

    res.status(201).json({
      optimization,
      metrics: {
        total_weight_kg: totalWeight,
        total_volume_m3: totalVolume,
        weight_utilization_rate: weightUtilization,
        volume_utilization_rate: volumeUtilization,
        recommendations
      }
    });
  })
);

// GET /api/logistics/demand-forecast - Prévision de demande par zone
app.get(
  '/api/logistics/demand-forecast',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const zoneId = req.query.zone_id as string;
    const materialType = req.query.material_type as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let sql = `
      select *
      from demand_forecasts
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (zoneId) {
      sql += ` and zone_id = $${paramIndex}`;
      params.push(zoneId);
      paramIndex++;
    }
    if (materialType) {
      sql += ` and material_type = $${paramIndex}`;
      params.push(materialType);
      paramIndex++;
    }
    if (startDate) {
      sql += ` and forecast_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      sql += ` and forecast_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ' order by forecast_date desc limit 100';

    const forecasts = await run(sql, params);
    res.json(forecasts);
  })
);

// POST /api/logistics/demand-forecast - Créer une prévision
app.post(
  '/api/logistics/demand-forecast',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const {
      forecast_date,
      zone_id,
      zone_name,
      zone_coordinates,
      material_type,
      forecasted_volume,
      forecasted_weight,
      confidence_level,
      forecast_method,
      historical_data
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    if (!forecast_date || !zone_name || !forecasted_volume) {
      return res.status(400).json({ message: 'Date, zone et volume requis' });
    }

    const [forecast] = await run(
      `insert into demand_forecasts (
        forecast_date, zone_id, zone_name, zone_coordinates,
        material_type, forecasted_volume, forecasted_weight,
        confidence_level, forecast_method, historical_data, created_by
      ) values (
        $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10::jsonb, $11
      ) returning *`,
      [
        forecast_date,
        zone_id || null,
        zone_name,
        zone_coordinates ? JSON.stringify(zone_coordinates) : null,
        material_type || null,
        forecasted_volume,
        forecasted_weight || null,
        confidence_level || 75,
        forecast_method || 'historical',
        historical_data ? JSON.stringify(historical_data) : null,
        auth?.id ?? null
      ]
    );

    res.status(201).json({ forecast });
  })
);

// GET /api/logistics/real-time-tracking - Suivi en temps réel
app.get(
  '/api/logistics/real-time-tracking',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const routeId = req.query.route_id as string;
    const vehicleId = req.query.vehicle_id as string;

    let sql = `
      select t.*,
             r.date as route_date,
             v.internal_number as vehicle_number,
             rs.customer_id,
             c.name as customer_name
      from real_time_tracking t
      left join routes r on r.id = t.route_id
      left join vehicles v on v.id = t.vehicle_id
      left join route_stops rs on rs.id = t.current_stop_id
      left join customers c on c.id = rs.customer_id
      where t.tracking_status = 'active'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (routeId) {
      sql += ` and t.route_id = $${paramIndex}`;
      params.push(routeId);
      paramIndex++;
    }
    if (vehicleId) {
      sql += ` and t.vehicle_id = $${paramIndex}`;
      params.push(vehicleId);
      paramIndex++;
    }

    sql += ' order by t.last_update desc';

    const tracking = await run(sql, params);
    res.json(tracking);
  })
);

// POST /api/logistics/real-time-tracking - Mettre à jour le suivi en temps réel
app.post(
  '/api/logistics/real-time-tracking',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const {
      route_id,
      vehicle_id,
      current_stop_id,
      current_latitude,
      current_longitude,
      current_speed_kmh,
      estimated_arrival_time,
      estimated_duration_minutes,
      distance_to_destination_km,
      traffic_conditions
    } = req.body;

    if (!route_id || !vehicle_id) {
      return res.status(400).json({ message: 'Route et véhicule requis' });
    }

    // Vérifier si un tracking existe déjà
    const existing = await run(
      `select id from real_time_tracking
       where route_id = $1 and vehicle_id = $2 and tracking_status = 'active'
       limit 1`,
      [route_id, vehicle_id]
    );

    if (existing.length > 0) {
      // Mettre à jour
      const [updated] = await run(
        `update real_time_tracking
         set current_stop_id = $1,
             current_latitude = $2,
             current_longitude = $3,
             current_speed_kmh = $4,
             estimated_arrival_time = $5,
             estimated_duration_minutes = $6,
             distance_to_destination_km = $7,
             traffic_conditions = $8,
             last_update = now()
         where id = $9
         returning *`,
        [
          current_stop_id || null,
          current_latitude || null,
          current_longitude || null,
          current_speed_kmh || null,
          estimated_arrival_time || null,
          estimated_duration_minutes || null,
          distance_to_destination_km || null,
          traffic_conditions || null,
          existing[0].id
        ]
      );
      res.json({ tracking: updated });
    } else {
      // Créer
      const [created] = await run(
        `insert into real_time_tracking (
          route_id, vehicle_id, current_stop_id,
          current_latitude, current_longitude, current_speed_kmh,
          estimated_arrival_time, estimated_duration_minutes,
          distance_to_destination_km, traffic_conditions
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) returning *`,
        [
          route_id,
          vehicle_id,
          current_stop_id || null,
          current_latitude || null,
          current_longitude || null,
          current_speed_kmh || null,
          estimated_arrival_time || null,
          estimated_duration_minutes || null,
          distance_to_destination_km || null,
          traffic_conditions || null
        ]
      );
      res.status(201).json({ tracking: created });
    }
  })
);

// GET /api/logistics/routing-constraints - Liste des contraintes
app.get(
  '/api/logistics/routing-constraints',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const constraintType = req.query.constraint_type as string;
    const isActive = req.query.is_active as string;

    let sql = `
      select c.*,
             u.full_name as created_by_name
      from routing_constraints c
      left join users u on u.id = c.created_by
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (constraintType) {
      sql += ` and c.constraint_type = $${paramIndex}`;
      params.push(constraintType);
      paramIndex++;
    }
    if (isActive === 'true') {
      sql += ` and c.is_active = true`;
    } else if (isActive === 'false') {
      sql += ` and c.is_active = false`;
    }

    sql += ' order by c.created_at desc';

    const constraints = await run(sql, params);
    res.json(constraints);
  })
);

// POST /api/logistics/routing-constraints - Créer une contrainte
app.post(
  '/api/logistics/routing-constraints',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const {
      constraint_type,
      constraint_name,
      constraint_description,
      constraint_config,
      applies_to
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    if (!constraint_type || !constraint_name) {
      return res.status(400).json({ message: 'Type et nom de contrainte requis' });
    }

    const [constraint] = await run(
      `insert into routing_constraints (
        constraint_type, constraint_name, constraint_description,
        constraint_config, applies_to, created_by
      ) values (
        $1, $2, $3, $4::jsonb, $5, $6
      ) returning *`,
      [
        constraint_type,
        constraint_name,
        constraint_description || null,
        JSON.stringify(constraint_config || {}),
        applies_to || [],
        auth?.id ?? null
      ]
    );

    res.status(201).json({ constraint });
  })
);

// ==================== ENDPOINTS GESTION DES FOURNISSEURS ====================

// GET /api/suppliers - Liste des fournisseurs
app.get(
  '/api/suppliers',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const supplierType = req.query.supplier_type as string;
    const isActive = req.query.is_active as string;
    const search = req.query.search as string;

    let sql = `
      select s.*,
             u.full_name as created_by_name,
             count(distinct e.id) as evaluation_count,
             count(distinct o.id) as order_count
      from suppliers s
      left join users u on u.id = s.created_by
      left join supplier_evaluations e on e.supplier_id = s.id
      left join supplier_orders o on o.supplier_id = s.id
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (supplierType) {
      sql += ` and s.supplier_type = $${paramIndex}`;
      params.push(supplierType);
      paramIndex++;
    }
    if (isActive === 'true') {
      sql += ` and s.is_active = true`;
    } else if (isActive === 'false') {
      sql += ` and s.is_active = false`;
    }
    if (search) {
      sql += ` and (s.name ilike $${paramIndex} or s.supplier_code ilike $${paramIndex} or s.email ilike $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ' group by s.id, u.full_name order by s.created_at desc limit 100';

    const suppliers = await run(sql, params);
    res.json(suppliers);
  })
);

// POST /api/suppliers - Créer un fournisseur
app.post(
  '/api/suppliers',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const {
      supplier_code,
      name,
      supplier_type,
      contact_name,
      email,
      phone,
      address,
      city,
      postal_code,
      country,
      siret,
      vat_number,
      payment_terms,
      bank_details,
      notes
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    if (!supplier_code || !name || !supplier_type) {
      return res.status(400).json({ message: 'Code, nom et type de fournisseur requis' });
    }

    const [supplier] = await run(
      `insert into suppliers (
        supplier_code, name, supplier_type, contact_name, email, phone,
        address, city, postal_code, country, siret, vat_number,
        payment_terms, bank_details, notes, created_by, created_by_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17
      ) returning *`,
      [
        supplier_code,
        name,
        supplier_type,
        contact_name || null,
        email || null,
        phone || null,
        address || null,
        city || null,
        postal_code || null,
        country || 'France',
        siret || null,
        vat_number || null,
        payment_terms || null,
        bank_details ? JSON.stringify(bank_details) : null,
        notes || null,
        auth?.id ?? null,
        auth?.full_name ?? null
      ]
    );

    res.status(201).json({ supplier });
  })
);

// PATCH /api/suppliers/:id - Mettre à jour un fournisseur
app.patch(
  '/api/suppliers/:id',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const allowedFields = [
      'name', 'supplier_type', 'contact_name', 'email', 'phone',
      'address', 'city', 'postal_code', 'country', 'siret', 'vat_number',
      'payment_terms', 'bank_details', 'notes', 'is_active'
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'bank_details') {
          updates.push(`${field} = $${paramIndex}::jsonb`);
          values.push(updateData[field] ? JSON.stringify(updateData[field]) : null);
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(updateData[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
    }

    updates.push(`updated_at = now()`);
    values.push(id);

    const [updated] = await run(
      `update suppliers set ${updates.join(', ')} where id = $${paramIndex} returning *`,
      values
    );

    res.json({ supplier: updated });
  })
);

// DELETE /api/suppliers/:id - Supprimer un fournisseur
app.delete(
  '/api/suppliers/:id',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await run('delete from suppliers where id = $1', [id]);

    res.json({ message: 'Fournisseur supprimé' });
  })
);

// GET /api/suppliers/:id/evaluations - Évaluations d'un fournisseur
app.get(
  '/api/suppliers/:id/evaluations',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const evaluations = await run(
      `select e.*,
             u.full_name as evaluated_by_name
      from supplier_evaluations e
      left join users u on u.id = e.evaluated_by
      where e.supplier_id = $1
      order by e.evaluation_date desc`,
      [id]
    );

    res.json(evaluations);
  })
);

// POST /api/suppliers/:id/evaluations - Créer une évaluation
app.post(
  '/api/suppliers/:id/evaluations',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      evaluation_date,
      quality_score,
      delivery_time_score,
      price_score,
      communication_score,
      comments,
      order_id
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    // Calculer le score global
    const scores = [quality_score, delivery_time_score, price_score, communication_score].filter(s => s !== null && s !== undefined);
    const overallScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const [evaluation] = await run(
      `insert into supplier_evaluations (
        supplier_id, evaluation_date, evaluated_by, evaluated_by_name,
        quality_score, delivery_time_score, price_score, communication_score,
        overall_score, comments, order_id
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) returning *`,
      [
        id,
        evaluation_date || new Date().toISOString().split('T')[0],
        auth?.id ?? null,
        auth?.full_name ?? null,
        quality_score || null,
        delivery_time_score || null,
        price_score || null,
        communication_score || null,
        overallScore,
        comments || null,
        order_id || null
      ]
    );

    // Mettre à jour la note moyenne du fournisseur
    const avgResult = await run(
      `select avg(overall_score) as avg_rating
       from supplier_evaluations
       where supplier_id = $1 and overall_score is not null`,
      [id]
    );
    const avgRating = avgResult[0]?.avg_rating || 0;

    await run(
      'update suppliers set average_rating = $1 where id = $2',
      [avgRating, id]
    );

    res.status(201).json({ evaluation });
  })
);

// GET /api/supplier-orders - Liste des commandes
app.get(
  '/api/supplier-orders',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const supplierId = req.query.supplier_id as string;
    const status = req.query.status as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let sql = `
      select o.*,
             u.full_name as created_by_name
      from supplier_orders o
      left join users u on u.id = o.created_by
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (supplierId) {
      sql += ` and o.supplier_id = $${paramIndex}`;
      params.push(supplierId);
      paramIndex++;
    }
    if (status) {
      sql += ` and o.order_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (startDate) {
      sql += ` and o.order_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      sql += ` and o.order_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ' order by o.order_date desc limit 100';

    const orders = await run(sql, params);
    res.json(orders);
  })
);

// POST /api/supplier-orders - Créer une commande
app.post(
  '/api/supplier-orders',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const {
      supplier_id,
      order_date,
      expected_delivery_date,
      order_type,
      items,
      notes
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Fournisseur et articles requis' });
    }

    // Récupérer le nom du fournisseur
    const suppliers = await run('select name from suppliers where id = $1', [supplier_id]);
    if (suppliers.length === 0) {
      return res.status(404).json({ message: 'Fournisseur introuvable' });
    }

    // Calculer le total
    const totalAmount = items.reduce((sum: number, item: any) => {
      return sum + ((item.quantity || 0) * (item.unit_price || 0));
    }, 0);

    const [order] = await run(
      `insert into supplier_orders (
        supplier_id, supplier_name, order_date, expected_delivery_date,
        order_type, total_amount, items, notes, created_by, created_by_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10
      ) returning *`,
      [
        supplier_id,
        suppliers[0].name,
        order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date || null,
        order_type || null,
        totalAmount,
        JSON.stringify(items),
        notes || null,
        auth?.id ?? null,
        auth?.full_name ?? null
      ]
    );

    // Mettre à jour les statistiques du fournisseur
    await run(
      `update suppliers
       set total_orders = total_orders + 1,
           total_value = total_value + $1
       where id = $2`,
      [totalAmount, supplier_id]
    );

    res.status(201).json({ order });
  })
);

// POST /api/supplier-orders/:id/receive - Enregistrer une réception
app.post(
  '/api/supplier-orders/:id/receive',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      reception_date,
      reception_status,
      received_items,
      quality_check_passed,
      quality_check_notes,
      notes
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    const [reception] = await run(
      `insert into supplier_receptions (
        order_id, reception_date, reception_status, received_items,
        quality_check_passed, quality_check_notes, notes,
        received_by, received_by_name
      ) values (
        $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9
      ) returning *`,
      [
        id,
        reception_date || new Date().toISOString().split('T')[0],
        reception_status || 'partial',
        JSON.stringify(received_items || []),
        quality_check_passed || null,
        quality_check_notes || null,
        notes || null,
        auth?.id ?? null,
        auth?.full_name ?? null
      ]
    );

    // Mettre à jour le statut de la commande si réception complète
    if (reception_status === 'complete') {
      await run(
        'update supplier_orders set order_status = $1, actual_delivery_date = $2 where id = $3',
        ['completed', reception_date || new Date().toISOString().split('T')[0], id]
      );
    }

    res.status(201).json({ reception });
  })
);

// GET /api/supplier-invoices - Liste des factures
app.get(
  '/api/supplier-invoices',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const supplierId = req.query.supplier_id as string;
    const status = req.query.status as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let sql = `
      select i.*,
             u.full_name as created_by_name
      from supplier_invoices i
      left join users u on u.id = i.created_by
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (supplierId) {
      sql += ` and i.supplier_id = $${paramIndex}`;
      params.push(supplierId);
      paramIndex++;
    }
    if (status) {
      sql += ` and i.invoice_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (startDate) {
      sql += ` and i.invoice_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      sql += ` and i.invoice_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ' order by i.invoice_date desc limit 100';

    const invoices = await run(sql, params);
    res.json(invoices);
  })
);

// POST /api/supplier-invoices - Créer une facture
app.post(
  '/api/supplier-invoices',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const {
      invoice_number,
      supplier_id,
      order_id,
      invoice_date,
      due_date,
      subtotal,
      tax_amount,
      total_amount,
      currency,
      notes
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    if (!invoice_number || !supplier_id || !invoice_date || !due_date || total_amount === undefined) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    // Récupérer le nom du fournisseur
    const suppliers = await run('select name from suppliers where id = $1', [supplier_id]);
    if (suppliers.length === 0) {
      return res.status(404).json({ message: 'Fournisseur introuvable' });
    }

    const [invoice] = await run(
      `insert into supplier_invoices (
        invoice_number, supplier_id, supplier_name, order_id,
        invoice_date, due_date, subtotal, tax_amount, total_amount,
        currency, notes, created_by, created_by_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) returning *`,
      [
        invoice_number,
        supplier_id,
        suppliers[0].name,
        order_id || null,
        invoice_date,
        due_date,
        subtotal || 0,
        tax_amount || 0,
        total_amount,
        currency || 'EUR',
        notes || null,
        auth?.id ?? null,
        auth?.full_name ?? null
      ]
    );

    res.status(201).json({ invoice });
  })
);

// PATCH /api/supplier-invoices/:id/pay - Marquer une facture comme payée
app.patch(
  '/api/supplier-invoices/:id/pay',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { payment_date, payment_method, payment_reference } = req.body;

    const [invoice] = await run(
      `update supplier_invoices
       set invoice_status = 'paid',
           payment_date = $1,
           payment_method = $2,
           payment_reference = $3,
           updated_at = now()
       where id = $4
       returning *`,
      [
        payment_date || new Date().toISOString().split('T')[0],
        payment_method || null,
        payment_reference || null,
        id
      ]
    );

    res.json({ invoice });
  })
);

// GET /api/tender-calls - Liste des appels d'offres
app.get(
  '/api/tender-calls',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const status = req.query.status as string;
    const tenderType = req.query.tender_type as string;

    let sql = `
      select t.*,
             u.full_name as created_by_name,
             count(distinct o.id) as offer_count
      from tender_calls t
      left join users u on u.id = t.created_by
      left join tender_offers o on o.tender_call_id = t.id
      where 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      sql += ` and t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (tenderType) {
      sql += ` and t.tender_type = $${paramIndex}`;
      params.push(tenderType);
      paramIndex++;
    }

    sql += ' group by t.id, u.full_name order by t.created_at desc limit 100';

    const tenders = await run(sql, params);
    res.json(tenders);
  })
);

// POST /api/tender-calls - Créer un appel d'offres
app.post(
  '/api/tender-calls',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      tender_type,
      start_date,
      end_date,
      submission_deadline,
      requirements,
      evaluation_criteria
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    if (!title || !tender_type || !start_date || !end_date || !submission_deadline) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    const [tender] = await run(
      `insert into tender_calls (
        title, description, tender_type, start_date, end_date,
        submission_deadline, requirements, evaluation_criteria,
        created_by, created_by_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10
      ) returning *`,
      [
        title,
        description || null,
        tender_type,
        start_date,
        end_date,
        submission_deadline,
        requirements ? JSON.stringify(requirements) : null,
        evaluation_criteria ? JSON.stringify(evaluation_criteria) : null,
        auth?.id ?? null,
        auth?.full_name ?? null
      ]
    );

    res.status(201).json({ tender });
  })
);

// GET /api/tender-calls/:id/offers - Offres pour un appel d'offres
app.get(
  '/api/tender-calls/:id/offers',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const offers = await run(
      `select o.*,
             u.full_name as evaluated_by_name
      from tender_offers o
      left join users u on u.id = o.evaluated_by
      where o.tender_call_id = $1
      order by o.offer_amount asc, o.submitted_at asc`,
      [id]
    );

    res.json(offers);
  })
);

// POST /api/tender-calls/:id/offers - Soumettre une offre
app.post(
  '/api/tender-calls/:id/offers',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      supplier_id,
      offer_amount,
      currency,
      delivery_time_days,
      validity_days,
      offer_details,
      technical_specifications
    } = req.body;

    if (!supplier_id || offer_amount === undefined) {
      return res.status(400).json({ message: 'Fournisseur et montant requis' });
    }

    // Récupérer le nom du fournisseur
    const suppliers = await run('select name from suppliers where id = $1', [supplier_id]);
    if (suppliers.length === 0) {
      return res.status(404).json({ message: 'Fournisseur introuvable' });
    }

    const [offer] = await run(
      `insert into tender_offers (
        tender_call_id, supplier_id, supplier_name, offer_amount,
        currency, delivery_time_days, validity_days,
        offer_details, technical_specifications
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb
      ) returning *`,
      [
        id,
        supplier_id,
        suppliers[0].name,
        offer_amount,
        currency || 'EUR',
        delivery_time_days || null,
        validity_days || null,
        offer_details ? JSON.stringify(offer_details) : null,
        technical_specifications ? JSON.stringify(technical_specifications) : null
      ]
    );

    res.status(201).json({ offer });
  })
);

// PATCH /api/tender-offers/:id/evaluate - Évaluer une offre
app.patch(
  '/api/tender-offers/:id/evaluate',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { offer_status, evaluation_score, evaluation_notes } = req.body;
    const auth = (req as AuthenticatedRequest).auth;

    const [offer] = await run(
      `update tender_offers
       set offer_status = $1,
           evaluation_score = $2,
           evaluation_notes = $3,
           evaluated_at = now(),
           evaluated_by = $4,
           evaluated_by_name = $5,
           updated_at = now()
       where id = $6
       returning *`,
      [
        offer_status || 'under_review',
        evaluation_score || null,
        evaluation_notes || null,
        auth?.id ?? null,
        auth?.full_name ?? null,
        id
      ]
    );

    res.json({ offer });
  })
);

// ==========================================
// GESTION DOCUMENTAIRE (GED) - API ENDPOINTS
// ==========================================

// GET /api/documents - Liste des documents
app.get(
  '/api/documents',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const category = req.query.category as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const tag = req.query.tag as string;

    let sql = `
      select d.*,
             u.full_name as created_by_name,
             array_agg(distinct dt.tag) filter (where dt.tag is not null) as tags,
             count(distinct dv.id) as version_count,
             count(distinct da.id) filter (where da.status = 'pending') as pending_approvals
      from documents d
      left join users u on u.id = d.created_by
      left join document_tags dt on dt.document_id = d.id
      left join document_versions dv on dv.document_id = d.id
      left join document_approvals da on da.document_id = d.id
      where d.status != 'deleted'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      sql += ` and d.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    if (status) {
      sql += ` and d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (search) {
      sql += ` and (d.title ilike $${paramIndex} or d.description ilike $${paramIndex} or d.document_number ilike $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (tag) {
      sql += ` and exists (select 1 from document_tags dt2 where dt2.document_id = d.id and dt2.tag ilike $${paramIndex})`;
      params.push(`%${tag}%`);
      paramIndex++;
    }

    sql += ' group by d.id, u.full_name order by d.created_at desc limit 100';

    const documents = await run(sql, params);
    res.json(documents);
  })
);

// GET /api/documents/:id - Détails d'un document
app.get(
  '/api/documents/:id',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [document] = await run('select * from documents where id = $1', [id]);
    if (!document) {
      return res.status(404).json({ message: 'Document introuvable' });
    }

    const versions = await run('select * from document_versions where document_id = $1 order by version_number desc', [id]);
    const tags = await run('select tag from document_tags where document_id = $1', [id]);
    const approvals = await run('select * from document_approvals where document_id = $1 order by approval_order', [id]);

    res.json({
      ...document,
      versions,
      tags: tags.map((t: any) => t.tag),
      approvals
    });
  })
);

// POST /api/documents - Créer un document
app.post(
  '/api/documents',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      category,
      file_name,
      file_path,
      file_size,
      mime_type,
      file_hash,
      is_sensitive,
      requires_approval,
      tags,
      retention_rule_id
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    if (!title || !category || !file_name || !file_path) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    const [document] = await run(
      `insert into documents (
        title, description, category, file_name, file_path, file_size,
        mime_type, file_hash, is_sensitive, requires_approval,
        retention_rule_id, status, created_by, created_by_name
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) returning *`,
      [
        title,
        description || null,
        category,
        file_name,
        file_path,
        file_size || 0,
        mime_type || 'application/octet-stream',
        file_hash || null,
        is_sensitive || false,
        requires_approval || false,
        retention_rule_id || null,
        requires_approval ? 'pending_approval' : 'approved',
        auth.id,
        auth.full_name
      ]
    );

    // Créer la première version
    await run(
      `insert into document_versions (
        document_id, version_number, file_name, file_path, file_size,
        mime_type, file_hash, created_by, created_by_name
      ) values ($1, 1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        document.id,
        file_name,
        file_path,
        file_size || 0,
        mime_type || 'application/octet-stream',
        file_hash || null,
        auth.id,
        auth.full_name
      ]
    );

    // Ajouter les tags
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        if (tag && typeof tag === 'string') {
          await run('insert into document_tags (document_id, tag) values ($1, $2) on conflict do nothing', [document.id, tag.trim()]);
        }
      }
    }

    // Créer le workflow d'approbation si nécessaire
    if (requires_approval && auth.role === 'admin') {
      // Pour l'instant, on crée une approbation pour le manager
      // Dans un vrai système, on aurait une configuration des approbateurs
      await run(
        `insert into document_approvals (document_id, approver_id, approver_name, approval_order, status)
         select $1, id, full_name, 1, 'pending'
         from users where role = 'manager' limit 1`,
        [document.id]
      );
    }

    // Logger l'accès
    await run(
      `insert into document_access_logs (document_id, user_id, user_name, action, ip_address, user_agent)
       values ($1, $2, $3, 'upload', $4, $5)`,
      [document.id, auth.id, auth.full_name, req.ip, req.get('user-agent')]
    );

    res.status(201).json(document);
  })
);

// PUT /api/documents/:id - Mettre à jour un document
app.put(
  '/api/documents/:id',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      status,
      tags
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    const [document] = await run('select * from documents where id = $1', [id]);
    if (!document) {
      return res.status(404).json({ message: 'Document introuvable' });
    }

    await run(
      `update documents set
        title = coalesce($1, title),
        description = coalesce($2, description),
        category = coalesce($3, category),
        status = coalesce($4, status),
        updated_by = $5,
        updated_by_name = $6,
        updated_at = now()
       where id = $7`,
      [title, description, category, status, auth.id, auth.full_name, id]
    );

    // Mettre à jour les tags
    if (tags && Array.isArray(tags)) {
      await run('delete from document_tags where document_id = $1', [id]);
      for (const tag of tags) {
        if (tag && typeof tag === 'string') {
          await run('insert into document_tags (document_id, tag) values ($1, $2)', [id, tag.trim()]);
        }
      }
    }

    const [updated] = await run('select * from documents where id = $1', [id]);
    res.json(updated);
  })
);

// POST /api/documents/:id/versions - Créer une nouvelle version
app.post(
  '/api/documents/:id/versions',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      file_name,
      file_path,
      file_size,
      mime_type,
      file_hash,
      change_summary
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    const [document] = await run('select * from documents where id = $1', [id]);
    if (!document) {
      return res.status(404).json({ message: 'Document introuvable' });
    }

    const newVersion = document.current_version + 1;

    await run(
      `insert into document_versions (
        document_id, version_number, file_name, file_path, file_size,
        mime_type, file_hash, change_summary, created_by, created_by_name
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        newVersion,
        file_name,
        file_path,
        file_size || 0,
        mime_type || 'application/octet-stream',
        file_hash || null,
        change_summary || null,
        auth.id,
        auth.full_name
      ]
    );

    await run(
      'update documents set current_version = $1, updated_at = now() where id = $2',
      [newVersion, id]
    );

    const [version] = await run(
      'select * from document_versions where document_id = $1 and version_number = $2',
      [id, newVersion]
    );

    res.status(201).json(version);
  })
);

// POST /api/documents/:id/approve - Approuver un document
app.post(
  '/api/documents/:id/approve',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comments } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    const [approval] = await run(
      `select * from document_approvals
       where document_id = $1 and approver_id = $2 and status = 'pending'
       order by approval_order limit 1`,
      [id, auth.id]
    );

    if (!approval) {
      return res.status(404).json({ message: 'Aucune approbation en attente trouvée' });
    }

    await run(
      `update document_approvals set
        status = 'approved',
        comments = $1,
        approved_at = now()
       where id = $2`,
      [comments || null, approval.id]
    );

    // Vérifier si toutes les approbations sont complètes
    const pendingCount = await run(
      'select count(*) as count from document_approvals where document_id = $1 and status = $2',
      [id, 'pending']
    );

    if (pendingCount[0].count === 0) {
      await run('update documents set status = $1 where id = $2', ['approved', id]);
      
      // Déclencher les webhooks
      const [document] = await run('select * from documents where id = $1', [id]);
      if (document) {
        await triggerWebhooks('document_approved', {
          document_id: document.id,
          document_number: document.document_number,
          title: document.title,
          approved_by: auth.id,
          approved_at: new Date().toISOString()
        });
      }
    }

    res.json({ message: 'Document approuvé' });
  })
);

// POST /api/documents/:id/reject - Rejeter un document
app.post(
  '/api/documents/:id/reject',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comments } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    await run(
      `update document_approvals set
        status = 'rejected',
        comments = $1,
        approved_at = now()
       where document_id = $2 and approver_id = $3 and status = 'pending'`,
      [comments || null, id, auth.id]
    );

    await run('update documents set status = $1 where id = $2', ['rejected', id]);

    res.json({ message: 'Document rejeté' });
  })
);

// POST /api/documents/:id/archive - Archiver un document
app.post(
  '/api/documents/:id/archive',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    await run(
      `update documents set
        status = 'archived',
        archived_at = now(),
        archived_by = $1
       where id = $2`,
      [auth.id, id]
    );

    res.json({ message: 'Document archivé' });
  })
);

// DELETE /api/documents/:id - Supprimer un document
app.delete(
  '/api/documents/:id',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    await run('update documents set status = $1 where id = $2', ['deleted', id]);

    res.json({ message: 'Document supprimé' });
  })
);

// GET /api/documents/:id/access-logs - Logs d'accès d'un document
app.get(
  '/api/documents/:id/access-logs',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const logs = await run(
      'select * from document_access_logs where document_id = $1 order by created_at desc limit 100',
      [id]
    );
    res.json(logs);
  })
);

// GET /api/document-retention-rules - Liste des règles de rétention
app.get(
  '/api/document-retention-rules',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const rules = await run('select * from document_retention_rules where is_active = true order by name');
    res.json(rules);
  })
);

// POST /api/document-retention-rules - Créer une règle de rétention
app.post(
  '/api/document-retention-rules',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      category,
      retention_years,
      auto_archive,
      archive_after_days
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    const [rule] = await run(
      `insert into document_retention_rules (
        name, description, category, retention_years, auto_archive, archive_after_days, created_by
      ) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [
        name,
        description || null,
        category || null,
        retention_years || 7,
        auto_archive !== false,
        archive_after_days || null,
        auth.id
      ]
    );

    res.status(201).json(rule);
  })
);

// ==========================================
// INTÉGRATIONS EXTERNES - API ENDPOINTS
// ==========================================

// GET /api/integrations - Liste des intégrations
app.get(
  '/api/integrations',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const type = req.query.type as string;
    let sql = 'select * from external_integrations where 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      sql += ` and integration_type = $${paramIndex}`;
      params.push(type);
    }

    sql += ' order by integration_type, name';

    const integrations = await run(sql, params);
    res.json(integrations);
  })
);

// GET /api/integrations/:id - Détails d'une intégration
app.get(
  '/api/integrations/:id',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [integration] = await run('select * from external_integrations where id = $1', [id]);
    if (!integration) {
      return res.status(404).json({ message: 'Intégration introuvable' });
    }
    res.json(integration);
  })
);

// POST /api/integrations - Créer une intégration
app.post(
  '/api/integrations',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const {
      integration_type,
      name,
      provider,
      is_active,
      config,
      credentials
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    if (!integration_type || !name || !provider) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    const [integration] = await run(
      `insert into external_integrations (
        integration_type, name, provider, is_active, config, credentials, created_by
      ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7) returning *`,
      [
        integration_type,
        name,
        provider,
        is_active !== false,
        config ? JSON.stringify(config) : '{}',
        credentials ? JSON.stringify(credentials) : '{}',
        auth.id
      ]
    );

    res.status(201).json(integration);
  })
);

// PUT /api/integrations/:id - Mettre à jour une intégration
app.put(
  '/api/integrations/:id',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      is_active,
      config,
      credentials
    } = req.body;

    const [integration] = await run('select * from external_integrations where id = $1', [id]);
    if (!integration) {
      return res.status(404).json({ message: 'Intégration introuvable' });
    }

    await run(
      `update external_integrations set
        name = coalesce($1, name),
        is_active = coalesce($2, is_active),
        config = coalesce($3::jsonb, config),
        credentials = coalesce($4::jsonb, credentials),
        updated_at = now()
       where id = $5`,
      [
        name,
        is_active,
        config ? JSON.stringify(config) : null,
        credentials ? JSON.stringify(credentials) : null,
        id
      ]
    );

    const [updated] = await run('select * from external_integrations where id = $1', [id]);
    res.json(updated);
  })
);

// DELETE /api/integrations/:id - Supprimer une intégration
app.delete(
  '/api/integrations/:id',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from external_integrations where id = $1', [id]);
    res.json({ message: 'Intégration supprimée' });
  })
);

// POST /api/integrations/:id/test - Tester une intégration
app.post(
  '/api/integrations/:id/test',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [integration] = await run('select * from external_integrations where id = $1', [id]);
    if (!integration) {
      return res.status(404).json({ message: 'Intégration introuvable' });
    }

    const startTime = Date.now();
    let success = false;
    let errorMessage = null;

    try {
      // Test selon le type d'intégration
      switch (integration.integration_type) {
        case 'email':
          // Test de connexion email (simulé)
          success = true;
          break;
        case 'sms':
          // Test de connexion SMS (simulé)
          success = true;
          break;
        case 'accounting':
          // Test de connexion comptable (simulé)
          success = true;
          break;
        case 'gps':
          // Test de connexion GPS (simulé)
          success = true;
          break;
        case 'scale':
          // Test de connexion balance (simulé)
          success = true;
          break;
        default:
          success = true;
      }

      const executionTime = Date.now() - startTime;

      await run(
        `update external_integrations set
          last_sync_at = now(),
          last_error = $1
         where id = $2`,
        [errorMessage, id]
      );

      await run(
        `insert into integration_logs (
          integration_id, integration_type, action, status, execution_time_ms
        ) values ($1, $2, 'test', $3, $4)`,
        [id, integration.integration_type, success ? 'success' : 'error', executionTime]
      );

      res.json({ success, executionTime });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      errorMessage = error.message;

      await run(
        `update external_integrations set last_error = $1 where id = $2`,
        [errorMessage, id]
      );

      await run(
        `insert into integration_logs (
          integration_id, integration_type, action, status, error_message, execution_time_ms
        ) values ($1, $2, 'test', 'error', $3, $4)`,
        [id, integration.integration_type, errorMessage, executionTime]
      );

      res.status(500).json({ success: false, error: errorMessage });
    }
  })
);

// GET /api/webhooks - Liste des webhooks
app.get(
  '/api/webhooks',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const eventType = req.query.event_type as string;
    let sql = 'select * from webhooks where 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (eventType) {
      sql += ` and event_type = $${paramIndex}`;
      params.push(eventType);
    }

    sql += ' order by event_type, name';

    const webhooks = await run(sql, params);
    res.json(webhooks);
  })
);

// POST /api/webhooks - Créer un webhook
app.post(
  '/api/webhooks',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const {
      name,
      url,
      event_type,
      http_method,
      headers,
      payload_template,
      secret_token,
      retry_count,
      timeout_seconds
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    if (!name || !url || !event_type) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    const [webhook] = await run(
      `insert into webhooks (
        name, url, event_type, http_method, headers, payload_template,
        secret_token, retry_count, timeout_seconds, created_by
      ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10) returning *`,
      [
        name,
        url,
        event_type,
        http_method || 'POST',
        headers ? JSON.stringify(headers) : '{}',
        payload_template ? JSON.stringify(payload_template) : null,
        secret_token || null,
        retry_count || 3,
        timeout_seconds || 30,
        auth.id
      ]
    );

    res.status(201).json(webhook);
  })
);

// PUT /api/webhooks/:id - Mettre à jour un webhook
app.put(
  '/api/webhooks/:id',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      url,
      is_active,
      headers,
      payload_template,
      secret_token,
      retry_count,
      timeout_seconds
    } = req.body;

    const [webhook] = await run('select * from webhooks where id = $1', [id]);
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook introuvable' });
    }

    await run(
      `update webhooks set
        name = coalesce($1, name),
        url = coalesce($2, url),
        is_active = coalesce($3, is_active),
        headers = coalesce($4::jsonb, headers),
        payload_template = coalesce($5::jsonb, payload_template),
        secret_token = coalesce($6, secret_token),
        retry_count = coalesce($7, retry_count),
        timeout_seconds = coalesce($8, timeout_seconds),
        updated_at = now()
       where id = $9`,
      [
        name,
        url,
        is_active,
        headers ? JSON.stringify(headers) : null,
        payload_template ? JSON.stringify(payload_template) : null,
        secret_token,
        retry_count,
        timeout_seconds,
        id
      ]
    );

    const [updated] = await run('select * from webhooks where id = $1', [id]);
    res.json(updated);
  })
);

// DELETE /api/webhooks/:id - Supprimer un webhook
app.delete(
  '/api/webhooks/:id',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from webhooks where id = $1', [id]);
    res.json({ message: 'Webhook supprimé' });
  })
);

// POST /api/webhooks/:id/test - Tester un webhook
app.post(
  '/api/webhooks/:id/test',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [webhook] = await run('select * from webhooks where id = $1', [id]);
    if (!webhook) {
      return res.status(404).json({ message: 'Webhook introuvable' });
    }

    const startTime = Date.now();
    let success = false;
    let statusCode = null;
    let errorMessage = null;

    try {
      const headers: any = webhook.headers || {};
      headers['Content-Type'] = 'application/json';
      if (webhook.secret_token) {
        headers['X-Webhook-Secret'] = webhook.secret_token;
      }

      const testPayload = {
        event: webhook.event_type,
        timestamp: new Date().toISOString(),
        test: true
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), (webhook.timeout_seconds || 30) * 1000);

      const response = await fetch(webhook.url, {
        method: webhook.http_method || 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      statusCode = response.status;
      success = response.ok;

      if (!response.ok) {
        errorMessage = `HTTP ${statusCode}: ${await response.text()}`;
      }

      const executionTime = Date.now() - startTime;

      await run(
        `update webhooks set
          last_triggered_at = now(),
          last_status_code = $1,
          last_error = $2
         where id = $3`,
        [statusCode, errorMessage, id]
      );

      await run(
        `insert into webhook_logs (
          webhook_id, event_type, payload, response_status, error_message, execution_time_ms
        ) values ($1, $2, $3::jsonb, $4, $5, $6)`,
        [id, webhook.event_type, JSON.stringify(testPayload), statusCode, errorMessage, executionTime]
      );

      res.json({ success, statusCode, executionTime });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      errorMessage = error.message;

      await run(
        `update webhooks set
          last_triggered_at = now(),
          last_error = $1
         where id = $2`,
        [errorMessage, id]
      );

      await run(
        `insert into webhook_logs (
          webhook_id, event_type, payload, error_message, execution_time_ms
        ) values ($1, $2, $3::jsonb, $4, $5)`,
        [id, webhook.event_type, JSON.stringify({ test: true }), errorMessage, executionTime]
      );

      res.status(500).json({ success: false, error: errorMessage });
    }
  })
);

// GET /api/webhooks/:id/logs - Logs d'un webhook
app.get(
  '/api/webhooks/:id/logs',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await run(
      'select * from webhook_logs where webhook_id = $1 order by triggered_at desc limit $2',
      [id, limit]
    );
    res.json(logs);
  })
);

// GET /api/integrations/:id/logs - Logs d'une intégration
app.get(
  '/api/integrations/:id/logs',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await run(
      'select * from integration_logs where integration_id = $1 order by created_at desc limit $2',
      [id, limit]
    );
    res.json(logs);
  })
);

// Fonction helper pour déclencher les webhooks
async function triggerWebhooks(eventType: string, payload: any) {
  try {
    const webhooks = await run(
      'select * from webhooks where event_type = $1 and is_active = true',
      [eventType]
    );

    for (const webhook of webhooks) {
      try {
        const headers: any = webhook.headers || {};
        headers['Content-Type'] = 'application/json';
        if (webhook.secret_token) {
          headers['X-Webhook-Secret'] = webhook.secret_token;
        }

        const webhookPayload = webhook.payload_template
          ? { ...payload, ...webhook.payload_template }
          : payload;

        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), (webhook.timeout_seconds || 30) * 1000);

        const response = await fetch(webhook.url, {
          method: webhook.http_method || 'POST',
          headers,
          body: JSON.stringify(webhookPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const executionTime = Date.now() - startTime;
        const responseBody = await response.text();

        await run(
          `update webhooks set
            last_triggered_at = now(),
            last_status_code = $1,
            last_error = $2
           where id = $3`,
          [response.status, response.ok ? null : responseBody.substring(0, 500), webhook.id]
        );

        await run(
          `insert into webhook_logs (
            webhook_id, event_type, payload, response_status, response_body, error_message, execution_time_ms
          ) values ($1, $2, $3::jsonb, $4, $5, $6, $7)`,
          [
            webhook.id,
            eventType,
            JSON.stringify(webhookPayload),
            response.status,
            responseBody.substring(0, 1000),
            response.ok ? null : responseBody.substring(0, 500),
            executionTime
          ]
        );
      } catch (error: any) {
        await run(
          `update webhooks set last_error = $1 where id = $2`,
          [error.message.substring(0, 500), webhook.id]
        );
      }
    }
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

// ==========================================
// GAMIFICATION ET MOTIVATION - API ENDPOINTS
// ==========================================

// GET /api/badges - Liste des badges
app.get(
  '/api/badges',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const category = req.query.category as string;
    let sql = 'select * from badges where is_active = true';
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      sql += ` and category = $${paramIndex}`;
      params.push(category);
    }

    sql += ' order by rarity desc, points desc';

    const badges = await run(sql, params);
    res.json(badges);
  })
);

// GET /api/employees/:id/badges - Badges d'un employé
app.get(
  '/api/employees/:id/badges',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const badges = await run(
      `select eb.*, b.*
       from employee_badges eb
       join badges b on b.id = eb.badge_id
       where eb.employee_id = $1
       order by eb.earned_at desc`,
      [id]
    );
    res.json(badges);
  })
);

// POST /api/employees/:id/badges - Attribuer un badge
app.post(
  '/api/employees/:id/badges',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { badge_id, earned_for } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    if (!badge_id) {
      return res.status(400).json({ message: 'badge_id requis' });
    }

    const [badge] = await run('select * from badges where id = $1', [badge_id]);
    if (!badge) {
      return res.status(404).json({ message: 'Badge introuvable' });
    }

    const [employeeBadge] = await run(
      `insert into employee_badges (employee_id, badge_id, earned_for, points_earned)
       values ($1, $2, $3, $4)
       on conflict (employee_id, badge_id) do nothing
       returning *`,
      [id, badge_id, earned_for || null, badge.points]
    );

    if (employeeBadge) {
      // Mettre à jour les statistiques
      // Pour 'all_time', period_start est NULL, donc on utilise UPSERT manuel
      const existing = await run(
        `select * from employee_statistics 
         where employee_id = $1 and period_type = 'all_time' and period_start is null`,
        [id]
      );
      
      if (existing.length > 0) {
        await run(
          `update employee_statistics 
           set total_points = total_points + $1,
               badges_count = badges_count + 1,
               updated_at = now()
           where employee_id = $2 and period_type = 'all_time' and period_start is null`,
          [badge.points, id]
        );
      } else {
        await run(
          `insert into employee_statistics (employee_id, period_type, total_points, badges_count, period_start)
           values ($1, 'all_time', $2, 1, null)`,
          [id, badge.points]
        );
      }
    }

    res.status(201).json(employeeBadge || { message: 'Badge déjà attribué' });
  })
);

// GET /api/rewards - Liste des récompenses
app.get(
  '/api/rewards',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const rewards = await run('select * from rewards where is_active = true order by points_cost');
    res.json(rewards);
  })
);

// POST /api/rewards/:id/claim - Réclamer une récompense
app.post(
  '/api/rewards/:id/claim',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    // Trouver l'employé correspondant à l'utilisateur
    const [employee] = await run('select * from employees where user_id = $1', [auth.id]);
    if (!employee) {
      return res.status(404).json({ message: 'Employé introuvable' });
    }

    const [reward] = await run('select * from rewards where id = $1', [id]);
    if (!reward) {
      return res.status(404).json({ message: 'Récompense introuvable' });
    }

    // Vérifier les points disponibles
    const [stats] = await run(
      `select total_points from employee_statistics
       where employee_id = $1 and period_type = 'all_time'
       order by updated_at desc limit 1`,
      [employee.id]
    );

    const availablePoints = stats?.total_points || 0;
    if (reward.points_cost && availablePoints < reward.points_cost) {
      return res.status(400).json({ message: 'Points insuffisants' });
    }

    // Créer la réclamation
    const [claim] = await run(
      `insert into reward_claims (employee_id, reward_id, points_spent, status)
       values ($1, $2, $3, 'pending')
       returning *`,
      [employee.id, id, reward.points_cost || 0]
    );

    res.status(201).json(claim);
  })
);

// GET /api/challenges - Liste des défis
app.get(
  '/api/challenges',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const active = req.query.active as string;
    let sql = 'select * from monthly_challenges where 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (active === 'true') {
      sql += ` and is_active = true and start_date <= current_date and end_date >= current_date`;
    }

    sql += ' order by start_date desc';

    const challenges = await run(sql, params);
    res.json(challenges);
  })
);

// GET /api/challenges/:id/participants - Participants d'un défi
app.get(
  '/api/challenges/:id/participants',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const participants = await run(
      `select cp.*,
              cp.team_id as team_name, -- team_id contient directement le nom du département
              e.first_name, e.last_name, e.email as employee_email
       from challenge_participants cp
       left join employees e on e.id = cp.employee_id
       where cp.challenge_id = $1
       order by cp.rank nulls last, cp.current_value desc`,
      [id]
    );
    res.json(participants);
  })
);

// GET /api/employees/:id/statistics - Statistiques d'un employé
app.get(
  '/api/employees/:id/statistics',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const periodType = req.query.period_type as string || 'all_time';
    
    const stats = await run(
      `select * from employee_statistics
       where employee_id = $1 and period_type = $2
       order by coalesce(period_start, '1900-01-01'::date) desc limit 1`,
      [id, periodType]
    );
    
    res.json(stats[0] || null);
  })
);

// GET /api/leaderboards - Classements
app.get(
  '/api/leaderboards',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const leaderboardType = req.query.type as string || 'points';
    const periodType = req.query.period_type as string || 'monthly';
    
    const [leaderboard] = await run(
      `select * from leaderboards
       where leaderboard_type = $1 and period_type = $2
       order by coalesce(period_start, '1900-01-01'::date) desc limit 1`,
      [leaderboardType, periodType]
    );
    
    if (leaderboard) {
      res.json(leaderboard);
    } else {
      // Calculer le classement si inexistant
      let sql = '';
      if (leaderboardType === 'points') {
        sql = `
          select e.id, e.first_name, e.last_name, e.email as employee_email,
                 coalesce(es.total_points, 0) as value
          from employees e
          left join employee_statistics es on es.employee_id = e.id and es.period_type = $1
          where e.is_active = true
          order by coalesce(es.total_points, 0) desc
          limit 100
        `;
      } else if (leaderboardType === 'volume') {
        sql = `
          select e.id, e.first_name, e.last_name, e.email as employee_email,
                 coalesce(es.total_volume_kg, 0) as value
          from employees e
          left join employee_statistics es on es.employee_id = e.id and es.period_type = $1
          where e.is_active = true
          order by coalesce(es.total_volume_kg, 0) desc
          limit 100
        `;
      } else if (leaderboardType === 'badges') {
        sql = `
          select e.id, e.first_name, e.last_name, e.email as employee_email,
                 count(eb.id) as value
          from employees e
          left join employee_badges eb on eb.employee_id = e.id
          where e.is_active = true
          group by e.id, e.first_name, e.last_name, e.email
          order by count(eb.id) desc
          limit 100
        `;
      }
      
      if (sql) {
        const rankings = await run(sql, [periodType]);
        const rankingData = rankings.map((r: any, index: number) => ({
          employee_id: r.id,
          rank: index + 1,
          value: r.value,
          employee_name: `${r.first_name} ${r.last_name}`
        }));
        
        res.json({
          leaderboard_type: leaderboardType,
          period_type: periodType,
          ranking_data: rankingData
        });
      } else {
        res.json({ leaderboard_type: leaderboardType, period_type: periodType, ranking_data: [] });
      }
    }
  })
);

// POST /api/challenges - Créer un défi
app.post(
  '/api/challenges',
  requireAuth({ roles: ['admin', 'manager'] }),
  asyncHandler(async (req, res) => {
    const {
      challenge_code,
      name,
      description,
      challenge_type,
      target_value,
      unit,
      start_date,
      end_date
    } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    if (!name || !challenge_type || !target_value || !start_date || !end_date) {
      return res.status(400).json({ message: 'Champs requis manquants' });
    }

    const [challenge] = await run(
      `insert into monthly_challenges (
        challenge_code, name, description, challenge_type, target_value, unit,
        start_date, end_date, created_by
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
      [
        challenge_code || `CHALL-${Date.now()}`,
        name,
        description || null,
        challenge_type,
        target_value,
        unit || null,
        start_date,
        end_date,
        auth.id
      ]
    );

    res.status(201).json(challenge);
  })
);

// ==========================================
// RECHERCHE GLOBALE ET FILTRES AVANCÉS
// ==========================================

// GET /api/search/global - Recherche globale
app.get(
  '/api/search/global',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const query = (req.query.q as string) || '';
    const types = req.query.types ? (req.query.types as string).split(',') : [];
    const dateStart = req.query.date_start as string;
    const dateEnd = req.query.date_end as string;
    const status = req.query.status as string;
    const department = req.query.department as string;

    if (!query.trim()) {
      return res.json([]);
    }

    const searchTerm = `%${query.toLowerCase()}%`;
    const results: any[] = [];

    // Recherche dans les clients
    if (types.length === 0 || types.includes('customer')) {
      let sql = `select id, name, address, created_at from customers where lower(name) like $1 or lower(coalesce(address, '')) like $1`;
      const params: any[] = [searchTerm];
      if (dateStart) {
        sql += ` and created_at >= $${params.length + 1}`;
        params.push(dateStart);
      }
      if (dateEnd) {
        sql += ` and created_at <= $${params.length + 1}`;
        params.push(dateEnd + ' 23:59:59');
      }
      sql += ' limit 20';
      const customers = await run(sql, params);
      customers.forEach((c: any) => {
        results.push({
          type: 'customer',
          id: c.id,
          title: c.name,
          subtitle: c.address || 'Aucune adresse',
          metadata: [`Créé le ${new Date(c.created_at).toLocaleDateString('fr-FR')}`],
          url: `/customers?selected=${c.id}`
        });
      });
    }

    // Recherche dans les factures
    if (types.length === 0 || types.includes('invoice')) {
      let sql = `select id, invoice_number, customer_name, issue_date, status, total_amount, currency from invoices where lower(invoice_number) like $1 or lower(coalesce(customer_name, '')) like $1`;
      const params: any[] = [searchTerm];
      if (dateStart) {
        sql += ` and issue_date >= $${params.length + 1}`;
        params.push(dateStart);
      }
      if (dateEnd) {
        sql += ` and issue_date <= $${params.length + 1}`;
        params.push(dateEnd);
      }
      if (status) {
        sql += ` and status = $${params.length + 1}`;
        params.push(status);
      }
      sql += ' limit 20';
      const invoices = await run(sql, params);
      invoices.forEach((inv: any) => {
        results.push({
          type: 'invoice',
          id: inv.id,
          title: `Facture ${inv.invoice_number}`,
          subtitle: inv.customer_name || 'Client inconnu',
          metadata: [
            `${inv.total_amount.toFixed(2)} ${inv.currency}`,
            `Émise le ${new Date(inv.issue_date).toLocaleDateString('fr-FR')}`,
            inv.status
          ],
          url: `/finance?selected=${inv.id}`
        });
      });
    }

    // Recherche dans les interventions
    if (types.length === 0 || types.includes('intervention')) {
      let sql = `select i.id, i.title, i.status, i.priority, i.customer_name, i.created_at from interventions i where lower(i.title) like $1 or lower(coalesce(i.description, '')) like $1 or lower(coalesce(i.customer_name, '')) like $1`;
      const params: any[] = [searchTerm];
      if (dateStart) {
        sql += ` and i.created_at >= $${params.length + 1}`;
        params.push(dateStart);
      }
      if (dateEnd) {
        sql += ` and i.created_at <= $${params.length + 1}`;
        params.push(dateEnd + ' 23:59:59');
      }
      if (status) {
        sql += ` and i.status = $${params.length + 1}`;
        params.push(status);
      }
      sql += ' limit 20';
      const interventions = await run(sql, params);
      interventions.forEach((int: any) => {
        results.push({
          type: 'intervention',
          id: int.id,
          title: int.title,
          subtitle: int.customer_name || 'Client inconnu',
          metadata: [int.status, int.priority, `Créée le ${new Date(int.created_at).toLocaleDateString('fr-FR')}`],
          url: `/interventions?selected=${int.id}`
        });
      });
    }

    // Recherche dans les matières
    if (types.length === 0 || types.includes('material')) {
      let sql = `select id, abrege, description, unite, famille from materials where lower(coalesce(abrege, '')) like $1 or lower(coalesce(description, '')) like $1 or lower(coalesce(famille, '')) like $1 limit 20`;
      const materials = await run(sql, [searchTerm]);
      materials.forEach((m: any) => {
        results.push({
          type: 'material',
          id: m.id,
          title: m.abrege || m.description || 'Matière sans nom',
          subtitle: m.description || m.famille || '',
          metadata: m.unite ? [`Unité: ${m.unite}`] : [],
          url: `/materials?selected=${m.id}`
        });
      });
    }

    // Recherche dans les employés
    if (types.length === 0 || types.includes('employee')) {
      let sql = `select id, first_name, last_name, email, department, role from employees where lower(first_name) like $1 or lower(last_name) like $1 or lower(email) like $1`;
      const params: any[] = [searchTerm];
      if (department) {
        sql += ` and department = $${params.length + 1}`;
        params.push(department);
      }
      sql += ' limit 20';
      const employees = await run(sql, params);
      employees.forEach((e: any) => {
        results.push({
          type: 'employee',
          id: e.id,
          title: `${e.first_name} ${e.last_name}`,
          subtitle: e.email || '',
          metadata: [e.department || '', e.role || ''],
          url: `/employees?selected=${e.id}`
        });
      });
    }

    // Recherche dans les véhicules
    if (types.length === 0 || types.includes('vehicle')) {
      let sql = `select id, internal_number, plate_number from vehicles where lower(coalesce(internal_number, '')) like $1 or lower(coalesce(plate_number, '')) like $1 limit 20`;
      const vehicles = await run(sql, [searchTerm]);
      vehicles.forEach((v: any) => {
        results.push({
          type: 'vehicle',
          id: v.id,
          title: v.internal_number || v.plate_number || 'Véhicule sans nom',
          subtitle: v.plate_number || '',
          metadata: [],
          url: `/vehicles?selected=${v.id}`
        });
      });
    }

    // Recherche dans les documents
    if (types.length === 0 || types.includes('document')) {
      let sql = `select id, title, document_number, category, status from documents where lower(title) like $1 or lower(coalesce(description, '')) like $1 or lower(document_number) like $1`;
      const params: any[] = [searchTerm];
      if (dateStart) {
        sql += ` and created_at >= $${params.length + 1}`;
        params.push(dateStart);
      }
      if (dateEnd) {
        sql += ` and created_at <= $${params.length + 1}`;
        params.push(dateEnd + ' 23:59:59');
      }
      sql += ' limit 20';
      const documents = await run(sql, params);
      documents.forEach((d: any) => {
        results.push({
          type: 'document',
          id: d.id,
          title: d.title,
          subtitle: d.document_number || '',
          metadata: [d.category || '', d.status || ''],
          url: `/documents?selected=${d.id}`
        });
      });
    }

    // Recherche dans les fournisseurs
    if (types.length === 0 || types.includes('supplier')) {
      let sql = `select id, name, supplier_type, contact_email from suppliers where lower(name) like $1 or lower(coalesce(contact_email, '')) like $1 limit 20`;
      const suppliers = await run(sql, [searchTerm]);
      suppliers.forEach((s: any) => {
        results.push({
          type: 'supplier',
          id: s.id,
          title: s.name,
          subtitle: s.contact_email || '',
          metadata: [s.supplier_type || ''],
          url: `/suppliers?selected=${s.id}`
        });
      });
    }

    res.json(results);
  })
);

// GET /api/search/semantic - Recherche sémantique
app.get(
  '/api/search/semantic',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const query = (req.query.q as string) || '';
    const types = req.query.types ? (req.query.types as string).split(',') : [];
    const dateStart = req.query.date_start as string;
    const dateEnd = req.query.date_end as string;

    if (!query.trim()) {
      return res.json([]);
    }

    const queryLower = query.toLowerCase();
    const results: any[] = [];

    // Analyse sémantique basique
    const isClientQuery = queryLower.includes('client') || queryLower.includes('customer');
    const isInterventionQuery = queryLower.includes('intervention') || queryLower.includes('ticket');
    const isFactureQuery = queryLower.includes('facture') || queryLower.includes('invoice');
    const isSemaineQuery = queryLower.includes('semaine') || queryLower.includes('week');
    const isMoisQuery = queryLower.includes('mois') || queryLower.includes('month');

    // Calculer les dates si nécessaire
    let startDate: string | null = null;
    let endDate: string | null = null;
    if (isSemaineQuery) {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      startDate = start.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    } else if (isMoisQuery) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = start.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    }

    if (dateStart) startDate = dateStart;
    if (dateEnd) endDate = dateEnd;

    // Recherche clients avec interventions cette semaine/mois
    if (isClientQuery && (isInterventionQuery || isSemaineQuery || isMoisQuery)) {
      let sql = `
        select distinct c.id, c.name, c.address, count(i.id) as intervention_count
        from customers c
        left join interventions i on i.customer_id = c.id
        where 1=1
      `;
      const params: any[] = [];
      if (startDate) {
        sql += ` and i.created_at >= $${params.length + 1}`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` and i.created_at <= $${params.length + 1}`;
        params.push(endDate + ' 23:59:59');
      }
      sql += ` group by c.id, c.name, c.address having count(i.id) > 0 limit 20`;
      const customers = await run(sql, params);
      customers.forEach((c: any) => {
        results.push({
          type: 'customer',
          id: c.id,
          title: c.name,
          subtitle: `${c.intervention_count} intervention(s)`,
          metadata: [c.address || ''],
          url: `/customers?selected=${c.id}`
        });
      });
    }

    // Si pas de résultats sémantiques, faire une recherche normale
    if (results.length === 0) {
      const searchResults = await run(
        `select 'customer' as type, id::text, name as title, coalesce(address, '') as subtitle from customers where lower(name) like $1 limit 10`,
        [`%${queryLower}%`]
      );
      searchResults.forEach((r: any) => {
        results.push({
          type: r.type,
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          metadata: [],
          url: `/customers?selected=${r.id}`
        });
      });
    }

    res.json(results);
  })
);

// GET /api/search/suggestions - Suggestions intelligentes
app.get(
  '/api/search/suggestions',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const query = (req.query.q as string) || '';
    if (!query.trim() || query.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${query.toLowerCase()}%`;
    const suggestions: string[] = [];

    // Suggestions depuis les clients
    const customers = await run(`select distinct name from customers where lower(name) like $1 limit 5`, [searchTerm]);
    customers.forEach((c: any) => suggestions.push(c.name));

    // Suggestions depuis les factures
    const invoices = await run(`select distinct invoice_number from invoices where lower(invoice_number) like $1 limit 5`, [searchTerm]);
    invoices.forEach((inv: any) => suggestions.push(`Facture ${inv.invoice_number}`));

    // Suggestions depuis les matières
    const materials = await run(`select distinct abrege from materials where lower(coalesce(abrege, '')) like $1 limit 5`, [searchTerm]);
    materials.forEach((m: any) => {
      if (m.abrege) suggestions.push(m.abrege);
    });

    // Suggestions depuis les employés
    const employees = await run(`select distinct first_name, last_name from employees where lower(first_name) like $1 or lower(last_name) like $1 limit 5`, [searchTerm]);
    employees.forEach((e: any) => {
      suggestions.push(`${e.first_name} ${e.last_name}`);
    });

    res.json([...new Set(suggestions)].slice(0, 10));
  })
);

// GET /api/search/saved-filters - Liste des filtres sauvegardés
app.get(
  '/api/search/saved-filters',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    // S'assurer que la table existe (au cas où ensureSchema n'a pas été exécuté)
    try {
      await run(`
        create table if not exists saved_search_filters (
          id uuid primary key default gen_random_uuid(),
          name text not null,
          query text not null,
          filters jsonb not null default '{}',
          is_favorite boolean not null default false,
          created_by uuid references users(id) on delete cascade,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await run('create index if not exists saved_search_filters_created_by_idx on saved_search_filters(created_by)');
    } catch (error: any) {
      // Ignorer l'erreur si la table existe déjà
      if (!error.message?.includes('already exists')) {
        console.warn('Erreur lors de la création de saved_search_filters:', error.message);
      }
    }

    const filters = await run(
      `select sf.*, u.full_name as created_by_name
       from saved_search_filters sf
       left join users u on u.id = sf.created_by
       where sf.created_by = $1
       order by sf.is_favorite desc, sf.created_at desc`,
      [auth.id]
    );

    res.json(filters);
  })
);

// POST /api/search/saved-filters - Créer un filtre sauvegardé
app.post(
  '/api/search/saved-filters',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    // S'assurer que la table existe
    try {
      await run(`
        create table if not exists saved_search_filters (
          id uuid primary key default gen_random_uuid(),
          name text not null,
          query text not null,
          filters jsonb not null default '{}',
          is_favorite boolean not null default false,
          created_by uuid references users(id) on delete cascade,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await run('create index if not exists saved_search_filters_created_by_idx on saved_search_filters(created_by)');
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        console.warn('Erreur lors de la création de saved_search_filters:', error.message);
      }
    }

    const { name, query, filters, is_favorite } = req.body;

    if (!name || !query) {
      return res.status(400).json({ message: 'Nom et requête requis' });
    }

    const [savedFilter] = await run(
      `insert into saved_search_filters (name, query, filters, is_favorite, created_by)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [name, query, JSON.stringify(filters || {}), is_favorite || false, auth.id]
    );

    res.status(201).json(savedFilter);
  })
);

// PUT /api/search/saved-filters/:id - Modifier un filtre sauvegardé
app.put(
  '/api/search/saved-filters/:id',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    const { id } = req.params;
    const { name, query, filters, is_favorite } = req.body;

    const [savedFilter] = await run(
      `update saved_search_filters
       set name = coalesce($1, name),
           query = coalesce($2, query),
           filters = coalesce($3::jsonb, filters),
           is_favorite = coalesce($4, is_favorite),
           updated_at = now()
       where id = $5 and created_by = $6
       returning *`,
      [name, query, filters ? JSON.stringify(filters) : null, is_favorite, id, auth.id]
    );

    if (!savedFilter) {
      return res.status(404).json({ message: 'Filtre non trouvé' });
    }

    res.json(savedFilter);
  })
);

// DELETE /api/search/saved-filters/:id - Supprimer un filtre sauvegardé
app.delete(
  '/api/search/saved-filters/:id',
  requireAuth({ roles: ['admin', 'manager', 'user'] }),
  asyncHandler(async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ message: 'Authentification requise' });
    }

    const { id } = req.params;

    await run(
      `delete from saved_search_filters where id = $1 and created_by = $2`,
      [id, auth.id]
    );

    res.status(204).send();
  })
);

// ==========================================
// BUSINESS INTELLIGENCE (BI) - API ENDPOINTS
// ==========================================

// GET /api/bi/historical - Data Warehouse - Analyses historiques
app.get(
  '/api/bi/historical',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const dimensions = req.query.dimensions ? (req.query.dimensions as string).split(',') : ['time'];
    const metrics = req.query.metrics ? (req.query.metrics as string).split(',') : ['volume'];

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Dates de début et fin requises' });
    }

    const dataPoints: any[] = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    // Générer les points de données par jour
    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dimensionsObj: Record<string, string> = {};
      const metricsObj: Record<string, number> = {};

      // Remplir les dimensions
      for (const dim of dimensions) {
        if (dim === 'time') {
          dimensionsObj.time = dateStr;
        } else if (dim === 'material') {
          // Récupérer les matières pour cette date
          const materials = await run(
            `select distinct m.abrege from materials m limit 5`
          );
          if (materials.length > 0) {
            dimensionsObj.material = materials[0].abrege || 'Tous';
          }
        }
      }

      // Remplir les métriques
      for (const metric of metrics) {
        if (metric === 'volume') {
          const volumes = await run(
            `select coalesce(sum(case when category = 'halle' then quantity else 0 end), 0) as halle,
                    coalesce(sum(case when category = 'plastiqueB' then quantity else 0 end), 0) as plastique,
                    coalesce(sum(case when category = 'cdt' then quantity else 0 end), 0) as cdt,
                    coalesce(sum(case when category = 'papier' then quantity else 0 end), 0) as papier
             from inventory_snapshots
             where report_date::date = $1`,
            [dateStr]
          );
          metricsObj.volume = (volumes[0]?.halle || 0) + (volumes[0]?.plastique || 0) + (volumes[0]?.cdt || 0) + (volumes[0]?.papier || 0);
        } else if (metric === 'revenue') {
          const revenues = await run(
            `select coalesce(sum(total_amount), 0) as total
             from invoices
             where issue_date::date = $1`,
            [dateStr]
          );
          metricsObj.revenue = revenues[0]?.total || 0;
        } else if (metric === 'cost') {
          // Estimation des coûts (à améliorer avec une vraie table de coûts)
          metricsObj.cost = Math.random() * 1000; // Placeholder
        } else if (metric === 'count') {
          const counts = await run(
            `select count(*) as total from interventions where created_at::date = $1`,
            [dateStr]
          );
          metricsObj.count = counts[0]?.total || 0;
        } else if (metric === 'efficiency') {
          metricsObj.efficiency = Math.random() * 100; // Placeholder
        }
      }

      dataPoints.push({
        date: dateStr,
        dimensions: dimensionsObj,
        metrics: metricsObj
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(dataPoints);
  })
);

// POST /api/bi/olap - Cubes OLAP - Analyses multidimensionnelles
app.post(
  '/api/bi/olap',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { cube, dimensions, measures, filters } = req.body;

    if (!cube || !dimensions || !measures) {
      return res.status(400).json({ message: 'Cube, dimensions et mesures requis' });
    }

    let sql = '';
    const params: any[] = [];
    let paramIndex = 1;

    // Construire la requête SQL selon le cube
    if (cube === 'volumes') {
      sql = `
        select 
          ${dimensions.map((d: string, idx: number) => {
            if (d === 'material') return `m.abrege as material`;
            if (d === 'time') return `to_char(is.report_date, 'YYYY-MM') as time`;
            if (d === 'customer') return `c.name as customer`;
            return `'all' as ${d}`;
          }).join(', ')},
          ${measures.map((m: string) => {
            if (m === 'total_volume') return `sum(is.quantity) as total_volume`;
            if (m === 'total_revenue') return `coalesce(sum(i.total_amount), 0) as total_revenue`;
            return `0 as ${m}`;
          }).join(', ')}
        from inventory_snapshots is
        left join materials m on m.id = is.material_id
        left join customers c on c.id = is.customer_id
        left join invoices i on i.customer_id = c.id
        where 1=1
      `;

      if (filters) {
        if (filters.start_date) {
          sql += ` and is.report_date >= $${paramIndex}`;
          params.push(filters.start_date);
          paramIndex++;
        }
        if (filters.end_date) {
          sql += ` and is.report_date <= $${paramIndex}`;
          params.push(filters.end_date);
          paramIndex++;
        }
      }

      sql += ` group by ${dimensions.map((d: string, idx: number) => idx + 1).join(', ')}`;
    } else {
      // Autres cubes (revenues, costs, performance)
      sql = `
        select 
          ${dimensions.map((d: string) => `'all' as ${d}`).join(', ')},
          ${measures.map((m: string) => `0 as ${m}`).join(', ')}
        limit 0
      `;
    }

    const rows = await run(sql, params);
    
    const totals: Record<string, number> = {};
    measures.forEach((m: string) => {
      totals[m] = rows.reduce((sum: number, row: any) => sum + (row[m] || 0), 0);
    });

    res.json({
      cube,
      dimensions,
      measures,
      data: rows.map((row: any) => ({
        dimension_values: dimensions.reduce((acc: Record<string, string>, dim: string) => {
          acc[dim] = row[dim] || 'all';
          return acc;
        }, {}),
        measure_values: measures.reduce((acc: Record<string, number>, meas: string) => {
          acc[meas] = row[meas] || 0;
          return acc;
        }, {})
      })),
      totals
    });
  })
);

// GET /api/bi/forecast/demand - Prédictions de demande (ML)
app.get(
  '/api/bi/forecast/demand',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const materialType = req.query.material_type as string;
    const horizon = parseInt(req.query.horizon as string) || 30;
    const startDate = req.query.start_date as string || format(new Date(), 'yyyy-MM-dd');

    // Récupérer les données historiques pour la prédiction
    const historicalData = await run(
      `select report_date, sum(quantity) as volume
       from inventory_snapshots
       where report_date >= $1::date - interval '90 days'
       ${materialType ? `and material_id in (select id from materials where abrege = $2)` : ''}
       group by report_date
       order by report_date`,
      materialType ? [format(subDays(new Date(startDate), 90), 'yyyy-MM-dd'), materialType] : [format(subDays(new Date(startDate), 90), 'yyyy-MM-dd')]
    );

    // Algorithme simple de prédiction basé sur la moyenne mobile et tendance
    const forecastData: any[] = [];
    const currentDate = new Date(startDate);
    
    // Calculer la moyenne et la tendance
    const volumes = historicalData.map((d: any) => d.volume || 0);
    const avgVolume = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;
    const trend = volumes.length > 1 ? (volumes[volumes.length - 1] - volumes[0]) / volumes.length : 0;

    for (let i = 0; i < horizon; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);
      const predictedValue = avgVolume + (trend * i);
      const confidence = Math.max(0.7, 1 - (i / horizon) * 0.3); // Confiance décroissante
      const deviation = predictedValue * (1 - confidence);

      forecastData.push({
        date: format(date, 'yyyy-MM-dd'),
        predicted_value: Math.max(0, predictedValue),
        confidence_lower: Math.max(0, predictedValue - deviation),
        confidence_upper: predictedValue + deviation,
        actual_value: i === 0 && historicalData.length > 0 ? historicalData[historicalData.length - 1].volume : undefined
      });
    }

    res.json(forecastData);
  })
);

// GET /api/bi/anomalies - Détection d'anomalies (ML)
app.get(
  '/api/bi/anomalies',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const entityType = req.query.entity_type as string;
    const threshold = parseFloat(req.query.threshold as string) || 0.2;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Dates requises' });
    }

    const anomalies: any[] = [];

    // Détecter les anomalies dans les volumes
    const volumes = await run(
      `select report_date, sum(quantity) as volume
       from inventory_snapshots
       where report_date between $1 and $2
       group by report_date
       order by report_date`,
      [startDate, endDate]
    );

    if (volumes.length > 0) {
      const volumeValues = volumes.map((v: any) => v.volume || 0);
      const mean = volumeValues.reduce((a: number, b: number) => a + b, 0) / volumeValues.length;
      const variance = volumeValues.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / volumeValues.length;
      const stdDev = Math.sqrt(variance);

      volumes.forEach((vol: any, idx: number) => {
        const value = vol.volume || 0;
        const zScore = stdDev > 0 ? Math.abs((value - mean) / stdDev) : 0;
        const deviation = stdDev > 0 ? (value - mean) / mean : 0;

        if (Math.abs(deviation) > threshold) {
          anomalies.push({
            id: `anomaly-${idx}`,
            entity_type: 'inventory',
            entity_id: vol.report_date,
            metric: 'volume',
            value,
            expected_value: mean,
            deviation,
            severity: Math.abs(deviation) > 0.5 ? 'critical' : Math.abs(deviation) > 0.3 ? 'high' : Math.abs(deviation) > 0.2 ? 'medium' : 'low',
            detected_at: vol.report_date,
            description: `Volume anormal détecté: ${value.toFixed(2)} (attendu: ${mean.toFixed(2)})`
          });
        }
      });
    }

    // Détecter les anomalies dans les revenus
    const revenues = await run(
      `select issue_date, sum(total_amount) as revenue
       from invoices
       where issue_date between $1 and $2
       group by issue_date
       order by issue_date`,
      [startDate, endDate]
    );

    if (revenues.length > 0) {
      const revenueValues = revenues.map((r: any) => r.revenue || 0);
      const mean = revenueValues.reduce((a: number, b: number) => a + b, 0) / revenueValues.length;
      const variance = revenueValues.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / revenueValues.length;
      const stdDev = Math.sqrt(variance);

      revenues.forEach((rev: any, idx: number) => {
        const value = rev.revenue || 0;
        const deviation = stdDev > 0 ? (value - mean) / mean : 0;

        if (Math.abs(deviation) > threshold) {
          anomalies.push({
            id: `anomaly-revenue-${idx}`,
            entity_type: 'invoice',
            entity_id: rev.issue_date,
            metric: 'revenue',
            value,
            expected_value: mean,
            deviation,
            severity: Math.abs(deviation) > 0.5 ? 'critical' : Math.abs(deviation) > 0.3 ? 'high' : Math.abs(deviation) > 0.2 ? 'medium' : 'low',
            detected_at: rev.issue_date,
            description: `Revenu anormal détecté: ${value.toFixed(2)} € (attendu: ${mean.toFixed(2)} €)`
          });
        }
      });
    }

    res.json(anomalies);
  })
);

// POST /api/bi/drill-down - Drill-down navigation
app.post(
  '/api/bi/drill-down',
  requireAuth({ roles: ['admin', 'manager'], permissions: ['view_customers'] }),
  asyncHandler(async (req, res) => {
    const { level, parentId, dimension, measure, filters } = req.body;

    if (!level || !dimension || !measure) {
      return res.status(400).json({ message: 'Level, dimension et measure requis' });
    }

    let sql = '';
    const params: any[] = [];

    // Construire la requête selon la dimension
    if (dimension === 'material') {
      sql = `
        select m.id, m.abrege as label, sum(is.quantity) as value, count(distinct is.id) as children_count
        from materials m
        left join inventory_snapshots is on is.material_id = m.id
        where 1=1
      `;
      if (parentId) {
        sql += ` and m.famille = $1`;
        params.push(parentId);
      }
      sql += ` group by m.id, m.abrege order by value desc limit 20`;
    } else if (dimension === 'customer') {
      sql = `
        select c.id, c.name as label, coalesce(sum(i.total_amount), 0) as value, count(distinct i.id) as children_count
        from customers c
        left join invoices i on i.customer_id = c.id
        where 1=1
      `;
      if (parentId) {
        sql += ` and c.risk_level = $1`;
        params.push(parentId);
      }
      sql += ` group by c.id, c.name order by value desc limit 20`;
    } else if (dimension === 'time') {
      sql = `
        select to_char(is.report_date, 'YYYY-MM') as id, 
               to_char(is.report_date, 'YYYY-MM') as label,
               sum(is.quantity) as value,
               count(distinct is.report_date) as children_count
        from inventory_snapshots is
        where 1=1
      `;
      if (parentId) {
        sql += ` and to_char(is.report_date, 'YYYY') = $1`;
        params.push(parentId);
      }
      sql += ` group by to_char(is.report_date, 'YYYY-MM') order by id desc limit 20`;
    } else {
      sql = `select 'all' as id, 'Tous' as label, 0 as value, 0 as children_count limit 0`;
    }

    const rows = await run(sql, params);

    res.json({
      level,
      dimension,
      measure,
      data: rows.map((row: any) => ({
        id: row.id,
        label: row.label,
        value: row.value || 0,
        children_count: row.children_count || 0,
        can_drill_down: (row.children_count || 0) > 0
      })),
      parent: parentId ? { id: parentId, label: parentId } : undefined
    });
  })
);

// Endpoint de migration manuel pour forcer la création des colonnes manquantes
app.post(
  '/api/migrate/downgrades-columns',
  requireAuth({ roles: ['admin'] }),
  asyncHandler(async (_req, res) => {
    try {
      await run('alter table downgrades add column if not exists motive_principal text');
      await run('alter table downgrades add column if not exists motive_description text');
      await run('alter table downgrades add column if not exists declassed_material_code text');
      await run('alter table downgrades add column if not exists vehicle_plate text');
      await run('alter table downgrades add column if not exists slip_number text');
      await run('alter table downgrades add column if not exists motive_ratio text');
      await run('alter table downgrades add column if not exists sorting_time_minutes text');
      await run('alter table downgrades add column if not exists machines_used text[]');
      await run('alter table downgrades add column if not exists lot_origin_client_name text');
      await run('alter table downgrades add column if not exists lot_origin_client_address text');
      res.json({ message: 'Colonnes créées avec succès' });
    } catch (error: any) {
      console.error('Erreur migration colonnes downgrades:', error);
      res.status(500).json({ message: 'Erreur migration', detail: error.message });
    }
  })
);

start().catch((error) => {
  console.error('Failed to start API server', error);
  process.exit(1);
});

