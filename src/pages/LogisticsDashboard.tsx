import { useEffect, useMemo, useState } from 'react';
import { Calendar, RefreshCcw, TrendingUp, Truck, Clock3 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Api } from '../lib/api';

type LogisticsKpis = Awaited<ReturnType<typeof Api.fetchLogisticsKpis>>;

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const LogisticsDashboard = () => {
  const today = useMemo(() => new Date(), []);
  const initialEnd = useMemo(() => formatDateInput(today), [today]);
  const initialStart = useMemo(() => formatDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), [today]);

  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<LogisticsKpis | null>(null);

  const loadKpis = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchLogisticsKpis({ start: startDate, end: endDate });
      setKpis(data);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de charger les KPIs logistiques");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, []);

  const statusEntries = useMemo(() => {
    if (!kpis) return [];
    return Object.entries(kpis.status_breakdown ?? {}).map(([status, value]) => ({ status, value }));
  }, [kpis]);

  const rotationsEntries = useMemo(() => {
    if (!kpis) return [];
    return Object.entries(kpis.rotations_per_day ?? {}).map(([date, value]) => ({ date, value }));
  }, [kpis]);

  return (
    <section className="destruction-page">
      <div className="destruction-wrapper">
        <div className="destruction-card">
          <div className="destruction-card__header">
            <div>
              <p className="eyebrow">Logistique</p>
              <h1>Tableau de bord</h1>
              <p>Suivi des rotations, des temps d’expédition et du taux de remplissage.</p>
            </div>
            <div className="kpi-filters">
              <label className="destruction-field">
                <span>Début</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="destruction-field">
                <span>Fin</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <button type="button" className="btn btn-outline" onClick={loadKpis} disabled={loading}>
                <RefreshCcw size={16} />
                Actualiser
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state" style={{ padding: 40 }}>
              Chargement…
            </div>
          ) : (
            <>
              <div className="kpi-grid">
                <div className="kpi-card">
                  <Truck size={20} />
                  <div>
                    <p>Rotations</p>
                    <h3>{kpis?.total_routes ?? 0}</h3>
                  </div>
                </div>
                <div className="kpi-card">
                  <TrendingUp size={20} />
                  <div>
                    <p>Rotations achevées</p>
                    <h3>{kpis?.completed_routes ?? 0}</h3>
                  </div>
                </div>
                <div className="kpi-card">
                  <Clock3 size={20} />
                  <div>
                    <p>Durée moyenne expédition</p>
                    <h3>{kpis?.avg_route_duration_minutes ?? 0} min</h3>
                  </div>
                </div>
                <div className="kpi-card">
                  <Calendar size={20} />
                  <div>
                    <p>Taux de remplissage</p>
                    <h3>{((kpis?.avg_fill_rate ?? 0) * 100).toFixed(1)}%</h3>
                  </div>
                </div>
              </div>

              <div className="logistics-panels">
                <div className="logistics-panel">
                  <div className="logistics-panel__header">
                    <strong>Status des routes</strong>
                    <span>Période {startDate} → {endDate}</span>
                  </div>
                  {statusEntries.length === 0 ? (
                    <p className="muted-text">Aucune donnée.</p>
                  ) : (
                    <ul className="status-list">
                      {statusEntries.map((entry) => (
                        <li key={entry.status}>
                          <span className="status-label">{entry.status}</span>
                          <strong>{entry.value}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="logistics-panel">
                  <div className="logistics-panel__header">
                    <strong>Rotations par jour</strong>
                    <span>Routes planifiées</span>
                  </div>
                  {rotationsEntries.length === 0 ? (
                    <p className="muted-text">Pas de rotation sur cette période.</p>
                  ) : (
                    <div className="rotations-bars">
                      {rotationsEntries.map((entry) => (
                        <div key={entry.date} className="rotations-bar">
                          <span>{entry.date}</span>
                          <div className="rotations-bar__track">
                            <div className="rotations-bar__fill" style={{ width: `${(entry.value / (kpis?.total_routes || 1)) * 100}%` }}>
                              {entry.value}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default LogisticsDashboard;

