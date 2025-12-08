import { useEffect, useState } from 'react';
import { Plus, FileText, Search, Loader2, Edit2, Trash2, Eye, DollarSign, Calendar, User, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api, type EmploymentContract, type PayrollEntry, type ContractAllowance, type OvertimeEntry } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import './PayrollContractsPage.css';

type ContractForm = {
  employee_id: string;
  contract_type: 'CDI' | 'CDD' | 'interim' | 'stage';
  start_date: string;
  end_date: string | null;
  work_rate: number;
  base_salary: number;
  currency: string;
  site_id: string | null;
  notes: string;
};

type PayrollForm = {
  employee_id: string;
  period_start: string;
  period_end: string;
  base_salary: number;
  overtime_hours: number;
  overtime_rate: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  currency: string;
  status: 'draft' | 'approved' | 'paid';
};

const DEFAULT_CONTRACT_FORM: ContractForm = {
  employee_id: '',
  contract_type: 'CDI',
  start_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: null,
  work_rate: 100,
  base_salary: 0,
  currency: 'CHF',
  site_id: null,
  notes: ''
};

const DEFAULT_PAYROLL_FORM: PayrollForm = {
  employee_id: '',
  period_start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
  period_end: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'),
  base_salary: 0,
  overtime_hours: 0,
  overtime_rate: 1.25,
  allowances: 0,
  deductions: 0,
  net_salary: 0,
  currency: 'CHF',
  status: 'draft'
};

