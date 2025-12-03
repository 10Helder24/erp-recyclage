import type { Employee } from '../types/employees';
import type { AuthUser, UserRole } from '../types/auth';
import type { Leave, LeaveBalance, LeaveRequestPayload, LeaveStatus } from '../types/leaves';

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

const API_URL = import.meta.env.VITE_API_URL ?? '/api';
let authToken: string | null = null;

const buildHeaders = (options: RequestInit) => {
  const baseHeaders: Record<string, string> = {
    ...(options.headers as Record<string, string>) ?? {}
  };
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !baseHeaders['Content-Type']) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  if (authToken) {
    baseHeaders.Authorization = `Bearer ${authToken}`;
  }
  return baseHeaders;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isOffline = !navigator.onLine;
  const method = options.method || 'GET';
  const isMutation = method !== 'GET' && method !== 'HEAD';

  if (isOffline && isMutation) {
    const { offlineStorage } = await import('../utils/offlineStorage');
    await offlineStorage.init();
    const actionId = await offlineStorage.savePendingAction({
      type: 'api_request',
      endpoint: `${API_URL}${path}`,
      method,
      payload: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined
    });
    throw new Error(`OFFLINE_QUEUED:${actionId}`);
  }

  try {
  const response = await fetch(`${API_URL}${path}`, {
      headers: buildHeaders(options),
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Erreur serveur');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      if (isMutation) {
        const { offlineStorage } = await import('../utils/offlineStorage');
        await offlineStorage.init();
        const actionId = await offlineStorage.savePendingAction({
          type: 'api_request',
          endpoint: `${API_URL}${path}`,
          method,
          payload: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined
        });
        throw new Error(`OFFLINE_QUEUED:${actionId}`);
      }
      throw new Error('Pas de connexion internet');
    }
    throw error;
  }
}

export const Api = {
  setAuthToken: (token: string | null) => {
    authToken = token;
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
    const response = await fetch(`${API_URL}/customers/${customerId}/documents/${documentId}/download`, {
      headers: authToken
        ? {
            Authorization: `Bearer ${authToken}`
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
  optimizeRoute: (id: string, payload: { apply?: boolean; startTime?: string }) =>
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
  fetchPdfTemplate: (module: string) => request<PdfTemplate>(`/pdf-templates/${module}`),
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
    request<{ message: string }>(`/alert-category-recipients/${id}`, { method: 'DELETE' })
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
  quality_status: string | null;
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
  quality_status?: string;
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
