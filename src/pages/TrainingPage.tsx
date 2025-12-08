import { useEffect, useState } from 'react';
import { Plus, BookOpen, Search, Loader2, Edit2, Trash2, Video, FileText, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api, type TrainingModule, type TrainingProgress, type TrainingReminder } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import './PayrollContractsPage.css'; // Reuse styles

export const TrainingPage = () => {
  const { hasRole } = useAuth();
  const isManager = hasRole('admin') || hasRole('manager');

  const [activeTab, setActiveTab] = useState<'modules' | 'progress' | 'reminders'>('modules');
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [reminders, setReminders] = useState<TrainingReminder[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', module_type: 'video' as 'video' | 'checklist' | 'quiz', content_url: '', duration_minutes: 0, is_mandatory: false });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'modules') {
        const data = await Api.fetchTrainingModules();
        setModules(data);
      } else if (activeTab === 'progress') {
        const data = await Api.fetchTrainingProgress();
        setProgress(data);
      } else if (activeTab === 'reminders') {
        const data = await Api.fetchTrainingReminders();
        setReminders(data);
      }
      const empData = await Api.fetchEmployees();
      setEmployees(empData);
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveModule = async () => {
    try {
      await Api.createTrainingModule(moduleForm);
      toast.success('Module créé');
      setShowModuleModal(false);
      setModuleForm({ title: '', description: '', module_type: 'video', content_url: '', duration_minutes: 0, is_mandatory: false });
      loadData();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  return (
    <div className="payroll-contracts-page">
      <div className="page-header">
        <div>
          <h1>Formation Continue</h1>
          <p>Gestion des modules de formation et suivi de progression</p>
        </div>
        {isManager && activeTab === 'modules' && (
          <button className="btn-primary" onClick={() => setShowModuleModal(true)}>
            <Plus size={18} /> Nouveau module
          </button>
        )}
      </div>

      <div className="tabs">
        <button className={activeTab === 'modules' ? 'active' : ''} onClick={() => setActiveTab('modules')}>
          <BookOpen size={18} /> Modules
        </button>
        <button className={activeTab === 'progress' ? 'active' : ''} onClick={() => setActiveTab('progress')}>
          <FileText size={18} /> Progression
        </button>
        <button className={activeTab === 'reminders' ? 'active' : ''} onClick={() => setActiveTab('reminders')}>
          <AlertCircle size={18} /> Rappels
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
          {activeTab === 'modules' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Type</th>
                    <th>Durée</th>
                    <th>Obligatoire</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.filter(m => !searchTerm || m.title.toLowerCase().includes(searchTerm.toLowerCase())).map((module) => (
                    <tr key={module.id}>
                      <td>{module.title}</td>
                      <td><span className="badge">{module.module_type}</span></td>
                      <td>{module.duration_minutes} min</td>
                      <td>{module.is_mandatory ? 'Oui' : 'Non'}</td>
                      <td>
                        {isManager && (
                          <>
                            <button className="icon-btn"><Edit2 size={16} /></button>
                            <button className="icon-btn danger"><Trash2 size={16} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Module</th>
                    <th>Statut</th>
                    <th>Progression</th>
                    <th>Complété le</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((p) => {
                    const emp = employees.find(e => e.id === p.employee_id);
                    const mod = modules.find(m => m.id === p.module_id);
                    return (
                      <tr key={p.id}>
                        <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                        <td>{mod?.title || 'N/A'}</td>
                        <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                        <td>{p.completion_percentage}%</td>
                        <td>{p.completed_at ? format(new Date(p.completed_at), 'dd.MM.yyyy', { locale: fr }) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Module</th>
                    <th>Raison</th>
                    <th>Date limite</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((r) => {
                    const emp = employees.find(e => e.id === r.employee_id);
                    const mod = modules.find(m => m.id === r.module_id);
                    return (
                      <tr key={r.id}>
                        <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                        <td>{mod?.title || 'N/A'}</td>
                        <td>{r.reason}</td>
                        <td>{format(new Date(r.due_date), 'dd.MM.yyyy', { locale: fr })}</td>
                        <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showModuleModal && (
        <div className="modal-overlay" onClick={() => setShowModuleModal(false)}>
          <div className="modal-content unified-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nouveau module</h2>
            <div className="form-group">
              <label>Titre *</label>
              <input type="text" value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} rows={3} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={moduleForm.module_type} onChange={(e) => setModuleForm({ ...moduleForm, module_type: e.target.value as any })}>
                  <option value="video">Vidéo</option>
                  <option value="checklist">Checklist</option>
                  <option value="quiz">Quiz</option>
                </select>
              </div>
              <div className="form-group">
                <label>Durée (min)</label>
                <input type="number" value={moduleForm.duration_minutes} onChange={(e) => setModuleForm({ ...moduleForm, duration_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-group">
              <label>URL contenu</label>
              <input type="text" value={moduleForm.content_url} onChange={(e) => setModuleForm({ ...moduleForm, content_url: e.target.value })} />
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={moduleForm.is_mandatory} onChange={(e) => setModuleForm({ ...moduleForm, is_mandatory: e.target.checked })} />
                Formation obligatoire
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModuleModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={handleSaveModule}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

