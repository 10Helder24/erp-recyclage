import { useEffect, useState } from 'react';
import { Plus, Briefcase, Search, Loader2, Edit2, UserCheck, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api, type JobPosition, type JobApplicant, type ApplicantTest } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import './PayrollContractsPage.css';

export const RecruitmentPage = () => {
  const { hasRole } = useAuth();
  const isManager = hasRole('admin') || hasRole('manager');

  const [activeTab, setActiveTab] = useState<'positions' | 'applicants' | 'tests'>('positions');
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [applicants, setApplicants] = useState<JobApplicant[]>([]);
  const [tests, setTests] = useState<ApplicantTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [positionForm, setPositionForm] = useState({ title: '', department: '', description: '', requirements: '', status: 'open' as 'open' | 'closed' });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'positions') {
        const data = await Api.fetchJobPositions();
        setPositions(data);
      } else if (activeTab === 'applicants') {
        const data = await Api.fetchJobApplicants();
        setApplicants(data);
      } else if (activeTab === 'tests') {
        const data = await Api.fetchApplicantTests();
        setTests(data);
      }
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePosition = async () => {
    try {
      await Api.createJobPosition(positionForm);
      toast.success('Poste créé');
      setShowPositionModal(false);
      setPositionForm({ title: '', department: '', description: '', requirements: '', status: 'open' });
      loadData();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  return (
    <div className="payroll-contracts-page">
      <div className="page-header">
        <div>
          <h1>Recrutement</h1>
          <p>Gestion des postes, candidats et tests</p>
        </div>
        {isManager && activeTab === 'positions' && (
          <button className="btn-primary" onClick={() => setShowPositionModal(true)}>
            <Plus size={18} /> Nouveau poste
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={activeTab === 'positions' ? 'active' : ''} onClick={() => setActiveTab('positions')}>
          <Briefcase size={18} /> Postes
        </button>
        <button className={activeTab === 'applicants' ? 'active' : ''} onClick={() => setActiveTab('applicants')}>
          <UserCheck size={18} /> Candidats
        </button>
        <button className={activeTab === 'tests' ? 'active' : ''} onClick={() => setActiveTab('tests')}>
          <FileText size={18} /> Tests
        </button>
      </div>

      <div className="search-bar">
        <Search size={20} />
        <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading"><Loader2 className="spinner" /></div>
      ) : (
        <>
          {activeTab === 'positions' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Département</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.filter(p => !searchTerm || p.title.toLowerCase().includes(searchTerm.toLowerCase())).map((pos) => (
                    <tr key={pos.id}>
                      <td>{pos.title}</td>
                      <td>{pos.department}</td>
                      <td><span className={`badge ${pos.status}`}>{pos.status}</span></td>
                      <td>
                        {isManager && <button className="icon-btn"><Edit2 size={16} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'applicants' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Poste</th>
                    <th>Statut</th>
                    <th>Score</th>
                    <th>Date candidature</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((app) => {
                    const pos = positions.find(p => p.id === app.position_id);
                    return (
                      <tr key={app.id}>
                        <td>{app.first_name ?? app.full_name.split(' ')[0]} {app.last_name ?? app.full_name.split(' ').slice(1).join(' ')}</td>
                        <td>{pos?.title || 'N/A'}</td>
                        <td><span className={`badge ${app.status}`}>{app.status}</span></td>
                        <td>{app.test_score ?? app.score ?? '-'}</td>
                        <td>{app.applied_at ? format(new Date(app.applied_at), 'dd.MM.yyyy', { locale: fr }) : format(new Date(app.created_at), 'dd.MM.yyyy', { locale: fr })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'tests' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Candidat</th>
                    <th>Type</th>
                    <th>Score</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test) => {
                    const app = applicants.find(a => a.id === test.applicant_id);
                    return (
                      <tr key={test.id}>
                        <td>{app ? `${app.first_name ?? app.full_name.split(' ')[0]} ${app.last_name ?? app.full_name.split(' ').slice(1).join(' ')}` : 'N/A'}</td>
                        <td>{test.test_type}</td>
                        <td>{test.score ?? 0}%</td>
                        <td>{test.completed_at ? format(new Date(test.completed_at), 'dd.MM.yyyy', { locale: fr }) : format(new Date(test.created_at), 'dd.MM.yyyy', { locale: fr })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showPositionModal && (
        <div className="modal-overlay" onClick={() => setShowPositionModal(false)}>
          <div className="modal-content unified-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nouveau poste</h2>
            <div className="form-group">
              <label>Titre *</label>
              <input type="text" value={positionForm.title} onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Département</label>
              <input type="text" value={positionForm.department} onChange={(e) => setPositionForm({ ...positionForm, department: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={positionForm.description} onChange={(e) => setPositionForm({ ...positionForm, description: e.target.value })} rows={4} />
            </div>
            <div className="form-group">
              <label>Exigences</label>
              <textarea value={positionForm.requirements} onChange={(e) => setPositionForm({ ...positionForm, requirements: e.target.value })} rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPositionModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={handleSavePosition}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

