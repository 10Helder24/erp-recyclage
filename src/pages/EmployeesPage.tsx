  const isExpiring = (date?: string | null) => {
    if (!date) return false;
    const now = new Date();
    const target = new Date(date);
    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };

  const expiryBadge = (date?: string | null) => {
    if (!date) return null;
    const now = new Date();
    const target = new Date(date);
    const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return <span className="badge badge-danger">Expiré</span>;
    if (diffDays <= 30) return <span className="badge badge-warning">Expire dans {diffDays} j</span>;
    return null;
  };
import { useEffect, useMemo, useState } from 'react';
import { User, Mail, Phone, Building, Calendar, Plus, Loader2, Hash, Briefcase, MapPin, Shield, FileText, AlertTriangle, Home, BadgeCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import { Api } from '../lib/api';
import type { Employee } from '../types/employees';
import { useAuth } from '../hooks/useAuth';

type EmployeeForm = {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  contract_type: string;
  employment_status: string;
  work_rate: string;
  work_schedule: string;
  manager_name: string;
  location: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  work_permit: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
  start_date: string;
  birth_date: string;
  birth_location: string;
  personal_email: string;
  personal_phone: string;
  nationality: string;
  marital_status: string;
  dependent_children: string;
  id_document_number: string;
  ahv_number: string;
  iban: string;
};

const DEFAULT_FORM: EmployeeForm = {
  employee_code: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department: '',
  role: '',
  contract_type: '',
  employment_status: '',
  work_rate: '',
  work_schedule: '',
  manager_name: '',
  location: '',
  address_line1: '',
  address_line2: '',
  postal_code: '',
  city: '',
  country: '',
  work_permit: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
  start_date: '',
  birth_date: '',
  birth_location: '',
  personal_email: '',
  personal_phone: '',
  nationality: '',
  marital_status: '',
  dependent_children: '',
  id_document_number: '',
  ahv_number: '',
  iban: ''
};

const DEPARTMENTS = ['Logistique', 'Exploitation', 'Administration', 'Commercial', 'Direction'];
const CONTRACT_TYPES = ['CDI', 'CDD', 'Intérim', 'Apprentissage', 'Stage', 'Mandat', 'Freelance'];
const EMPLOYMENT_STATUSES = ['Actif', 'En congé', 'Suspendu', 'Sorti'];
const SITES = ['Crissier', 'Genève', 'Massongex', 'Monthey', 'Saillon', 'Vétroz', 'Féchy', 'Autre'];

const EmployeesPage = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager') || isAdmin;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [rhModalOpen, setRhModalOpen] = useState(false);
  const [rhEmployee, setRhEmployee] = useState<Employee | null>(null);
  const [rhTab, setRhTab] = useState<
    'skills' | 'certifications' | 'trainings' | 'epis' | 'hse' | 'performance' | 'driver' | 'timeclock'
  >('skills');
  const [skills, setSkills] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [epis, setEpis] = useState<any[]>([]);
  const [skillItems, setSkillItems] = useState<any[]>([]);
  const [certItems, setCertItems] = useState<any[]>([]);
  const [trainingItems, setTrainingItems] = useState<any[]>([]);
  const [epiItems, setEpiItems] = useState<any[]>([]);
  const [hseItems, setHseItems] = useState<any[]>([]);
  const [perfItems, setPerfItems] = useState<any[]>([]);
  const [driverItems, setDriverItems] = useState<any[]>([]);
  const [timeClockItems, setTimeClockItems] = useState<any[]>([]);
  const [loadingRh, setLoadingRh] = useState(false);
  const [rhForm, setRhForm] = useState<any>({});

  const title = useMemo(() => (editingId ? 'Modifier un employé' : 'Nouvel employé'), [editingId]);

  useEffect(() => {
    loadEmployees();
  }, []);

  const scopedEmployees = useMemo(() => {
    if (isAdmin) {
      return employees;
    }
    // Managers see only their department
    const managerDepartment = user?.department;
    if (!managerDepartment) {
      return [];
    }
    return employees.filter((employee) => employee.department === managerDepartment);
  }, [employees, isAdmin, user?.department]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await Api.fetchEmployees();
      setEmployees(data);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de charger les employés");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    if (!isAdmin) return;
    setForm({
      ...DEFAULT_FORM,
      start_date: new Date().toISOString().split('T')[0]
    });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    if (!isAdmin) return;
    setForm({
      employee_code: employee.employee_code ?? '',
      first_name: employee.first_name ?? '',
      last_name: employee.last_name ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      department: employee.department ?? '',
      role: employee.role ?? '',
      contract_type: employee.contract_type ?? '',
      employment_status: employee.employment_status ?? '',
      work_rate: employee.work_rate?.toString() ?? '',
      work_schedule: employee.work_schedule ?? '',
      manager_name: employee.manager_name ?? '',
      location: employee.location ?? '',
      address_line1: employee.address_line1 ?? '',
      address_line2: employee.address_line2 ?? '',
      postal_code: employee.postal_code ?? '',
      city: employee.city ?? '',
      country: employee.country ?? '',
      work_permit: employee.work_permit ?? '',
      emergency_contact_name: employee.emergency_contact_name ?? '',
      emergency_contact_phone: employee.emergency_contact_phone ?? '',
      notes: employee.notes ?? '',
      start_date: employee.start_date ?? '',
      birth_date: employee.birth_date ?? '',
      birth_location: employee.birth_location ?? '',
      personal_email: employee.personal_email ?? '',
      personal_phone: employee.personal_phone ?? '',
      nationality: employee.nationality ?? '',
      marital_status: employee.marital_status ?? '',
      dependent_children: employee.dependent_children ?? '',
      id_document_number: employee.id_document_number ?? '',
      ahv_number: employee.ahv_number ?? '',
      iban: employee.iban ?? ''
    });
    setEditingId(employee.id);
    setModalOpen(true);
  };

  const openRhModal = async (employee: Employee) => {
    setRhEmployee(employee);
    setRhModalOpen(true);
    setRhTab('skills');
    setLoadingRh(true);
    try {
      const [sk, certs, tr, ep, empSkills, empCerts, empTr, empEp, hse, perf, driver, clock] = await Promise.all([
        Api.fetchSkills(),
        Api.fetchCertifications(),
        Api.fetchTrainings(),
        Api.fetchEpis(),
        Api.fetchEmployeeSkills(employee.id),
        Api.fetchEmployeeCertifications(employee.id),
        Api.fetchEmployeeTrainings(employee.id),
        Api.fetchEmployeeEpis(employee.id),
        Api.fetchHseIncidents({ employee_id: employee.id }),
        Api.fetchEmployeePerformance(employee.id),
        Api.fetchEmployeeDriverCompliance(employee.id),
        Api.fetchTimeClockEvents({ employee_id: employee.id, limit: 50 })
      ]);
      setSkills(sk);
      setCertifications(certs);
      setTrainings(tr);
      setEpis(ep);
      setSkillItems(empSkills);
      setCertItems(empCerts);
      setTrainingItems(empTr);
      setEpiItems(empEp);
      setHseItems(hse);
      setPerfItems(perf);
      setDriverItems(driver);
      setTimeClockItems(clock);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les données RH+');
    } finally {
      setLoadingRh(false);
    }
  };

  const closeRhModal = () => {
    setRhModalOpen(false);
    setRhEmployee(null);
    setRhForm({});
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      employee_code: form.employee_code || undefined,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone || undefined,
      department: form.department || undefined,
      role: form.role || undefined,
      contract_type: form.contract_type || undefined,
      employment_status: form.employment_status || undefined,
      work_rate: form.work_rate ? Number(form.work_rate) : undefined,
      work_schedule: form.work_schedule || undefined,
      manager_name: form.manager_name || undefined,
      location: form.location || undefined,
      address_line1: form.address_line1 || undefined,
      address_line2: form.address_line2 || undefined,
      postal_code: form.postal_code || undefined,
      city: form.city || undefined,
      country: form.country || undefined,
      work_permit: form.work_permit || undefined,
      emergency_contact_name: form.emergency_contact_name || undefined,
      emergency_contact_phone: form.emergency_contact_phone || undefined,
      notes: form.notes || undefined,
      start_date: form.start_date || undefined,
      birth_date: form.birth_date || undefined,
      birth_location: form.birth_location || undefined,
      personal_email: form.personal_email || undefined,
      personal_phone: form.personal_phone || undefined,
      nationality: form.nationality || undefined,
      marital_status: form.marital_status || undefined,
      dependent_children: form.dependent_children || undefined,
      id_document_number: form.id_document_number || undefined,
      ahv_number: form.ahv_number || undefined,
      iban: form.iban || undefined
    };

    try {
      if (editingId) {
        await Api.updateEmployee(editingId, payload);
        toast.success('Employé mis à jour');
      } else {
        await Api.createEmployee(payload);
        toast.success('Employé ajouté');
      }
      closeModal();
      loadEmployees();
    } catch (error) {
      console.error(error);
      toast.error("Impossible d'enregistrer l'employé");
    } finally {
      setSaving(false);
    }
  };

  const toggleDetails = (employeeId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  return (
    <section className="employees-page">
      <div className="employees-header">
        <div>
          <p className="eyebrow">RH +</p>
          <h1>Employés</h1>
          <p>Annuaire des collaborateurs et informations administratives.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          Ajouter un employé
        </button>
      </div>

      {loading ? (
        <div className="employees-empty">
          <Loader2 className="h-6 w-6 animate-spin text-[#2563eb]" />
          <p>Chargement des collaborateurs…</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="employees-empty">Aucun collaborateur pour le moment.</div>
      ) : (
        <div className="employees-grid">
          {employees.map((employee) => {
            const expanded = !!expandedCards[employee.id];
            const hasDetails =
              !!(
                employee.employee_code ||
                employee.department ||
                employee.contract_type ||
                employee.employment_status ||
                employee.manager_name ||
                employee.location ||
                employee.start_date ||
                employee.address_line1 ||
                employee.address_line2 ||
                employee.postal_code ||
                employee.city ||
                employee.country ||
                employee.work_permit ||
                employee.work_schedule ||
                employee.emergency_contact_name ||
                employee.notes
              );
            return (
            <article key={employee.id} className="employee-card">
              <div className="employee-card__header">
                <div className="avatar">
                  <User size={28} />
                </div>
                <div>
                  <h2>
                    {employee.first_name} {employee.last_name}
                  </h2>
                  <p>{employee.role || 'Poste non renseigné'}</p>
                </div>
              </div>

              <div className="employee-card__body">
                <InfoRow icon={<Mail size={16} />} label="Email" value={employee.email} />
                {employee.phone && <InfoRow icon={<Phone size={16} />} label="Téléphone" value={employee.phone} />}
                {expanded && (
                  <>
                    {employee.employee_code && <InfoRow icon={<Hash size={16} />} label="Matricule" value={employee.employee_code} />}
                    {employee.department && <InfoRow icon={<Building size={16} />} label="Département" value={employee.department} />}
                    {employee.contract_type && (
                      <InfoRow
                        icon={<Briefcase size={16} />}
                        label="Contrat"
                        value={`${employee.contract_type}${employee.work_rate ? ` · ${employee.work_rate}%` : ''}`}
                      />
                    )}
                    {employee.employment_status && <InfoRow icon={<Shield size={16} />} label="Statut" value={employee.employment_status} />}
                    {employee.manager_name && <InfoRow icon={<User size={16} />} label="Manager" value={employee.manager_name} />}
                    {employee.location && <InfoRow icon={<MapPin size={16} />} label="Site" value={employee.location} />}
                    {employee.start_date && (
                      <InfoRow icon={<Calendar size={16} />} label="Depuis" value={new Date(employee.start_date).toLocaleDateString('fr-FR')} />
                    )}
                    {(employee.address_line1 || employee.city) && (
                      <InfoRow
                        icon={<Home size={16} />}
                        label="Adresse"
                        value={[
                          employee.address_line1,
                          employee.address_line2,
                          `${employee.postal_code ?? ''} ${employee.city ?? ''}`.trim(),
                          employee.country
                        ]
                          .filter((part) => part && part.trim().length > 0)
                          .join(' · ')}
                      />
                    )}
                    {employee.work_permit && <InfoRow icon={<BadgeCheck size={16} />} label="Permis" value={employee.work_permit} />}
                    {employee.work_schedule && <InfoRow icon={<FileText size={16} />} label="Horaire" value={employee.work_schedule} />}
                    {employee.emergency_contact_name && (
                      <InfoRow
                        icon={<AlertTriangle size={16} />}
                        label="Contact d'urgence"
                        value={
                          employee.emergency_contact_phone
                            ? `${employee.emergency_contact_name} (${employee.emergency_contact_phone})`
                            : employee.emergency_contact_name
                        }
                      />
                    )}
                    {employee.notes && (
                      <div className="employee-notes">
                        <p>Notes RH</p>
                        <strong>{employee.notes}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="employee-card__actions">
                {hasDetails && (
                  <button className="btn btn-outline" onClick={() => toggleDetails(employee.id)}>
                    {expanded ? 'Masquer les détails' : 'Voir les détails'}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => openRhModal(employee)}>
                  RH+
                </button>
                {isAdmin && (
                  <button className="btn btn-outline" onClick={() => openEditModal(employee)}>
                    Modifier
                  </button>
                )}
              </div>
            </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel unified-modal">
            <div className="modal-header">
              <h2 className="modal-title">{title}</h2>
              <button className="modal-close" onClick={closeModal} aria-label="Fermer">
                ×
              </button>
            </div>

            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-section">
                <h3>Identité & contact</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label htmlFor="employee-code">Matricule / ID interne</label>
                    <input id="employee-code" value={form.employee_code} onChange={(e) => setForm((prev) => ({ ...prev, employee_code: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-first-name">
                      Prénom <span className="required-indicator">*</span>
                    </label>
                    <input
                      id="employee-first-name"
                      required
                      value={form.first_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-last-name">
                      Nom <span className="required-indicator">*</span>
                    </label>
                    <input id="employee-last-name" required value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-email">
                      Email professionnel <span className="required-indicator">*</span>
                    </label>
                    <input id="employee-email" type="email" required value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-personal-email">Email personnel</label>
                    <input id="employee-personal-email" type="email" value={form.personal_email} onChange={(e) => setForm((prev) => ({ ...prev, personal_email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-phone">Téléphone professionnel</label>
                    <input id="employee-phone" type="tel" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-personal-phone">Téléphone personnel</label>
                    <input id="employee-personal-phone" type="tel" value={form.personal_phone} onChange={(e) => setForm((prev) => ({ ...prev, personal_phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-birth-date">Date de naissance</label>
                    <input id="employee-birth-date" type="date" value={form.birth_date} onChange={(e) => setForm((prev) => ({ ...prev, birth_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-birth-location">Lieu de naissance</label>
                    <input id="employee-birth-location" value={form.birth_location} onChange={(e) => setForm((prev) => ({ ...prev, birth_location: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-nationality">Nationalité</label>
                    <input id="employee-nationality" value={form.nationality} onChange={(e) => setForm((prev) => ({ ...prev, nationality: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-marital-status">État civil</label>
                    <input id="employee-marital-status" value={form.marital_status} onChange={(e) => setForm((prev) => ({ ...prev, marital_status: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-dependent-children">Enfants à charge</label>
                    <input id="employee-dependent-children" value={form.dependent_children} onChange={(e) => setForm((prev) => ({ ...prev, dependent_children: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-id-document">N° document d'identité</label>
                    <input id="employee-id-document" value={form.id_document_number} onChange={(e) => setForm((prev) => ({ ...prev, id_document_number: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-ahv">AVS</label>
                    <input id="employee-ahv" value={form.ahv_number} onChange={(e) => setForm((prev) => ({ ...prev, ahv_number: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-iban">IBAN</label>
                    <input id="employee-iban" value={form.iban} onChange={(e) => setForm((prev) => ({ ...prev, iban: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Contrat & organisation</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label htmlFor="employee-department">Département</label>
                    <select id="employee-department" value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}>
                      <option value="">Sélectionner</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-role">Poste</label>
                    <input id="employee-role" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-contract-type">Type de contrat</label>
                    <select id="employee-contract-type" value={form.contract_type} onChange={(e) => setForm((prev) => ({ ...prev, contract_type: e.target.value }))}>
                      <option value="">Sélectionner</option>
                      {CONTRACT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-employment-status">Statut</label>
                    <select id="employee-employment-status" value={form.employment_status} onChange={(e) => setForm((prev) => ({ ...prev, employment_status: e.target.value }))}>
                      <option value="">Sélectionner</option>
                      {EMPLOYMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-work-rate">Taux d'activité (%)</label>
                    <input
                      id="employee-work-rate"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.work_rate}
                      onChange={(e) => setForm((prev) => ({ ...prev, work_rate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-work-schedule">Horaire / rythme</label>
                    <input id="employee-work-schedule" value={form.work_schedule} onChange={(e) => setForm((prev) => ({ ...prev, work_schedule: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-manager">Manager référent</label>
                    <input id="employee-manager" value={form.manager_name} onChange={(e) => setForm((prev) => ({ ...prev, manager_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-location">Site / localisation</label>
                    <select id="employee-location" value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}>
                      <option value="">Sélectionner</option>
                      {SITES.map((site) => (
                        <option key={site} value={site}>
                          {site}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-start-date">Date de début</label>
                    <input id="employee-start-date" type="date" value={form.start_date} onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Adresse & permis</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label htmlFor="employee-address-line1">Adresse (ligne 1)</label>
                    <input id="employee-address-line1" value={form.address_line1} onChange={(e) => setForm((prev) => ({ ...prev, address_line1: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-address-line2">Adresse (ligne 2)</label>
                    <input id="employee-address-line2" value={form.address_line2} onChange={(e) => setForm((prev) => ({ ...prev, address_line2: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-postal-code">NPA</label>
                    <input id="employee-postal-code" value={form.postal_code} onChange={(e) => setForm((prev) => ({ ...prev, postal_code: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-city">Ville</label>
                    <input id="employee-city" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-country">Pays</label>
                    <input id="employee-country" value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-work-permit">Permis / autorisation</label>
                    <input id="employee-work-permit" value={form.work_permit} onChange={(e) => setForm((prev) => ({ ...prev, work_permit: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Urgence & notes</h3>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label htmlFor="employee-emergency-contact">Contact d'urgence</label>
                    <input id="employee-emergency-contact" value={form.emergency_contact_name} onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="employee-emergency-phone">Téléphone d'urgence</label>
                    <input
                      id="employee-emergency-phone"
                      value={form.emergency_contact_phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="employee-notes">Notes RH</label>
                    <textarea id="employee-notes" rows={3} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement…' : editingId ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rhModalOpen && rhEmployee && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel unified-modal" style={{ maxWidth: '1100px' }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">RH+</p>
                <h2 className="modal-title">
                  {rhEmployee.first_name} {rhEmployee.last_name}
                </h2>
                <p>Compétences, certifications, EPI, HSE, performance</p>
              </div>
              <button className="modal-close" onClick={closeRhModal} aria-label="Fermer">
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="tab-nav">
                {[
                  { id: 'skills', label: 'Compétences' },
                  { id: 'certifications', label: 'Certifications' },
                  { id: 'trainings', label: 'Formations' },
                  { id: 'epis', label: 'EPI' },
                  { id: 'hse', label: 'HSE' },
                  { id: 'performance', label: 'Performance' },
                  { id: 'driver', label: 'Chauffeur' },
                  { id: 'timeclock', label: 'Pointage' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={rhTab === tab.id ? 'active' : ''}
                    onClick={() => setRhTab(tab.id as any)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {loadingRh ? (
                <div className="employees-empty">
                  <Loader2 className="h-6 w-6 animate-spin text-[#2563eb]" />
                  <p>Chargement…</p>
                </div>
              ) : (
                <div className="rh-sections" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div className="rh-list">
                    {rhTab === 'skills' && (
                      <div className="unified-card">
                        <h3>Compétences</h3>
                        <ul className="simple-list">
                          {skillItems.map((s) => (
                            <li key={s.id}>
                              <strong>{s.name}</strong>
                              {s.level ? ` · Niveau ${s.level}` : ''}
                              {s.expires_at ? (
                                <>
                                  {' · Expire le '}{s.expires_at} {expiryBadge(s.expires_at)}
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => {
                                  Api.deleteEmployeeSkill(rhEmployee.id, s.skill_id || s.id).then(() => {
                                    setSkillItems((prev) => prev.filter((x) => x.id !== s.id));
                                  });
                                }}
                              >
                                Retirer
                              </button>
                            </li>
                          ))}
                          {skillItems.length === 0 && <li>Aucune compétence</li>}
                        </ul>
                      </div>
                    )}

                    {rhTab === 'certifications' && (
                      <div className="unified-card">
                        <h3>Certifications</h3>
                        <ul className="simple-list">
                          {certItems.map((c) => (
                            <li key={c.id}>
                              <strong>{c.name || c.code}</strong>
                              {c.expires_at ? (
                                <>
                                  {' · Expire le '}{c.expires_at} {expiryBadge(c.expires_at)}
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => {
                                  Api.deleteEmployeeCertification(rhEmployee.id, c.certification_id || c.id).then(() => {
                                    setCertItems((prev) => prev.filter((x) => x.id !== c.id));
                                  });
                                }}
                              >
                                Retirer
                              </button>
                            </li>
                          ))}
                          {certItems.length === 0 && <li>Aucune certification</li>}
                        </ul>
                      </div>
                    )}

                    {rhTab === 'trainings' && (
                      <div className="unified-card">
                        <h3>Formations</h3>
                        <ul className="simple-list">
                          {trainingItems.map((t) => (
                            <li key={t.id}>
                              <strong>{t.title}</strong> · {t.status || 'pending'}
                              {t.expires_at ? (
                                <>
                                  {' · Expire le '}{t.expires_at} {expiryBadge(t.expires_at)}
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => {
                                  Api.deleteEmployeeTraining(rhEmployee.id, t.training_id || t.id).then(() => {
                                    setTrainingItems((prev) => prev.filter((x) => x.id !== t.id));
                                  });
                                }}
                              >
                                Retirer
                              </button>
                            </li>
                          ))}
                          {trainingItems.length === 0 && <li>Aucune formation</li>}
                        </ul>
                      </div>
                    )}

                    {rhTab === 'epis' && (
                      <div className="unified-card">
                        <h3>EPI attribués</h3>
                        <ul className="simple-list">
                          {epiItems.map((e) => (
                            <li key={e.id}>
                              <strong>{e.name}</strong> · {e.status || 'assigné'}
                              {e.expires_at ? (
                                <>
                                  {' · Expire le '}{e.expires_at} {expiryBadge(e.expires_at)}
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => {
                                  Api.deleteEmployeeEpi(rhEmployee.id, e.epi_id || e.id).then(() => {
                                    setEpiItems((prev) => prev.filter((x) => x.id !== e.id));
                                  });
                                }}
                              >
                                Retirer
                              </button>
                            </li>
                          ))}
                          {epiItems.length === 0 && <li>Aucun EPI</li>}
                        </ul>
                      </div>
                    )}

                    {rhTab === 'hse' && (
                      <div className="unified-card">
                        <h3>Incidents HSE</h3>
                        <ul className="simple-list">
                          {hseItems.map((i) => (
                            <li key={i.id}>
                              <strong>{i.type_label || i.type_code || 'Incident'}</strong> · {i.status || 'open'}
                              <div>{i.description}</div>
                              <div>{i.occurred_at ? new Date(i.occurred_at).toLocaleString('fr-FR') : ''}</div>
                            </li>
                          ))}
                          {hseItems.length === 0 && <li>Aucun incident</li>}
                        </ul>
                      </div>
                    )}

                    {rhTab === 'performance' && (
                      <div className="unified-card">
                        <h3>Performance</h3>
                        <ul className="simple-list">
                          {perfItems.map((p) => (
                            <li key={p.id}>
                              <strong>
                                {p.period_start} → {p.period_end}
                              </strong>
                              <div>Débit/h: {p.throughput_per_hour ?? '-'}</div>
                              <div>Qualité: {p.quality_score ?? '-'}</div>
                              <div>Sécurité: {p.safety_score ?? '-'}</div>
                              <div>Polyvalence: {p.versatility_score ?? '-'}</div>
                            </li>
                          ))}
                          {perfItems.length === 0 && <li>Aucune donnée</li>}
                        </ul>
                      </div>
                    )}

                    {rhTab === 'driver' && (
                      <div className="unified-card">
                        <h3>Chauffeur</h3>
                        <ul className="simple-list">
                          {driverItems.map((d) => (
                            <li key={d.id}>
                              <strong>
                                {d.period_start} → {d.period_end}
                              </strong>
                              <div>Heures conduite: {d.driving_hours ?? '-'}</div>
                              <div>Incidents: {d.incidents ?? 0}</div>
                              <div>Ponctualité: {d.punctuality_score ?? '-'}</div>
                              <div>Éco conduite: {d.fuel_efficiency_score ?? '-'}</div>
                            </li>
                          ))}
                          {driverItems.length === 0 && <li>Aucune donnée</li>}
                        </ul>
                      </div>
                    )}

                    {rhTab === 'timeclock' && (
                      <div className="unified-card">
                        <h3>Pointage</h3>
                        <ul className="simple-list">
                          {timeClockItems.map((t) => (
                            <li key={t.id}>
                              <strong>{t.event_type}</strong> · {t.occurred_at ? new Date(t.occurred_at).toLocaleString('fr-FR') : ''}
                              {t.line_name ? ` · ${t.line_name}` : ''}
                              {t.position_code ? ` (${t.position_code})` : ''}
                            </li>
                          ))}
                          {timeClockItems.length === 0 && <li>Aucun pointage</li>}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="rh-form unified-card">
                    {rhTab === 'skills' && (
                      <>
                        <h4>Ajouter une compétence</h4>
                        <select
                          value={rhForm.skill_id || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, skill_id: e.target.value }))}
                        >
                          <option value="">Sélectionner</option>
                          {skills.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          placeholder="Niveau (1-5)"
                          value={rhForm.level || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, level: e.target.value }))}
                        />
                        <input
                          type="date"
                          value={rhForm.expires_at || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, expires_at: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            if (!rhForm.skill_id) return toast.error('Choisissez une compétence');
                            const row = await Api.upsertEmployeeSkill(rhEmployee.id, {
                              skill_id: rhForm.skill_id,
                              level: rhForm.level ? Number(rhForm.level) : undefined,
                              expires_at: rhForm.expires_at || undefined
                            });
                            setSkillItems((prev) => {
                              const others = prev.filter((p) => p.skill_id !== row.skill_id);
                              return [...others, row];
                            });
                            setRhForm({});
                            toast.success('Compétence ajoutée');
                          }}
                        >
                          Enregistrer
                        </button>
                      </>
                    )}

                    {rhTab === 'certifications' && (
                      <>
                        <h4>Ajouter une certification</h4>
                        <select
                          value={rhForm.certification_id || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, certification_id: e.target.value }))}
                        >
                          <option value="">Sélectionner</option>
                          {certifications.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name || c.code}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          placeholder="Obtention"
                          value={rhForm.obtained_at || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, obtained_at: e.target.value }))}
                        />
                        <input
                          type="date"
                          placeholder="Expiration"
                          value={rhForm.expires_at || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, expires_at: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            if (!rhForm.certification_id) return toast.error('Choisissez une certification');
                            const row = await Api.upsertEmployeeCertification(rhEmployee.id, {
                              certification_id: rhForm.certification_id,
                              obtained_at: rhForm.obtained_at || undefined,
                              expires_at: rhForm.expires_at || undefined
                            });
                            setCertItems((prev) => {
                              const others = prev.filter((p) => p.certification_id !== row.certification_id);
                              return [...others, row];
                            });
                            setRhForm({});
                            toast.success('Certification enregistrée');
                          }}
                        >
                          Enregistrer
                        </button>
                      </>
                    )}

                    {rhTab === 'trainings' && (
                      <>
                        <h4>Ajouter une formation</h4>
                        <select
                          value={rhForm.training_id || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, training_id: e.target.value }))}
                        >
                          <option value="">Sélectionner</option>
                          {trainings.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                        <select
                          value={rhForm.status || 'pending'}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, status: e.target.value }))}
                        >
                          <option value="pending">En attente</option>
                          <option value="done">Réalisée</option>
                        </select>
                        <input
                          type="date"
                          placeholder="Date"
                          value={rhForm.taken_at || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, taken_at: e.target.value }))}
                        />
                        <input
                          type="date"
                          placeholder="Expiration"
                          value={rhForm.expires_at || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, expires_at: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            if (!rhForm.training_id) return toast.error('Choisissez une formation');
                            const row = await Api.upsertEmployeeTraining(rhEmployee.id, {
                              training_id: rhForm.training_id,
                              status: rhForm.status || 'pending',
                              taken_at: rhForm.taken_at || undefined,
                              expires_at: rhForm.expires_at || undefined
                            });
                            setTrainingItems((prev) => {
                              const others = prev.filter((p) => p.training_id !== row.training_id);
                              return [...others, row];
                            });
                            setRhForm({});
                            toast.success('Formation enregistrée');
                          }}
                        >
                          Enregistrer
                        </button>
                      </>
                    )}

                    {rhTab === 'epis' && (
                      <>
                        <h4>Attribuer un EPI</h4>
                        <select
                          value={rhForm.epi_id || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, epi_id: e.target.value }))}
                        >
                          <option value="">Sélectionner</option>
                          {epis.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={rhForm.assigned_at || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, assigned_at: e.target.value }))}
                        />
                        <input
                          type="date"
                          value={rhForm.expires_at || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, expires_at: e.target.value }))}
                        />
                        <select
                          value={rhForm.status || 'assigned'}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, status: e.target.value }))}
                        >
                          <option value="assigned">Assigné</option>
                          <option value="returned">Retourné</option>
                        </select>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            if (!rhForm.epi_id) return toast.error('Choisissez un EPI');
                            const row = await Api.assignEmployeeEpi(rhEmployee.id, {
                              epi_id: rhForm.epi_id,
                              assigned_at: rhForm.assigned_at || undefined,
                              expires_at: rhForm.expires_at || undefined,
                              status: rhForm.status || 'assigned'
                            });
                            setEpiItems((prev) => [...prev, row]);
                            setRhForm({});
                            toast.success('EPI attribué');
                          }}
                        >
                          Enregistrer
                        </button>
                      </>
                    )}

                    {rhTab === 'hse' && (
                      <>
                        <h4>Déclarer un incident</h4>
                        <input
                          type="text"
                          placeholder="Type / code"
                          value={rhForm.type_id || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, type_id: e.target.value }))}
                        />
                        <textarea
                          placeholder="Description"
                          value={rhForm.description || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, description: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            const row = await Api.createHseIncident({
                              employee_id: rhEmployee.id,
                              type_id: rhForm.type_id || undefined,
                              description: rhForm.description || undefined
                            });
                            setHseItems((prev) => [row, ...prev].slice(0, 50));
                            setRhForm({});
                            toast.success('Incident enregistré');
                          }}
                        >
                          Enregistrer
                        </button>
                      </>
                    )}

                    {rhTab === 'performance' && (
                      <>
                        <h4>Performance</h4>
                        <input
                          type="date"
                          value={rhForm.period_start || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, period_start: e.target.value }))}
                          placeholder="Début"
                        />
                        <input
                          type="date"
                          value={rhForm.period_end || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, period_end: e.target.value }))}
                          placeholder="Fin"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Débit/h"
                          value={rhForm.throughput_per_hour || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, throughput_per_hour: e.target.value }))}
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Qualité"
                          value={rhForm.quality_score || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, quality_score: e.target.value }))}
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Sécurité"
                          value={rhForm.safety_score || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, safety_score: e.target.value }))}
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Polyvalence"
                          value={rhForm.versatility_score || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, versatility_score: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            if (!rhForm.period_start || !rhForm.period_end) return toast.error('Renseignez la période');
                            const row = await Api.upsertEmployeePerformance(rhEmployee.id, {
                              period_start: rhForm.period_start,
                              period_end: rhForm.period_end,
                              throughput_per_hour: rhForm.throughput_per_hour ? Number(rhForm.throughput_per_hour) : undefined,
                              quality_score: rhForm.quality_score ? Number(rhForm.quality_score) : undefined,
                              safety_score: rhForm.safety_score ? Number(rhForm.safety_score) : undefined,
                              versatility_score: rhForm.versatility_score ? Number(rhForm.versatility_score) : undefined,
                              incidents_count: rhForm.incidents_count ? Number(rhForm.incidents_count) : undefined
                            });
                            setPerfItems((prev) => {
                              const others = prev.filter((p) => !(p.period_start === row.period_start && p.period_end === row.period_end));
                            return [row, ...others].slice(0, 50);
                            });
                            setRhForm({});
                            toast.success('Performance enregistrée');
                          }}
                        >
                          Enregistrer
                        </button>
                      </>
                    )}

                    {rhTab === 'driver' && (
                      <>
                        <h4>Chauffeur</h4>
                        <input
                          type="date"
                          value={rhForm.period_start || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, period_start: e.target.value }))}
                        />
                        <input
                          type="date"
                          value={rhForm.period_end || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, period_end: e.target.value }))}
                        />
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Heures conduite"
                          value={rhForm.driving_hours || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, driving_hours: e.target.value }))}
                        />
                        <input
                          type="number"
                          placeholder="Incidents"
                          value={rhForm.incidents || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, incidents: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            if (!rhForm.period_start || !rhForm.period_end) return toast.error('Renseignez la période');
                            const row = await Api.upsertEmployeeDriverCompliance(rhEmployee.id, {
                              period_start: rhForm.period_start,
                              period_end: rhForm.period_end,
                              driving_hours: rhForm.driving_hours ? Number(rhForm.driving_hours) : undefined,
                              incidents: rhForm.incidents ? Number(rhForm.incidents) : undefined,
                              punctuality_score: rhForm.punctuality_score ? Number(rhForm.punctuality_score) : undefined,
                              fuel_efficiency_score: rhForm.fuel_efficiency_score ? Number(rhForm.fuel_efficiency_score) : undefined
                            });
                            setDriverItems((prev) => {
                              const others = prev.filter((p) => !(p.period_start === row.period_start && p.period_end === row.period_end));
                              return [row, ...others].slice(0, 50);
                            });
                            setRhForm({});
                            toast.success('Données chauffeur enregistrées');
                          }}
                        >
                          Enregistrer
                        </button>
                      </>
                    )}

                    {rhTab === 'timeclock' && (
                      <>
                        <h4>Pointage manuel</h4>
                        <select
                          value={rhForm.event_type || 'in'}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, event_type: e.target.value }))}
                        >
                          <option value="in">Entrée</option>
                          <option value="out">Sortie</option>
                          <option value="pause_in">Pause début</option>
                          <option value="pause_out">Pause fin</option>
                          <option value="position_change">Changement poste</option>
                        </select>
                        <input
                          type="datetime-local"
                          value={rhForm.occurred_at || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, occurred_at: e.target.value }))}
                        />
                        <input
                          type="text"
                          placeholder="Source (RFID/QR/mobile)"
                          value={rhForm.source || ''}
                          onChange={(e) => setRhForm((prev: any) => ({ ...prev, source: e.target.value }))}
                        />
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={async () => {
                            if (!rhForm.event_type) return toast.error('Type requis');
                            const row = await Api.createTimeClockEvent({
                              employee_id: rhEmployee.id,
                              event_type: rhForm.event_type,
                              occurred_at: rhForm.occurred_at || undefined,
                              source: rhForm.source || undefined
                            });
                            setTimeClockItems((prev) => [row, ...prev].slice(0, 50));
                            setRhForm({});
                            toast.success('Pointage enregistré');
                          }}
                        >
                          Enregistrer
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="employee-info">
    <span className="employee-info__icon">{icon}</span>
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  </div>
);

export default EmployeesPage;

