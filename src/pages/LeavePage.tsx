import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  User,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Plus
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import toast from 'react-hot-toast';
import { format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { jsPDF } from 'jspdf';

import { Api } from '../lib/api';
import { MONTHS, getMonthDays, isDateWeekend, isHoliday, calculateBusinessDays } from '../utils/dates';
import type { CantonCode } from '../utils/dates';
import type { Leave, LeaveBalance, LeaveRequestPayload, LeaveStatus, LeaveType, EmployeeSummary } from '../types/leaves';
import type { Employee } from '../types/employees';
import { useAuth } from '../hooks/useAuth';

const TYPE_COLORS: Record<LeaveType, string> = {
  vacances: 'rgba(59, 130, 246, 0.18)',
  maladie: 'rgba(248, 113, 113, 0.22)',
  accident: 'rgba(251, 191, 36, 0.22)',
  deces: 'rgba(148, 163, 184, 0.32)',
  formation: 'rgba(196, 181, 253, 0.32)',
  heures_sup: 'rgba(16, 185, 129, 0.22)',
  armee: 'rgba(107, 114, 128, 0.28)'
};

const TYPE_LABELS: Record<LeaveType, string> = {
  vacances: 'Vacances',
  maladie: 'Maladie',
  accident: 'Accident',
  deces: 'Congé décès',
  formation: 'Formation',
  heures_sup: 'Heures sup.',
  armee: 'Armée / PC'
};

const TYPE_PDF_COLORS: Record<LeaveType, [number, number, number]> = {
  vacances: [0, 176, 240],
  maladie: [255, 0, 0],
  accident: [255, 165, 0],
  deces: [120, 120, 120],
  formation: [128, 0, 128],
  heures_sup: [0, 200, 83],
  armee: [64, 64, 64]
};

const STATUS_TAG: Record<LeaveStatus, string> = {
  en_attente: 'pending',
  approuve: 'approved',
  refuse: 'rejected'
};

const PRIMARY_PDF_TYPES: LeaveType[] = ['vacances', 'heures_sup', 'armee'];

type PeriodForm = { type: LeaveType; start_date: string; end_date: string };

interface NewLeaveForm {
  employee_id: string;
  email: string;
  first_name: string;
  last_name: string;
  comment: string;
  periods: PeriodForm[];
  army_reference: string;
  army_start_date: string;
  army_end_date: string;
}

const createDefaultFormState = (): NewLeaveForm => ({
  employee_id: '',
  email: '',
  first_name: '',
  last_name: '',
  comment: '',
  periods: Array.from({ length: 3 }, () => ({ type: 'vacances', start_date: '', end_date: '' })),
  army_reference: '',
  army_start_date: '',
  army_end_date: ''
});

type LeaveTab = 'calendrier' | 'demandes' | 'soldes';

interface LeavePageProps {
  initialTab?: LeaveTab;
}

const CANTON_OPTIONS: Array<{ code: CantonCode; label: string }> = [
  { code: 'VD', label: 'Vaud (VD)' },
  { code: 'GE', label: 'Genève (GE)' },
  { code: 'FR', label: 'Fribourg (FR)' },
  { code: 'VS', label: 'Valais (VS)' },
  { code: 'NE', label: 'Neuchâtel (NE)' },
  { code: 'ZH', label: 'Zurich (ZH)' },
  { code: 'BE', label: 'Berne (BE)' },
  { code: 'JU', label: 'Jura (JU)' },
  { code: 'TI', label: 'Tessin (TI)' }
];

const LeavePage: React.FC<LeavePageProps> = ({ initialTab = 'calendrier' }) => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('admin') || hasRole('manager');
  const availableTabs = useMemo<LeaveTab[]>(() => (isManager ? ['calendrier', 'demandes', 'soldes'] : ['calendrier', 'soldes']), [isManager]);
  const initialSafeTab = availableTabs.includes(initialTab) ? initialTab : availableTabs[0];
  const [activeTab, setActiveTab] = useState<LeaveTab>(initialSafeTab);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [calendarLeaves, setCalendarLeaves] = useState<Leave[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<Leave[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [newLeave, setNewLeave] = useState<NewLeaveForm>(createDefaultFormState);
  const [selectedCanton, setSelectedCanton] = useState<CantonCode>('VD');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const groupedPendingLeaves = useMemo(() => {
    const map = new Map<string, Leave[]>();
    pendingLeaves.forEach((leave) => {
      const key = leave.request_group_id ?? leave.id;
      const existing = map.get(key);
      if (existing) {
        existing.push(leave);
      } else {
        map.set(key, [leave]);
      }
    });
    return Array.from(map.values());
  }, [pendingLeaves]);


  const currentEmployee = useMemo(
    () => employees.find((employee) => employee.email?.toLowerCase() === user?.email?.toLowerCase()),
    [employees, user?.email]
  );
  const departmentScope = useMemo(() => {
    if (isAdmin) return null;
    return currentEmployee?.department ?? null;
  }, [isAdmin, currentEmployee]);
  const scopedEmployees = useMemo(() => {
    if (!departmentScope) {
      return employees;
    }
    return employees.filter((employee) => employee.department === departmentScope);
  }, [employees, departmentScope]);

  const managerOptions = useMemo(() => {
    const source = isManager ? employees : scopedEmployees;
    const options = new Set<string>();
    source.forEach((employee) => {
      if (employee.manager_name) {
        options.add(employee.manager_name);
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [employees, scopedEmployees, isManager]);

  const departmentOptions = useMemo(() => {
    const source = isManager ? employees : scopedEmployees;
    const options = new Set<string>();
    source.forEach((employee) => {
      if (employee.department) {
        options.add(employee.department);
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [employees, scopedEmployees, isManager]);

  const resolveEmployeeMeta = useCallback(
    (leave: Leave) => {
      const summary = leave.employee;
      const fallback = employees.find((employee) => employee.id === (summary?.id ?? leave.employee_id));
      return {
        department: summary?.department ?? fallback?.department ?? null,
        manager: summary?.manager_name ?? fallback?.manager_name ?? null,
        role: summary?.role ?? fallback?.role ?? null
      };
    },
    [employees]
  );

  const effectiveDepartmentFilter = isAdmin ? departmentFilter : departmentScope ?? 'all';
  const effectiveManagerFilter = isAdmin ? managerFilter : currentEmployee?.manager_name ?? 'all';

  const matchesFilters = useCallback(
    (leave: Leave) => {
      const meta = resolveEmployeeMeta(leave);
      if (effectiveDepartmentFilter !== 'all') {
        if (effectiveDepartmentFilter === 'none') {
          if (meta.department) {
            return false;
          }
        } else if (meta.department !== effectiveDepartmentFilter) {
          return false;
        }
      }
      if (effectiveManagerFilter !== 'all') {
        if (effectiveManagerFilter === 'none') {
          if (meta.manager) {
            return false;
          }
        } else if (meta.manager !== effectiveManagerFilter) {
          return false;
        }
      }
      return true;
    },
    [effectiveDepartmentFilter, effectiveManagerFilter, resolveEmployeeMeta]
  );

  const filteredPendingGroups = useMemo(
    () => groupedPendingLeaves.filter((group) => group.length > 0 && matchesFilters(group[0])),
    [groupedPendingLeaves, matchesFilters]
  );

  const overlappingPendingLeaves = useMemo(() => {
    const conflictIds = new Set<string>();
    const conflictDetails = new Map<string, { department: string | null; role: string | null }>();
    const buckets = new Map<string, Leave[]>();

    pendingLeaves.forEach((leave) => {
      const meta = resolveEmployeeMeta(leave);
      const department = meta.department ?? null;
      const role = meta.role ?? null;
      if (!department || !role) {
        return;
      }
      const key = `${department}::${role}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(leave);
      } else {
        buckets.set(key, [leave]);
      }
    });

    buckets.forEach((bucket, key) => {
      if (bucket.length < 2) return;
      const sorted = bucket.slice().sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      for (let i = 0; i < sorted.length; i += 1) {
        const current = sorted[i];
        const currentStart = new Date(current.start_date).getTime();
        const currentEnd = new Date(current.end_date).getTime();
        for (let j = i + 1; j < sorted.length; j += 1) {
          const next = sorted[j];
          const nextStart = new Date(next.start_date).getTime();
          const nextEnd = new Date(next.end_date).getTime();
          if (nextStart > currentEnd) {
            break;
          }
          if (currentStart <= nextEnd && nextStart <= currentEnd) {
            conflictIds.add(current.id);
            conflictIds.add(next.id);
            const [department, role] = key.split('::');
            conflictDetails.set(current.id, { department, role });
            conflictDetails.set(next.id, { department, role });
          }
        }
      }
    });

    return { conflictIds, conflictDetails };
  }, [pendingLeaves, resolveEmployeeMeta]);
  const { conflictIds, conflictDetails } = overlappingPendingLeaves;

  const employeeSignatureRef = useRef<SignatureCanvas | null>(null);
  const managerSignatureRef = useRef<SignatureCanvas | null>(null);

  const days = useMemo(() => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const approvedCalendarLeaves = useMemo(
    () => calendarLeaves.filter((leave) => leave.status === 'approuve'),
    [calendarLeaves]
  );
  const employeesWithApprovedLeaves = useMemo(
    () => Array.from(new Set(approvedCalendarLeaves.map((leave) => leave.employee_id))),
    [approvedCalendarLeaves]
  );
  const filteredEmployees = useMemo(
    () => scopedEmployees.filter((employee) => employeesWithApprovedLeaves.includes(employee.id)),
    [scopedEmployees, employeesWithApprovedLeaves]
  );
  const displayEmployees = filteredEmployees;
  const displayBalances = useMemo(
    () => (isManager ? leaveBalances : leaveBalances.filter((balance) => balance.employee?.id === currentEmployee?.id)),
    [leaveBalances, isManager, currentEmployee?.id]
  );
  const showEmptyCalendarMessage = approvedCalendarLeaves.length === 0 || displayEmployees.length === 0;
  const [showFullMobileCalendar, setShowFullMobileCalendar] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

      const pendingPromise = isManager ? Api.fetchPendingLeaves() : Promise.resolve([] as Leave[]);
      const [employeesRes, pendingRes, balancesRes, calendarRes] = await Promise.all([
        Api.fetchEmployees(),
        pendingPromise,
        Api.fetchLeaveBalances(year),
        Api.fetchCalendarLeaves({ start, end })
      ]);

      setEmployees(employeesRes ?? []);
      setPendingLeaves(pendingRes ?? []);
      setLeaveBalances(balancesRes ?? []);
      setCalendarLeaves(calendarRes ?? []);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les données RH');
    } finally {
      setLoading(false);
    }
  }, [currentDate, isManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateLayout = () => setIsCompactLayout(window.innerWidth <= 960);
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    if (!isCompactLayout && showFullMobileCalendar) {
      setShowFullMobileCalendar(false);
    }
  }, [isCompactLayout, showFullMobileCalendar]);

  const getLeaveForDay = useCallback(
    (employeeId: string, date: Date) => {
      return approvedCalendarLeaves.find((leave) => {
        const start = startOfDay(new Date(leave.start_date));
        const end = startOfDay(new Date(leave.end_date));
        const current = startOfDay(date);
        return leave.employee_id === employeeId && current >= start && current <= end;
      });
    },
    [approvedCalendarLeaves]
  );

  const openAddModal = () => {
    setShowAddModal(true);
    requestAnimationFrame(() => employeeSignatureRef.current?.clear());
    setNewLeave((prev) => {
      if (!currentEmployee) {
        return createDefaultFormState();
      }
      return {
        ...prev,
        employee_id: currentEmployee.id ?? '',
        first_name: currentEmployee.first_name || prev.first_name,
        last_name: currentEmployee.last_name || prev.last_name,
        email: currentEmployee.email || user?.email || prev.email
      };
    });
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewLeave(createDefaultFormState());
    employeeSignatureRef.current?.clear();
  };

  const handleEmployeeSelect = (employeeId: string) => {
    if (!employeeId) {
      if (currentEmployee) {
        setNewLeave((prev) => ({
          ...prev,
          employee_id: currentEmployee.id ?? '',
          first_name: currentEmployee.first_name ?? '',
          last_name: currentEmployee.last_name ?? '',
          email: currentEmployee.email ?? user?.email ?? ''
        }));
      } else {
        setNewLeave((prev) => ({
          ...prev,
          employee_id: '',
          first_name: '',
          last_name: '',
          email: ''
        }));
      }
      return;
    }
    const employee = employees.find((emp) => emp.id === employeeId);
    if (employee) {
      setNewLeave((prev) => ({
        ...prev,
        employee_id: employeeId,
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email
      }));
    } else {
      setNewLeave((prev) => ({ ...prev, employee_id: employeeId }));
    }
  };

  useEffect(() => {
    if (currentEmployee) {
      setNewLeave((prev) => ({
        ...prev,
        employee_id: currentEmployee.id ?? '',
        first_name: currentEmployee.first_name ?? '',
        last_name: currentEmployee.last_name ?? '',
        email: currentEmployee.email ?? user?.email ?? ''
      }));
    }
  }, [currentEmployee, user?.email]);

  useEffect(() => {
    if (!isAdmin) {
      setDepartmentFilter(departmentScope ?? 'all');
      setManagerFilter(currentEmployee?.manager_name ?? 'all');
    }
  }, [departmentScope, currentEmployee?.manager_name, isAdmin]);

  const openSignModal = (leave: Leave) => {
    setSelectedLeave(leave);
    setShowSignModal(true);
    requestAnimationFrame(() => managerSignatureRef.current?.clear());
  };

  const closeSignModal = () => {
    setShowSignModal(false);
    setSelectedLeave(null);
    managerSignatureRef.current?.clear();
  };

  const handleNewLeaveSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const signaturePad = employeeSignatureRef.current;
    if (!signaturePad || signaturePad.isEmpty()) {
      toast.error('Merci de signer avant de soumettre la demande.');
      return;
    }

    const hasEmployee =
      Boolean(newLeave.employee_id) ||
      (newLeave.email.trim() && newLeave.first_name.trim() && newLeave.last_name.trim());

    if (!hasEmployee) {
      toast.error('Sélectionnez un employé ou renseignez email / prénom / nom.');
      return;
    }

    const periods = newLeave.periods.filter((p) => p.start_date && p.end_date);
    if (newLeave.army_start_date && newLeave.army_end_date) {
      periods.push({
        type: 'armee',
        start_date: newLeave.army_start_date,
        end_date: newLeave.army_end_date
      });
    }
    if (periods.length === 0) {
      toast.error('Ajoutez au moins une période complète.');
      return;
    }

    if (
      (newLeave.army_start_date && !newLeave.army_end_date) ||
      (!newLeave.army_start_date && newLeave.army_end_date)
    ) {
      toast.error('Renseignez les deux dates Armée / PC ou laissez les champs vides.');
      return;
    }

    const payload: LeaveRequestPayload = {
      employee_id: newLeave.employee_id || undefined,
      email: newLeave.email || undefined,
      first_name: newLeave.first_name || undefined,
      last_name: newLeave.last_name || undefined,
      comment: newLeave.comment || undefined,
      signature: signaturePad.toDataURL(),
      periods,
      army_reference: newLeave.army_reference || undefined,
      army_start_date: newLeave.army_start_date || undefined,
      army_end_date: newLeave.army_end_date || undefined
    };

    try {
      await Api.createLeaveRequest(payload);
      toast.success('Demande envoyée');
      closeAddModal();
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || 'Erreur lors de la création');
    }
  };

  const handleRequestAction = async (leave: Leave, action: LeaveStatus) => {
    if (!matchesFilters(leave)) {
      toast.error("Cette demande appartient à un autre secteur");
      return;
    }
    if (action === 'approuve') {
      openSignModal(leave);
      return;
    }
    try {
      await Api.updateLeaveStatus(leave.id, action);
      toast.success('Statut mis à jour');
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || 'Action impossible');
    }
  };

const handleDeleteLeave = async (leaveToDelete: Leave) => {
    if (!matchesFilters(leaveToDelete)) {
      toast.error("Cette demande appartient à un autre secteur");
      return;
    }
    if (!window.confirm('Supprimer cette demande ?')) {
      return;
    }
    try {
      await Api.deleteLeave(leaveToDelete.id);
      toast.success('Demande supprimée');
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || 'Suppression impossible');
    }
  };

const submitApprovalWithSignature = async (holidayCanton: CantonCode) => {
    if (!selectedLeave || !matchesFilters(selectedLeave)) {
      toast.error("Cette demande n'appartient pas à votre périmètre");
      return;
    }
    if (!managerSignatureRef.current || managerSignatureRef.current.isEmpty()) {
      toast.error('Signature manager requise');
      return;
    }

    try {
      const signature = managerSignatureRef.current.toDataURL();
      const groupedLeaves =
        selectedLeave.request_group_id != null
          ? pendingLeaves.filter((leave) => leave.request_group_id === selectedLeave.request_group_id)
          : [selectedLeave];

      await Promise.all(groupedLeaves.map((leave) => Api.updateLeaveStatus(leave.id, 'approuve', signature)));
      const pdfDocument = await generatePDF(
        groupedLeaves[0],
        signature,
        groupedLeaves.map((leave) => ({
          type: leave.type,
          start_date: leave.start_date,
          end_date: leave.end_date
        })),
        groupedLeaves[0].signature ?? ''
      );
      await Api.notifyVacationApproval({
        leaveIds: groupedLeaves.map((leave) => leave.id),
        canton: holidayCanton,
        pdfBase64: pdfDocument.base64,
        pdfFilename: pdfDocument.filename
      });
      toast.success('Demande approuvée');
      closeSignModal();
      await loadData();
      pdfDocument.doc.save(pdfDocument.filename);
    } catch (error) {
      toast.error((error as Error).message || 'Impossible d’approuver');
    }
  };

  const formatRange = (leave: Leave) =>
    `${format(new Date(leave.start_date), 'dd MMM', { locale: fr })} – ${format(new Date(leave.end_date), 'dd MMM', {
      locale: fr
    })}`;

  const mobileEmployeeSummaries = useMemo(() => {
    if (!isCompactLayout) {
      return [];
    }

    return displayEmployees.map((employee) => ({
      employee,
      leaves: approvedCalendarLeaves.filter((leave) => leave.employee_id === employee.id)
    }));
  }, [isCompactLayout, displayEmployees, approvedCalendarLeaves]);

  return (
    <section>
      <div className="page-header">
        <div>
          <p className="eyebrow">RH +</p>
          <h1 className="page-title">Demandes de congés</h1>
          <p className="page-subtitle">
            Vision calendrier, flux d’approbation et suivi des soldes intégrés pour toutes les équipes.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline">
            Exporter
          </button>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} />
            Nouvelle demande
          </button>
        </div>
      </div>

      <div className="card">
        <div className="tab-nav">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? 'active' : ''}
            >
                {tab === 'demandes' ? `Demandes (${filteredPendingGroups.length})` : tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state" style={{ gap: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
            <p>Chargement des données RH…</p>
          </div>
        ) : (
          <>
            {activeTab === 'calendrier' && (
              <div className="calendar-card">
                <div className="calendar-controls">
                  <div className="calendar-controls-group">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <select
                      value={currentDate.getMonth()}
                      onChange={(event) => setCurrentDate(new Date(currentDate.getFullYear(), Number(event.target.value), 1))}
                    >
                      {MONTHS.map((month, index) => (
                        <option key={month} value={index}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <select
                      value={currentDate.getFullYear()}
                      onChange={(event) => setCurrentDate(new Date(Number(event.target.value), currentDate.getMonth(), 1))}
                    >
                      {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="calendar-controls-group">
                    <label className="input-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Canton
                    </label>
                    <select value={selectedCanton} onChange={(event) => setSelectedCanton(event.target.value as CantonCode)}>
                      {CANTON_OPTIONS.map((canton) => (
                        <option key={canton.code} value={canton.code}>
                          {canton.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="legend">
                    {Object.entries(TYPE_LABELS).map(([type, label]) => (
                      <span key={type}>
                        <span className="legend-dot" style={{ background: TYPE_COLORS[type as LeaveType] }} />
                        {label}
                      </span>
                    ))}
                    <span>
                      <span className="legend-dot legend-dot-holiday" />
                      Jours fériés
                    </span>
                  </div>
                {isCompactLayout && (
                  <button
                    type="button"
                    className="btn btn-outline mobile-calendar-toggle"
                    onClick={() => setShowFullMobileCalendar((prev) => !prev)}
                  >
                    {showFullMobileCalendar ? 'Vue compacte' : 'Voir le calendrier'}
                  </button>
                )}
                </div>

                {showEmptyCalendarMessage && (
                  <div className="calendar-hint">Aucun congé approuvé pour ce mois. Les jours fériés et week-ends restent visibles.</div>
                )}
              {isCompactLayout && !showFullMobileCalendar ? (
                  <div className="calendar-mobile">
                    {displayEmployees.length === 0 ? (
                      <div className="calendar-hint">Aucun congé approuvé ce mois-ci</div>
                    ) : (
                      mobileEmployeeSummaries.map(({ employee, leaves }) => (
                        <article key={employee.id} className="calendar-mobile-card">
                          <header>
                            <div>
                              <strong>
                                {employee.first_name} {employee.last_name}
                              </strong>
                              <p>{employee.department || 'Département non défini'}</p>
                            </div>
                            <span className="calendar-mobile-count">{leaves.length} période(s)</span>
                          </header>
                          {leaves.length === 0 ? (
                            <p className="calendar-mobile-empty">Pas de congé ce mois.</p>
                          ) : (
                            <ul>
                              {leaves.map((leave) => (
                                <li key={leave.id} className="calendar-mobile-leave">
                                  <span
                                    className="calendar-mobile-leave-dot"
                                    style={{ background: TYPE_COLORS[leave.type] }}
                                    aria-hidden
                                  />
                                  <div>
                                    <p>{TYPE_LABELS[leave.type]}</p>
                                    <small>{formatRange(leave)}</small>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </article>
                      ))
                    )}
                  </div>
              ) : (
                  <div className="calendar-table-wrapper">
                  {isCompactLayout && showFullMobileCalendar && (
                    <p className="calendar-hint">Vue calendrier complète (défilable) avec jours fériés visibles.</p>
                  )}
                    <table className="calendar-table">
                      <thead>
                        <tr>
                          <th className="sticky">Employé</th>
                          {days.map((day) => {
                            const dayClasses = ['calendar-day-header'];
                            if (isDateWeekend(day)) dayClasses.push('weekend');
                            if (isHoliday(day, selectedCanton)) dayClasses.push('holiday');
                            return (
                              <th key={day.toISOString()} className={dayClasses.join(' ')}>
                                {day.getDate()}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {displayEmployees.length === 0 ? (
                          <tr className="calendar-placeholder-row">
                            <td className="sticky">—</td>
                            <td colSpan={days.length} className="calendar-placeholder-cell">
                              Aucun congé approuvé ce mois-ci
                            </td>
                          </tr>
                        ) : (
                          displayEmployees.map((employee) => (
                            <tr key={employee.id}>
                              <td className="sticky">{`${employee.first_name} ${employee.last_name}`}</td>
                              {days.map((day) => {
                                const leave = getLeaveForDay(employee.id, day);
                                const classNames = ['calendar-cell'];
                                if (isDateWeekend(day)) classNames.push('weekend');
                                if (isHoliday(day, selectedCanton)) classNames.push('holiday');
                                if (leave) classNames.push('leave');
                                const cellStyle: React.CSSProperties = {};
                                if (isHoliday(day, selectedCanton)) {
                                  cellStyle.boxShadow = 'inset 0 0 0 2px rgba(248, 113, 113, 0.9)';
                                }
                                return (
                                  <td key={`${employee.id}-${day.toISOString()}`}>
                                    <div className={classNames.join(' ')} style={Object.keys(cellStyle).length > 0 ? cellStyle : undefined}>
                                      {leave && (
                                        <span
                                          className="calendar-leave-pill"
                                          style={{ background: TYPE_COLORS[leave.type] }}
                                          aria-label={TYPE_LABELS[leave.type]}
                                        />
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {isManager && activeTab === 'demandes' && (
              <div className="requests-list">
                {isAdmin ? (
                  <div className="request-filters">
                    <label className="request-filter">
                      <span>Département</span>
                      <select className="destruction-input" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                        <option value="all">Tous</option>
                        <option value="none">Sans département</option>
                        {departmentOptions.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="request-filter">
                      <span>Responsable</span>
                      <select className="destruction-input" value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)}>
                        <option value="all">Tous</option>
                        <option value="none">Sans responsable</option>
                        {managerOptions.map((manager) => (
                          <option key={manager} value={manager}>
                            {manager}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <div className="request-filter note">
                    <span>Filtre appliqué</span>
                    <p>
                      Département : <strong>{user?.department || 'N/A'}</strong> · Responsable : <strong>{user?.manager_name || 'N/A'}</strong>
                    </p>
                  </div>
                )}
                {filteredPendingGroups.length === 0 && (
                  <div className="empty-state">
                    {groupedPendingLeaves.length === 0
                      ? 'Aucune demande en attente'
                      : 'Aucune demande ne correspond aux filtres sélectionnés'}
                  </div>
                )}
                {filteredPendingGroups.map((group) => {
                  const leave = group[0];
                  const conflictLeave = group.find((period) => conflictIds.has(period.id));
                  const conflictInfo = conflictLeave ? conflictDetails.get(conflictLeave.id) : null;
                  return (
                    <div key={leave.request_group_id ?? leave.id} className="request-card">
                    <div className="request-card-info">
                      <div className="avatar">
                        <User size={20} />
                      </div>
                      <div>
                        <strong>
                          {leave.employee?.first_name} {leave.employee?.last_name}
                        </strong>
                        <p className="page-subtitle" style={{ margin: 0 }}>
                          {leave.employee?.email || 'Sans email'}
                        </p>
                        <div className="request-periods" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {group.map((period) => (
                            <span key={period.id} className={`tag ${STATUS_TAG[period.status]}`}>
                              {TYPE_LABELS[period.type]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="request-card-periods" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {group.map((period) => (
                        <div key={period.id} className="request-card-period" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CalendarIcon size={16} />
                          <span>
                            {TYPE_LABELS[period.type]} · {formatRange(period)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {conflictInfo && (
                      <div className="conflict-alert">
                        ⚠️ Conflit potentiel : un autre {conflictInfo.role?.toLowerCase() || 'employé'} du département{' '}
                        {conflictInfo.department || 'inconnu'} demande ces dates.
                      </div>
                    )}
                    <div className="request-card-actions">
                      <button type="button" className="icon-button approve" onClick={() => handleRequestAction(leave, 'approuve')}>
                        <Check size={18} />
                      </button>
                      <button type="button" className="icon-button reject" onClick={() => handleRequestAction(leave, 'refuse')}>
                        <X size={18} />
                      </button>
                      <button type="button" className="icon-button warn" onClick={() => handleDeleteLeave(leave)}>
                        <AlertTriangle size={18} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'soldes' && (
              <div className="balances-grid">
                {displayBalances.map((balance) => (
                  <div key={balance.id} className="balance-card">
                    <div className="request-card-info">
                      <div className="avatar">
                        <User size={20} />
                      </div>
                      <div>
                        <strong>
                          {balance.employee?.first_name} {balance.employee?.last_name}
                        </strong>
                        <p className="page-subtitle" style={{ margin: 0 }}>
                          Année {balance.year}
                        </p>
                      </div>
                    </div>
                    <Progress label="Congés payés" used={balance.paid_leave_used} total={balance.paid_leave_total} color="#10b981" />
                    <Progress label="Maladie" used={balance.sick_leave_used} total={30} color="#ef4444" />
                    <Progress label="Formation" used={balance.training_days_used} total={5} color="#a855f7" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <Modal title="Nouvelle demande de congé" onClose={closeAddModal}>
          <form className="form-grid" onSubmit={handleNewLeaveSubmit}>
            <div className="input-group">
              <label>Employé existant</label>
              <select
                value={newLeave.employee_id}
                onChange={(event) => handleEmployeeSelect(event.target.value)}
                disabled={!isManager}
              >
                <option value="">Sélectionner</option>
                {scopedEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Prénom</label>
              <input value={newLeave.first_name} onChange={(event) => setNewLeave((prev) => ({ ...prev, first_name: event.target.value }))} />
            </div>
            <div className="input-group">
              <label>Nom</label>
              <input value={newLeave.last_name} onChange={(event) => setNewLeave((prev) => ({ ...prev, last_name: event.target.value }))} />
            </div>
            <div className="input-group">
              <label>Email</label>
              <input type="email" value={newLeave.email} onChange={(event) => setNewLeave((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="input-group">
              <label>Commentaire</label>
              <textarea rows={3} value={newLeave.comment} onChange={(event) => setNewLeave((prev) => ({ ...prev, comment: event.target.value }))} />
            </div>

            <div className="input-group">
              <label>Ordre de marche (Armée / PC)</label>
              <input
                value={newLeave.army_reference}
                onChange={(event) => setNewLeave((prev) => ({ ...prev, army_reference: event.target.value }))}
                placeholder="Référence ou remarque"
              />
            </div>
            <div className="period-grid">
              <div className="input-group">
                <label>Date de début (Armée / PC)</label>
                <input
                  type="date"
                  value={newLeave.army_start_date}
                  onChange={(event) => setNewLeave((prev) => ({ ...prev, army_start_date: event.target.value }))}
                />
              </div>
              <div className="input-group">
                <label>Date de fin (Armée / PC)</label>
                <input
                  type="date"
                  value={newLeave.army_end_date}
                  onChange={(event) => setNewLeave((prev) => ({ ...prev, army_end_date: event.target.value }))}
                />
              </div>
            </div>

            {newLeave.periods.map((period, index) => (
              <div key={index} className="period-card">
                <strong>Période {index + 1}</strong>
                <div className="period-grid">
                  <div className="input-group">
                    <label>Type</label>
                    <select
                      value={period.type}
                      onChange={(event) => {
                        const periods = [...newLeave.periods];
                        periods[index].type = event.target.value as LeaveType;
                        setNewLeave((prev) => ({ ...prev, periods }));
                      }}
                    >
                      {Object.entries(TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Date de début</label>
                    <input
                      type="date"
                      value={period.start_date}
                      onChange={(event) => {
                        const periods = [...newLeave.periods];
                        periods[index].start_date = event.target.value;
                        setNewLeave((prev) => ({ ...prev, periods }));
                      }}
                    />
                  </div>
                  <div className="input-group">
                    <label>Date de fin</label>
                    <input
                      type="date"
                      value={period.end_date}
                      onChange={(event) => {
                        const periods = [...newLeave.periods];
                        periods[index].end_date = event.target.value;
                        setNewLeave((prev) => ({ ...prev, periods }));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="input-group">
              <label>Signature de l'employé</label>
              <div className="signature-pad">
                <SignatureCanvas ref={(ref) => (employeeSignatureRef.current = ref)} canvasProps={{ className: 'signature-canvas' }} />
              </div>
              <button type="button" className="btn btn-outline" style={{ width: 'fit-content', marginTop: 8 }} onClick={() => employeeSignatureRef.current?.clear()}>
                Effacer
              </button>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={closeAddModal}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Soumettre
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showSignModal && selectedLeave && (
        <Modal title="Signature manager" onClose={closeSignModal}>
          <div className="input-group">
            <label>Signature</label>
            <div className="signature-pad" style={{ height: 180 }}>
              <SignatureCanvas ref={(ref) => (managerSignatureRef.current = ref)} canvasProps={{ className: 'signature-canvas' }} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeSignModal}>
              Annuler
            </button>
              <button type="button" className="btn btn-primary" onClick={() => submitApprovalWithSignature(selectedCanton)}>
                Valider & envoyer
              </button>
          </div>
        </Modal>
      )}
    </section>
  );
};

const Progress = ({ label, used, total, color }: { label: string; used: number; total: number; color: string }) => {
  const ratio = Math.min(total === 0 ? 0 : (used / total) * 100, 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <span>{label}</span>
        <strong>
          {used} / {total} j
        </strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${ratio}%`, background: color }} />
      </div>
    </div>
  );
};

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="modal-panel">
      <div className="modal-header">
        <h3 className="modal-title">{title}</h3>
        <button type="button" className="icon-button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

async function generatePDF(
  leave: Leave,
  managerSignature: string,
  periods: { type: string; start_date: string; end_date: string }[] = [],
  employeeSignature: string = ''
): Promise<{ doc: jsPDF; base64: string; filename: string }> {
  const doc = new jsPDF('p', 'mm', [148, 210]);
  const pageWidth = 148;
  const margin = 8;
  let y = 10;
  const normalizedPeriods =
    periods.length > 0
      ? periods.slice(0, 3)
      : [
          {
            type: leave.type,
            start_date: leave.start_date,
            end_date: leave.end_date
          }
        ];

  const logoUrl = `${window.location.origin}/logo-retripa.png`;
  try {
    const logoBase64 = await loadImageAsBase64(logoUrl);
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', margin, y, 48, 4);
    }
  } catch (error) {
    console.warn('Logo indisponible', error);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('VACANCES ET CONGES', pageWidth / 2, y + 4, { align: 'center' });
  const year =
    normalizedPeriods[0]?.start_date && normalizedPeriods[0].start_date !== ''
      ? new Date(normalizedPeriods[0].start_date).getFullYear()
      : new Date().getFullYear();
  doc.setFontSize(11);
  doc.text(`${year}`, pageWidth - margin, y + 4, { align: 'right' });
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`NOM, Prénom :  ${leave.employee?.last_name || ''} ${leave.employee?.first_name || ''}`, margin, y);
  doc.text(`Date : ${format(new Date(), 'dd.MM.yyyy')}`, pageWidth - margin, y, { align: 'right' });
  y += 4;
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  for (let i = 0; i < 3; i++) {
    const period = normalizedPeriods[i];
    if (period && period.start_date && period.end_date) {
      const color = TYPE_PDF_COLORS[(period.type as LeaveType) || 'vacances'] || [0, 176, 240];
      doc.setFillColor(...color);
      doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      const days = calculateBusinessDays(period.start_date, period.end_date);
      doc.text(
        `${TYPE_LABELS[period.type as LeaveType] || period.type} : ${days} jours  du ${format(
          new Date(period.start_date),
          'dd.MM.yyyy'
        )} au ${format(new Date(period.end_date), 'dd.MM.yyyy')}`,
        margin + 2,
        y + 5
      );
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, pageWidth - 2 * margin, 7, 'S');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.text('du __________________ au __________________', margin + 2, y + 5);
    }
    y += 9;
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  const attentionText =
    "ATTENTION : Lors des vacances scolaires, il n'est pas possible de prendre plus de 2 semaines en 1 fois. Le reste de l'année il n'est pas possible de prendre plus de 3 semaines de vacances en 1 fois. Les dates de vacances formulées ci-dessus ne sont que des souhaits tant qu'elles ne sont pas confirmées par le bureau. Dès leur confirmation, il n'est plus possible de les changer.";
  doc.setFont('helvetica', 'italic');
  const attentionLines = doc.splitTextToSize(attentionText, pageWidth - 2 * margin);
  doc.text(attentionLines, margin, y + 2);
  y += attentionLines.length * 4 + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Armée et PC : ', margin, y);
  doc.setFont('helvetica', 'normal');
  if (leave.army_reference) {
    doc.text(`Ordre de marche : ${leave.army_reference}`, margin + 32, y);
  } else {
    doc.text('(joindre copie ordre de marche)', margin + 32, y);
  }
  y += 6;
  const armyStartText = leave.army_start_date ? format(new Date(leave.army_start_date), 'dd.MM.yyyy') : '__________________________';
  const armyEndText = leave.army_end_date ? format(new Date(leave.army_end_date), 'dd.MM.yyyy') : '__________________________';
  doc.text(`du ${armyStartText} au ${armyEndText}`, margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.text("Signature de l'employé :", margin, y);
  doc.text('Signature du chef de département :', pageWidth / 2 + margin / 2, y);
  y += 10;
  doc.line(margin, y, pageWidth / 2 - margin, y);
  doc.line(pageWidth / 2 + margin / 2, y, pageWidth - margin, y);
  y += 4;

  if (employeeSignature) {
    doc.addImage(employeeSignature, 'PNG', margin, y - 10, 40, 10);
  }
  if (managerSignature) {
    doc.addImage(managerSignature, 'PNG', pageWidth / 2 + margin / 2, y - 10, 40, 10);
  }

  const filename = `demande-${leave.employee?.last_name ?? leave.id}.pdf`;
  const base64 = doc.output('datauristring').split(',')[1] ?? '';
  return { doc, base64, filename };
}

async function loadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result?.toString() ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default LeavePage;

