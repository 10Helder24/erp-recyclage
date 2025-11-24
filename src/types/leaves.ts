export type LeaveType = 'vacances' | 'maladie' | 'accident' | 'deces' | 'formation' | 'heures_sup' | 'armee';
export type LeaveStatus = 'en_attente' | 'approuve' | 'refuse';

export interface Leave {
  id: string;
  employee_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  comment?: string;
  signature?: string;
  approved_by?: string;
  approved_at?: string;
  request_group_id?: string;
  created_at?: string;
  updated_at?: string;
  employee?: EmployeeSummary;
  army_start_date?: string | null;
  army_end_date?: string | null;
  army_reference?: string | null;
}

export interface EmployeeSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string | null;
  manager_name?: string | null;
  role?: string | null;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  paid_leave_total: number;
  paid_leave_used: number;
  sick_leave_used: number;
  training_days_used: number;
  employee?: EmployeeSummary;
}

export interface LeaveRequestPayload {
  employee_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  comment?: string;
  signature?: string;
  periods: Array<{ type: LeaveType; start_date: string; end_date: string }>;
  army_start_date?: string;
  army_end_date?: string;
  army_reference?: string;
}
