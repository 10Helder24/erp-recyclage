import React, { useEffect, useState } from 'react';
import { Api, HrDashboard, EmploymentContract, PayrollEntry, TrainingReminder, TrainingModule, JobApplicant, JobPosition, DriverDutyRecord, DriverIncident, EcoDrivingScore } from '../lib/api';
import './HRDashboardPage.css';

type Status = 'idle' | 'loading' | 'error';

const HRDashboardPage: React.FC = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<HrDashboard | null>(null);
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollEntry[]>([]);
  const [reminders, setReminders] = useState<TrainingReminder[]>([]);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [applicants, setApplicants] = useState<JobApplicant[]>([]);
  const [duties, setDuties] = useState<DriverDutyRecord[]>([]);
  const [incidents, setIncidents] = useState<DriverIncident[]>([]);
  const [eco, setEco] = useState<EcoDrivingScore[]>([]);

  const loadAll = async () => {
    setStatus('loading');
    setError(null);
    try {
      const [s, c, p, r, m, pos, apps] = await Promise.all([
        Api.fetchHrDashboard(),
        Api.fetchContracts({ status: 'active' }),
        Api.fetchPayroll({}),
        Api.fetchTrainingReminders(),
        Api.fetchTrainingModules(),
        Api.fetchJobPositions(),
        Api.fetchJobApplicants({})
      ]);
      setSummary(s);
      setContracts(c);
      setPayrolls(p);
      setReminders(r);
      setModules(m);
      setPositions(pos);
      setApplicants(apps);
      // Chauffeurs : charge un échantillon (dernier employé trouvé)
      if (apps.length > 0 || c.length > 0) {
        const employeeId = c[0]?.employee_id || apps[0]?.id;
        if (employeeId) {
          try {
            const [d, inc, ecoScores] = await Promise.all([
              Api.fetchDriverDuty(employeeId).catch(() => []),
              Api.fetchDriverIncidents(employeeId).catch(() => []),
              Api.fetchEcoDriving(employeeId).catch(() => [])
            ]);
            setDuties(d);
            setIncidents(inc);
            setEco(ecoScores);
          } catch (err) {
            // Ignorer les erreurs pour les endpoints optionnels
            console.warn('Erreur chargement données chauffeur:', err);
          }
        }
      }
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
      setStatus('error');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="dashboard-page unified-page">
      <div className="page-header">
        <div>
          <h1>Dashboard RH+</h1>
          <p className="text-muted">Synthèse RH : effectifs, polyvalence, formation, HSE, paie.</p>
        </div>
        <button className="btn btn-primary" onClick={loadAll} disabled={status === 'loading'}>
          {status === 'loading' ? 'Chargement...' : 'Rafraîchir'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="grid-4">
        <div className="card metric">
          <p className="label">Effectifs</p>
          <h2>{summary?.headcount ?? '—'}</h2>
          <p className="sub">Contrats actifs : {summary?.activeContracts ?? '—'}</p>
        </div>
        <div className="card metric">
          <p className="label">Polyvalence moyenne</p>
          <h2>{summary ? summary.avgVersatility.toFixed(1) : '—'}</h2>
          <p className="sub">Indice sur les 90 derniers jours</p>
        </div>
        <div className="card metric">
          <p className="label">Conformité formation</p>
          <h2>
            {summary?.trainingCompliance?.rate != null ? `${summary.trainingCompliance.rate}%` : '—'}
          </h2>
          <p className="sub">
            {summary?.trainingCompliance?.completed ?? 0}/{summary?.trainingCompliance?.total ?? 0} modules
          </p>
        </div>
        <div className="card metric">
          <p className="label">Absentéisme (mois)</p>
          <h2>{summary ? `${summary.absenteeism.rate}%` : '—'}</h2>
          <p className="sub">{summary ? `${summary.absenteeism.absent} absents` : '—'}</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>HSE & heures sup</h3>
            <span className="badge warning">Critiques HSE : {summary?.hseOpenCritical ?? 0}</span>
          </div>
          <ul className="list">
            <li>Heures sup (30j) : {summary?.overtimeLast30Hours ?? 0} h</li>
            <li>Incidents chauffeurs (échantillon) : {incidents.length}</li>
            <li>Éco-conduite (échantillon) : {eco[0]?.score ?? '—'}</li>
            <li>Postes tenus (duty) : {duties.length}</li>
          </ul>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Rappels formation (30j)</h3>
            <span className="badge info">{reminders.length}</span>
          </div>
          <ul className="list">
            {reminders.slice(0, 5).map((r) => (
              <li key={r.id}>
                <strong>{r.title || 'Module'}</strong> — dû le {r.due_date}
              </li>
            ))}
            {reminders.length === 0 && <li className="text-muted">Aucun rappel à venir</li>}
          </ul>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Contrats actifs</h3>
            <span className="badge">{contracts.length}</span>
          </div>
          <ul className="list">
            {contracts.slice(0, 5).map((c) => (
              <li key={c.id}>
                {c.contract_type.toUpperCase()} — début {c.start_date} — {c.status}
              </li>
            ))}
            {contracts.length === 0 && <li className="text-muted">Aucun contrat</li>}
          </ul>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Paie (dernières fiches)</h3>
            <span className="badge">{payrolls.length}</span>
          </div>
          <ul className="list">
            {payrolls.slice(0, 5).map((p) => (
              <li key={p.id}>
                {p.period_start} → {p.period_end} — {p.net_amount ?? '—'} {p.currency}
              </li>
            ))}
            {payrolls.length === 0 && <li className="text-muted">Aucune fiche</li>}
          </ul>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Recrutement</h3>
            <span className="badge">{positions.length} postes</span>
          </div>
          <ul className="list">
            {positions.slice(0, 4).map((p) => (
              <li key={p.id}>
                {p.title} — {p.status}
              </li>
            ))}
            {positions.length === 0 && <li className="text-muted">Aucun poste</li>}
          </ul>
          <div className="divider" />
          <p className="text-muted">Candidats : {applicants.length}</p>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Formations</h3>
            <span className="badge">{modules.length}</span>
          </div>
          <ul className="list">
            {modules.slice(0, 4).map((m) => (
              <li key={m.id}>
                {m.title} — {m.module_type}
              </li>
            ))}
            {modules.length === 0 && <li className="text-muted">Aucun module</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HRDashboardPage;

