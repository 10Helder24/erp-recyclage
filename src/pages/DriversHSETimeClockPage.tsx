import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Truck, Search, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api, type DriverDutyRecord, type DriverIncident, type EcoDrivingScore, type TimeClockEvent } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import './PayrollContractsPage.css';

export const DriversHSETimeClockPage = () => {
  const { hasRole } = useAuth();
  const isManager = hasRole('admin') || hasRole('manager');

  const [activeTab, setActiveTab] = useState<'drivers' | 'hse' | 'timeclock'>('drivers');
  const [dutyRecords, setDutyRecords] = useState<DriverDutyRecord[]>([]);
  const [incidents, setIncidents] = useState<DriverIncident[]>([]);
  const [ecoDriving, setEcoDriving] = useState<EcoDrivingScore[]>([]);
  const [timeClockEvents, setTimeClockEvents] = useState<TimeClockEvent[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const empData = await Api.fetchEmployees();
      setEmployees(empData);
      if (activeTab === 'drivers') {
        // Load driver data for first employee as example
        if (empData.length > 0) {
          const duty = await Api.fetchDriverDutyRecords(empData[0].id);
          setDutyRecords(duty);
          const inc = await Api.fetchDriverIncidents(empData[0].id);
          setIncidents(inc);
          const eco = await Api.fetchEcoDrivingScores(empData[0].id);
          setEcoDriving(eco);
        }
      } else if (activeTab === 'timeclock') {
        const data = await Api.fetchTimeClockEvents();
        setTimeClockEvents(data);
      }
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payroll-contracts-page">
      <div className="page-header">
        <div>
          <h1>Chauffeurs & HSE</h1>
          <p>Gestion des chauffeurs, incidents HSE et pointage</p>
        </div>
      </div>

      <div className="tabs">
        <button className={activeTab === 'drivers' ? 'active' : ''} onClick={() => setActiveTab('drivers')}>
          <Truck size={18} /> Chauffeurs
        </button>
        <button className={activeTab === 'hse' ? 'active' : ''} onClick={() => setActiveTab('hse')}>
          <AlertTriangle size={18} /> HSE
        </button>
        <button className={activeTab === 'timeclock' ? 'active' : ''} onClick={() => setActiveTab('timeclock')}>
          <Clock size={18} /> Pointage
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
          {activeTab === 'drivers' && (
            <>
              <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ padding: '1rem', margin: 0, borderBottom: '1px solid #e5e7eb' }}>Heures de service</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Employé</th>
                      <th>Date</th>
                      <th>Heures</th>
                      <th>Pauses</th>
                      <th>Conforme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dutyRecords.map((duty) => {
                      const emp = employees.find(e => e.id === duty.employee_id);
                      return (
                        <tr key={duty.id}>
                          <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                          <td>{format(new Date(duty.duty_date), 'dd.MM.yyyy', { locale: fr })}</td>
                          <td>{duty.total_hours}h</td>
                          <td>{duty.break_minutes} min</td>
                          <td><span className={`badge ${duty.is_compliant ? 'approved' : 'draft'}`}>{duty.is_compliant ? 'Oui' : 'Non'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ padding: '1rem', margin: 0, borderBottom: '1px solid #e5e7eb' }}>Incidents</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Employé</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => {
                      const emp = employees.find(e => e.id === inc.employee_id);
                      return (
                        <tr key={inc.id}>
                          <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                          <td>{format(new Date(inc.incident_date), 'dd.MM.yyyy', { locale: fr })}</td>
                          <td>{inc.incident_type}</td>
                          <td>{inc.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="table-container">
                <h3 style={{ padding: '1rem', margin: 0, borderBottom: '1px solid #e5e7eb' }}>Éco-conduite</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Employé</th>
                      <th>Période</th>
                      <th>Score</th>
                      <th>Consommation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ecoDriving.map((eco) => {
                      const emp = employees.find(e => e.id === eco.employee_id);
                      return (
                        <tr key={eco.id}>
                          <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                          <td>{format(new Date(eco.period_start), 'dd.MM.yyyy', { locale: fr })} - {format(new Date(eco.period_end), 'dd.MM.yyyy', { locale: fr })}</td>
                          <td><strong>{eco.score}/100</strong></td>
                          <td>{eco.fuel_consumption_l_per_100km?.toFixed(2) || '-'} L/100km</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'hse' && (
            <div className="table-container">
              <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Module HSE - À implémenter</p>
            </div>
          )}

          {activeTab === 'timeclock' && (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Type</th>
                    <th>Position</th>
                    <th>Date/Heure</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {timeClockEvents.map((event) => {
                    const emp = employees.find(e => e.id === event.employee_id);
                    return (
                      <tr key={event.id}>
                        <td>{emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}</td>
                        <td><span className="badge">{event.event_type}</span></td>
                        <td>{event.position_id || '-'}</td>
                        <td>{format(new Date(event.occurred_at), 'dd.MM.yyyy HH:mm', { locale: fr })}</td>
                        <td>{event.source || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