export const PayrollContractsPage = () => {
  const { hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canEdit = isAdmin || isManager || hasPermission('view_customers');

  const [activeTab, setActiveTab] = useState<'contracts' | 'payroll' | 'allowances' | 'overtime'>('contracts');
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [allowances, setAllowances] = useState<ContractAllowance[]>([]);
  const [overtimeEntries, setOvertimeEntries] = useState<OvertimeEntry[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showContractModal, setShowContractModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [editingContract, setEditingContract] = useState<EmploymentContract | null>(null);
  const [editingPayroll, setEditingPayroll] = useState<PayrollEntry | null>(null);
  const [contractForm, setContractForm] = useState<ContractForm>(DEFAULT_CONTRACT_FORM);
  const [payrollForm, setPayrollForm] = useState<PayrollForm>(DEFAULT_PAYROLL_FORM);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'contracts') {
        const data = await Api.fetchEmploymentContracts();
        setContracts(data);
      } else if (activeTab === 'payroll') {
        const data = await Api.fetchPayrollEntries();
        setPayrollEntries(data);
      } else if (activeTab === 'allowances') {
        const data = await Api.fetchContractAllowances();
        setAllowances(data);
      } else if (activeTab === 'overtime') {
        const data = await Api.fetchOvertimeEntries();
        setOvertimeEntries(data);
      }
      const empData = await Api.fetchEmployees();
      setEmployees(empData);
    } catch (error: any) {
      toast.error(`Erreur chargement: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContract = async () => {
    try {
      if (!contractForm.employee_id) {
        toast.error('Sélectionnez un employé');
        return;
      }
      if (editingContract) {
        await Api.updateEmploymentContract(editingContract.id, contractForm);
        toast.success('Contrat mis à jour');
      } else {
        await Api.createEmploymentContract(contractForm);
        toast.success('Contrat créé');
      }
      setShowContractModal(false);
      setEditingContract(null);
      setContractForm(DEFAULT_CONTRACT_FORM);
      loadData();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleSavePayroll = async () => {
    try {
      if (!payrollForm.employee_id) {
        toast.error('Sélectionnez un employé');
        return;
      }
      const netSalary = payrollForm.base_salary + (payrollForm.overtime_hours * payrollForm.overtime_rate * payrollForm.base_salary / 160) + payrollForm.allowances - payrollForm.deductions;
      const payload = { ...payrollForm, net_salary: netSalary };
      if (editingPayroll) {
        await Api.updatePayrollEntry(editingPayroll.id, payload);
        toast.success('Fiche de paie mise à jour');
      } else {
        await Api.createPayrollEntry(payload);
        toast.success('Fiche de paie créée');
      }
      setShowPayrollModal(false);
      setEditingPayroll(null);
      setPayrollForm(DEFAULT_PAYROLL_FORM);
      loadData();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (!confirm('Supprimer ce contrat ?')) return;
    try {
      await Api.deleteEmploymentContract(id);
      toast.success('Contrat supprimé');
      loadData();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const filteredContracts = contracts.filter(c => {
    const emp = employees.find(e => e.id === c.employee_id);
    return !searchTerm || (emp?.first_name + ' ' + emp?.last_name).toLowerCase().includes(searchTerm.toLowerCase()) || c.contract_type.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredPayroll = payrollEntries.filter(p => {
    const emp = employees.find(e => e.id === p.employee_id);
    return !searchTerm || (emp?.first_name + ' ' + emp?.last_name).toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="payroll-contracts-page">
      <div className="page-header">
        <div>
          <h1>Paie & Contrats</h1>
          <p>Gestion des contrats de travail et fiches de paie</p>
        </div>
        {canEdit && (
          <div className="header-actions">
            {activeTab === 'contracts' && (
              <button className="btn-primary" onClick={() => { setEditingContract(null); setContractForm(DEFAULT_CONTRACT_FORM); setShowContractModal(true); }}>
                <Plus size={18} /> Nouveau contrat
              </button>
            )}
            {activeTab === 'payroll' && (
              <button className="btn-primary" onClick={() => { setEditingPayroll(null); setPayrollForm(DEFAULT_PAYROLL_FORM); setShowPayrollModal(true); }}>
                <Plus size={18} /> Nouvelle fiche de paie
              </button>
            )}
            {activeTab === 'allowances' && (
              <button className="btn-primary" onClick={() => setShowAllowanceModal(true)}>
                <Plus size={18} /> Nouvelle indemnité
              </button>
            )}
            {activeTab === 'overtime' && (
              <button className="btn-primary" onClick={() => setShowOvertimeModal(true)}>
                <Plus size={18} /> Nouvelle heure sup
              </button>
            )}
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={activeTab === 'contracts' ? 'active' : ''} onClick={() => setActiveTab('contracts')}>
          <Briefcase size={18} /> Contrats
        </button>
        <button className={activeTab === 'payroll' ? 'active' : ''} onClick={() => setActiveTab('payroll')}>
          <DollarSign size={18} /> Fiches de paie
        </button>
        <button className={activeTab === 'allowances' ? 'active' : ''} onClick={() => setActiveTab('allowances')}>
          <FileText size={18} /> Indemnités
        </button>
        <button className={activeTab === 'overtime' ? 'active' : ''} onClick={() => setActiveTab('overtime')}>
          <Calendar size={18} /> Heures sup
        </button>
      </div>

      <div className="search-bar">
        <Search size={20} />
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">
          <Loader2 className="spinner" />
        </div>
      ) : (
        <>
          {activeTab === 'contracts' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Type</th>
                    <th>Début</th>
                    <th>Fin</th>
                    <th>Taux</th>
                    <th>Salaire de base</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((contract) => {
                    const emp = employees.find(e => e.id === contract.employee_id);
                    return (
                      <tr key={contract.id}>
                        <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                        <td><span className="badge">{contract.contract_type}</span></td>
                        <td>{format(new Date(contract.start_date), 'dd.MM.yyyy', { locale: fr })}</td>
                        <td>{contract.end_date ? format(new Date(contract.end_date), 'dd.MM.yyyy', { locale: fr }) : 'Indéterminé'}</td>
                        <td>{contract.work_rate ?? 100}%</td>
                        <td>{contract.base_salary?.toFixed(2) ?? '0.00'} {contract.currency}</td>
                        <td>
                          {canEdit && (
                            <>
                              <button className="icon-btn" onClick={() => { setEditingContract(contract); setContractForm({ employee_id: contract.employee_id, contract_type: contract.contract_type as 'CDI' | 'CDD' | 'interim' | 'stage', start_date: contract.start_date, end_date: contract.end_date || null, work_rate: contract.work_rate ?? 100, base_salary: contract.base_salary ?? 0, currency: contract.currency, site_id: contract.site_id, notes: contract.notes || '' }); setShowContractModal(true); }}>
                                <Edit2 size={16} />
                              </button>
                              <button className="icon-btn danger" onClick={() => handleDeleteContract(contract.id)}>
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Période</th>
                    <th>Salaire de base</th>
                    <th>Heures sup</th>
                    <th>Indemnités</th>
                    <th>Net</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayroll.map((payroll) => {
                    const emp = employees.find(e => e.id === payroll.employee_id);
                    return (
                      <tr key={payroll.id}>
                        <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                        <td>{format(new Date(payroll.period_start), 'dd.MM.yyyy', { locale: fr })} - {format(new Date(payroll.period_end), 'dd.MM.yyyy', { locale: fr })}</td>
                        <td>{payroll.base_salary?.toFixed(2) ?? payroll.gross_amount?.toFixed(2) ?? '0.00'} {payroll.currency}</td>
                        <td>{payroll.overtime_hours ?? 0}h</td>
                        <td>{payroll.allowances?.toFixed(2) ?? '0.00'} {payroll.currency}</td>
                        <td><strong>{payroll.net_salary?.toFixed(2) ?? payroll.net_amount?.toFixed(2) ?? '0.00'} {payroll.currency}</strong></td>
                        <td><span className={`badge ${payroll.status}`}>{payroll.status}</span></td>
                        <td>
                          {canEdit && (
                            <button className="icon-btn" onClick={() => { setEditingPayroll(payroll); setPayrollForm({ employee_id: payroll.employee_id, period_start: payroll.period_start, period_end: payroll.period_end, base_salary: payroll.base_salary ?? payroll.gross_amount ?? 0, overtime_hours: payroll.overtime_hours ?? 0, overtime_rate: 1.25, allowances: payroll.allowances ?? 0, deductions: 0, net_salary: payroll.net_salary ?? payroll.net_amount ?? 0, currency: payroll.currency, status: payroll.status as 'draft' | 'approved' | 'paid' }); setShowPayrollModal(true); }}>
                              <Edit2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'allowances' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Contrat</th>
                    <th>Type</th>
                    <th>Montant</th>
                    <th>Période</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allowances.map((allowance) => {
                    const contract = contracts.find(c => c.id === allowance.contract_id);
                    const emp = contract ? employees.find(e => e.id === contract.employee_id) : null;
                    return (
                      <tr key={allowance.id}>
                        <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                        <td>{allowance.allowance_type ?? allowance.label}</td>
                        <td>{allowance.amount.toFixed(2)} {allowance.currency ?? 'CHF'}</td>
                        <td>{allowance.period_start ? format(new Date(allowance.period_start), 'dd.MM.yyyy', { locale: fr }) : 'Permanent'}</td>
                        <td>
                          {canEdit && (
                            <button className="icon-btn" onClick={() => {/* TODO */}}>
                              <Edit2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'overtime' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Date</th>
                    <th>Heures</th>
                    <th>Taux</th>
                    <th>Montant</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {overtimeEntries.map((overtime) => {
                    const emp = employees.find(e => e.id === overtime.employee_id);
                    return (
                      <tr key={overtime.id}>
                        <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                        <td>{format(new Date(overtime.overtime_date ?? overtime.entry_date), 'dd.MM.yyyy', { locale: fr })}</td>
                        <td>{overtime.hours}h</td>
                        <td>{overtime.rate_multiplier}x</td>
                        <td>{overtime.amount?.toFixed(2) ?? '0.00'} {overtime.currency ?? 'CHF'}</td>
                        <td>
                          {canEdit && (
                            <button className="icon-btn" onClick={() => {/* TODO */}}>
                              <Edit2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Contract Modal */}
      {showContractModal && (
        <div className="modal-overlay" onClick={() => { setShowContractModal(false); setEditingContract(null); setContractForm(DEFAULT_CONTRACT_FORM); }}>
          <div className="modal-content unified-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingContract ? 'Modifier le contrat' : 'Nouveau contrat'}</h2>
            <div className="form-group">
              <label>Employé *</label>
              <select value={contractForm.employee_id} onChange={(e) => setContractForm({ ...contractForm, employee_id: e.target.value })}>
                <option value="">Sélectionner...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type de contrat *</label>
                <select value={contractForm.contract_type} onChange={(e) => setContractForm({ ...contractForm, contract_type: e.target.value as any })}>
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="interim">Intérim</option>
                  <option value="stage">Stage</option>
                </select>
              </div>
              <div className="form-group">
                <label>Taux de travail (%)</label>
                <input type="number" value={contractForm.work_rate} onChange={(e) => setContractForm({ ...contractForm, work_rate: Number(e.target.value) })} min="0" max="100" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Date de début *</label>
                <input type="date" value={contractForm.start_date} onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Date de fin</label>
                <input type="date" value={contractForm.end_date || ''} onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value || null })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Salaire de base *</label>
                <input type="number" step="0.01" value={contractForm.base_salary} onChange={(e) => setContractForm({ ...contractForm, base_salary: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Devise</label>
                <select value={contractForm.currency} onChange={(e) => setContractForm({ ...contractForm, currency: e.target.value })}>
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowContractModal(false); setEditingContract(null); setContractForm(DEFAULT_CONTRACT_FORM); }}>Annuler</button>
              <button className="btn-primary" onClick={handleSaveContract}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Modal */}
      {showPayrollModal && (
        <div className="modal-overlay" onClick={() => { setShowPayrollModal(false); setEditingPayroll(null); setPayrollForm(DEFAULT_PAYROLL_FORM); }}>
          <div className="modal-content unified-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingPayroll ? 'Modifier la fiche de paie' : 'Nouvelle fiche de paie'}</h2>
            <div className="form-group">
              <label>Employé *</label>
              <select value={payrollForm.employee_id} onChange={(e) => setPayrollForm({ ...payrollForm, employee_id: e.target.value })}>
                <option value="">Sélectionner...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Début période *</label>
                <input type="date" value={payrollForm.period_start} onChange={(e) => setPayrollForm({ ...payrollForm, period_start: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Fin période *</label>
                <input type="date" value={payrollForm.period_end} onChange={(e) => setPayrollForm({ ...payrollForm, period_end: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Salaire de base *</label>
                <input type="number" step="0.01" value={payrollForm.base_salary} onChange={(e) => setPayrollForm({ ...payrollForm, base_salary: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Heures sup</label>
                <input type="number" step="0.1" value={payrollForm.overtime_hours} onChange={(e) => setPayrollForm({ ...payrollForm, overtime_hours: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Taux heures sup</label>
                <input type="number" step="0.01" value={payrollForm.overtime_rate} onChange={(e) => setPayrollForm({ ...payrollForm, overtime_rate: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Indemnités</label>
                <input type="number" step="0.01" value={payrollForm.allowances} onChange={(e) => setPayrollForm({ ...payrollForm, allowances: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Déductions</label>
                <input type="number" step="0.01" value={payrollForm.deductions} onChange={(e) => setPayrollForm({ ...payrollForm, deductions: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Statut</label>
                <select value={payrollForm.status} onChange={(e) => setPayrollForm({ ...payrollForm, status: e.target.value as any })}>
                  <option value="draft">Brouillon</option>
                  <option value="approved">Approuvé</option>
                  <option value="paid">Payé</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowPayrollModal(false); setEditingPayroll(null); setPayrollForm(DEFAULT_PAYROLL_FORM); }}>Annuler</button>
              <button className="btn-primary" onClick={handleSavePayroll}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

