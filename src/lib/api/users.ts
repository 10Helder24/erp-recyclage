import type { AuthUser, UserRole } from '../../types/auth';
import type { Employee } from '../../types/employees';
import { request } from './base';

export const UsersApi = {
  fetchUsers: () => request<AuthUser[]>('/auth/users'),
  createUser: (payload: {
    role: UserRole;
    full_name: string;
    email: string;
    department?: string;
    manager_name?: string;
    permissions?: string[];
    password?: string;
  }) =>
    request<{ user: AuthUser }>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateUser: (
    id: string,
    payload: {
      role?: UserRole;
      full_name?: string;
      department?: string | null;
      manager_name?: string | null;
      permissions?: string[];
      email?: string;
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
  // Employees
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
    })
};


