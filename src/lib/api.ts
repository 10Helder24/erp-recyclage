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
};

export type MapVehicle = {
  id: string;
  internal_number: string | null;
  plate_number: string | null;
};

export type MapRouteStop = {
  id: string;
  order_index: number;
  estimated_time: string | null;
  status: string | null;
  notes: string | null;
  customer_name: string | null;
  customer_address: string | null;
  latitude: number | null;
  longitude: number | null;
  vehicle_id: string | null;
  internal_number: string | null;
  plate_number: string | null;
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
  updateLeaveStatus: (id: string, status: LeaveStatus, signature?: string) =>
    request<Leave>(`/leaves/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, signature })
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
  fetchUserLocations: () => request<MapUserLocation[]>('/map/user-locations'),
  updateCurrentLocation: (payload: { latitude: number; longitude: number }) =>
    request<void>('/map/user-locations', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchVehicles: () => request<MapVehicle[]>('/map/vehicles'),
  fetchRouteStops: (params: { date: string; vehicleId?: string }) => {
    const query = new URLSearchParams({ date: params.date });
    if (params.vehicleId) {
      query.append('vehicleId', params.vehicleId);
    }
    return request<MapRouteStop[]>(`/map/routes?${query.toString()}`);
  }
};
