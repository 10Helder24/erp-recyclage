import type { Employee } from '../types/employees';
import type { AuthUser, UserRole } from '../types/auth';
import type { Leave, LeaveBalance, LeaveRequestPayload, LeaveStatus } from '../types/leaves';
import { request, setAuthToken as setAuthTokenBase, API_URL, getAuthToken } from './api/base';

export type MapUserLocation = {
  employee_id: string;
  latitude: number;
  longitude: number;
  last_update: string;
  first_name: string;
  last_name: string;
  employee_email: string;
  department: string | null;
  role: string | null;
  manager_name: string | null;
};

export type MapUserLocationHistory = {
  id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  first_name: string;
  last_name: string;
  employee_email: string;
  department: string | null;
  role: string | null;
  manager_name: string | null;
};

export type Customer = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  risk_level: string | null;
  created_at: string;
};

export type Material = {
  id: string;
  famille: string | null;
  numero: string | null;
  abrege: string | null;
  description: string | null;
  unite: string | null;
  me_bez: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialQuality = {
  id: string;
  material_id: string;
  name: string;
  description: string | null;
  deduction_pct: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerDocument = {
  id: string;
  filename: string;
  mimetype: string | null;
  size: number | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

export type PriceSource = {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  created_at: string;
};

export type MaterialPrice = {
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
  source_name?: string;
};

export type AuditLogEntry = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  changed_by: string | null;
  changed_by_name: string | null;
  before_data: Record<string, any> | null;
  after_data: Record<string, any> | null;
  created_at: string;
};

export type InventoryMaterial = {
  id: string;
  category: 'halle' | 'plastiqueB' | 'cdt' | 'papier';
  matiere: string;
  num: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryMachine = {
  id: string;
  num1: string;
  mac: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryContainer = {
  id: string;
  type: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryBag = {
  id: string;
  type: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryOtherItem = {
  id: string;
  category: 'diesel' | 'adBlue' | 'filFer' | 'eau';
  subcategory: string | null;
  label: string;
  unit1: string | null;
  unit2: string | null;
  default_value1: number;
  default_value2: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventorySnapshot = {
  id: string;
  report_date: string;
  report_date_label: string | null;
  halle_data: any[];
  plastique_b_data: any[];
  cdt_data: any[];
  papier_data: any[];
  machines_data: any[];
  autres_data: any;
  containers_data: any[];
  bags_data: any[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Intervention = {
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
};

export type Route = {
  id: string;
  date: string;
  vehicle_id: string | null;
  status: string | null;
  path: Array<[number, number]> | null;
  created_at: string;
  internal_number: string | null;
  plate_number: string | null;
};

export type RouteStop = {
  id: string;
  route_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_address: string | null;
  order_index: number;
  estimated_time: string | null;
  status: string | null;
  notes: string | null;
  completed_at: string | null;
  latitude?: number | null;
  longitude?: number | null;
  risk_level?: string | null;
};

export type RouteOptimizationResponse = {
  applied: boolean;
  suggestedStops: Array<{
    stop_id: string;
    customer_name: string | null;
    previous_order: number;
    suggested_order: number;
    eta: string | null;
    distance_km: number;
    travel_minutes: number;
    traffic_factor: number;
    traffic_label: string | null;
  }>;
  missingStops: Array<{ id: string; name: string | null }>;
  totalDistanceKm: number;
  totalDurationMin: number;
  trafficNotes: string[];
};

export type PdfTemplateZoneConfig = {
  backgroundColor?: string | null;
  textColor?: string | null;
  titleColor?: string | null;
  subtitleColor?: string | null;
  borderColor?: string | null;
};

export type PdfTemplateZones = {
  header?: PdfTemplateZoneConfig;
  body?: PdfTemplateZoneConfig;
  highlight?: PdfTemplateZoneConfig;
};

export type PdfTemplateConfig = {
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

export type PdfTemplate = {
  id: string;
  module: string;
  config: PdfTemplateConfig;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name?: string | null;
};

export type CustomerDetailPayload = {
  customer: Customer;
  interventions: Intervention[];
  routeStops: Array<
    RouteStop & {
      route_date: string;
      route_status: string | null;
      internal_number: string | null;
      plate_number: string | null;
    }
  >;
  documents: CustomerDocument[];
  auditLogs: AuditLogEntry[];
};

export type MapVehicle = {
  id: string;
  internal_number: string | null;
  plate_number: string | null;
  created_at?: string;
};

export type Vehicle = MapVehicle & {
  max_weight_kg?: number | null;
  max_volume_m3?: number | null;
  vehicle_type?: string | null;
  compatible_materials?: string[] | null;
  is_active?: boolean | null;
};

export type MapRouteType = {
  id: string;
  status: string | null;
  path: Array<[number, number]>;
  vehicle_id: string | null;
  internal_number: string | null;
  plate_number: string | null;
  stops: Array<{
    id: string;
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
  }>;
};

// Finance types
export type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name_full: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_vat_number: string | null;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  status: string;
  total_amount: number;
  total_tax: number;
  currency: string;
  payment_terms: string | null;
  notes: string | null;
  reference: string | null;
  total_paid?: number;
  remaining_amount?: number;
  created_at: string;
};

export type InvoiceLine = {
  id: string;
  invoice_id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  material_id: string | null;
};

export type InvoiceDetail = Invoice & {
  lines: InvoiceLine[];
  payments: Payment[];
};

export type CreateInvoicePayload = {
  customer_id?: string;
  customer_name: string;
  customer_address?: string;
  customer_vat_number?: string;
  issue_date: string;
  due_date: string;
  currency: string;
  payment_terms?: string;
  notes?: string;
  reference?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    material_id?: string | null;
  }>;
};

export type Quote = {
  id: string;
  quote_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_vat_number: string | null;
  issue_date: string;
  valid_until: string;
  status: string;
  total_amount: number;
  total_tax: number;
  currency: string;
  notes: string | null;
  reference: string | null;
  created_at: string;
};

export type QuoteLine = {
  id: string;
  quote_id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  material_id: string | null;
};

export type QuoteDetail = Quote & {
  lines: QuoteLine[];
};

export type CreateQuotePayload = {
  customer_id?: string;
  customer_name: string;
  customer_address?: string;
  customer_vat_number?: string;
  issue_date: string;
  valid_until: string;
  currency: string;
  notes?: string;
  reference?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    material_id?: string | null;
  }>;
};

export type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

export type CreatePaymentPayload = {
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string;
  notes?: string;
};

export type CustomerPricing = {
  id: string;
  customer_id: string;
  material_id: string;
  unit_price: number;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  created_at: string;
};

export type CreateCustomerPricingPayload = {
  customer_id: string;
  material_id: string;
  unit_price: number;
  currency: string;
  valid_from: string;
  valid_to?: string;
  notes?: string;
};

export type InterventionCosts = {
  id: string;
  intervention_id: string;
  fuel_cost: number;
  labor_cost: number;
  time_hours: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
};

export type CreateInterventionCostsPayload = {
  intervention_id: string;
  fuel_cost: number;
  labor_cost: number;
  time_hours: number;
  notes?: string;
};

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
  pdfFilename: string;
  photos?: Array<{
    filename: string;
    mimeType?: string;
    base64: string;
  }>;
};

type InventoryEmailPayload = {
  dateLabel: string;
  pdfBase64: string;
  pdfFilename: string;
  excelBase64?: string;
  excelFilename?: string;
};

type VacationNotificationPayload = {
  leaveIds: string[];
  canton: string;
  pdfBase64?: string;
  pdfFilename?: string;
};

// ==========================================
// GAMIFICATION ET MOTIVATION - TYPES
// ==========================================

export interface Badge {
  id: string;
  badge_code: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: 'volume' | 'quality' | 'efficiency' | 'attendance' | 'achievement' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeBadge {
  id: string;
  employee_id: string;
  badge_id: string;
  earned_at: string;
  earned_for: string | null;
  points_earned: number;
  // Badge details
  badge_code?: string;
  name?: string;
  description?: string | null;
  icon?: string | null;
  category?: string;
  rarity?: string;
}

export interface Reward {
  id: string;
  reward_code: string;
  name: string;
  description: string | null;
  reward_type: 'points' | 'bonus' | 'gift' | 'recognition' | 'privilege';
  points_cost: number | null;
  monetary_value: number | null;
  is_active: boolean;
  created_at: string;
}

export interface RewardClaim {
  id: string;
  employee_id: string;
  reward_id: string;
  points_spent: number;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  claimed_at: string;
  approved_at: string | null;
  approved_by: string | null;
  fulfilled_at: string | null;
  notes: string | null;
}

export interface MonthlyChallenge {
  id: string;
  challenge_code: string;
  name: string;
  description: string | null;
  challenge_type: 'volume' | 'quality' | 'efficiency' | 'team' | 'individual';
  target_value: number;
  unit: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  participant_type: 'team' | 'individual';
  team_id: string | null;
  employee_id: string | null;
  current_value: number;
  progress_percentage: number;
  rank: number | null;
  joined_at: string;
  team_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  employee_email?: string | null;
}

export interface EmployeeStatistics {
  id: string;
  employee_id: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  period_start: string | null;
  period_end: string | null;
  total_volume_kg: number;
  total_routes: number;
  total_customers_served: number;
  average_quality_score: number | null;
  on_time_delivery_rate: number | null;
  total_points: number;
  badges_count: number;
  challenges_won: number;
  updated_at: string;
}

export interface Leaderboard {
  id: string;
  leaderboard_type: 'volume' | 'quality' | 'efficiency' | 'points' | 'badges' | 'challenges';
  period_type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  period_start: string | null;
  period_end: string | null;
  ranking_data: Array<{
    employee_id: string;
    rank: number;
    value: number;
    employee_name?: string;
  }>;
  updated_at: string;
}

export interface CreateChallengePayload {
  challenge_code?: string;
  name: string;
  description?: string;
  challenge_type: 'volume' | 'quality' | 'efficiency' | 'team' | 'individual';
  target_value: number;
  unit?: string;
  start_date: string;
  end_date: string;
}

export interface AwardBadgePayload {
  badge_id: string;
  earned_for?: string;
}

export const Api = {
  setAuthToken: (token: string | null) => {
    setAuthTokenBase(token);
  },
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchCurrentUser: () => request<{ user: AuthUser }>('/auth/me'),
  requestPasswordReset: (payload: { email: string }) =>
    request<{ message: string }>('/auth/password/request', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  resetPassword: (payload: { token: string; password: string }) =>
    request<{ message: string }>('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchUsers: () => request<AuthUser[]>('/auth/users'),
  createUser: (payload: {
    email: string;
    password: string;
    role: UserRole;
    full_name?: string;
    department?: string | null;
    manager_name?: string | null;
    permissions?: string[];
  }) =>
    request<{ user: AuthUser }>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateUser: (
    id: string,
    payload: {
      email?: string;
      role?: UserRole;
      full_name?: string | null;
      department?: string | null;
      manager_name?: string | null;
      password?: string;
      permissions?: string[];
    }
  ) =>
    request<{ user: AuthUser }>(`/auth/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteUser: (id: string) =>
    request<{ message: string }>(`/auth/users/${id}`, {
      method: 'DELETE'
    }),
  fetchEmployees: () => request<Employee[]>('/employees'),
  createEmployee: (payload: {
    employee_code?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    personal_email?: string;
    personal_phone?: string;
    department?: string;
    role?: string;
    contract_type?: string;
    employment_status?: string;
    work_rate?: number;
    work_schedule?: string;
    manager_name?: string;
    location?: string;
    address_line1?: string;
    address_line2?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    work_permit?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    notes?: string;
    start_date?: string;
    birth_date?: string;
    birth_location?: string;
    nationality?: string;
    marital_status?: string;
    dependent_children?: string;
    id_document_number?: string;
    ahv_number?: string;
    iban?: string;
  }) =>
    request<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateEmployee: (
    id: string,
    payload: {
      employee_code?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      personal_email?: string;
      personal_phone?: string;
      department?: string;
      role?: string;
      contract_type?: string;
      employment_status?: string;
      work_rate?: number;
      work_schedule?: string;
      manager_name?: string;
      location?: string;
      address_line1?: string;
      address_line2?: string;
      postal_code?: string;
      city?: string;
      country?: string;
      work_permit?: string;
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
      notes?: string;
      start_date?: string;
      birth_date?: string;
      birth_location?: string;
      nationality?: string;
      marital_status?: string;
      dependent_children?: string;
      id_document_number?: string;
      ahv_number?: string;
      iban?: string;
    }
  ) =>
    request<Employee>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  // HR+ : Skills
  fetchSkills: () => request<any[]>('/hr/skills'),
  createSkill: (payload: { name: string; description?: string }) =>
    request<any>('/hr/skills', { method: 'POST', body: JSON.stringify(payload) }),
  updateSkill: (id: string, payload: { name?: string; description?: string }) =>
    request<any>(`/hr/skills/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSkill: (id: string) => request<{ message: string }>(`/hr/skills/${id}`, { method: 'DELETE' }),
  fetchEmployeeSkills: (employeeId: string) => request<any[]>(`/hr/employees/${employeeId}/skills`),
  upsertEmployeeSkill: (
    employeeId: string,
    payload: { skill_id: string; level?: number; validated_at?: string; expires_at?: string }
  ) =>
    request<any>(`/hr/employees/${employeeId}/skills`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteEmployeeSkill: (employeeId: string, skillId: string) =>
    request<{ message: string }>(`/hr/employees/${employeeId}/skills/${skillId}`, { method: 'DELETE' }),

  // HR+ : Certifications
  fetchCertifications: () => request<any[]>('/hr/certifications'),
  createCertification: (payload: { code: string; name: string; description?: string; validity_months?: number }) =>
    request<any>('/hr/certifications', { method: 'POST', body: JSON.stringify(payload) }),
  fetchEmployeeCertifications: (employeeId: string) => request<any[]>(`/hr/employees/${employeeId}/certifications`),
  upsertEmployeeCertification: (
    employeeId: string,
    payload: { certification_id: string; obtained_at?: string; expires_at?: string; reminder_days?: number }
  ) =>
    request<any>(`/hr/employees/${employeeId}/certifications`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteEmployeeCertification: (employeeId: string, certId: string) =>
    request<{ message: string }>(`/hr/employees/${employeeId}/certifications/${certId}`, { method: 'DELETE' }),

  // HR+ : Trainings
  fetchTrainings: () => request<any[]>('/hr/trainings'),
  createTraining: (payload: { title: string; description?: string; mandatory?: boolean; validity_months?: number }) =>
    request<any>('/hr/trainings', { method: 'POST', body: JSON.stringify(payload) }),
  fetchEmployeeTrainings: (employeeId: string) => request<any[]>(`/hr/employees/${employeeId}/trainings`),
  upsertEmployeeTraining: (
    employeeId: string,
    payload: { training_id: string; status?: string; taken_at?: string; expires_at?: string; reminder_days?: number }
  ) =>
    request<any>(`/hr/employees/${employeeId}/trainings`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteEmployeeTraining: (employeeId: string, trainingId: string) =>
    request<{ message: string }>(`/hr/employees/${employeeId}/trainings/${trainingId}`, { method: 'DELETE' }),

  // HR+ : EPI
  fetchEpis: () => request<any[]>('/hr/epis'),
  createEpi: (payload: { name: string; category?: string; lifetime_months?: number }) =>
    request<any>('/hr/epis', { method: 'POST', body: JSON.stringify(payload) }),
  fetchEmployeeEpis: (employeeId: string) => request<any[]>(`/hr/employees/${employeeId}/epis`),
  assignEmployeeEpi: (
    employeeId: string,
    payload: { epi_id: string; assigned_at?: string; expires_at?: string; status?: string }
  ) =>
    request<any>(`/hr/employees/${employeeId}/epis`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteEmployeeEpi: (employeeId: string, epiId: string) =>
    request<{ message: string }>(`/hr/employees/${employeeId}/epis/${epiId}`, { method: 'DELETE' }),

  // HR+ : HSE incidents
  fetchHseIncidents: (params?: { employee_id?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.employee_id) search.set('employee_id', params.employee_id);
    if (params?.status) search.set('status', params.status);
    const qs = search.toString();
    return request<any[]>(`/hr/hse/incidents${qs ? `?${qs}` : ''}`);
  },
  createHseIncident: (payload: {
    employee_id?: string;
    type_id?: string;
    description?: string;
    occurred_at?: string;
    location?: string;
    status?: string;
    root_cause?: string;
    actions?: string;
  }) =>
    request<any>('/hr/hse/incidents', { method: 'POST', body: JSON.stringify(payload) }),

  // HR+ : Performance
  fetchEmployeePerformance: (employeeId: string) =>
    request<any[]>(`/hr/employees/${employeeId}/performance`),
  upsertEmployeePerformance: (
    employeeId: string,
    payload: {
      period_start: string;
      period_end: string;
      throughput_per_hour?: number;
      quality_score?: number;
      safety_score?: number;
      versatility_score?: number;
      incidents_count?: number;
    }
  ) =>
    request<any>(`/hr/employees/${employeeId}/performance`, { method: 'POST', body: JSON.stringify(payload) }),

  // HR+ : Chauffeurs
  fetchEmployeeDriverCompliance: (employeeId: string) =>
    request<any[]>(`/hr/employees/${employeeId}/driver-compliance`),
  upsertEmployeeDriverCompliance: (
    employeeId: string,
    payload: {
      period_start: string;
      period_end: string;
      driving_hours?: number;
      incidents?: number;
      punctuality_score?: number;
      fuel_efficiency_score?: number;
    }
  ) =>
    request<any>(`/hr/employees/${employeeId}/driver-compliance`, { method: 'POST', body: JSON.stringify(payload) }),

  // HR+ : Pointage
  fetchTimeClockEvents: (params?: { employee_id?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.employee_id) search.set('employee_id', params.employee_id);
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return request<TimeClockEvent[]>(`/hr/time-clock${qs ? `?${qs}` : ''}`);
  },
  createTimeClockEvent: (payload: {
    employee_id: string;
    position_id?: string;
    event_type?: TimeClockEvent['event_type'];
    source?: string;
    device_id?: string;
    occurred_at?: string;
  }) =>
    request<TimeClockEvent>('/hr/time-clock', { method: 'POST', body: JSON.stringify(payload) }),
  batchTimeClockEvents: (events: Array<Omit<TimeClockEvent, 'id' | 'created_at'>>) =>
    request<{ inserted: number }>('/hr/time-clock/batch', { method: 'POST', body: JSON.stringify({ events }) }),

  fetchLeaves: (query: string) => request<Leave[]>(`/leaves${query ? `?${query}` : ''}`),
  fetchPendingLeaves: () => request<Leave[]>('/leaves/pending'),
  fetchCalendarLeaves: (params: { start: string; end: string }) =>
    request<Leave[]>(`/leaves/calendar?start=${params.start}&end=${params.end}`),
  fetchLeaveBalances: (year: number) => request<LeaveBalance[]>(`/leave-balances?year=${year}`),
  createLeaveRequest: (payload: LeaveRequestPayload) =>
    request<Leave>('/leaves', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateLeaveWorkflow: (
    id: string,
    payload: { decision: 'approve' | 'reject'; comment?: string; signature?: string }
  ) =>
    request<{ leaves: Leave[] }>(`/leaves/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  notifyVacationApproval: (payload: VacationNotificationPayload) =>
    request<{ message: string }>('/leaves/notify', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteLeave: (id: string) =>
    request<void>(`/leaves/${id}`, {
      method: 'DELETE'
    }),
  recalcLeaveBalances: () =>
    request<LeaveBalance[]>('/leave-balances/recalculate', {
      method: 'POST'
    }),
  updateLeaveBalance: (employeeId: string, year: number, paid_leave_total: number) =>
    request<LeaveBalance>(`/leave-balances/${employeeId}/${year}`, {
      method: 'PATCH',
      body: JSON.stringify({ paid_leave_total })
    }),
  sendDeclassement: (payload: DeclassementEmailPayload) =>
    request<{ message: string }>('/declassements/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  sendDestruction: (payload: {
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
  }) =>
    request<{ message: string }>('/destructions/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  sendCDT: (payload: {
    dateLabel: string;
    formData: Record<string, string>;
    pdfBase64: string;
    pdfFilename: string;
  }) =>
    request<{ message: string }>('/cdt/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  sendInventorySheet: (payload: InventoryEmailPayload) =>
    request<{ message: string }>('/inventory/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  sendExpedition: (payload: {
    dateRange: string;
    weekStart: string;
    data: Record<string, Record<string, Array<{ qty: string; note: string }>>>;
    pdfBase64: string;
    pdfFilename: string;
  }) =>
    request<{ message: string }>('/expeditions/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchUserLocations: (filters?: { department?: string; role?: string; manager?: string }) => {
    const params = new URLSearchParams();
    if (filters?.department) params.set('department', filters.department);
    if (filters?.role) params.set('role', filters.role);
    if (filters?.manager) params.set('manager', filters.manager);
    const query = params.toString();
    return request<MapUserLocation[]>(`/map/user-locations${query ? `?${query}` : ''}`);
  },
  updateCurrentLocation: (payload: { latitude: number; longitude: number }) =>
    request<{ message: string; updated: boolean }>('/map/user-locations', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchVehicles: () => request<MapVehicle[]>('/map/vehicles'),
  fetchAllVehicles: () => request<MapVehicle[]>('/vehicles'),
  fetchRouteStops: (params: { date: string; vehicleId?: string }) => {
    const query = new URLSearchParams({ date: params.date });
    if (params.vehicleId) {
      query.append('vehicleId', params.vehicleId);
    }
    return request<MapRouteType[]>(`/map/routes?${query.toString()}`);
  },
  fetchUserLocationHistory: (params: { date: string; employeeId?: string; timeFrom?: string; timeTo?: string }) => {
    const query = new URLSearchParams({ date: params.date });
    if (params.employeeId) query.append('employeeId', params.employeeId);
    if (params.timeFrom) query.append('timeFrom', params.timeFrom);
    if (params.timeTo) query.append('timeTo', params.timeTo);
    return request<MapUserLocationHistory[]>(`/map/user-locations/history?${query.toString()}`);
  },
  createIntervention: (payload: {
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
  }) =>
    request<{ id: string; message: string }>('/interventions', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  // Clients
  fetchCustomers: () => request<Customer[]>('/customers'),
  createCustomer: (payload: { name: string; address?: string; latitude?: number; longitude?: number; risk_level?: string }) =>
    request<{ id: string; message: string }>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateCustomer: (id: string, payload: { name?: string; address?: string; latitude?: number; longitude?: number; risk_level?: string }) =>
    request<{ message: string }>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteCustomer: (id: string) => request<{ message: string }>(`/customers/${id}`, { method: 'DELETE' }),
  fetchCustomerDetail: (id: string) => request<CustomerDetailPayload>(`/customers/${id}/detail`),
  fetchCustomerDocuments: (id: string) => request<CustomerDocument[]>(`/customers/${id}/documents`),
  uploadCustomerDocument: (id: string, payload: { filename: string; mimetype?: string; base64: string }) =>
    request<{ document: CustomerDocument }>(`/customers/${id}/documents`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteCustomerDocument: (customerId: string, documentId: string) =>
    request<{ message: string }>(`/customers/${customerId}/documents/${documentId}`, {
      method: 'DELETE'
    }),

  // Materials API
  fetchMaterials: () => request<Material[]>('/materials'),
  createMaterial: (payload: {
    famille?: string;
    numero?: string;
    abrege: string;
    description: string;
    unite: string;
    me_bez?: string;
  }) =>
    request<{ id: string; message: string }>('/materials', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchMaterialQualities: (materialId?: string) => {
    const query = materialId ? `?material_id=${materialId}` : '';
    return request<MaterialQuality[]>(`/materials/qualities${query}`);
  },
  createMaterialQuality: (payload: {
    material_id: string;
    name: string;
    description?: string;
    deduction_pct?: number;
    is_default?: boolean;
  }) =>
    request<{ id: string; message: string }>('/materials/qualities', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateMaterialQuality: (id: string, payload: Partial<MaterialQuality>) =>
    request<{ message: string }>(`/materials/qualities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteMaterialQuality: (id: string) =>
    request<{ message: string }>(`/materials/qualities/${id}`, { method: 'DELETE' }),
  updateMaterial: (
    id: string,
    payload: {
      famille?: string;
      numero?: string;
      abrege?: string;
      description?: string;
      unite?: string;
      me_bez?: string;
    }
  ) =>
    request<{ message: string }>(`/materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteMaterial: (id: string) => request<{ message: string }>(`/materials/${id}`, { method: 'DELETE' }),
  fetchMaterialPrices: (materialId: string) => request<MaterialPrice[]>(`/materials/${materialId}/prices`),
  fetchPriceSources: () => request<PriceSource[]>('/price-sources'),
  createMaterialPrice: (materialId: string, payload: {
    price_source_id: string;
    price: number;
    price_min?: number;
    price_max?: number;
    currency?: string;
    valid_from?: string;
    valid_to?: string | null;
    comment?: string;
  }) =>
    request<MaterialPrice>(`/materials/${materialId}/prices`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateMaterialPrice: (priceId: string, payload: {
    price?: number;
    price_min?: number;
    price_max?: number;
    currency?: string;
    valid_from?: string;
    valid_to?: string | null;
    comment?: string;
  }) =>
    request<MaterialPrice>(`/material-prices/${priceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteMaterialPrice: (priceId: string) => request<{ message: string }>(`/material-prices/${priceId}`, { method: 'DELETE' }),
  importCopacelPdf: (payload: {
    prices: Array<{
      abrege?: string;
      description?: string;
      price: number;
      price_min?: number;
      price_max?: number;
    }>;
    filename?: string;
    valid_from?: string;
  }) =>
    request<{ message: string; results: Array<{ material_id: string; success: boolean; error?: string }> }>(
      '/materials/import-copacel-pdf',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    ),
  downloadCustomerDocument: async (customerId: string, documentId: string) => {
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/customers/${customerId}/documents/${documentId}/download`, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`
          }
        : undefined
    });
    if (!response.ok) {
      throw new Error('Téléchargement impossible');
    }
    return response.blob();
  },
  
  // Inventory Config API
  fetchInventoryMaterials: (category?: string, includeInactive?: boolean) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (includeInactive) params.append('include_inactive', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<InventoryMaterial[]>(`/inventory-config/materials${query}`);
  },
  createInventoryMaterial: (payload: { category: string; matiere: string; num?: string; display_order?: number }) =>
    request<InventoryMaterial>('/inventory-config/materials', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateInventoryMaterial: (id: string, payload: { category?: string; matiere?: string; num?: string; display_order?: number; is_active?: boolean }) =>
    request<InventoryMaterial>(`/inventory-config/materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteInventoryMaterial: (id: string, permanent?: boolean) => {
    const query = permanent ? '?permanent=true' : '';
    return request<InventoryMaterial>(`/inventory-config/materials/${id}${query}`, { method: 'DELETE' });
  },
  
  fetchInventoryMachines: (includeInactive?: boolean) => {
    const query = includeInactive ? '?include_inactive=true' : '';
    return request<InventoryMachine[]>(`/inventory-config/machines${query}`);
  },
  createInventoryMachine: (payload: { num1: string; mac: string; display_order?: number }) =>
    request<InventoryMachine>('/inventory-config/machines', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateInventoryMachine: (id: string, payload: { num1?: string; mac?: string; display_order?: number; is_active?: boolean }) =>
    request<InventoryMachine>(`/inventory-config/machines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteInventoryMachine: (id: string, permanent?: boolean) => {
    const query = permanent ? '?permanent=true' : '';
    return request<InventoryMachine>(`/inventory-config/machines/${id}${query}`, { method: 'DELETE' });
  },
  
  fetchInventoryContainers: (includeInactive?: boolean) => {
    const query = includeInactive ? '?include_inactive=true' : '';
    return request<InventoryContainer[]>(`/inventory-config/containers${query}`);
  },
  createInventoryContainer: (payload: { type: string; display_order?: number }) =>
    request<InventoryContainer>('/inventory-config/containers', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateInventoryContainer: (id: string, payload: { type?: string; display_order?: number; is_active?: boolean }) =>
    request<InventoryContainer>(`/inventory-config/containers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteInventoryContainer: (id: string, permanent?: boolean) => {
    const query = permanent ? '?permanent=true' : '';
    return request<InventoryContainer>(`/inventory-config/containers/${id}${query}`, { method: 'DELETE' });
  },
  
  fetchInventoryBags: (includeInactive?: boolean) => {
    const query = includeInactive ? '?include_inactive=true' : '';
    return request<InventoryBag[]>(`/inventory-config/bags${query}`);
  },
  createInventoryBag: (payload: { type: string; display_order?: number }) =>
    request<InventoryBag>('/inventory-config/bags', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateInventoryBag: (id: string, payload: { type?: string; display_order?: number; is_active?: boolean }) =>
    request<InventoryBag>(`/inventory-config/bags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteInventoryBag: (id: string, permanent?: boolean) => {
    const query = permanent ? '?permanent=true' : '';
    return request<InventoryBag>(`/inventory-config/bags/${id}${query}`, { method: 'DELETE' });
  },
  
  fetchInventoryOtherItems: (category?: string, includeInactive?: boolean) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (includeInactive) params.append('include_inactive', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<InventoryOtherItem[]>(`/inventory-config/other-items${query}`);
  },
  createInventoryOtherItem: (payload: {
    category: string;
    subcategory?: string;
    label: string;
    unit1?: string;
    unit2?: string;
    default_value1?: number;
    default_value2?: number;
    display_order?: number;
  }) =>
    request<InventoryOtherItem>('/inventory-config/other-items', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateInventoryOtherItem: (
    id: string,
    payload: {
      category?: string;
      subcategory?: string;
      label?: string;
      unit1?: string;
      unit2?: string;
      default_value1?: number;
      default_value2?: number;
      display_order?: number;
      is_active?: boolean;
    }
  ) =>
    request<InventoryOtherItem>(`/inventory-config/other-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteInventoryOtherItem: (id: string, permanent?: boolean) => {
    const query = permanent ? '?permanent=true' : '';
    return request<InventoryOtherItem>(`/inventory-config/other-items/${id}${query}`, { method: 'DELETE' });
  },
  
  // Inventory Snapshots API
  fetchInventorySnapshots: (params?: { year?: number; month?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.year) query.append('year', params.year.toString());
    if (params?.month) query.append('month', params.month.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<InventorySnapshot[]>(`/inventory-snapshots${suffix}`);
  },
  fetchInventorySnapshot: (id: string) => request<InventorySnapshot>(`/inventory-snapshots/${id}`),
  createInventorySnapshot: (payload: {
    report_date: string;
    report_date_label?: string;
    halle_data: any[];
    plastique_b_data: any[];
    cdt_data: any[];
    papier_data: any[];
    machines_data: any[];
    autres_data: any;
    containers_data: any[];
    bags_data: any[];
  }) =>
    request<InventorySnapshot>('/inventory-snapshots', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateInventorySnapshot: (
    id: string,
    payload: {
      report_date?: string;
      report_date_label?: string;
      halle_data?: any[];
      plastique_b_data?: any[];
      cdt_data?: any[];
      papier_data?: any[];
      machines_data?: any[];
      autres_data?: any;
      containers_data?: any[];
      bags_data?: any[];
    }
  ) =>
    request<InventorySnapshot>(`/inventory-snapshots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteInventorySnapshot: (id: string) => request<{ message: string }>(`/inventory-snapshots/${id}`, { method: 'DELETE' }),
  fetchAuditLogs: (params: { entity_type: string; entity_id?: string; limit?: number }) => {
    const searchParams = new URLSearchParams({ entity_type: params.entity_type });
    if (params.entity_id) {
      searchParams.set('entity_id', params.entity_id);
    }
    if (params.limit) {
      searchParams.set('limit', params.limit.toString());
    }
    return request<AuditLogEntry[]>(`/audit-logs?${searchParams.toString()}`);
  },
  fetchDashboardKpis: (params?: { period?: 'day' | 'week' | 'month' | 'year' }) => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set('period', params.period);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<{
      period: string;
      start_date: string;
      end_date: string;
      volumes: {
        total: number;
        halle_bb: number;
        plastique_balles: number;
        cdt_m3: number;
        papier_balles: number;
      };
      revenues: {
        estimated_total: number;
        by_material: Record<string, number>;
      };
      performance: {
        routes: {
          total: number;
          completed: number;
          completion_rate: number;
          avg_duration_minutes: number;
        };
        interventions: {
          total: number;
          completed: number;
          pending: number;
          completion_rate: number;
          avg_time_hours: number;
        };
        vehicle_fill_rate: number;
      };
      charts: {
        monthly_evolution: Array<{
          month: string;
          halle_bb: number;
          plastique_balles: number;
          cdt_m3: number;
          papier_balles: number;
        }>;
        material_distribution: {
          halle: number;
          plastique: number;
          cdt: number;
          papier: number;
        };
      };
      alerts: any[];
    }>(`/dashboard/kpis${suffix}`);
  },
  fetchLogisticsKpis: (params: { start?: string; end?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.start) searchParams.set('start', params.start);
    if (params.end) searchParams.set('end', params.end);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<{
      start: string;
      end: string;
      total_routes: number;
      completed_routes: number;
      status_breakdown: Record<string, number>;
      rotations_per_day: Record<string, number>;
      avg_fill_rate: number;
      avg_route_duration_minutes: number;
    }>(`/logistics/kpis${suffix}`);
  },
  // Véhicules
  createVehicle: (payload: { internal_number?: string; plate_number?: string }) =>
    request<{ id: string; message: string }>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateVehicle: (id: string, payload: { internal_number?: string; plate_number?: string }) =>
    request<{ message: string }>(`/vehicles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteVehicle: (id: string) => request<{ message: string }>(`/vehicles/${id}`, { method: 'DELETE' }),
  // Interventions
  fetchInterventions: (params?: { status?: string; priority?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.priority) query.append('priority', params.priority);
    return request<Intervention[]>(`/interventions${query.toString() ? `?${query.toString()}` : ''}`);
  },
  updateIntervention: (id: string, payload: { status?: string; priority?: string; assigned_to?: string; notes?: string }) =>
    request<{ message: string }>(`/interventions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteIntervention: (id: string) => request<{ message: string }>(`/interventions/${id}`, { method: 'DELETE' }),
  // Routes
  fetchRoutes: (params?: { date?: string }) => {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    return request<Route[]>('/routes' + (query.toString() ? `?${query.toString()}` : ''));
  },
  createRoute: (payload: { date: string; vehicle_id?: string; status?: string; path?: Array<[number, number]> }) =>
    request<{ id: string; message: string }>('/routes', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateRoute: (id: string, payload: { date?: string; vehicle_id?: string; status?: string; path?: Array<[number, number]> }) =>
    request<{ message: string }>(`/routes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  optimizeRouteById: (id: string, payload: { apply?: boolean; startTime?: string }) =>
    request<RouteOptimizationResponse>(`/routes/${id}/optimize`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteRoute: (id: string) => request<{ message: string }>(`/routes/${id}`, { method: 'DELETE' }),
  // Arrêts de route
  fetchRouteStopsByRoute: (routeId: string) => request<RouteStop[]>('/route-stops?route_id=' + routeId),
  createRouteStop: (payload: { route_id: string; customer_id?: string; order_index: number; estimated_time?: string; notes?: string }) =>
    request<{ id: string; message: string }>('/route-stops', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateRouteStop: (id: string, payload: { customer_id?: string; order_index?: number; estimated_time?: string; status?: string; notes?: string; completed_at?: string }) =>
    request<{ message: string }>(`/route-stops/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteRouteStop: (id: string) => request<{ message: string }>(`/route-stops/${id}`, { method: 'DELETE' }),
  // PDF Templates
  fetchPdfTemplates: () => request<PdfTemplate[]>('/pdf-templates'),
  fetchPdfTemplate: (module: string, cacheBust?: boolean) => 
    request<PdfTemplate>(`/pdf-templates/${module}${cacheBust ? `?t=${Date.now()}` : ''}`),
  updatePdfTemplate: (module: string, config: PdfTemplateConfig) =>
    request<PdfTemplate>(`/pdf-templates/${module}`, {
      method: 'PUT',
      body: JSON.stringify({ config })
    }),

  // Finance API
  fetchInvoices: (filters?: { status?: string; customer_id?: string; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.customer_id) params.set('customer_id', filters.customer_id);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<Invoice[]>(`/invoices${query ? `?${query}` : ''}`);
  },
  fetchInvoice: (id: string) => request<InvoiceDetail>(`/invoices/${id}`),
  createInvoice: (payload: CreateInvoicePayload) =>
    request<{ invoice: Invoice; message: string }>('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateInvoice: (id: string, payload: Partial<Invoice>) =>
    request<{ message: string }>(`/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteInvoice: (id: string) => request<{ message: string }>(`/invoices/${id}`, { method: 'DELETE' }),

  fetchQuotes: (filters?: { status?: string; customer_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.customer_id) params.set('customer_id', filters.customer_id);
    const query = params.toString();
    return request<Quote[]>(`/quotes${query ? `?${query}` : ''}`);
  },
  fetchQuote: (id: string) => request<QuoteDetail>(`/quotes/${id}`),
  createQuote: (payload: CreateQuotePayload) =>
    request<{ quote: Quote; message: string }>('/quotes', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateQuote: (id: string, payload: Partial<Quote>) =>
    request<{ message: string }>(`/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteQuote: (id: string) => request<{ message: string }>(`/quotes/${id}`, { method: 'DELETE' }),

  createPayment: (payload: CreatePaymentPayload) =>
    request<{ payment: Payment; message: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  fetchCustomerPricing: (filters?: { customer_id?: string; material_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.customer_id) params.set('customer_id', filters.customer_id);
    if (filters?.material_id) params.set('material_id', filters.material_id);
    const query = params.toString();
    return request<CustomerPricing[]>(`/customer-pricing${query ? `?${query}` : ''}`);
  },
  createCustomerPricing: (payload: CreateCustomerPricingPayload) =>
    request<{ pricing: CustomerPricing; message: string }>('/customer-pricing', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  fetchInterventionCosts: (intervention_id: string) =>
    request<InterventionCosts | null>(`/intervention-costs/${intervention_id}`),
  createInterventionCosts: (payload: CreateInterventionCostsPayload) =>
    request<{ costs?: InterventionCosts; message: string }>('/intervention-costs', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Stock Management API
  // Warehouses
  fetchWarehouses: () => request<Warehouse[]>('/stock/warehouses'),
  createWarehouse: (payload: CreateWarehousePayload) =>
    request<{ warehouse: Warehouse; message: string }>('/stock/warehouses', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateWarehouse: (id: string, payload: Partial<Warehouse>) =>
    request<{ message: string }>(`/stock/warehouses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteWarehouse: (id: string) => request<{ message: string }>(`/stock/warehouses/${id}`, { method: 'DELETE' }),

  // Stock Thresholds
  fetchStockThresholds: (filters?: { material_id?: string; warehouse_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.material_id) params.set('material_id', filters.material_id);
    if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
    const query = params.toString();
    return request<StockThreshold[]>(`/stock/thresholds${query ? `?${query}` : ''}`);
  },
  createStockThreshold: (payload: CreateStockThresholdPayload) =>
    request<{ threshold: StockThreshold; message: string }>('/stock/thresholds', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateStockThreshold: (id: string, payload: Partial<StockThreshold>) =>
    request<{ message: string }>(`/stock/thresholds/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteStockThreshold: (id: string) => request<{ message: string }>(`/stock/thresholds/${id}`, { method: 'DELETE' }),

  // Stock Lots
  fetchStockLots: (filters?: { material_id?: string; warehouse_id?: string; lot_number?: string }) => {
    const params = new URLSearchParams();
    if (filters?.material_id) params.set('material_id', filters.material_id);
    if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
    if (filters?.lot_number) params.set('lot_number', filters.lot_number);
    const query = params.toString();
    return request<StockLot[]>(`/stock/lots${query ? `?${query}` : ''}`);
  },
  createStockLot: (payload: CreateStockLotPayload) =>
    request<{ lot: StockLot; message: string }>('/stock/lots', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateStockLot: (id: string, payload: Partial<StockLot>) =>
    request<{ message: string }>(`/stock/lots/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteStockLot: (id: string) => request<{ message: string }>(`/stock/lots/${id}`, { method: 'DELETE' }),

  // Stock Movements
  fetchStockMovements: (filters?: {
    material_id?: string;
    warehouse_id?: string;
    lot_id?: string;
    movement_type?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.material_id) params.set('material_id', filters.material_id);
    if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
    if (filters?.lot_id) params.set('lot_id', filters.lot_id);
    if (filters?.movement_type) params.set('movement_type', filters.movement_type);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<StockMovement[]>(`/stock/movements${query ? `?${query}` : ''}`);
  },
  createStockMovement: (payload: CreateStockMovementPayload) =>
    request<{ movement: StockMovement; message: string }>('/stock/movements', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Stock Alerts
  fetchStockAlerts: (filters?: { material_id?: string; warehouse_id?: string; alert_type?: string; is_resolved?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.material_id) params.set('material_id', filters.material_id);
    if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
    if (filters?.alert_type) params.set('alert_type', filters.alert_type);
    if (filters?.is_resolved !== undefined) params.set('is_resolved', filters.is_resolved.toString());
    const query = params.toString();
    return request<StockAlert[]>(`/stock/alerts${query ? `?${query}` : ''}`);
  },
  resolveStockAlert: (id: string) =>
    request<{ message: string }>(`/stock/alerts/${id}/resolve`, {
      method: 'PATCH'
    }),

  // Stock Reconciliations
  fetchStockReconciliations: (filters?: {
    warehouse_id?: string;
    material_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
    if (filters?.material_id) params.set('material_id', filters.material_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<StockReconciliation[]>(`/stock/reconciliations${query ? `?${query}` : ''}`);
  },
  createStockReconciliation: (payload: CreateStockReconciliationPayload) =>
    request<{ reconciliation: StockReconciliation; message: string }>('/stock/reconciliations', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateStockReconciliation: (id: string, payload: Partial<StockReconciliation>) =>
    request<{ message: string }>(`/stock/reconciliations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Stock Valuations
  fetchStockValuations: (filters?: {
    material_id?: string;
    warehouse_id?: string;
    valuation_method?: string;
    valuation_date?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.material_id) params.set('material_id', filters.material_id);
    if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
    if (filters?.valuation_method) params.set('valuation_method', filters.valuation_method);
    if (filters?.valuation_date) params.set('valuation_date', filters.valuation_date);
    const query = params.toString();
    return request<StockValuation[]>(`/stock/valuations${query ? `?${query}` : ''}`);
  },
  calculateStockValuation: (payload: CalculateStockValuationPayload) =>
    request<{ valuation: StockValuation; message: string }>('/stock/valuations/calculate', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Stock Forecasts
  fetchStockForecasts: (filters?: { material_id?: string; warehouse_id?: string; forecast_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.material_id) params.set('material_id', filters.material_id);
    if (filters?.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
    if (filters?.forecast_date) params.set('forecast_date', filters.forecast_date);
    const query = params.toString();
    return request<StockForecast[]>(`/stock/forecasts${query ? `?${query}` : ''}`);
  },
  createStockForecast: (payload: CreateStockForecastPayload) =>
    request<{ forecast: StockForecast; message: string }>('/stock/forecasts', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateStockForecast: (id: string, payload: Partial<StockForecast>) =>
    request<{ message: string }>(`/stock/forecasts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteStockForecast: (id: string) => request<{ message: string }>(`/stock/forecasts/${id}`, { method: 'DELETE' }),

  // CRM API
  // Customer Interactions
  fetchCustomerInteractions: (customerId: string, filters?: { interaction_type?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.interaction_type) params.set('interaction_type', filters.interaction_type);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    const query = params.toString();
    return request<CustomerInteraction[]>(`/customers/${customerId}/interactions${query ? `?${query}` : ''}`);
  },
  createCustomerInteraction: (customerId: string, payload: CreateCustomerInteractionPayload) =>
    request<{ interaction: CustomerInteraction; message: string }>(`/customers/${customerId}/interactions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Customer Contracts
  fetchCustomerContracts: (customerId: string, filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return request<CustomerContract[]>(`/customers/${customerId}/contracts${query ? `?${query}` : ''}`);
  },
  createCustomerContract: (customerId: string, payload: CreateCustomerContractPayload) =>
    request<{ contract: CustomerContract; message: string }>(`/customers/${customerId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateContract: (id: string, payload: Partial<CustomerContract>) =>
    request<{ message: string }>(`/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Customer Opportunities
  fetchCustomerOpportunities: (customerId: string, filters?: { stage?: string }) => {
    const params = new URLSearchParams();
    if (filters?.stage) params.set('stage', filters.stage);
    const query = params.toString();
    return request<CustomerOpportunity[]>(`/customers/${customerId}/opportunities${query ? `?${query}` : ''}`);
  },
  fetchOpportunities: (filters?: { stage?: string; assigned_to?: string }) => {
    const params = new URLSearchParams();
    if (filters?.stage) params.set('stage', filters.stage);
    if (filters?.assigned_to) params.set('assigned_to', filters.assigned_to);
    const query = params.toString();
    return request<CustomerOpportunity[]>(`/opportunities${query ? `?${query}` : ''}`);
  },
  createCustomerOpportunity: (customerId: string, payload: CreateCustomerOpportunityPayload) =>
    request<{ opportunity: CustomerOpportunity; message: string }>(`/customers/${customerId}/opportunities`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateOpportunity: (id: string, payload: Partial<CustomerOpportunity>) =>
    request<{ message: string }>(`/opportunities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Customer Notes
  fetchCustomerNotes: (customerId: string, filters?: { note_type?: string; is_completed?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.note_type) params.set('note_type', filters.note_type);
    if (filters?.is_completed !== undefined) params.set('is_completed', filters.is_completed.toString());
    const query = params.toString();
    return request<CustomerNote[]>(`/customers/${customerId}/notes${query ? `?${query}` : ''}`);
  },
  fetchReminders: (daysAhead?: number) => {
    const params = new URLSearchParams();
    if (daysAhead) params.set('days_ahead', daysAhead.toString());
    const query = params.toString();
    return request<CustomerNote[]>(`/notes/reminders${query ? `?${query}` : ''}`);
  },
  createCustomerNote: (customerId: string, payload: CreateCustomerNotePayload) =>
    request<{ note: CustomerNote; message: string }>(`/customers/${customerId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateNote: (id: string, payload: Partial<CustomerNote>) =>
    request<{ message: string }>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteNote: (id: string) => request<{ message: string }>(`/notes/${id}`, { method: 'DELETE' }),

  // Customer Statistics
  fetchCustomerStatistics: (customerId: string, filters?: { period_start?: string; period_end?: string }) => {
    const params = new URLSearchParams();
    if (filters?.period_start) params.set('period_start', filters.period_start);
    if (filters?.period_end) params.set('period_end', filters.period_end);
    const query = params.toString();
    return request<CustomerStatistics>(`/customers/${customerId}/statistics${query ? `?${query}` : ''}`);
  },
  updateCustomerSegment: (customerId: string, payload: { segment?: 'A' | 'B' | 'C'; customer_type?: 'prospect' | 'client' | 'inactive' }) =>
    request<{ message: string }>(`/customers/${customerId}/segment`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Mobile App API
  // Intervention Photos
  fetchInterventionPhotos: (interventionId: string, filters?: { photo_type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.photo_type) params.set('photo_type', filters.photo_type);
    const query = params.toString();
    return request<InterventionPhoto[]>(`/interventions/${interventionId}/photos${query ? `?${query}` : ''}`);
  },
  fetchInterventionPhoto: (interventionId: string, photoId: string) =>
    request<InterventionPhoto>(`/interventions/${interventionId}/photos/${photoId}`),
  createInterventionPhoto: (interventionId: string, payload: CreateInterventionPhotoPayload) =>
    request<{ photo: InterventionPhoto; message: string }>(`/interventions/${interventionId}/photos`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteInterventionPhoto: (interventionId: string, photoId: string) =>
    request<{ message: string }>(`/interventions/${interventionId}/photos/${photoId}`, { method: 'DELETE' }),

  // Intervention Signatures
  fetchInterventionSignatures: (interventionId: string) =>
    request<InterventionSignature[]>(`/interventions/${interventionId}/signatures`),
  createInterventionSignature: (interventionId: string, payload: CreateInterventionSignaturePayload) =>
    request<{ signature: InterventionSignature; message: string }>(`/interventions/${interventionId}/signatures`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // QR Scans
  fetchInterventionScans: (interventionId: string) =>
    request<QRScan[]>(`/interventions/${interventionId}/scans`),
  createInterventionScan: (interventionId: string, payload: CreateQRScanPayload) =>
    request<{ scan: QRScan; message: string }>(`/interventions/${interventionId}/scans`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Voice Notes
  fetchInterventionVoiceNotes: (interventionId: string) =>
    request<VoiceNote[]>(`/interventions/${interventionId}/voice-notes`),
  fetchInterventionVoiceNote: (interventionId: string, noteId: string) =>
    request<VoiceNote>(`/interventions/${interventionId}/voice-notes/${noteId}`),
  createInterventionVoiceNote: (interventionId: string, payload: CreateVoiceNotePayload) =>
    request<{ voice_note: VoiceNote; message: string }>(`/interventions/${interventionId}/voice-notes`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Offline Sync
  syncOfflineData: (payload: { sync_items: Array<{ entity_type: string; action: string; payload: any }> }) =>
    request<{ results: any[]; message: string }>('/mobile/sync', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchSyncQueue: () => request<SyncQueueItem[]>('/mobile/sync-queue'),

  // Push Notifications
  getPushPublicKey: () => request<{ publicKey: string }>('/mobile/push-public-key'),
  registerPushToken: (payload: { subscription: PushSubscription; device_type?: string; device_info?: string; employee_id?: string }) =>
    request<{ message: string }>('/mobile/push-token', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  sendPushNotification: (payload: { user_id?: string; employee_id?: string; title: string; body: string; data?: any; url?: string }) =>
    request<{ message: string; results: any[] }>('/mobile/send-notification', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Geolocation
  updateInterventionGeolocation: (interventionId: string, payload: { latitude: number; longitude: number; location_type: 'arrival' | 'completion' | 'current' }) =>
    request<{ message: string }>(`/interventions/${interventionId}/geolocation`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Timing
  updateInterventionTiming: (interventionId: string, payload: { start_time?: string; end_time?: string }) =>
    request<{ message: string }>(`/interventions/${interventionId}/timing`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Alerts & Notifications
  fetchAlerts: (filters?: { category?: string; severity?: string; is_resolved?: boolean; assigned_to?: string; entity_type?: string; entity_id?: string }) => {
    const query = new URLSearchParams();
    if (filters?.category) query.append('category', filters.category);
    if (filters?.severity) query.append('severity', filters.severity);
    if (filters?.is_resolved !== undefined) query.append('is_resolved', String(filters.is_resolved));
    if (filters?.assigned_to) query.append('assigned_to', filters.assigned_to);
    if (filters?.entity_type) query.append('entity_type', filters.entity_type);
    if (filters?.entity_id) query.append('entity_id', filters.entity_id);
    return request<Alert[]>(`/alerts${query.toString() ? `?${query.toString()}` : ''}`);
  },
  fetchAlert: (alertId: string) => request<Alert>(`/alerts/${alertId}`),
  createAlert: (payload: CreateAlertPayload) =>
    request<{ alert: Alert; message: string }>('/alerts', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateAlert: (alertId: string, payload: UpdateAlertPayload) =>
    request<{ message: string }>(`/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  resolveAlert: (alertId: string, resolvedNotes?: string) =>
    request<{ message: string }>(`/alerts/${alertId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolved_notes: resolvedNotes })
    }),
  deleteAlert: (alertId: string) => request<{ message: string }>(`/alerts/${alertId}`, { method: 'DELETE' }),
  sendAlertNotifications: (alertId: string, payload: { notification_types?: string[]; recipient_ids?: string[]; recipient_roles?: string[] }) =>
    request<{ notifications: any[]; message: string }>(`/alerts/${alertId}/notify`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchNotifications: (filters?: { status?: string; notification_type?: string; unread_only?: boolean }) => {
    const query = new URLSearchParams();
    if (filters?.status) query.append('status', filters.status);
    if (filters?.notification_type) query.append('notification_type', filters.notification_type);
    if (filters?.unread_only) query.append('unread_only', 'true');
    return request<Notification[]>(`/notifications${query.toString() ? `?${query.toString()}` : ''}`);
  },
  markNotificationAsRead: (notificationId: string) =>
    request<{ message: string }>(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
  fetchNotificationPreferences: () => request<NotificationPreference[]>('/notification-preferences'),
  updateNotificationPreferences: (preferences: Array<{ alert_category: string; notification_type: string; enabled: boolean }>) =>
    request<{ message: string }>('/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences })
    }),
  fetchAlertCategoryRecipients: () => request<AlertCategoryRecipient[]>('/alert-category-recipients'),
  createAlertCategoryRecipient: (payload: CreateAlertCategoryRecipientPayload) =>
    request<AlertCategoryRecipient>('/alert-category-recipients', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateAlertCategoryRecipient: (id: string, payload: UpdateAlertCategoryRecipientPayload) =>
    request<AlertCategoryRecipient>(`/alert-category-recipients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteAlertCategoryRecipient: (id: string) =>
    request<{ message: string }>(`/alert-category-recipients/${id}`, { method: 'DELETE' }),

  // Reports & Analytics
  fetchWeeklyReport: (filters?: { period?: string; startDate?: string; endDate?: string; department?: string; team?: string; materialType?: string }) => {
    const params = new URLSearchParams();
    if (filters?.period) params.set('period', filters.period);
    if (filters?.startDate) params.set('start_date', filters.startDate);
    if (filters?.endDate) params.set('end_date', filters.endDate);
    if (filters?.department) params.set('department', filters.department);
    if (filters?.team) params.set('team', filters.team);
    if (filters?.materialType) params.set('material_type', filters.materialType);
    const query = params.toString();
    return request<WeeklyReport>(`/reports/weekly${query ? `?${query}` : ''}`);
  },
  fetchMonthlyReport: (filters?: { period?: string; startDate?: string; endDate?: string; department?: string; team?: string; materialType?: string }) => {
    const params = new URLSearchParams();
    if (filters?.period) params.set('period', filters.period);
    if (filters?.startDate) params.set('start_date', filters.startDate);
    if (filters?.endDate) params.set('end_date', filters.endDate);
    if (filters?.department) params.set('department', filters.department);
    if (filters?.team) params.set('team', filters.team);
    if (filters?.materialType) params.set('material_type', filters.materialType);
    const query = params.toString();
    return request<MonthlyReport>(`/reports/monthly${query ? `?${query}` : ''}`);
  },
  fetchRegulatoryReport: (filters?: { period?: string; startDate?: string; endDate?: string; department?: string; team?: string; materialType?: string }) => {
    const params = new URLSearchParams();
    if (filters?.period) params.set('period', filters.period);
    if (filters?.startDate) params.set('start_date', filters.startDate);
    if (filters?.endDate) params.set('end_date', filters.endDate);
    const query = params.toString();
    return request<RegulatoryReport>(`/reports/regulatory${query ? `?${query}` : ''}`);
  },
  fetchPerformanceReport: (filters?: { period?: string; startDate?: string; endDate?: string; department?: string; team?: string; materialType?: string }) => {
    const params = new URLSearchParams();
    if (filters?.period) params.set('period', filters.period);
    if (filters?.startDate) params.set('start_date', filters.startDate);
    if (filters?.endDate) params.set('end_date', filters.endDate);
    if (filters?.department) params.set('department', filters.department);
    if (filters?.team) params.set('team', filters.team);
    const query = params.toString();
    return request<PerformanceReport>(`/reports/performance${query ? `?${query}` : ''}`);
  },
  fetchPredictiveAnalysis: (filters?: { period?: string; startDate?: string; endDate?: string; department?: string; team?: string; materialType?: string }) => {
    const params = new URLSearchParams();
    if (filters?.period) params.set('period', filters.period);
    const query = params.toString();
    return request<PredictiveAnalysis>(`/reports/predictive${query ? `?${query}` : ''}`);
  },
  exportReport: (payload: { reportType: string; format: 'excel' | 'pdf'; filters?: any }) =>
    request<{ downloadUrl: string; message: string }>('/reports/export', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  scheduleReport: (payload: { reportType: string; frequency: 'weekly' | 'monthly'; recipients: string[]; filters?: any }) =>
    request<{ message: string }>('/reports/schedule', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Compliance & Traceability
  fetchWasteTrackingSlips: (filters?: { status?: string; producer_id?: string; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.producer_id) params.set('producer_id', filters.producer_id);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<WasteTrackingSlip[]>(`/compliance/waste-tracking-slips${query ? `?${query}` : ''}`);
  },
  createWasteTrackingSlip: (payload: CreateWasteTrackingSlipPayload) =>
    request<{ slip: WasteTrackingSlip }>('/compliance/waste-tracking-slips', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchTreatmentCertificates: (filters?: { customer_id?: string; compliance_status?: string; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.customer_id) params.set('customer_id', filters.customer_id);
    if (filters?.compliance_status) params.set('compliance_status', filters.compliance_status);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<TreatmentCertificate[]>(`/compliance/treatment-certificates${query ? `?${query}` : ''}`);
  },
  createTreatmentCertificate: (payload: CreateTreatmentCertificatePayload) =>
    request<{ certificate: TreatmentCertificate }>('/compliance/treatment-certificates', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchTraceabilityChain: (filters?: { slip_id?: string; chain_reference?: string; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.slip_id) params.set('slip_id', filters.slip_id);
    if (filters?.chain_reference) params.set('chain_reference', filters.chain_reference);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<TraceabilityLink[]>(`/compliance/traceability-chain${query ? `?${query}` : ''}`);
  },
  createTraceabilityLink: (payload: CreateTraceabilityLinkPayload) =>
    request<{ link: TraceabilityLink }>('/compliance/traceability-chain', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchComplianceChecks: (filters?: { entity_type?: string; entity_id?: string; check_status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    if (filters?.entity_id) params.set('entity_id', filters.entity_id);
    if (filters?.check_status) params.set('check_status', filters.check_status);
    const query = params.toString();
    return request<ComplianceCheck[]>(`/compliance/compliance-checks${query ? `?${query}` : ''}`);
  },
  fetchRegulatoryDocuments: (filters?: { document_type?: string; related_entity_type?: string; related_entity_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.document_type) params.set('document_type', filters.document_type);
    if (filters?.related_entity_type) params.set('related_entity_type', filters.related_entity_type);
    if (filters?.related_entity_id) params.set('related_entity_id', filters.related_entity_id);
    const query = params.toString();
    return request<RegulatoryDocument[]>(`/compliance/regulatory-documents${query ? `?${query}` : ''}`);
  },

  // Logistics Optimization
  optimizeRoute: (payload: { route_id?: string; customer_ids: string[]; vehicle_id?: string; algorithm?: string; constraints?: any }) =>
    request<{ optimized_route: OptimizedRoute; optimized_order: any[]; metrics: RouteOptimizationMetrics }>('/logistics/optimize-route', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  simulateScenario: (payload: CreateScenarioPayload) =>
    request<{ scenario: RouteScenario }>('/logistics/simulate-scenario', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchScenarios: (filters?: { scenario_type?: string; is_applied?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.scenario_type) params.set('scenario_type', filters.scenario_type);
    if (filters?.is_applied !== undefined) params.set('is_applied', filters.is_applied.toString());
    const query = params.toString();
    return request<RouteScenario[]>(`/logistics/scenarios${query ? `?${query}` : ''}`);
  },
  optimizeLoad: (payload: { route_id?: string; vehicle_id: string; stops_data: Array<{ weight_kg?: number; volume_m3?: number }> }) =>
    request<{ optimization: VehicleLoadOptimization; metrics: LoadOptimizationMetrics }>('/logistics/optimize-load', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchDemandForecasts: (filters?: { zone_id?: string; material_type?: string; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.zone_id) params.set('zone_id', filters.zone_id);
    if (filters?.material_type) params.set('material_type', filters.material_type);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<DemandForecast[]>(`/logistics/demand-forecast${query ? `?${query}` : ''}`);
  },
  createDemandForecast: (payload: CreateDemandForecastPayload) =>
    request<{ forecast: DemandForecast }>('/logistics/demand-forecast', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchRealTimeTracking: (filters?: { route_id?: string; vehicle_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.route_id) params.set('route_id', filters.route_id);
    if (filters?.vehicle_id) params.set('vehicle_id', filters.vehicle_id);
    const query = params.toString();
    return request<RealTimeTracking[]>(`/logistics/real-time-tracking${query ? `?${query}` : ''}`);
  },
  updateRealTimeTracking: (payload: UpdateRealTimeTrackingPayload) =>
    request<{ tracking: RealTimeTracking }>('/logistics/real-time-tracking', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchRoutingConstraints: (filters?: { constraint_type?: string; is_active?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.constraint_type) params.set('constraint_type', filters.constraint_type);
    if (filters?.is_active !== undefined) params.set('is_active', filters.is_active.toString());
    const query = params.toString();
    return request<RoutingConstraint[]>(`/logistics/routing-constraints${query ? `?${query}` : ''}`);
  },
  createRoutingConstraint: (payload: CreateRoutingConstraintPayload) =>
    request<{ constraint: RoutingConstraint }>('/logistics/routing-constraints', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Suppliers Management
  fetchSuppliers: (filters?: { supplier_type?: string; is_active?: boolean; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.supplier_type) params.set('supplier_type', filters.supplier_type);
    if (filters?.is_active !== undefined) params.set('is_active', filters.is_active.toString());
    if (filters?.search) params.set('search', filters.search);
    const query = params.toString();
    return request<Supplier[]>(`/suppliers${query ? `?${query}` : ''}`);
  },
  createSupplier: (payload: CreateSupplierPayload) =>
    request<{ supplier: Supplier }>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateSupplier: (id: string, payload: Partial<CreateSupplierPayload>) =>
    request<{ supplier: Supplier }>(`/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteSupplier: (id: string) =>
    request<{ message: string }>(`/suppliers/${id}`, { method: 'DELETE' }),
  fetchSupplierEvaluations: (supplierId: string) =>
    request<SupplierEvaluation[]>(`/suppliers/${supplierId}/evaluations`),
  createSupplierEvaluation: (supplierId: string, payload: CreateSupplierEvaluationPayload) =>
    request<{ evaluation: SupplierEvaluation }>(`/suppliers/${supplierId}/evaluations`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchSupplierOrders: (filters?: { supplier_id?: string; status?: string; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.supplier_id) params.set('supplier_id', filters.supplier_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<SupplierOrder[]>(`/supplier-orders${query ? `?${query}` : ''}`);
  },
  createSupplierOrder: (payload: CreateSupplierOrderPayload) =>
    request<{ order: SupplierOrder }>('/supplier-orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  receiveSupplierOrder: (orderId: string, payload: ReceiveSupplierOrderPayload) =>
    request<{ reception: SupplierReception }>(`/supplier-orders/${orderId}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchSupplierInvoices: (filters?: { supplier_id?: string; status?: string; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    if (filters?.supplier_id) params.set('supplier_id', filters.supplier_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    const query = params.toString();
    return request<SupplierInvoice[]>(`/supplier-invoices${query ? `?${query}` : ''}`);
  },
  createSupplierInvoice: (payload: CreateSupplierInvoicePayload) =>
    request<{ invoice: SupplierInvoice }>('/supplier-invoices', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  paySupplierInvoice: (invoiceId: string, payload: PaySupplierInvoicePayload) =>
    request<{ invoice: SupplierInvoice }>(`/supplier-invoices/${invoiceId}/pay`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  fetchTenderCalls: (filters?: { status?: string; tender_type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.tender_type) params.set('tender_type', filters.tender_type);
    const query = params.toString();
    return request<TenderCall[]>(`/tender-calls${query ? `?${query}` : ''}`);
  },
  createTenderCall: (payload: CreateTenderCallPayload) =>
    request<{ tender: TenderCall }>('/tender-calls', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchTenderOffers: (tenderCallId: string) =>
    request<TenderOffer[]>(`/tender-calls/${tenderCallId}/offers`),
  submitTenderOffer: (tenderCallId: string, payload: SubmitTenderOfferPayload) =>
    request<{ offer: TenderOffer }>(`/tender-calls/${tenderCallId}/offers`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  evaluateTenderOffer: (offerId: string, payload: EvaluateTenderOfferPayload) =>
    request<{ offer: TenderOffer }>(`/tender-offers/${offerId}/evaluate`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Document Management (GED)
  fetchDocuments: (filters?: { category?: string; status?: string; search?: string; tag?: string }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.tag) params.set('tag', filters.tag);
    const query = params.toString();
    return request<Document[]>(`/documents${query ? `?${query}` : ''}`);
  },
  fetchDocument: (id: string) =>
    request<DocumentDetail>(`/documents/${id}`),
  createDocument: (payload: CreateDocumentPayload) =>
    request<Document>('/documents', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateDocument: (id: string, payload: Partial<CreateDocumentPayload>) =>
    request<Document>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  deleteDocument: (id: string) =>
    request<{ message: string }>(`/documents/${id}`, { method: 'DELETE' }),
  createDocumentVersion: (id: string, payload: CreateDocumentVersionPayload) =>
    request<DocumentVersion>(`/documents/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  approveDocument: (id: string, payload: { comments?: string }) =>
    request<{ message: string }>(`/documents/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  rejectDocument: (id: string, payload: { comments?: string }) =>
    request<{ message: string }>(`/documents/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  archiveDocument: (id: string) =>
    request<{ message: string }>(`/documents/${id}/archive`, {
      method: 'POST'
    }),
  fetchDocumentAccessLogs: (id: string) =>
    request<DocumentAccessLog[]>(`/documents/${id}/access-logs`),
  fetchDocumentRetentionRules: () =>
    request<DocumentRetentionRule[]>('/document-retention-rules'),
  createDocumentRetentionRule: (payload: CreateDocumentRetentionRulePayload) =>
    request<DocumentRetentionRule>('/document-retention-rules', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // External Integrations
  fetchIntegrations: (filters?: { type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    const query = params.toString();
    return request<ExternalIntegration[]>(`/integrations${query ? `?${query}` : ''}`);
  },
  fetchIntegration: (id: string) =>
    request<ExternalIntegration>(`/integrations/${id}`),
  createIntegration: (payload: CreateIntegrationPayload) =>
    request<ExternalIntegration>('/integrations', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateIntegration: (id: string, payload: Partial<CreateIntegrationPayload>) =>
    request<ExternalIntegration>(`/integrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  deleteIntegration: (id: string) =>
    request<{ message: string }>(`/integrations/${id}`, { method: 'DELETE' }),
  testIntegration: (id: string) =>
    request<{ success: boolean; executionTime?: number; error?: string }>(`/integrations/${id}/test`, {
      method: 'POST'
    }),
  fetchIntegrationLogs: (id: string, limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    return request<IntegrationLog[]>(`/integrations/${id}/logs${query ? `?${query}` : ''}`);
  },

  // Webhooks
  fetchWebhooks: (filters?: { event_type?: string }) => {
    const params = new URLSearchParams();
    if (filters?.event_type) params.set('event_type', filters.event_type);
    const query = params.toString();
    return request<Webhook[]>(`/webhooks${query ? `?${query}` : ''}`);
  },
  createWebhook: (payload: CreateWebhookPayload) =>
    request<Webhook>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateWebhook: (id: string, payload: Partial<CreateWebhookPayload>) =>
    request<Webhook>(`/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  deleteWebhook: (id: string) =>
    request<{ message: string }>(`/webhooks/${id}`, { method: 'DELETE' }),

  // ==========================================
  // GAMIFICATION ET MOTIVATION
  // ==========================================

  // Badges
  fetchBadges: (category?: string) =>
    request<Badge[]>(`/badges${category ? `?category=${category}` : ''}`),
  fetchEmployeeBadges: (employeeId: string) =>
    request<EmployeeBadge[]>(`/employees/${employeeId}/badges`),
  awardBadge: (employeeId: string, payload: AwardBadgePayload) =>
    request<EmployeeBadge>(`/employees/${employeeId}/badges`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Récompenses
  fetchRewards: () =>
    request<Reward[]>(`/rewards`),
  claimReward: (rewardId: string) =>
    request<RewardClaim>(`/rewards/${rewardId}/claim`, {
      method: 'POST'
    }),

  // Défis
  fetchChallenges: (active?: boolean) =>
    request<MonthlyChallenge[]>(`/challenges${active !== undefined ? `?active=${active}` : ''}`),
  fetchChallengeParticipants: (challengeId: string) =>
    request<ChallengeParticipant[]>(`/challenges/${challengeId}/participants`),
  createChallenge: (payload: CreateChallengePayload) =>
    request<MonthlyChallenge>(`/challenges`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Statistiques
  fetchEmployeeStatistics: (employeeId: string, periodType?: string) =>
    request<EmployeeStatistics | null>(`/employees/${employeeId}/statistics${periodType ? `?period_type=${periodType}` : ''}`),

  // Classements
  fetchLeaderboard: (type?: string, periodType?: string) =>
    request<Leaderboard>(`/leaderboards${type || periodType ? `?type=${type || 'points'}&period_type=${periodType || 'monthly'}` : '?type=points&period_type=monthly'}`),
  testWebhook: (id: string) =>
    request<{ success: boolean; statusCode?: number; executionTime?: number; error?: string }>(`/webhooks/${id}/test`, {
      method: 'POST'
    }),
  fetchWebhookLogs: (id: string, limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    const query = params.toString();
    return request<WebhookLog[]>(`/webhooks/${id}/logs${query ? `?${query}` : ''}`);
  },

  // ==========================================
  // RECHERCHE GLOBALE ET FILTRES AVANCÉS
  // ==========================================

  // Recherche globale
  globalSearch: (query: string, filters?: any) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (filters) {
      if (filters.types && filters.types.length > 0) {
        params.set('types', filters.types.join(','));
      }
      if (filters.dateRange?.start) {
        params.set('date_start', filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        params.set('date_end', filters.dateRange.end);
      }
      if (filters.status) {
        params.set('status', filters.status);
      }
      if (filters.department) {
        params.set('department', filters.department);
      }
    }
    return request<SearchResult[]>(`/search/global?${params.toString()}`);
  },

  // Recherche sémantique
  semanticSearch: (query: string, filters?: any) => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (filters) {
      if (filters.types && filters.types.length > 0) {
        params.set('types', filters.types.join(','));
      }
      if (filters.dateRange?.start) {
        params.set('date_start', filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        params.set('date_end', filters.dateRange.end);
      }
    }
    return request<SearchResult[]>(`/search/semantic?${params.toString()}`);
  },

  // Suggestions intelligentes
  searchSuggestions: (query: string) => {
    return request<string[]>(`/search/suggestions?q=${encodeURIComponent(query)}`);
  },

  // Filtres sauvegardables
  fetchSavedFilters: () =>
    request<SavedFilter[]>(`/search/saved-filters`),
  saveFilter: (payload: CreateSavedFilterPayload) =>
    request<SavedFilter>(`/search/saved-filters`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteSavedFilter: (id: string) =>
    request<void>(`/search/saved-filters/${id}`, {
      method: 'DELETE'
    }),
  updateSavedFilter: (id: string, payload: Partial<CreateSavedFilterPayload>) =>
    request<SavedFilter>(`/search/saved-filters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),

  // ==========================================
  // BUSINESS INTELLIGENCE (BI)
  // ==========================================

  // Data Warehouse - Analyses historiques
  fetchHistoricalData: (params: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    metrics?: string[];
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set('start_date', params.startDate);
    searchParams.set('end_date', params.endDate);
    if (params.dimensions) searchParams.set('dimensions', params.dimensions.join(','));
    if (params.metrics) searchParams.set('metrics', params.metrics.join(','));
    return request<HistoricalDataPoint[]>(`/bi/historical?${searchParams.toString()}`);
  },

  // Cubes OLAP - Analyses multidimensionnelles
  fetchOlapCube: (params: {
    cube: string;
    dimensions: string[];
    measures: string[];
    filters?: Record<string, any>;
  }) =>
    request<OlapCubeResult>(`/bi/olap`, {
      method: 'POST',
      body: JSON.stringify(params)
    }),

  // Machine Learning - Prédictions
  fetchDemandForecast: (params: {
    materialType?: string;
    horizon?: number; // jours
    startDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.materialType) searchParams.set('material_type', params.materialType);
    if (params.horizon) searchParams.set('horizon', params.horizon.toString());
    if (params.startDate) searchParams.set('start_date', params.startDate);
    return request<ForecastData[]>(`/bi/forecast/demand?${searchParams.toString()}`);
  },

  // Détection d'anomalies
  fetchAnomalies: (params: {
    startDate: string;
    endDate: string;
    entityType?: string;
    threshold?: number;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.set('start_date', params.startDate);
    searchParams.set('end_date', params.endDate);
    if (params.entityType) searchParams.set('entity_type', params.entityType);
    if (params.threshold) searchParams.set('threshold', params.threshold.toString());
    return request<Anomaly[]>(`/bi/anomalies?${searchParams.toString()}`);
  },

  // Drill-down - Navigation hiérarchique
  fetchDrillDown: (params: {
    level: string;
    parentId?: string;
    dimension: string;
    measure: string;
    filters?: Record<string, any>;
  }) =>
    request<DrillDownResult>(`/bi/drill-down`, {
      method: 'POST',
      body: JSON.stringify(params)
    }),

  // Sécurité renforcée - 2FA
  setup2FA: () => request<TwoFactorSetup>('/security/2fa/setup', { method: 'POST' }),
  enable2FA: (payload: { code: string }) =>
    request<{ message: string }>('/security/2fa/enable', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  disable2FA: (payload: { password: string }) =>
    request<{ message: string }>('/security/2fa/disable', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  regenerateBackupCodes: () =>
    request<{ backupCodes: string[] }>('/security/2fa/regenerate-backup-codes', { method: 'POST' }),

  // Sécurité renforcée - 2FA Admin (pour gérer le 2FA d'autres utilisateurs)
  setup2FAForUser: (userId: string) =>
    request<TwoFactorSetup>(`/security/2fa/admin/setup/${userId}`, { method: 'POST' }),
  enable2FAForUser: (userId: string, payload: { code: string }) =>
    request<{ message: string }>(`/security/2fa/admin/enable/${userId}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  disable2FAForUser: (userId: string) =>
    request<{ message: string }>(`/security/2fa/admin/disable/${userId}`, { method: 'POST' }),
  get2FAStatusForUser: (userId: string) =>
    request<{ enabled: boolean }>(`/security/2fa/admin/status/${userId}`),

  // Sécurité renforcée - Sessions
  fetchSessions: () => request<UserSession[]>('/security/sessions'),
  deleteSession: (sessionId: string) =>
    request<{ message: string }>(`/security/sessions/${sessionId}`, { method: 'DELETE' }),
  logoutOtherSessions: () =>
    request<{ message: string }>('/security/sessions/logout-others', { method: 'POST' }),

  // Sécurité renforcée - RGPD
  fetchGDPRConsents: () => request<GDPRConsent[]>('/security/gdpr/consents'),
  updateGDPRConsent: (payload: { consent_type: string; granted: boolean }) =>
    request<{ message: string }>('/security/gdpr/consents', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  createGDPRRequest: (payload: { request_type: string; notes?: string }) =>
    request<GDPRDataRequest>('/security/gdpr/requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchGDPRRequests: () => request<GDPRDataRequest[]>('/security/gdpr/requests'),

  // Sécurité renforcée - Logs d'audit (version améliorée avec IP, user agent, etc.)
  fetchSecurityAuditLogs: (filters?: {
    entity_type?: string;
    entity_id?: string;
    action?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    if (filters?.entity_id) params.set('entity_id', filters.entity_id);
    if (filters?.action) params.set('action', filters.action);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    if (filters?.limit) params.set('limit', filters.limit.toString());
    const query = params.toString();
    return request<AuditLog[]>(`/security/audit-logs${query ? `?${query}` : ''}`);
  },

  // Multilingue et Multi-sites - Sites
  fetchSites: () => request<any[]>('/sites'),
  createSite: (payload: {
    code: string;
    name: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    currency?: string;
  }) =>
    request<any>('/sites', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateSite: (id: string, payload: {
    code?: string;
    name?: string;
    address?: string;
    city?: string;
    postal_code?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    currency?: string;
    is_active?: boolean;
  }) =>
    request<any>(`/sites/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteSite: (id: string) =>
    request<{ message: string }>(`/sites/${id}`, { method: 'DELETE' }),

  // Multilingue et Multi-sites - Devises
  fetchCurrencies: () => request<any[]>('/currencies'),
  createCurrency: (payload: {
    code: string;
    name: string;
    symbol: string;
    exchange_rate?: number;
    is_base?: boolean;
  }) =>
    request<any>('/currencies', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateCurrency: (id: string, payload: {
    code?: string;
    name?: string;
    symbol?: string;
    exchange_rate?: number;
    is_base?: boolean;
    is_active?: boolean;
  }) =>
    request<any>(`/currencies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Multilingue et Multi-sites - Taux de change
  fetchCurrencyRates: (filters?: {
    from?: string;
    to?: string;
    date?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.date) params.set('date', filters.date);
    return request<any[]>(`/currency-rates?${params.toString()}`);
  },
  createCurrencyRate: (payload: {
    from_currency: string;
    to_currency: string;
    rate: number;
    effective_date?: string;
  }) =>
    request<any>('/currency-rates', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Multilingue et Multi-sites - Consolidation
  fetchSiteConsolidations: (filters: {
    start_date: string;
    end_date: string;
    metric_type?: string;
  }) => {
    const params = new URLSearchParams();
    params.set('start_date', filters.start_date);
    params.set('end_date', filters.end_date);
    if (filters.metric_type) params.set('metric_type', filters.metric_type);
    return request<any[]>(`/sites/consolidation?${params.toString()}`);
  },
  createSiteConsolidation: (payload: {
    consolidation_date: string;
    site_id: string;
    metric_type: string;
    metric_value: number;
    currency?: string;
  }) =>
    request<any>('/sites/consolidation', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Multilingue et Multi-sites - Préférences utilisateur
  updateUserPreferences: (payload: {
    language?: string;
    timezone?: string;
    currency?: string;
    site_id?: string;
  }) =>
    request<any>('/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // ===== RH avancé - Chauffeurs =====
  fetchDriverDuty: (employeeId: string, start_date?: string, end_date?: string) =>
    request<DriverDutyRecord[]>(`/api/hr/employees/${employeeId}/driver-duty${buildQuery({ start_date, end_date })}`),
  fetchDriverDutyRecords: async (employeeId: string, start_date?: string, end_date?: string) => {
    const records = await Api.fetchDriverDuty(employeeId, start_date, end_date);
    return records.map((r: DriverDutyRecord) => ({
      ...r,
      total_hours: (r as any).total_hours ?? r.duty_hours ?? 0,
      break_minutes: (r as any).break_minutes ?? r.breaks_minutes ?? 0,
      is_compliant: (r as any).is_compliant ?? r.legal_ok ?? false
    }));
  },
  upsertDriverDuty: (employeeId: string, payload: Partial<DriverDutyRecord>) =>
    request<DriverDutyRecord>(`/api/hr/employees/${employeeId}/driver-duty`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchDriverIncidents: (employeeId: string) =>
    request<DriverIncident[]>(`/api/hr/employees/${employeeId}/driver-incidents`),
  createDriverIncident: (employeeId: string, payload: Omit<DriverIncident, 'id' | 'employee_id' | 'created_at'>) =>
    request<DriverIncident>(`/api/hr/employees/${employeeId}/driver-incidents`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchEcoDriving: (employeeId: string) =>
    request<EcoDrivingScore[]>(`/api/hr/employees/${employeeId}/eco-driving`),
  fetchEcoDrivingScores: async (employeeId: string) => {
    const scores = await Api.fetchEcoDriving(employeeId);
    return scores.map((s: EcoDrivingScore) => ({
      ...s,
      period_start: (s as any).period_start || s.created_at,
      period_end: (s as any).period_end || s.created_at,
      fuel_consumption_l_per_100km: s.fuel_consumption ?? (s as any).fuel_consumption_l_per_100km ?? null
    }));
  },
  createEcoDriving: (employeeId: string, payload: Omit<EcoDrivingScore, 'id' | 'employee_id' | 'created_at'>) =>
    request<EcoDrivingScore>(`/api/hr/employees/${employeeId}/eco-driving`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // ===== RH avancé - Recrutement =====
  fetchJobPositions: () => request<JobPosition[]>('/api/hr/recruitment/positions'),
  createJobPosition: (payload: Partial<JobPosition>) =>
    request<JobPosition>('/api/hr/recruitment/positions', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchJobApplicants: (params?: { position_id?: string; status?: string }) =>
    request<JobApplicant[]>(`/api/hr/recruitment/applicants${buildQuery(params || {})}`),
  createJobApplicant: (payload: Partial<JobApplicant>) =>
    request<JobApplicant>('/api/hr/recruitment/applicants', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateJobApplicant: (id: string, payload: { status?: string; score?: number }) =>
    request<JobApplicant>(`/api/hr/recruitment/applicants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  fetchApplicantTests: (applicantId?: string) => {
    if (applicantId) {
      return request<ApplicantTest[]>(`/api/hr/recruitment/applicants/${applicantId}/tests`);
    }
    // Si aucun applicantId, charger tous les tests pour tous les candidats
    return Api.fetchJobApplicants({}).then(async (applicants) => {
      const allTests: ApplicantTest[] = [];
      for (const app of applicants) {
        try {
          const tests = await request<ApplicantTest[]>(`/api/hr/recruitment/applicants/${app.id}/tests`);
          allTests.push(...tests);
        } catch {
          // Ignore errors for individual applicants
        }
      }
      return allTests;
    });
  },
  createApplicantTest: (applicantId: string, payload: Partial<ApplicantTest>) =>
    request<ApplicantTest>(`/api/hr/recruitment/applicants/${applicantId}/tests`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // ===== RH avancé - Formations continues =====
  fetchTrainingModules: () => request<TrainingModule[]>('/api/hr/training/modules'),
  createTrainingModule: (payload: Partial<TrainingModule>) =>
    request<TrainingModule>('/api/hr/training/modules', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchTrainingProgress: (employeeId?: string) => {
    if (employeeId) {
      return request<TrainingProgress[]>(`/api/hr/employees/${employeeId}/training-progress`);
    }
    // Si aucun employeeId, charger toute la progression pour tous les employés
    return Api.fetchEmployees().then(async (employees) => {
      const allProgress: TrainingProgress[] = [];
      for (const emp of employees) {
        try {
          const progress = await request<TrainingProgress[]>(`/api/hr/employees/${emp.id}/training-progress`);
          allProgress.push(...progress);
        } catch {
          // Ignore errors for individual employees
        }
      }
      return allProgress;
    });
  },
  upsertTrainingProgress: (employeeId: string, payload: Partial<TrainingProgress>) =>
    request<TrainingProgress>(`/api/hr/employees/${employeeId}/training-progress`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  generateTrainingReminders: () =>
    request<{ created: number }>('/api/hr/training/reminders/generate', {
      method: 'POST'
    }),
  fetchTrainingReminders: () => request<TrainingReminder[]>('/api/hr/training/reminders'),

  // ===== RH avancé - Paie / contrats =====
  fetchContracts: (params?: { employee_id?: string; status?: string }) =>
    request<EmploymentContract[]>(`/api/hr/contracts${buildQuery(params || {})}`),
  fetchEmploymentContracts: (params?: { employee_id?: string; status?: string }) =>
    Api.fetchContracts(params),
  createContract: (payload: Partial<EmploymentContract>) =>
    request<EmploymentContract>('/api/hr/contracts', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  createEmploymentContract: (payload: Partial<EmploymentContract>) => Api.createContract(payload),
  updateEmploymentContract: (id: string, payload: Partial<EmploymentContract>) =>
    request<EmploymentContract>(`/api/hr/contracts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deleteEmploymentContract: (id: string) =>
    request<{ message: string }>(`/api/hr/contracts/${id}`, {
      method: 'DELETE'
    }),
  fetchContractAllowances: (contractId?: string) => {
    if (contractId) {
      return request<ContractAllowance[]>(`/api/hr/contracts/${contractId}/allowances`);
    }
    // Si aucun contractId, charger toutes les indemnités pour tous les contrats
    return Api.fetchContracts({}).then(async (contracts) => {
      const allAllowances: ContractAllowance[] = [];
      for (const contract of contracts) {
        try {
          const allowances = await request<ContractAllowance[]>(`/api/hr/contracts/${contract.id}/allowances`);
          allAllowances.push(...allowances);
        } catch {
          // Ignore errors for individual contracts
        }
      }
      return allAllowances;
    });
  },
  createContractAllowance: (contractId: string, payload: Partial<ContractAllowance>) =>
    request<ContractAllowance>(`/api/hr/contracts/${contractId}/allowances`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchOvertime: (params?: { employee_id?: string; start_date?: string; end_date?: string }) =>
    request<OvertimeEntry[]>(`/api/hr/overtime${buildQuery(params || {})}`),
  fetchOvertimeEntries: (params?: { employee_id?: string; start_date?: string; end_date?: string }) =>
    Api.fetchOvertime(params),
  createOvertime: (payload: Partial<OvertimeEntry>) =>
    request<OvertimeEntry>('/api/hr/overtime', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchPayroll: (params?: { employee_id?: string; period_start?: string; period_end?: string }) =>
    request<PayrollEntry[]>(`/api/hr/payroll${buildQuery(params || {})}`),
  fetchPayrollEntries: (params?: { employee_id?: string; period_start?: string; period_end?: string }) =>
    Api.fetchPayroll(params),
  createPayroll: (payload: Partial<PayrollEntry>) =>
    request<PayrollEntry>('/api/hr/payroll', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  createPayrollEntry: (payload: Partial<PayrollEntry>) => Api.createPayroll(payload),
  updatePayrollEntry: (id: string, payload: Partial<PayrollEntry>) =>
    request<PayrollEntry>(`/api/hr/payroll/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  deletePayrollEntry: (id: string) =>
    request<{ message: string }>(`/api/hr/payroll/${id}`, {
      method: 'DELETE'
    }),

  // ===== RH avancé - Dashboard RH =====
  fetchHrDashboard: () => request<HrDashboard>('/api/hr/dashboard')
};

// Alert & Notification types
export type Alert = {
  id: string;
  alert_category: 'security' | 'operational' | 'financial' | 'hr';
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  related_data: any;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_notes: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAlertPayload = {
  alert_category: 'security' | 'operational' | 'financial' | 'hr';
  alert_type: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  related_data?: any;
  assigned_to?: string;
  due_date?: string;
};

export type UpdateAlertPayload = {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  title?: string;
  message?: string;
  assigned_to?: string;
  due_date?: string;
  related_data?: any;
};

export type Notification = {
  id: string;
  alert_id: string | null;
  notification_type: 'email' | 'sms' | 'push' | 'in_app';
  recipient_type: 'user' | 'employee' | 'role' | 'all';
  recipient_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  alert_title?: string;
  alert_category?: string;
  severity?: string;
};

export type NotificationPreference = {
  id: string;
  user_id: string;
  alert_category: string;
  notification_type: 'email' | 'sms' | 'push' | 'in_app';
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type AlertCategoryRecipient = {
  id: string;
  alert_category: 'security' | 'operational' | 'financial' | 'hr';
  recipient_type: 'email' | 'phone' | 'role' | 'department' | 'user';
  recipient_value: string;
  notification_types: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateAlertCategoryRecipientPayload = {
  alert_category: 'security' | 'operational' | 'financial' | 'hr';
  recipient_type: 'email' | 'phone' | 'role' | 'department' | 'user';
  recipient_value: string;
  notification_types?: string[];
  enabled?: boolean;
};

export type UpdateAlertCategoryRecipientPayload = {
  notification_types?: string[];
  enabled?: boolean;
};

// Mobile App types
export type InterventionPhoto = {
  id: string;
  intervention_id: string;
  photo_type: 'before' | 'after' | 'other';
  photo_data: string; // base64
  mime_type: string;
  file_size: number | null;
  latitude: number | null;
  longitude: number | null;
  taken_at: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type CreateInterventionPhotoPayload = {
  photo_type: 'before' | 'after' | 'other';
  photo_data: string; // base64
  mime_type?: string;
  file_size?: number;
  latitude?: number;
  longitude?: number;
};

export type InterventionSignature = {
  id: string;
  intervention_id: string;
  signature_type: 'customer' | 'operator' | 'witness';
  signature_data: string; // base64
  signer_name: string | null;
  signer_role: string | null;
  signed_at: string;
  latitude: number | null;
  longitude: number | null;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
};

export type CreateInterventionSignaturePayload = {
  signature_type: 'customer' | 'operator' | 'witness';
  signature_data: string; // base64
  signer_name?: string;
  signer_role?: string;
  latitude?: number;
  longitude?: number;
  ip_address?: string;
  device_info?: string;
};

export type QRScan = {
  id: string;
  intervention_id: string | null;
  scan_type: 'qr_code' | 'barcode' | 'nfc';
  code_value: string;
  code_format: string | null;
  material_id: string | null;
  lot_id: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  scanned_at: string;
  scanned_by: string | null;
  scanned_by_name: string | null;
  device_info: string | null;
  created_at: string;
};

export type CreateQRScanPayload = {
  scan_type: 'qr_code' | 'barcode' | 'nfc';
  code_value: string;
  code_format?: string;
  material_id?: string;
  lot_id?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  device_info?: string;
};

export type VoiceNote = {
  id: string;
  intervention_id: string;
  audio_data: string; // base64
  mime_type: string;
  duration_seconds: number | null;
  transcription: string | null;
  latitude: number | null;
  longitude: number | null;
  recorded_at: string;
  recorded_by: string | null;
  recorded_by_name: string | null;
  created_at: string;
};

export type CreateVoiceNotePayload = {
  audio_data: string; // base64
  mime_type?: string;
  duration_seconds?: number;
  transcription?: string;
  latitude?: number;
  longitude?: number;
};

export type SyncQueueItem = {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  action: 'create' | 'update' | 'delete';
  payload: any;
  status: 'pending' | 'synced' | 'failed';
  error_message: string | null;
  retry_count: number;
  created_at: string;
  synced_at: string | null;
};

// Stock Management types
export type Warehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  is_depot: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateWarehousePayload = {
  code: string;
  name: string;
  address?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  is_depot?: boolean;
  notes?: string;
};

export type StockThreshold = {
  id: string;
  material_id: string;
  warehouse_id: string;
  min_quantity: number;
  max_quantity: number | null;
  alert_enabled: boolean;
  unit: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateStockThresholdPayload = {
  material_id: string;
  warehouse_id: string;
  min_quantity: number;
  max_quantity?: number;
  alert_enabled?: boolean;
  unit?: string;
  notes?: string;
};

export type StockLot = {
  id: string;
  lot_number: string;
  material_id: string;
  warehouse_id: string;
  quantity: number;
  unit: string | null;
  production_date: string | null;
  expiry_date: string | null;
  origin: string | null;
  supplier_name: string | null;
  batch_reference: string | null;
  quality_id: string | null;
  quality_status: string | null; // Garde pour compatibilité
  weighing_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateStockLotPayload = {
  lot_number: string;
  material_id: string;
  warehouse_id: string;
  quantity: number;
  unit?: string;
  production_date?: string;
  expiry_date?: string;
  origin?: string;
  supplier_name?: string;
  batch_reference?: string;
  quality_id?: string;
  quality_status?: string; // Garde pour compatibilité
  weighing_id?: string;
  notes?: string;
};

export type StockMovement = {
  id: string;
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment' | 'production' | 'consumption';
  material_id: string | null;
  lot_id: string | null;
  warehouse_id: string | null;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  total_value: number | null;
  reference_type: string | null;
  reference_id: string | null;
  origin: string | null;
  destination: string | null;
  treatment_stage: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type CreateStockMovementPayload = {
  movement_type: 'in' | 'out' | 'transfer' | 'adjustment' | 'production' | 'consumption';
  material_id?: string;
  lot_id?: string;
  warehouse_id?: string;
  from_warehouse_id?: string;
  to_warehouse_id?: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  reference_type?: string;
  reference_id?: string;
  origin?: string;
  destination?: string;
  treatment_stage?: string;
  notes?: string;
};

export type StockAlert = {
  id: string;
  material_id: string;
  warehouse_id: string;
  alert_type: 'below_min' | 'above_max' | 'expiring_soon' | 'expired' | 'reconciliation_needed';
  current_quantity: number | null;
  threshold_value: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

export type StockReconciliation = {
  id: string;
  warehouse_id: string;
  material_id: string;
  reconciliation_date: string;
  theoretical_quantity: number;
  actual_quantity: number;
  difference: number;
  difference_percentage: number | null;
  unit: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateStockReconciliationPayload = {
  warehouse_id: string;
  material_id: string;
  reconciliation_date: string;
  theoretical_quantity: number;
  actual_quantity: number;
  reason?: string;
  unit?: string;
  notes?: string;
};

export type StockValuation = {
  id: string;
  material_id: string;
  warehouse_id: string;
  valuation_method: 'FIFO' | 'LIFO' | 'AVERAGE' | 'SPECIFIC';
  quantity: number;
  unit_cost: number;
  total_value: number;
  valuation_date: string;
  notes: string | null;
  calculated_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CalculateStockValuationPayload = {
  material_id: string;
  warehouse_id: string;
  valuation_method: 'FIFO' | 'LIFO' | 'AVERAGE';
  valuation_date: string;
};

export type StockForecast = {
  id: string;
  material_id: string;
  warehouse_id: string;
  forecast_date: string;
  forecasted_quantity: number;
  confidence_level: number | null;
  forecast_method: string | null;
  historical_period_months: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateStockForecastPayload = {
  material_id: string;
  warehouse_id: string;
  forecast_date: string;
  forecasted_quantity: number;
  confidence_level?: number;
  forecast_method?: string;
  historical_period_months?: number;
  notes?: string;
};

// CRM types
export type CustomerInteraction = {
  id: string;
  customer_id: string;
  interaction_type: 'call' | 'email' | 'meeting' | 'visit' | 'quote' | 'invoice' | 'complaint' | 'other';
  subject: string | null;
  description: string;
  outcome: string | null;
  next_action: string | null;
  next_action_date: string | null;
  duration_minutes: number | null;
  location: string | null;
  participants: string[] | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCustomerInteractionPayload = {
  interaction_type: 'call' | 'email' | 'meeting' | 'visit' | 'quote' | 'invoice' | 'complaint' | 'other';
  subject?: string;
  description: string;
  outcome?: string;
  next_action?: string;
  next_action_date?: string;
  duration_minutes?: number;
  location?: string;
  participants?: string[];
  related_entity_type?: string;
  related_entity_id?: string;
};

export type CustomerContract = {
  id: string;
  customer_id: string;
  contract_number: string;
  contract_type: 'service' | 'supply' | 'maintenance' | 'other';
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  renewal_date: string | null;
  auto_renewal: boolean;
  value: number | null;
  currency: string;
  status: 'draft' | 'active' | 'expired' | 'cancelled' | 'renewed';
  terms: string | null;
  notes: string | null;
  signed_date: string | null;
  signed_by: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCustomerContractPayload = {
  contract_number: string;
  contract_type: 'service' | 'supply' | 'maintenance' | 'other';
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  renewal_date?: string;
  auto_renewal?: boolean;
  value?: number;
  currency?: string;
  terms?: string;
  notes?: string;
  signed_date?: string;
  signed_by?: string;
};

export type CustomerOpportunity = {
  id: string;
  customer_id: string;
  customer_name?: string;
  title: string;
  description: string | null;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number | null;
  estimated_value: number | null;
  currency: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  win_reason: string | null;
  loss_reason: string | null;
  competitor: string | null;
  source: string | null;
  notes: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCustomerOpportunityPayload = {
  title: string;
  description?: string;
  stage?: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability?: number;
  estimated_value?: number;
  currency?: string;
  expected_close_date?: string;
  source?: string;
  notes?: string;
  assigned_to?: string;
};

export type CustomerNote = {
  id: string;
  customer_id: string;
  customer_name?: string;
  note_type: 'note' | 'reminder' | 'task' | 'call_log';
  title: string | null;
  content: string;
  is_reminder: boolean;
  reminder_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  tags: string[] | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCustomerNotePayload = {
  note_type?: 'note' | 'reminder' | 'task' | 'call_log';
  title?: string;
  content: string;
  is_reminder?: boolean;
  reminder_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  related_entity_type?: string;
  related_entity_id?: string;
};

export type CustomerStatistics = {
  period_start: string;
  period_end: string;
  total_revenue: number;
  invoice_count: number;
  average_invoice_value: number;
  order_frequency: number;
  last_order_date: string | null;
  first_order_date: string | null;
  total_interactions: number;
  last_interaction_date: string | null;
  segment: 'A' | 'B' | 'C';
  customer_type: 'prospect' | 'client' | 'inactive';
  currency?: string;
};

// Reports & Analytics types
export type WeeklyReport = {
  week_start: string;
  week_end: string;
  volumes: {
    total: number;
    by_material: Record<string, number>;
  };
  performance: {
    routes_completed: number;
    routes_total: number;
    avg_duration: number;
    vehicle_fill_rate: number;
  };
  financial: {
    revenue: number;
    costs: number;
    margin: number;
  };
};

export type MonthlyReport = {
  month: string;
  volumes: {
    total: number;
    by_material: Record<string, number>;
    evolution: number;
  };
  performance: {
    teams: Array<{
      team_name: string;
      routes_completed: number;
      avg_duration: number;
      efficiency_score: number;
    }>;
  };
  financial: {
    revenue: number;
    costs: number;
    margin: number;
    margin_percentage: number;
  };
};

export type RegulatoryReport = {
  period_start: string;
  period_end: string;
  compliance_score: number;
  waste_tracking: {
    total_volume: number;
    tracked_volume: number;
    tracking_rate: number;
  };
  certificates: {
    generated: number;
    pending: number;
    expired: number;
  };
  environmental_impact: {
    co2_saved: number;
    energy_saved: number;
    landfill_diverted: number;
  };
};

export type PerformanceReport = {
  period_start: string;
  period_end: string;
  teams: Array<{
    team_id: string;
    team_name: string;
    department: string;
    metrics: {
      routes_completed: number;
      avg_duration_hours: number;
      on_time_rate: number;
      customer_satisfaction: number;
      efficiency_score: number;
    };
  }>;
  departments: Array<{
    department_name: string;
    total_routes: number;
    completion_rate: number;
    avg_efficiency: number;
  }>;
};

export type PredictiveAnalysis = {
  forecast_period: string;
  volume_forecast: {
    next_month: number;
    next_quarter: number;
    next_year: number;
    confidence: number;
  };
  resource_needs: {
    vehicles: {
      current: number;
      needed: number;
      recommendation: string;
    };
    staff: {
      current: number;
      needed: number;
      recommendation: string;
    };
    storage: {
      current_capacity: number;
      needed_capacity: number;
      recommendation: string;
    };
  };
  trends: Array<{
    metric: string;
    current_value: number;
    predicted_value: number;
    change_percent: number;
  }>;
};

// Compliance & Traceability types
export type WasteTrackingSlip = {
  id: string;
  slip_number: string;
  slip_type: 'BSD' | 'BSDD' | 'BSDA' | 'BSDI';
  producer_id: string | null;
  producer_name: string;
  producer_address: string | null;
  producer_siret: string | null;
  transporter_id: string | null;
  transporter_name: string | null;
  transporter_address: string | null;
  transporter_siret: string | null;
  recipient_id: string | null;
  recipient_name: string;
  recipient_address: string | null;
  recipient_siret: string | null;
  waste_code: string;
  waste_description: string;
  quantity: number;
  unit: string;
  collection_date: string;
  transport_date: string | null;
  delivery_date: string | null;
  treatment_date: string | null;
  treatment_method: string | null;
  treatment_facility: string | null;
  status: 'draft' | 'in_transit' | 'delivered' | 'treated' | 'archived';
  pdf_data: string | null; // Base64 encoded PDF data
  pdf_filename: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateWasteTrackingSlipPayload = {
  slip_type: 'BSD' | 'BSDD' | 'BSDA' | 'BSDI';
  producer_id?: string;
  producer_name: string;
  producer_address?: string;
  producer_siret?: string;
  transporter_id?: string;
  transporter_name?: string;
  transporter_address?: string;
  transporter_siret?: string;
  recipient_id?: string;
  recipient_name: string;
  recipient_address?: string;
  recipient_siret?: string;
  waste_code: string;
  waste_description: string;
  quantity: number;
  unit?: string;
  collection_date: string;
  transport_date?: string;
  delivery_date?: string;
  treatment_date?: string;
  treatment_method?: string;
  treatment_facility?: string;
};

export type TreatmentCertificate = {
  id: string;
  certificate_number: string;
  waste_tracking_slip_id: string | null;
  customer_id: string | null;
  customer_name: string;
  treatment_date: string;
  treatment_method: string;
  treatment_facility: string;
  waste_code: string;
  waste_description: string;
  quantity_treated: number;
  unit: string;
  treatment_result: string | null;
  compliance_status: 'compliant' | 'non_compliant' | 'pending_verification';
  pdf_data: string | null; // Base64 encoded PDF data
  pdf_filename: string | null;
  issued_by: string | null;
  issued_by_name: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};

export type CreateTreatmentCertificatePayload = {
  waste_tracking_slip_id?: string;
  customer_id?: string;
  customer_name: string;
  treatment_date: string;
  treatment_method: string;
  treatment_facility: string;
  waste_code: string;
  waste_description: string;
  quantity_treated: number;
  unit?: string;
  treatment_result?: string;
  expires_at?: string;
};

export type TraceabilityLink = {
  id: string;
  chain_reference: string;
  waste_tracking_slip_id: string | null;
  origin_type: 'collection' | 'customer' | 'warehouse' | 'treatment' | 'valorization';
  origin_id: string | null;
  origin_name: string;
  destination_type: 'warehouse' | 'treatment' | 'valorization' | 'disposal' | 'customer';
  destination_id: string | null;
  destination_name: string;
  material_id: string | null;
  material_name: string | null;
  quantity: number;
  unit: string;
  transaction_date: string;
  transaction_type: 'collection' | 'transfer' | 'treatment' | 'valorization' | 'disposal';
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type CreateTraceabilityLinkPayload = {
  waste_tracking_slip_id?: string;
  chain_reference?: string;
  origin_type: 'collection' | 'customer' | 'warehouse' | 'treatment' | 'valorization';
  origin_id?: string;
  origin_name: string;
  destination_type: 'warehouse' | 'treatment' | 'valorization' | 'disposal' | 'customer';
  destination_id?: string;
  destination_name: string;
  material_id?: string;
  material_name?: string;
  quantity: number;
  unit?: string;
  transaction_date: string;
  transaction_type: 'collection' | 'transfer' | 'treatment' | 'valorization' | 'disposal';
  notes?: string;
};

export type ComplianceCheck = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  rule_id: string | null;
  check_type: 'automatic' | 'manual' | 'scheduled';
  check_status: 'pending' | 'passed' | 'failed' | 'warning';
  check_result: any;
  checked_by: string | null;
  checked_by_name: string | null;
  checked_at: string | null;
  created_at: string;
  rule_name?: string;
  rule_code?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
};

export type RegulatoryDocument = {
  id: string;
  document_type: 'BSD' | 'certificate' | 'compliance_report' | 'audit_report' | 'other';
  document_number: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  title: string;
  description: string | null;
  file_name: string;
  file_mimetype: string | null;
  file_size: number;
  storage_location: string | null;
  retention_period_years: number;
  archived_at: string | null;
  archived_by_name: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

// Logistics Optimization types
export type OptimizedRoute = {
  id: string;
  route_id: string | null;
  optimization_date: string;
  optimization_algorithm: 'nearest_neighbor' | 'genetic' | 'simulated_annealing' | 'tabu_search' | 'custom';
  total_distance_km: number | null;
  total_duration_minutes: number | null;
  total_cost: number | null;
  vehicle_utilization_rate: number | null;
  stops_count: number;
  optimization_score: number | null;
  optimization_config: any;
  optimized_path: any;
  created_by: string | null;
  created_at: string;
};

export type RouteOptimizationMetrics = {
  total_distance_km: number;
  total_duration_minutes: number;
  vehicle_utilization_rate: number | null;
  stops_count: number;
};

export type RouteScenario = {
  id: string;
  scenario_name: string;
  scenario_description: string | null;
  base_route_id: string | null;
  scenario_type: 'what_if' | 'comparison' | 'optimization_test' | 'constraint_test';
  scenario_config: any;
  simulated_route_data: any;
  simulated_metrics: any;
  comparison_results: any;
  is_applied: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  base_route_date?: string | null;
  created_by_name?: string | null;
};

export type CreateScenarioPayload = {
  scenario_name: string;
  scenario_description?: string;
  base_route_id?: string;
  scenario_type: 'what_if' | 'comparison' | 'optimization_test' | 'constraint_test';
  scenario_config?: any;
};

export type VehicleLoadOptimization = {
  id: string;
  route_id: string | null;
  vehicle_id: string;
  optimization_date: string;
  total_weight_kg: number | null;
  total_volume_m3: number | null;
  max_weight_capacity: number | null;
  max_volume_capacity: number | null;
  weight_utilization_rate: number | null;
  volume_utilization_rate: number | null;
  load_distribution: any;
  compatibility_check: any;
  optimization_recommendations: any;
  created_by: string | null;
  created_at: string;
};

export type LoadOptimizationMetrics = {
  total_weight_kg: number;
  total_volume_m3: number;
  weight_utilization_rate: number;
  volume_utilization_rate: number;
  recommendations: string[];
};

export type DemandForecast = {
  id: string;
  forecast_date: string;
  zone_id: string | null;
  zone_name: string;
  zone_coordinates: any;
  material_type: string | null;
  forecasted_volume: number;
  forecasted_weight: number | null;
  confidence_level: number | null;
  forecast_method: 'historical' | 'trend' | 'seasonal' | 'ml' | 'manual' | null;
  historical_data: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateDemandForecastPayload = {
  forecast_date: string;
  zone_id?: string;
  zone_name: string;
  zone_coordinates?: any;
  material_type?: string;
  forecasted_volume: number;
  forecasted_weight?: number;
  confidence_level?: number;
  forecast_method?: 'historical' | 'trend' | 'seasonal' | 'ml' | 'manual';
  historical_data?: any;
};

export type RealTimeTracking = {
  id: string;
  route_id: string | null;
  vehicle_id: string | null;
  current_stop_id: string | null;
  current_latitude: number | null;
  current_longitude: number | null;
  current_speed_kmh: number | null;
  estimated_arrival_time: string | null;
  estimated_duration_minutes: number | null;
  distance_to_destination_km: number | null;
  traffic_conditions: string | null;
  tracking_status: 'active' | 'paused' | 'completed' | 'cancelled';
  last_update: string;
  created_at: string;
  route_date?: string | null;
  vehicle_number?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
};

export type UpdateRealTimeTrackingPayload = {
  route_id: string;
  vehicle_id: string;
  current_stop_id?: string;
  current_latitude?: number;
  current_longitude?: number;
  current_speed_kmh?: number;
  estimated_arrival_time?: string;
  estimated_duration_minutes?: number;
  distance_to_destination_km?: number;
  traffic_conditions?: string;
};

export type RoutingConstraint = {
  id: string;
  constraint_type: 'customer_hours' | 'max_weight' | 'max_volume' | 'restricted_zone' | 'vehicle_compatibility' | 'driver_hours' | 'custom';
  constraint_name: string;
  constraint_description: string | null;
  constraint_config: any;
  is_active: boolean;
  applies_to: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
};

export type CreateRoutingConstraintPayload = {
  constraint_type: 'customer_hours' | 'max_weight' | 'max_volume' | 'restricted_zone' | 'vehicle_compatibility' | 'driver_hours' | 'custom';
  constraint_name: string;
  constraint_description?: string;
  constraint_config?: any;
  applies_to?: string[];
};

// Suppliers Management types
export type Supplier = {
  id: string;
  supplier_code: string;
  name: string;
  supplier_type: 'transporter' | 'service_provider' | 'material_supplier' | 'equipment_supplier' | 'other';
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  siret: string | null;
  vat_number: string | null;
  payment_terms: string | null;
  bank_details: any;
  notes: string | null;
  is_active: boolean;
  average_rating: number | null;
  total_orders: number;
  total_value: number;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  evaluation_count?: number;
  order_count?: number;
};

export type CreateSupplierPayload = {
  supplier_code: string;
  name: string;
  supplier_type: 'transporter' | 'service_provider' | 'material_supplier' | 'equipment_supplier' | 'other';
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  siret?: string;
  vat_number?: string;
  payment_terms?: string;
  bank_details?: any;
  notes?: string;
};

export type SupplierEvaluation = {
  id: string;
  supplier_id: string;
  evaluation_date: string;
  evaluated_by: string | null;
  evaluated_by_name: string | null;
  quality_score: number | null;
  delivery_time_score: number | null;
  price_score: number | null;
  communication_score: number | null;
  overall_score: number | null;
  comments: string | null;
  order_id: string | null;
  created_at: string;
};

export type CreateSupplierEvaluationPayload = {
  evaluation_date?: string;
  quality_score?: number;
  delivery_time_score?: number;
  price_score?: number;
  communication_score?: number;
  comments?: string;
  order_id?: string;
};

export type SupplierOrder = {
  id: string;
  order_number: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  order_status: 'draft' | 'sent' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled' | 'completed';
  order_type: 'material' | 'service' | 'transport' | 'equipment' | 'other' | null;
  total_amount: number;
  currency: string;
  items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSupplierOrderPayload = {
  supplier_id: string;
  order_date?: string;
  expected_delivery_date?: string;
  order_type?: 'material' | 'service' | 'transport' | 'equipment' | 'other';
  items: Array<{ description: string; quantity: number; unit_price: number }>;
  notes?: string;
};

export type SupplierReception = {
  id: string;
  order_id: string;
  reception_date: string;
  reception_status: 'partial' | 'complete' | 'rejected';
  received_items: any[];
  quality_check_passed: boolean | null;
  quality_check_notes: string | null;
  received_by: string | null;
  received_by_name: string | null;
  notes: string | null;
  created_at: string;
};

export type ReceiveSupplierOrderPayload = {
  reception_date?: string;
  reception_status?: 'partial' | 'complete' | 'rejected';
  received_items: Array<{ item_id?: string; description: string; quantity_received: number }>;
  quality_check_passed?: boolean;
  quality_check_notes?: string;
  notes?: string;
};

export type SupplierInvoice = {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  order_id: string | null;
  invoice_date: string;
  due_date: string;
  payment_date: string | null;
  invoice_status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  pdf_data: string | null; // Base64 encoded PDF data
  pdf_filename: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSupplierInvoicePayload = {
  invoice_number: string;
  supplier_id: string;
  order_id?: string;
  invoice_date: string;
  due_date: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount: number;
  currency?: string;
  notes?: string;
};

export type PaySupplierInvoicePayload = {
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
};

export type TenderCall = {
  id: string;
  tender_number: string;
  title: string;
  description: string | null;
  tender_type: 'material' | 'service' | 'transport' | 'equipment' | 'other';
  start_date: string;
  end_date: string;
  submission_deadline: string;
  status: 'draft' | 'published' | 'closed' | 'awarded' | 'cancelled';
  requirements: any;
  evaluation_criteria: any;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  offer_count?: number;
};

export type CreateTenderCallPayload = {
  title: string;
  description?: string;
  tender_type: 'material' | 'service' | 'transport' | 'equipment' | 'other';
  start_date: string;
  end_date: string;
  submission_deadline: string;
  requirements?: any;
  evaluation_criteria?: any;
};

export type TenderOffer = {
  id: string;
  tender_call_id: string;
  supplier_id: string;
  supplier_name: string;
  offer_amount: number;
  currency: string;
  delivery_time_days: number | null;
  validity_days: number | null;
  offer_details: any;
  technical_specifications: any;
  offer_status: 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn';
  evaluation_score: number | null;
  evaluation_notes: string | null;
  submitted_at: string;
  evaluated_at: string | null;
  evaluated_by: string | null;
  evaluated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmitTenderOfferPayload = {
  supplier_id: string;
  offer_amount: number;
  currency?: string;
  delivery_time_days?: number;
  validity_days?: number;
  offer_details?: any;
  technical_specifications?: any;
};

export type EvaluateTenderOfferPayload = {
  offer_status?: 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn';
  evaluation_score?: number;
  evaluation_notes?: string;
};

// Document Management Types
export type Document = {
  id: string;
  document_number: string;
  title: string;
  description: string | null;
  category: 'contract' | 'invoice' | 'report' | 'certificate' | 'compliance' | 'hr' | 'financial' | 'legal' | 'other';
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  file_hash: string | null;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'archived' | 'deleted';
  is_sensitive: boolean;
  requires_approval: boolean;
  current_version: number;
  retention_rule_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  tags?: string[];
  version_count?: number;
  pending_approvals?: number;
};

export type DocumentVersion = {
  id: string;
  document_id: string;
  version_number: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  file_hash: string | null;
  change_summary: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type DocumentApproval = {
  id: string;
  document_id: string;
  approver_id: string;
  approver_name: string;
  approval_order: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  comments: string | null;
  approved_at: string | null;
  created_at: string;
};

export type DocumentAccessLog = {
  id: string;
  document_id: string;
  user_id: string | null;
  user_name: string | null;
  action: 'view' | 'download' | 'upload' | 'update' | 'delete' | 'approve' | 'reject' | 'archive';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type DocumentRetentionRule = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  retention_years: number;
  auto_archive: boolean;
  archive_after_days: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentDetail = Document & {
  versions: DocumentVersion[];
  tags: string[];
  approvals: DocumentApproval[];
};

export type CreateDocumentPayload = {
  title: string;
  description?: string;
  category: Document['category'];
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  file_hash?: string;
  is_sensitive?: boolean;
  requires_approval?: boolean;
  tags?: string[];
  retention_rule_id?: string;
};

export type CreateDocumentVersionPayload = {
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  file_hash?: string;
  change_summary?: string;
};

export type CreateDocumentRetentionRulePayload = {
  name: string;
  description?: string;
  category?: string;
  retention_years?: number;
  auto_archive?: boolean;
  archive_after_days?: number;
};

// External Integrations Types
export type ExternalIntegration = {
  id: string;
  integration_type: 'accounting' | 'email' | 'sms' | 'gps' | 'scale' | 'webhook' | 'other';
  name: string;
  provider: string;
  is_active: boolean;
  config: Record<string, any>;
  credentials: Record<string, any>;
  last_sync_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateIntegrationPayload = {
  integration_type: ExternalIntegration['integration_type'];
  name: string;
  provider: string;
  is_active?: boolean;
  config?: Record<string, any>;
  credentials?: Record<string, any>;
};

export type IntegrationLog = {
  id: string;
  integration_id: string | null;
  integration_type: string;
  action: string;
  status: 'success' | 'error' | 'pending';
  request_data: Record<string, any> | null;
  response_data: Record<string, any> | null;
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
};

export type Webhook = {
  id: string;
  name: string;
  url: string;
  event_type: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: Record<string, any>;
  payload_template: Record<string, any> | null;
  is_active: boolean;
  secret_token: string | null;
  retry_count: number;
  timeout_seconds: number;
  last_triggered_at: string | null;
  last_status_code: number | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateWebhookPayload = {
  name: string;
  url: string;
  event_type: string;
  http_method?: Webhook['http_method'];
  headers?: Record<string, any>;
  payload_template?: Record<string, any>;
  secret_token?: string;
  retry_count?: number;
  timeout_seconds?: number;
};

export type WebhookLog = {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, any>;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  execution_time_ms: number | null;
  triggered_at: string;
};

// Global Search types
export type SearchResult = {
  type: 'customer' | 'invoice' | 'intervention' | 'material' | 'employee' | 'vehicle' | 'document' | 'supplier' | 'route';
  id: string;
  title: string;
  subtitle: string;
  metadata?: string[];
  icon?: string;
  url?: string;
};

export type SavedFilter = {
  id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  is_favorite: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSavedFilterPayload = {
  name: string;
  query: string;
  filters: Record<string, any>;
  is_favorite?: boolean;
};

// Business Intelligence types
export type HistoricalDataPoint = {
  date: string;
  dimensions: Record<string, string>;
  metrics: Record<string, number>;
};

export type OlapCubeResult = {
  cube: string;
  dimensions: string[];
  measures: string[];
  data: Array<{
    dimension_values: Record<string, string>;
    measure_values: Record<string, number>;
  }>;
  totals: Record<string, number>;
};

export type ForecastData = {
  date: string;
  predicted_value: number;
  confidence_lower: number;
  confidence_upper: number;
  actual_value?: number;
};

export type Anomaly = {
  id: string;
  entity_type: string;
  entity_id: string;
  metric: string;
  value: number;
  expected_value: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  description: string;
};

// Types pour la sécurité renforcée
export type TwoFactorAuth = {
  id: string;
  user_id: string;
  is_enabled: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TwoFactorSetup = {
  secret: string;
  qrCode: string;
  backupCodes: string[];
};

export type UserSession = {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  location: string | null;
  is_active: boolean;
  last_activity: string;
  expires_at: string;
  created_at: string;
};

export type GDPRConsent = {
  id: string;
  user_id: string | null;
  consent_type: 'data_processing' | 'marketing' | 'analytics' | 'cookies' | 'location';
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  version: string;
  created_at: string;
};

export type GDPRDataRequest = {
  id: string;
  user_id: string | null;
  request_type: 'data_export' | 'data_deletion' | 'data_rectification' | 'access_request';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
};

export type AuditLog = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  changed_by: string | null;
  changed_by_name: string | null;
  before_data: Record<string, any> | null;
  after_data: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  created_at: string;
};

export type DrillDownResult = {
  level: string;
  dimension: string;
  measure: string;
  data: Array<{
    id: string;
    label: string;
    value: number;
    children_count?: number;
    can_drill_down?: boolean;
  }>;
  parent?: {
    id: string;
    label: string;
  };
};

const buildQuery = (params: Record<string, any>) => {
  const entries = Object.entries(params || {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (!entries.length) return '';
  return (
    '?' +
    entries
      .map(([k, v]) =>
        Array.isArray(v)
          ? v.map((item) => `${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`).join('&')
          : `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
      )
      .join('&')
  );
};

// ===== RH avancé - Types frontend =====
export type DriverDutyRecord = {
  id: string;
  employee_id: string;
  duty_date: string;
  duty_hours: number;
  driving_hours: number;
  night_hours: number;
  breaks_minutes: number;
  overtime_minutes: number;
  legal_ok: boolean;
  notes: string | null;
  // Aliases for UI compatibility
  total_hours?: number | null;
  break_minutes?: number | null;
  is_compliant?: boolean;
};

export type DriverIncident = {
  id: string;
  employee_id: string;
  route_id: string | null;
  occurred_at: string;
  type: string | null;
  severity: string | null;
  description: string | null;
  customer_feedback: string | null;
  resolved: boolean;
  // Aliases for UI compatibility
  incident_date?: string;
  incident_type?: string | null;
};

export type EcoDrivingScore = {
  id: string;
  employee_id: string;
  route_id: string | null;
  score: number | null;
  fuel_consumption: number | null;
  harsh_braking: number;
  harsh_acceleration: number;
  idle_time_minutes: number;
  created_at: string;
  // Aliases for UI compatibility
  period_start?: string;
  period_end?: string;
  fuel_consumption_l_per_100km?: number | null;
};

export type JobPosition = {
  id: string;
  title: string;
  site_id: string | null;
  department: string | null;
  description: string | null;
  requirements: string | null;
  status: string;
  created_at: string;
};

export type JobApplicant = {
  id: string;
  position_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  experience: string | null;
  status: string;
  score: number | null;
  created_at: string;
  // Aliases for UI compatibility
  first_name?: string | null;
  last_name?: string | null;
  test_score?: number | null;
  applied_at?: string | null;
};

export type ApplicantTest = {
  id: string;
  applicant_id: string;
  test_type: string | null;
  score: number | null;
  result: string | null;
  created_at: string;
  // Aliases for UI compatibility
  completed_at?: string | null;
};

export type TrainingModule = {
  id: string;
  title: string;
  module_type: 'video' | 'checklist' | 'document' | 'quiz';
  media_url: string | null;
  checklist_items: string[] | null;
  mandatory: boolean;
  refresh_months: number | null;
  duration_minutes: number | null;
  created_at: string;
  // Aliases for UI compatibility
  is_mandatory?: boolean;
};

export type TrainingProgress = {
  id: string;
  employee_id: string;
  module_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  score: number | null;
  completed_at: string | null;
  expires_at: string | null;
  last_reminder_at: string | null;
  created_at: string;
  title?: string;
  module_type?: TrainingModule['module_type'];
  mandatory?: boolean;
  refresh_months?: number | null;
  // Alias for UI compatibility
  completion_percentage?: number | null;
};

export type TrainingReminder = {
  id: string;
  employee_id: string;
  module_id: string;
  due_date: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'ack';
  created_at: string;
  title?: string;
  module_type?: TrainingModule['module_type'];
  // Alias for UI compatibility
  reason?: string | null;
};

export type EmploymentContract = {
  id: string;
  employee_id: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  base_salary: number | null;
  currency: string;
  hours_per_week: number | null;
  site_id: string | null;
  status: string;
  created_at: string;
  // Aliases for UI compatibility
  work_rate?: number | null;
  notes?: string | null;
};

export type ContractAllowance = {
  id: string;
  contract_id: string;
  label: string;
  amount: number;
  periodicity: string;
  // Aliases for UI compatibility
  allowance_type?: string | null;
  currency?: string | null;
  period_start?: string | null;
  period_end?: string | null;
};

export type OvertimeEntry = {
  id: string;
  employee_id: string;
  entry_date: string;
  hours: number;
  rate_multiplier: number;
  approved: boolean;
  created_at: string;
  // Aliases for UI compatibility
  overtime_date?: string;
  amount?: number | null;
  currency?: string | null;
};

export type PayrollEntry = {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  gross_amount: number | null;
  net_amount: number | null;
  currency: string;
  bonuses: Record<string, any> | null;
  overtime_hours: number | null;
  status: string;
  created_at: string;
  // Aliases for UI compatibility
  base_salary?: number | null;
  allowances?: number | null;
  net_salary?: number | null;
};

export type TimeClockEvent = {
  id: string;
  employee_id: string;
  position_id: string | null;
  event_type: 'in' | 'out' | 'pause_in' | 'pause_out' | 'position_change';
  source: string | null;
  device_id: string | null;
  occurred_at: string;
  created_at: string;
};

export type HrDashboard = {
  headcount: number;
  activeContracts: number;
  avgVersatility: number;
  trainingCompliance: { completed: number; total: number; rate: number | null };
  absenteeism: { absent: number; rate: number };
  hseOpenCritical: number;
  overtimeLast30Hours: number;
};

