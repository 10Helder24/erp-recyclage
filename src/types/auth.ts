export type UserRole = 'admin' | 'manager' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  department: string | null;
  manager_name: string | null;
  created_at?: string | null;
}

