import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Plus
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import toast from 'react-hot-toast';
import { format, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, getISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { jsPDF } from 'jspdf';

import { Api, type PdfTemplateConfig } from '../lib/api';
import { MONTHS, getMonthDays, isDateWeekend, isHoliday, calculateBusinessDays } from '../utils/dates';
import type { CantonCode } from '../utils/dates';
import type {
  Leave,
  LeaveBalance,
  LeaveRequestPayload,
  LeaveType,
  EmployeeSummary,
  LeaveWorkflowStep
} from '../types/leaves';
import type { Employee } from '../types/employees';
import { useAuth } from '../hooks/useAuth';
import { usePdfTemplate } from '../hooks/usePdfTemplate';
import { getFooterLines, getTemplateColors, resolveTemplateImage } from '../utils/pdfTemplate';

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

const PRIMARY_PDF_TYPES: LeaveType[] = ['vacances', 'heures_sup', 'armee'];
const WORKFLOW_SEQUENCE: LeaveWorkflowStep[] = ['manager', 'hr', 'director', 'completed'];
const WORKFLOW_LABELS: Record<LeaveWorkflowStep, string> = {
  manager: 'Manager',
  hr: 'RH',
  director: 'Direction',
  completed: 'Terminé'
};
type WorkflowVisualState = 'pending' | 'active' | 'done' | 'rejected';
const DEFAULT_MIN_STAFF = 2;
const DEPARTMENT_MIN_STAFF: Record<string, number> = {
  Exploitation: 3,
  Production: 4
};
type WeekRange = { start: Date; end: Date; label: string };
type CapacityAlert = { department: string; label: string; available: number; required: number };
type SimulationAbsence = { start: string; end: string; department?: string; fromPending?: boolean; leaveId?: string };

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
  const { user, hasRole, hasPermission } = useAuth();
  const { config: leaveTemplate } = usePdfTemplate('leave');
  const isAdmin = hasRole('admin');
  const canReviewManager = hasRole('manager') || hasPermission('approve_leave_manager');
  const canReviewHr = hasPermission('approve_leave_hr');
  const canReviewDirector = isAdmin || hasPermission('approve_leave_director');
  const canAccessRequests = canReviewManager || canReviewHr || canReviewDirector;
  const canSeeAllEmployees = isAdmin || canReviewHr || canReviewDirector;
  const availableTabs = useMemo<LeaveTab[]>(
    () => (canAccessRequests ? ['calendrier', 'demandes', 'soldes'] : ['calendrier', 'soldes']),
    [canAccessRequests]
  );
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
  const [selectedGroup, setSelectedGroup] = useState<Leave[] | null>(null);
  const [workflowModal, setWorkflowModal] = useState<{
    group: Leave[];
    action: 'approve' | 'reject';
    step: LeaveWorkflowStep;
  } | null>(null);
  const [workflowComment, setWorkflowComment] = useState('');
  const [signatureComment, setSignatureComment] = useState('');
  const [newLeave, setNewLeave] = useState<NewLeaveForm>(createDefaultFormState);
  const [selectedCanton, setSelectedCanton] = useState<CantonCode>('VD');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const weekRanges = useMemo(() => generateWeekRanges(currentDate), [currentDate]);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [simulationDate, setSimulationDate] = useState(() => new Date());
  const simulationWeekRanges = useMemo(() => generateWeekRanges(simulationDate), [simulationDate]);
  const [simulationConfig, setSimulationConfig] = useState<{
    department: string;
    headcount: number;
    minRequired: number;
    absences: SimulationAbsence[];
  }>({
    department: 'all',
    headcount: 0,
    minRequired: DEFAULT_MIN_STAFF,
    absences: []
  });
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
  const getWorkflowStep = useCallback((leave: Leave): LeaveWorkflowStep => leave.workflow_step ?? 'manager', []);
  const getStageDecision = (leave: Leave, step: LeaveWorkflowStep) => {
    if (step === 'manager') return leave.manager_status ?? null;
    if (step === 'hr') return leave.hr_status ?? null;
    if (step === 'director') return leave.director_status ?? null;
    return leave.status === 'approuve' ? 'approved' : leave.status === 'refuse' ? 'rejected' : null;
  };
  const getWorkflowStageState = useCallback(
    (group: Leave[], step: LeaveWorkflowStep): WorkflowVisualState => {
      const leave = group[0];
      if (!leave) return 'pending';
      if (step === 'completed') {
        if (leave.workflow_step === 'completed') {
          if (leave.status === 'approuve') return 'done';
          if (leave.status === 'refuse') return 'rejected';
        }
        return 'pending';
      }
      const decision = getStageDecision(leave, step);
      if (decision === 'approved') return 'done';
      if (decision === 'rejected') return 'rejected';
      if (getWorkflowStep(leave) === step) return 'active';
      const stepIndex = WORKFLOW_SEQUENCE.indexOf(step);
      const currentIndex = WORKFLOW_SEQUENCE.indexOf(getWorkflowStep(leave));
      if (currentIndex > stepIndex) return 'done';
      return 'pending';
    },
    [getWorkflowStep]
  );
  const getGroupLeaves = useCallback(
    (leave: Leave) =>
      leave.request_group_id ? pendingLeaves.filter((candidate) => candidate.request_group_id === leave.request_group_id) : [leave],
    [pendingLeaves]
  );

  const currentEmployee = useMemo(
    () => employees.find((employee) => employee.email?.toLowerCase() === user?.email?.toLowerCase()),
    [employees, user?.email]
  );
  const departmentScope = useMemo(() => {
    if (canSeeAllEmployees) return null;
    return currentEmployee?.department ?? null;
  }, [canSeeAllEmployees, currentEmployee]);
  const scopedEmployees = useMemo(() => {
    if (!departmentScope) {
      return employees;
    }
    return employees.filter((employee) => employee.department === departmentScope);
  }, [employees, departmentScope]);

  const managerOptions = useMemo(() => {
    const source = canSeeAllEmployees ? employees : scopedEmployees;
    const options = new Set<string>();
    source.forEach((employee) => {
      if (employee.manager_name) {
        options.add(employee.manager_name);
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [employees, scopedEmployees, canSeeAllEmployees]);

  const departmentOptions = useMemo(() => {
    const source = canSeeAllEmployees ? employees : scopedEmployees;
    const options = new Set<string>();
    source.forEach((employee) => {
      if (employee.department) {
        options.add(employee.department);
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [employees, scopedEmployees, canSeeAllEmployees]);

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

  const effectiveDepartmentFilter = canSeeAllEmployees ? departmentFilter : departmentScope ?? 'all';
  const effectiveManagerFilter = canSeeAllEmployees ? managerFilter : currentEmployee?.manager_name ?? 'all';

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

  const shouldDisplayGroup = useCallback(
    (group: Leave[]) => {
      if (!group.length) {
        return false;
      }
      const step = getWorkflowStep(group[0]);
      if (step === 'manager') {
        return canReviewManager && matchesFilters(group[0]);
      }
      if (step === 'hr') {
        return canReviewHr;
      }
      if (step === 'director') {
        return canReviewDirector;
      }
      return false;
    },
    [canReviewManager, canReviewHr, canReviewDirector, matchesFilters, getWorkflowStep]
  );

  const filteredPendingGroups = useMemo(
    () => groupedPendingLeaves.filter((group) => shouldDisplayGroup(group)),
    [groupedPendingLeaves, shouldDisplayGroup]
  );

  const canActOnGroup = useCallback(
    (group: Leave[]) => {
      if (!group.length) return false;
      const step = getWorkflowStep(group[0]);
      if (step === 'manager') {
        return canReviewManager && matchesFilters(group[0]);
      }
      if (step === 'hr') {
        return canReviewHr;
      }
      if (step === 'director') {
        return canReviewDirector;
      }
      return false;
    },
    [canReviewManager, canReviewHr, canReviewDirector, matchesFilters, getWorkflowStep]
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
  const weeklyCapacityAlerts = useMemo<CapacityAlert[]>(() => {
    if (!canAccessRequests) {
      return [];
    }
    const alerts: CapacityAlert[] = [];
    const departments = Array.from(
      new Set(employees.map((employee) => employee.department).filter((dept): dept is string => Boolean(dept)))
    );
    if (departments.length === 0) {
      return alerts;
    }
    weekRanges.forEach((range) => {
      departments.forEach((department) => {
        const deptEmployees = employees.filter((employee) => employee.department === department);
        if (!deptEmployees.length) {
          return;
        }
        const minStaff = DEPARTMENT_MIN_STAFF[department] ?? DEFAULT_MIN_STAFF;
        const unavailableEmployees = new Set(
          approvedCalendarLeaves
            .filter(
              (leave) =>
                overlapsRange(leave, range.start, range.end) && resolveEmployeeMeta(leave).department === department
            )
            .map((leave) => leave.employee_id)
        );
        const available = deptEmployees.length - unavailableEmployees.size;
        if (available < minStaff) {
          alerts.push({
            department,
            label: range.label,
            available,
            required: minStaff
          });
        }
      });
    });
    return alerts;
  }, [canAccessRequests, weekRanges, employees, approvedCalendarLeaves, resolveEmployeeMeta]);

  // Récupérer les demandes en attente pour le mois de simulation (uniquement pour les managers)
  const pendingLeavesForSimulation = useMemo(() => {
    if (!canReviewManager) {
      return [];
    }
    
    // Déterminer le département à utiliser pour le filtre
    let targetDepartment: string | null = null;
    if (simulationConfig.department && simulationConfig.department !== 'all') {
      targetDepartment = simulationConfig.department;
    } else if (departmentScope) {
      // Si aucun département sélectionné mais le manager est limité à un département
      targetDepartment = departmentScope;
    } else {
      // Si "all" est sélectionné et le manager peut voir tous les départements
      // On inclut toutes les demandes en attente
    }
    
    const monthStart = startOfMonth(simulationDate);
    const monthEnd = endOfMonth(simulationDate);
    
    return pendingLeaves.filter((leave) => {
      const meta = resolveEmployeeMeta(leave);
      
      // Filtrer par département du manager (si limité) et département sélectionné
      if (targetDepartment && meta.department !== targetDepartment) {
        return false;
      }
      
      // Si le manager est limité à un département, vérifier aussi ce filtre
      if (departmentScope && meta.department !== departmentScope) {
        return false;
      }
      
      // Vérifier que la demande chevauche le mois de simulation
      // Normaliser les dates à minuit pour éviter les problèmes de fuseau horaire
      const leaveStart = startOfDay(new Date(leave.start_date));
      const leaveEnd = startOfDay(new Date(leave.end_date));
      const normalizedMonthStart = startOfDay(monthStart);
      const normalizedMonthEnd = startOfDay(monthEnd);
      
      // La demande doit chevaucher le mois de simulation
      return (
        (leaveStart >= normalizedMonthStart && leaveStart <= normalizedMonthEnd) ||
        (leaveEnd >= normalizedMonthStart && leaveEnd <= normalizedMonthEnd) ||
        (leaveStart <= normalizedMonthStart && leaveEnd >= normalizedMonthEnd)
      );
    });
  }, [canReviewManager, pendingLeaves, simulationConfig.department, simulationDate, departmentScope, resolveEmployeeMeta]);

  // Convertir les demandes en attente en absences fictives
  const pendingAbsencesForSimulation = useMemo(() => {
    return pendingLeavesForSimulation.map((leave) => {
      // Extraire la date au format YYYY-MM-DD directement depuis la string
      // PostgreSQL renvoie les dates au format "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss.sssZ"
      // On doit extraire uniquement la partie date sans conversion qui pourrait causer un décalage
      // Extraire directement les dates depuis les strings SANS AUCUNE conversion
      // PostgreSQL renvoie les dates au format "YYYY-MM-DD" (type date)
      // On prend directement les 10 premiers caractères pour éviter tout problème
      const getDateString = (dateStr: string | undefined): string => {
        if (!dateStr) return '';
        // Si c'est déjà au format YYYY-MM-DD (10 caractères), le retourner tel quel
        if (dateStr.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          return dateStr.substring(0, 10);
        }
        // Si la date contient 'T', prendre la partie avant 'T'
        if (dateStr.includes('T')) {
          const datePart = dateStr.split('T')[0];
          return datePart.length >= 10 ? datePart.substring(0, 10) : datePart;
        }
        // Si la date contient un espace, prendre la partie avant l'espace
        if (dateStr.includes(' ')) {
          const datePart = dateStr.split(' ')[0];
          return datePart.length >= 10 ? datePart.substring(0, 10) : datePart;
        }
        return '';
      };
      
      // Utiliser directement les strings de dates sans aucune conversion
      // Les dates arrivent maintenant directement au format YYYY-MM-DD depuis le backend
      let start = getDateString(leave.start_date);
      let end = getDateString(leave.end_date);
      
      // Vérifier que les dates sont dans le bon ordre (start <= end)
      // Si ce n'est pas le cas, les inverser (problème de données)
      if (start && end && start > end) {
        // Les dates sont inversées, on les corrige
        const temp = start;
        start = end;
        end = temp;
      }
      
      return {
        start,
        end,
        department: resolveEmployeeMeta(leave).department,
        fromPending: true,
        leaveId: leave.id
      };
    });
  }, [pendingLeavesForSimulation, resolveEmployeeMeta]);

  const simulationResults = useMemo(() => {
    if (!canAccessRequests) {
      return [];
    }
    const department = simulationConfig.department && simulationConfig.department !== 'all' ? simulationConfig.department : departmentOptions[0];
    if (!department) {
      return [];
    }
    const departmentEmployees = employees.filter((employee) => employee.department === department);
    const baseHeadcount = simulationConfig.headcount || departmentEmployees.length || 0;
    const minStaff = simulationConfig.minRequired || DEPARTMENT_MIN_STAFF[department] || DEFAULT_MIN_STAFF;
    // Combiner les absences personnalisées et les demandes en attente
    const allAbsences = [...simulationConfig.absences, ...pendingAbsencesForSimulation].filter(
      (absence) => !absence.department || absence.department === department
    );
    return simulationWeekRanges.map((range) => {
      const unavailableEmployees = new Set(
        approvedCalendarLeaves
          .filter((leave) => resolveEmployeeMeta(leave).department === department && overlapsRange(leave, range.start, range.end))
          .map((leave) => leave.employee_id)
      );
      const customCount = allAbsences.filter(
        (absence) => absence.start && absence.end && intervalsOverlap(absence.start, absence.end, range.start, range.end)
      ).length;
      const available = baseHeadcount - unavailableEmployees.size - customCount;
      return {
        label: range.label,
        available,
        required: minStaff
      };
    });
  }, [canAccessRequests, simulationConfig, simulationWeekRanges, employees, approvedCalendarLeaves, resolveEmployeeMeta, departmentOptions, pendingAbsencesForSimulation]);
  const displayBalances = useMemo(() => {
    if (canSeeAllEmployees) {
      return leaveBalances;
    }
    if (canReviewManager) {
      const scopedIds = new Set(scopedEmployees.map((employee) => employee.id));
      return leaveBalances.filter((balance) => scopedIds.has(balance.employee_id));
    }
    return leaveBalances.filter((balance) => balance.employee?.id === currentEmployee?.id);
  }, [leaveBalances, canSeeAllEmployees, canReviewManager, scopedEmployees, currentEmployee?.id]);
  const showEmptyCalendarMessage = approvedCalendarLeaves.length === 0 || displayEmployees.length === 0;
  const [showFullMobileCalendar, setShowFullMobileCalendar] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

      const pendingPromise = canAccessRequests ? Api.fetchPendingLeaves() : Promise.resolve([] as Leave[]);
      const [employeesRes, pendingRes, balancesRes, calendarRes] = await Promise.all([
        Api.fetchEmployees(),
        pendingPromise,
        Api.fetchLeaveBalances(year),
        Api.fetchCalendarLeaves({ start, end })
      ]);

      const sortedEmployees = (employeesRes ?? []).sort((a, b) => a.last_name.localeCompare(b.last_name));
      setEmployees(sortedEmployees);
      setPendingLeaves(pendingRes ?? []);
      setLeaveBalances(balancesRes ?? []);
      setCalendarLeaves(calendarRes ?? []);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les données RH');
    } finally {
      setLoading(false);
    }
  }, [currentDate, canAccessRequests]);

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
    if (!canSeeAllEmployees) {
      setDepartmentFilter(departmentScope ?? 'all');
      setManagerFilter(currentEmployee?.manager_name ?? 'all');
    }
  }, [departmentScope, currentEmployee?.manager_name, canSeeAllEmployees]);

  useEffect(() => {
    if (!employees.length) return;
    let departmentValue = simulationConfig.department;
    if (!departmentValue || departmentValue === 'all') {
      departmentValue = departmentOptions[0] || 'all';
    }
    const targetDept = departmentValue === 'all' ? null : departmentValue;
    const count = targetDept
      ? employees.filter((employee) => employee.department === targetDept).length
      : employees.length;
    const defaultMin = targetDept ? (DEPARTMENT_MIN_STAFF[targetDept] ?? DEFAULT_MIN_STAFF) : DEFAULT_MIN_STAFF;
    setSimulationConfig((prev) => ({
      ...prev,
      department: departmentValue,
      headcount: count,
      minRequired: prev.minRequired || defaultMin
    }));
  }, [employees, simulationConfig.department, departmentOptions]);

  const openSignModal = (group: Leave[]) => {
    setSelectedGroup(group);
    setSelectedLeave(group[0]);
    setSignatureComment('');
    setShowSignModal(true);
    requestAnimationFrame(() => managerSignatureRef.current?.clear());
  };

  const closeSignModal = () => {
    setShowSignModal(false);
    setSelectedLeave(null);
    setSelectedGroup(null);
    setSignatureComment('');
    managerSignatureRef.current?.clear();
  };

  const handleSimulationDepartmentChange = (department: string) => {
    setSimulationConfig((prev) => ({
      ...prev,
      department
    }));
  };

  const addSimulationAbsence = () => {
    setSimulationConfig((prev) => ({
      ...prev,
      absences: [...prev.absences, { start: '', end: '', department: prev.department }]
    }));
  };

  const updateSimulationAbsence = (index: number, field: 'start' | 'end' | 'department', value: string) => {
    setSimulationConfig((prev) => {
      const absences = [...prev.absences];
      absences[index] = { ...absences[index], [field]: value };
      return { ...prev, absences };
    });
  };

  const removeSimulationAbsence = (index: number) => {
    setSimulationConfig((prev) => ({
      ...prev,
      absences: prev.absences.filter((_, idx) => idx !== index)
    }));
  };

  const resetSimulation = () => {
    setSimulationDate(new Date());
    const department = departmentOptions[0] || 'all';
    const targetDept = department === 'all' ? null : department;
    const count = targetDept
      ? employees.filter((employee) => employee.department === targetDept).length
      : employees.length;
    const defaultMin = targetDept ? (DEPARTMENT_MIN_STAFF[targetDept] ?? DEFAULT_MIN_STAFF) : DEFAULT_MIN_STAFF;
    setSimulationConfig({
      department,
      headcount: count,
      minRequired: defaultMin,
      absences: []
    });
  };

  const changeMonth = (delta: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
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

    // Valider que toutes les périodes ont des dates valides (fin >= début)
    const invalidPeriods = newLeave.periods.filter(
      (p) => p.start_date && p.end_date && p.start_date > p.end_date
    );
    if (invalidPeriods.length > 0) {
      toast.error('La date de fin doit être postérieure ou égale à la date de début pour toutes les périodes.');
      return;
    }
    
    if (newLeave.army_start_date && newLeave.army_end_date) {
      if (newLeave.army_start_date > newLeave.army_end_date) {
        toast.error('La date de fin (Armée / PC) doit être postérieure ou égale à la date de début.');
        return;
      }
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

  const handleRemovePeriod = (index: number) => {
    setNewLeave((prev) => ({
      ...prev,
      periods: prev.periods.filter((_, i) => i !== index)
    }));
  };

  const handleDeleteLeave = async (leaveToDelete: Leave) => {
    const group = getGroupLeaves(leaveToDelete);
    if (getWorkflowStep(group[0]) !== 'manager') {
      toast.error('Suppression impossible après validation manager');
      return;
    }
    if (!matchesFilters(leaveToDelete) || !canReviewManager) {
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

  const handleWorkflowAction = (group: Leave[], action: 'approve' | 'reject') => {
    if (!group.length) return;
    if (!canActOnGroup(group)) {
      toast.error('Action non autorisée pour ce flux');
      return;
    }
    const step = getWorkflowStep(group[0]);
    if (step === 'director' && action === 'approve') {
      openSignModal(group);
      return;
    }
    setWorkflowModal({ group, action, step });
    setWorkflowComment('');
  };

  const closeWorkflowDecisionModal = () => {
    setWorkflowModal(null);
    setWorkflowComment('');
  };

  const submitWorkflowDecision = async () => {
    if (!workflowModal) return;
    try {
      await Api.updateLeaveWorkflow(workflowModal.group[0].id, {
        decision: workflowModal.action,
        comment: workflowComment || undefined
      });
      toast.success(workflowModal.action === 'approve' ? 'Étape validée' : 'Demande refusée');
      closeWorkflowDecisionModal();
      await loadData();
    } catch (error) {
      toast.error((error as Error).message || 'Action impossible');
    }
  };

  const submitApprovalWithSignature = async (holidayCanton: CantonCode) => {
    if (!selectedGroup || !selectedGroup.length || !selectedLeave) {
      toast.error('Aucune demande sélectionnée');
      return;
    }
    if (!managerSignatureRef.current || managerSignatureRef.current.isEmpty()) {
      toast.error('Signature direction requise');
      return;
    }

    try {
      const signature = managerSignatureRef.current.toDataURL();
      await Api.updateLeaveWorkflow(selectedGroup[0].id, {
        decision: 'approve',
        signature,
        comment: signatureComment || undefined
      });
      const pdfDocument = await generatePDF(
        selectedGroup[0],
        signature,
        selectedGroup.map((leave) => ({
          type: leave.type,
          start_date: leave.start_date,
          end_date: leave.end_date
        })),
        selectedGroup[0].signature ?? '',
        leaveTemplate || undefined
      );
      await Api.notifyVacationApproval({
        leaveIds: selectedGroup.map((leave) => leave.id),
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

  const formatRange = (leave: Leave) => {
    // Parser les dates en évitant les problèmes de fuseau horaire
    // Si la date est au format "YYYY-MM-DD", ajouter "T00:00:00" pour forcer l'interprétation en heure locale
    const parseDateForDisplay = (dateStr: string): Date => {
      if (dateStr.includes('T')) {
        return new Date(dateStr);
      }
      // Si c'est juste une date, ajouter l'heure pour éviter le décalage UTC
      return new Date(dateStr + 'T12:00:00');
    };
    
    return `${format(parseDateForDisplay(leave.start_date), 'dd MMM', { locale: fr })} – ${format(parseDateForDisplay(leave.end_date), 'dd MMM', {
      locale: fr
    })}`;
  };

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
          {currentEmployee && (
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              Nouvelle demande
            </button>
          )}
          {canAccessRequests && (
            <button type="button" className="btn btn-outline" onClick={() => setShowSimulationModal(true)}>
              Simuler une absence
            </button>
          )}
        </div>
      </div>

      {canAccessRequests && weeklyCapacityAlerts.length > 0 && (
        <div className="team-alerts">
          <div className="team-alerts__header">
            <div>
              <strong>Alertes charge équipes</strong>
              <p>{weeklyCapacityAlerts.length} alerte(s) détectée(s) sur la période</p>
            </div>
          </div>
          <div className="team-alerts__grid">
            {weeklyCapacityAlerts.map((alert) => (
              <div key={`${alert.department}-${alert.label}`} className="team-alert-card">
                <div className="team-alert-card__meta">
                  <span className="team-alert-card__department">{alert.department}</span>
                  <span className="team-alert-card__label">{alert.label}</span>
                </div>
                <p className="team-alert-card__status">
                  Disponibles : <strong>{alert.available}</strong> / {alert.required} requis
                </p>
                <p className="team-alert-card__hint">Renforcez l’équipe ou ajustez les congés sur cette semaine.</p>
              </div>
            ))}
          </div>
        </div>
      )}

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

            {canAccessRequests && activeTab === 'demandes' && (
              <div className="requests-list">
                {canSeeAllEmployees ? (
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
                      Département : <strong>{currentEmployee?.department || 'N/A'}</strong> · Responsable :{' '}
                      <strong>{currentEmployee?.manager_name || 'N/A'}</strong>
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
                  const currentStep = getWorkflowStep(leave);
                  const canAct = canActOnGroup(group);
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
                              <span key={period.id} className="tag">
                                {TYPE_LABELS[period.type]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="request-workflow">
                        {WORKFLOW_SEQUENCE.map((step) => {
                          const state = getWorkflowStageState(group, step);
                          return (
                            <span key={step} className={`workflow-chip workflow-chip--${state}`}>
                              {WORKFLOW_LABELS[step]}
                            </span>
                          );
                        })}
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
                        {canAct && (
                          <>
                            <button type="button" className="btn btn-outline danger" onClick={() => handleWorkflowAction(group, 'reject')}>
                              Refuser
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => handleWorkflowAction(group, 'approve')}>
                              {currentStep === 'director' ? 'Valider & signer' : 'Valider'}
                            </button>
                          </>
                        )}
                        {canReviewManager && currentStep === 'manager' && (
                          <button type="button" className="icon-button warn" onClick={() => handleDeleteLeave(leave)} aria-label="Supprimer">
                            <AlertTriangle size={18} />
                          </button>
                        )}
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
              <select value={newLeave.employee_id} onChange={(event) => handleEmployeeSelect(event.target.value)} disabled={!canSeeAllEmployees}>
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
                  max={newLeave.army_end_date || undefined}
                  onChange={(event) => {
                    const newStartDate = event.target.value;
                    // Si la date de début est après la date de fin, réinitialiser la date de fin
                    if (newStartDate && newLeave.army_end_date && newStartDate > newLeave.army_end_date) {
                      setNewLeave((prev) => ({ ...prev, army_start_date: newStartDate, army_end_date: '' }));
                    } else {
                      setNewLeave((prev) => ({ ...prev, army_start_date: newStartDate }));
                    }
                  }}
                />
              </div>
              <div className="input-group">
                <label>Date de fin (Armée / PC)</label>
                <input
                  type="date"
                  value={newLeave.army_end_date}
                  min={newLeave.army_start_date || undefined}
                  onChange={(event) => {
                    const newEndDate = event.target.value;
                    // Valider que la date de fin n'est pas antérieure à la date de début
                    if (newEndDate && newLeave.army_start_date && newEndDate < newLeave.army_start_date) {
                      toast.error('La date de fin ne peut pas être antérieure à la date de début');
                      return;
                    }
                    setNewLeave((prev) => ({ ...prev, army_end_date: newEndDate }));
                  }}
                />
              </div>
            </div>

            {newLeave.periods.map((period, index) => (
              <div key={index} className="period-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong>Période {index + 1}</strong>
                  {newLeave.periods.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => handleRemovePeriod(index)}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
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
                      max={period.end_date || undefined}
                      onChange={(event) => {
                        const periods = [...newLeave.periods];
                        periods[index].start_date = event.target.value;
                        // Si la date de début est après la date de fin, réinitialiser la date de fin
                        if (event.target.value && periods[index].end_date && event.target.value > periods[index].end_date) {
                          periods[index].end_date = '';
                        }
                        setNewLeave((prev) => ({ ...prev, periods }));
                      }}
                    />
                  </div>
                  <div className="input-group">
                    <label>Date de fin</label>
                    <input
                      type="date"
                      value={period.end_date}
                      min={period.start_date || undefined}
                      onChange={(event) => {
                        const periods = [...newLeave.periods];
                        const newEndDate = event.target.value;
                        // Valider que la date de fin n'est pas antérieure à la date de début
                        if (newEndDate && periods[index].start_date && newEndDate < periods[index].start_date) {
                          toast.error('La date de fin ne peut pas être antérieure à la date de début');
                          return;
                        }
                        periods[index].end_date = newEndDate;
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

      {showSimulationModal && (
        <Modal title="Simulation d'absence" onClose={() => setShowSimulationModal(false)}>
          <div className="simulation-form">
            <div className="simulation-section">
              <h3 className="simulation-section-title">Paramètres de simulation</h3>
              <div className="simulation-grid">
                <div className="input-group">
                  <label>Mois de simulation</label>
                  <div className="date-selector">
                    <button
                      type="button"
                      className="btn btn-outline date-nav-btn"
                      onClick={() => setSimulationDate(new Date(simulationDate.getFullYear(), simulationDate.getMonth() - 1, 1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <select
                      value={simulationDate.getMonth()}
                      onChange={(event) => setSimulationDate(new Date(simulationDate.getFullYear(), Number(event.target.value), 1))}
                      className="date-select"
                    >
                      {MONTHS.map((month, index) => (
                        <option key={month} value={index}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <select
                      value={simulationDate.getFullYear()}
                      onChange={(event) => setSimulationDate(new Date(Number(event.target.value), simulationDate.getMonth(), 1))}
                      className="date-select"
                    >
                      {Array.from({ length: 5 }, (_, i) => simulationDate.getFullYear() - 2 + i).map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline date-nav-btn"
                      onClick={() => setSimulationDate(new Date(simulationDate.getFullYear(), simulationDate.getMonth() + 1, 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="input-group">
                  <label>Département</label>
                  <select value={simulationConfig.department} onChange={(event) => handleSimulationDepartmentChange(event.target.value)}>
                    {departmentOptions.length === 0 && <option value="all">Tous</option>}
                    {departmentOptions.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Effectif considéré</label>
                  <input
                    type="number"
                    min={0}
                    value={simulationConfig.headcount}
                    onChange={(event) =>
                      setSimulationConfig((prev) => ({
                        ...prev,
                        headcount: Number(event.target.value)
                      }))
                    }
                  />
                </div>
                <div className="input-group">
                  <label>Minimum requis</label>
                  <input
                    type="number"
                    min={1}
                    value={simulationConfig.minRequired}
                    onChange={(event) =>
                      setSimulationConfig((prev) => ({
                        ...prev,
                        minRequired: Number(event.target.value)
                      }))
                    }
                  />
                  <small className="input-hint">Nombre minimum d'employés requis par semaine</small>
                </div>
              </div>
            </div>
            <div className="simulation-section">
              <div className="simulation-section-header">
                <h3 className="simulation-section-title">Absences fictives</h3>
                <button type="button" className="btn btn-outline btn-small" onClick={addSimulationAbsence}>
                  <Plus size={14} />
                  Ajouter
                </button>
              </div>
              {canReviewManager && pendingAbsencesForSimulation.length > 0 && (
                <div className="simulation-pending-notice">
                  <small>
                    <strong>Note :</strong> {pendingAbsencesForSimulation.length} demande(s) de congé en attente pour ce mois sont automatiquement incluses dans la simulation.
                  </small>
                </div>
              )}
              {simulationConfig.absences.length === 0 && pendingAbsencesForSimulation.length === 0 ? (
                <p className="muted-text">Aucune absence ajoutée pour l'instant.</p>
              ) : (
                <div className="simulation-absences-list">
                  {pendingAbsencesForSimulation.map((absence, index) => (
                    <div key={`pending-${absence.leaveId}`} className="simulation-absence-row simulation-absence-row--pending">
                      <div className="simulation-absence-dates">
                        <input
                          type="date"
                          value={absence.start}
                          disabled
                          style={{ opacity: 0.7, cursor: 'not-allowed' }}
                        />
                        <span className="date-separator">→</span>
                        <input
                          type="date"
                          value={absence.end}
                          disabled
                          style={{ opacity: 0.7, cursor: 'not-allowed' }}
                        />
                        <span className="pending-badge">Demande en attente</span>
                      </div>
                    </div>
                  ))}
                  {simulationConfig.absences.map((absence, index) => (
                    <div key={`custom-${index}`} className="simulation-absence-row">
                      <div className="simulation-absence-dates">
                        <input
                          type="date"
                          value={absence.start}
                          onChange={(event) => updateSimulationAbsence(index, 'start', event.target.value)}
                          placeholder="Date début"
                        />
                        <span className="date-separator">→</span>
                        <input
                          type="date"
                          value={absence.end}
                          onChange={(event) => updateSimulationAbsence(index, 'end', event.target.value)}
                          placeholder="Date fin"
                        />
                      </div>
                      <button type="button" className="icon-button warn" onClick={() => removeSimulationAbsence(index)} aria-label="Supprimer">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="simulation-section">
              <h3 className="simulation-section-title">Impact hebdomadaire</h3>
              {simulationResults.length === 0 ? (
                <p className="muted-text">Sélectionnez un département pour voir la simulation.</p>
              ) : (
                <div className="simulation-results-table">
                  <table className="simulation-table">
                    <thead>
                      <tr>
                        <th>Semaine</th>
                        <th>Disponible (simulé)</th>
                        <th>Minimum requis</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationResults.map((result) => {
                        const isCritical = result.available < result.required;
                        return (
                          <tr key={result.label} className={isCritical ? 'critical' : ''}>
                            <td><strong>{result.label}</strong></td>
                            <td>{result.available}</td>
                            <td>{result.required}</td>
                            <td>
                              {isCritical ? (
                                <span className="status-badge status-badge--warning">⚠️ Insuffisant</span>
                              ) : (
                                <span className="status-badge status-badge--success">✓ OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={resetSimulation}>
              Réinitialiser
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setShowSimulationModal(false)}>
              Fermer
            </button>
          </div>
        </Modal>
      )}

      {workflowModal && (
        <Modal
          title={
            workflowModal.action === 'approve'
              ? `Valider - étape ${WORKFLOW_LABELS[workflowModal.step]}`
              : `Refuser - étape ${WORKFLOW_LABELS[workflowModal.step]}`
          }
          onClose={closeWorkflowDecisionModal}
        >
          <p className="modal-intro">
            {workflowModal.group[0].employee?.first_name} {workflowModal.group[0].employee?.last_name} ·{' '}
            {workflowModal.group.map((leave) => formatRange(leave)).join(' / ')}
          </p>
          <div className="input-group">
            <label>Commentaire (optionnel)</label>
            <textarea
              rows={3}
              value={workflowComment}
              onChange={(event) => setWorkflowComment(event.target.value)}
              placeholder="Ajouter un retour visible par les étapes précédentes"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeWorkflowDecisionModal}>
              Annuler
            </button>
            <button
              type="button"
              className={workflowModal.action === 'approve' ? 'btn btn-primary' : 'btn btn-outline danger'}
              onClick={submitWorkflowDecision}
            >
              {workflowModal.action === 'approve' ? 'Valider' : 'Refuser'}
            </button>
          </div>
        </Modal>
      )}

      {showSignModal && selectedLeave && (
        <Modal title="Signature direction" onClose={closeSignModal}>
          <div className="input-group">
            <label>Signature</label>
            <div className="signature-pad" style={{ height: 180 }}>
              <SignatureCanvas ref={(ref) => (managerSignatureRef.current = ref)} canvasProps={{ className: 'signature-canvas' }} />
            </div>
          </div>
          <div className="input-group">
            <label>Commentaire</label>
            <textarea rows={2} value={signatureComment} onChange={(event) => setSignatureComment(event.target.value)} placeholder="Ajouter une remarque (optionnel)" />
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
  employeeSignature: string = '',
  template?: PdfTemplateConfig
): Promise<{ doc: jsPDF; base64: string; filename: string }> {
  const doc = new jsPDF('p', 'mm', [148, 210]);
  const pageWidth = 148;
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const headerHeight = 18;
  const { primary, accent } = getTemplateColors(template, {
    primary: [15, 23, 42],
    accent: [59, 130, 246]
  });
  const footerLines = getFooterLines(template, ['Retripa Crissier S.A.', 'Workflow congés']);
  const [headerLogo, footerLogo] = await Promise.all([
    resolveTemplateImage(template?.headerLogo, '/logo-retripa.png'),
    resolveTemplateImage(template?.footerLogo, undefined)
  ]);

  const drawHeader = () => {
    doc.setFillColor(...primary);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    if (headerLogo) {
      doc.addImage(headerLogo, 'PNG', margin, 4, 38, 8, undefined, 'FAST');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(template?.title || 'VACANCES ET CONGÉS', pageWidth / 2, 9, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(template?.subtitle || format(new Date(), 'dd.MM.yyyy'), pageWidth - margin, 12, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const drawFooter = () => {
    const footerTop = pageHeight - 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    footerLines.forEach((line, idx) => {
      doc.text(line, margin, footerTop + idx * 3.5);
    });
    if (footerLogo) {
      doc.addImage(footerLogo, 'PNG', pageWidth - margin - 14, footerTop - 4, 14, 10, undefined, 'FAST');
    }
  };

  drawHeader();
  let y = headerHeight + 4;
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
      const color = TYPE_PDF_COLORS[(period.type as LeaveType) || 'vacances'] || [accent[0], accent[1], accent[2]];
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

  drawFooter();
  const filename = `demande-${leave.employee?.last_name ?? leave.id}.pdf`;
  const base64 = doc.output('datauristring').split(',')[1] ?? '';
  return { doc, base64, filename };
}

const generateWeekRanges = (referenceDate: Date): WeekRange[] => {
  const monthStart = startOfDay(startOfMonth(referenceDate));
  const monthEnd = startOfDay(endOfMonth(referenceDate));
  let cursor = startOfDay(startOfWeek(monthStart, { weekStartsOn: 1 }));
  const last = startOfDay(endOfWeek(monthEnd, { weekStartsOn: 1 }));
  const ranges: WeekRange[] = [];
  while (cursor <= last) {
    const weekStart = startOfDay(cursor);
    const weekEnd = startOfDay(endOfWeek(cursor, { weekStartsOn: 1 }));
    const isoWeek = getISOWeek(weekStart).toString().padStart(2, '0');
    const label = `S${isoWeek} (${format(weekStart, 'dd MMM', { locale: fr })} – ${format(weekEnd, 'dd MMM', {
      locale: fr
    })})`;
    ranges.push({ start: weekStart, end: weekEnd, label });
    cursor = startOfDay(addDays(weekEnd, 1));
  }
  return ranges;
};

const overlapsRange = (leave: Leave, rangeStart: Date, rangeEnd: Date) => {
  // Extraire la partie date uniquement (YYYY-MM-DD) pour éviter les problèmes de fuseau horaire
  const leaveStartStr = leave.start_date.includes('T') ? leave.start_date.split('T')[0] : leave.start_date.substring(0, 10);
  const leaveEndStr = leave.end_date.includes('T') ? leave.end_date.split('T')[0] : leave.end_date.substring(0, 10);
  
  // Créer des dates en heure locale (midi) pour éviter les décalages UTC
  const leaveStart = startOfDay(new Date(leaveStartStr + 'T12:00:00'));
  const leaveEnd = startOfDay(new Date(leaveEndStr + 'T12:00:00'));
  const normalizedRangeStart = startOfDay(rangeStart);
  const normalizedRangeEnd = startOfDay(rangeEnd);
  return leaveStart <= normalizedRangeEnd && leaveEnd >= normalizedRangeStart;
};

const intervalsOverlap = (start: string, end: string, rangeStart: Date, rangeEnd: Date) => {
  if (!start || !end) return false;
  // Extraire uniquement la partie date (YYYY-MM-DD) de la string
  const startDateOnly = start.includes('T') ? start.split('T')[0] : start.substring(0, 10);
  const endDateOnly = end.includes('T') ? end.split('T')[0] : end.substring(0, 10);
  
  // Créer des dates en heure locale (midi) pour éviter les problèmes de fuseau horaire
  // Utiliser midi (12:00) au lieu de minuit pour éviter les décalages
  const intervalStart = startOfDay(new Date(startDateOnly + 'T12:00:00'));
  const intervalEnd = startOfDay(new Date(endDateOnly + 'T12:00:00'));
  const normalizedRangeStart = startOfDay(rangeStart);
  const normalizedRangeEnd = startOfDay(rangeEnd);
  return intervalStart <= normalizedRangeEnd && intervalEnd >= normalizedRangeStart;
};

export default LeavePage;

