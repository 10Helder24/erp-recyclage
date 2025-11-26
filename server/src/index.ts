const TYPE_LABELS_SERVER: Record<string, string> = {
  vacances: 'Vacances',
  maladie: 'Maladie',
  accident: 'Accident',
  deces: 'Décès',
  formation: 'Formation',
  heures_sup: 'Récup. heures',
  armee: 'Armée / PC'
};
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
};

type AuthenticatedRequest = express.Request & { auth?: AuthPayload };

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
  created_at: row.created_at
});

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
  manager_name: user.manager_name
});

const signToken = (payload: AuthPayload) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: '12h'
  });

const requireAuth =
  (options?: { roles?: UserRole[] }): express.RequestHandler =>
  (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentification requise' });
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
      (req as AuthenticatedRequest).auth = payload;
      if (options?.roles && !options.roles.includes(payload.role)) {
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
    l.*,
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
    create table if not exists users (
      id uuid primary key,
      email text not null unique,
      password_hash text not null,
      role text not null default 'manager',
      full_name text,
      department text,
      manager_name text,
      reset_token text,
      reset_token_expires timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await run(`alter table users add column if not exists reset_token text`);
  await run(`alter table users add column if not exists reset_token_expires timestamptz`);
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
    const { email, password, role = 'manager', full_name, department, manager_name } = req.body as {
      email?: string;
      password?: string;
      role?: UserRole;
      full_name?: string;
      department?: string | null;
      manager_name?: string | null;
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
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    const [inserted] = await run<UserRow>(
      `insert into users (id, email, password_hash, role, full_name, department, manager_name)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [id, normalizedEmail, passwordHash, role, full_name ?? null, department ?? null, manager_name ?? null]
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
    const { role, full_name, department, manager_name, password, email } = req.body as {
      role?: UserRole;
      full_name?: string | null;
      department?: string | null;
      manager_name?: string | null;
      password?: string;
      email?: string;
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
  requireManagerAuth,
  asyncHandler(async (_req, res) => {
    const rows = await run<LeaveRow>(`${leaveBaseSelect} where l.status = 'en_attente' order by l.start_date asc`);
    res.json(rows);
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

    const balances: LeaveBalanceRow[] = employees.map((employee) => {
      const total = calculateAnnualEntitlement(employee, year);
      const used = usageMap.get(employee.id) ?? 0;
      return {
        id: `${employee.id}-${year}`,
        employee_id: employee.id,
        year,
        paid_leave_total: total,
        paid_leave_used: used,
        sick_leave_used: 0,
        training_days_used: 0,
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

    res.status(201).json(inserted);
  })
);

app.patch(
  '/api/leaves/:id/status',
  requireManagerAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, signature } = req.body as { status: LeaveStatus; signature?: string };

    const [row] = await run<Leave>(
      `update leaves
       set
        status = $1,
        approved_at = case when $1 = 'approuve' then now() else approved_at end,
        approved_by = case when $1 = 'approuve' then 'manager' else approved_by end,
        signature = coalesce($2, signature)
       where id = $3
       returning *`,
      [status, signature ?? null, id]
    );

    if (!row) {
      return res.status(404).json({ message: 'Demande introuvable' });
    }

    const [employee] = await run<EmployeeRow>('select * from employees where id = $1', [(row as Leave).employee_id]);
    res.json({ ...(row as Leave), employee } as LeaveRow);
  })
);

app.post(
  '/api/leaves/notify',
  requireManagerAuth,
  asyncHandler(async (req, res) => {
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

    const mailsTo = [...baseRecipients, ...uniqueEmployeeEmails].filter(Boolean);

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
      to: mailsTo,
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
    const [employee] = await run<{ id: string }>('select id from employees where lower(email) = lower($1)', [email]);
    if (!employee) {
      return res.status(404).json({ message: 'Employé introuvable pour cet utilisateur' });
    }
    const now = new Date();
    // Mettre à jour la position actuelle
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
    res.status(204).send();
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
  requireAuth(),
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
  requireAuth(),
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
    const [customer] = await run<{ id: string }>(
      `insert into customers (id, name, address, latitude, longitude, risk_level)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [id, name, address || null, latitude || null, longitude || null, risk_level || null]
    );
    res.status(201).json({ id: customer.id, message: 'Client créé avec succès' });
  })
);

app.patch(
  '/api/customers/:id',
  requireAuth(),
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
    params.push(id);
    await run(`update customers set ${updates.join(', ')} where id = $${paramIndex}`, params);
    res.json({ message: 'Client mis à jour avec succès' });
  })
);

app.delete(
  '/api/customers/:id',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await run('delete from customers where id = $1', [id]);
    res.json({ message: 'Client supprimé avec succès' });
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
    }>(
      `select rs.*, c.name as customer_name, c.address as customer_address
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

const start = async () => {
  await ensureSchema();
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start API server', error);
  process.exit(1);
});

