import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  DollarSign, 
  Users, 
  Truck, 
  Clock, 
  AlertCircle,
  BarChart3,
  PieChart,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { Api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../context/I18nContext';
import toast from 'react-hot-toast';

type DashboardKpis = {
  period: string;
  start_date: string;
  end_date: string;
  volumes: {
    total: number;
    halle_bb: number;
    plastique_balles: number;
    cdt_m3: number;
    papier_balles: number;
  };
  performance: {
    routes: {
      total: number;
      completed: number;
      completion_rate: number;
      avg_duration_minutes: number;
    };
    interventions: {
      total: number;
      completed: number;
      pending: number;
      completion_rate: number;
      avg_time_hours: number;
    };
    vehicle_fill_rate: number;
  };
  charts: {
    monthly_evolution: Array<{
      month: string;
      halle_bb: number;
      plastique_balles: number;
      cdt_m3: number;
      papier_balles: number;
    }>;
    material_distribution: {
      halle: number;
      plastique: number;
      cdt: number;
      papier: number;
    };
  };
  alerts: any[];
};

const DashboardPage = () => {
  const { hasRole } = useAuth();
  const { t } = useI18n();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadKpis = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchDashboardKpis({ period });
      setKpis(data);
      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('Error loading dashboard KPIs:', error);
      toast.error('Impossible de charger les données du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKpis();
    // Auto-refresh toutes les 5 minutes
    const interval = setInterval(loadKpis, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [period]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toFixed(0);
  };

  const formatPeriodLabel = (p: string) => {
    switch (p) {
      case 'day': return t('dashboard.period.today');
      case 'week': return t('dashboard.period.thisWeek');
      case 'month': return t('dashboard.period.thisMonth');
      case 'year': return t('dashboard.period.thisYear');
      default: return p;
    }
  };

  const materialDistributionData = useMemo(() => {
    if (!kpis) return [];
    const dist = kpis.charts.material_distribution;
    const total = dist.halle + dist.plastique + dist.cdt + dist.papier;
    if (total === 0) return [];
    
    return [
      { name: t('dashboard.material.halle'), value: dist.halle, percentage: (dist.halle / total) * 100, color: '#3b82f6' },
      { name: t('dashboard.material.plastique'), value: dist.plastique, percentage: (dist.plastique / total) * 100, color: '#10b981' },
      { name: t('dashboard.material.cdt'), value: dist.cdt, percentage: (dist.cdt / total) * 100, color: '#f59e0b' },
      { name: t('dashboard.material.papier'), value: dist.papier, percentage: (dist.papier / total) * 100, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [kpis]);

  if (loading && !kpis) {
    return (
      <section className="destruction-page">
        <div className="destruction-wrapper">
          <div className="destruction-card">
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <RefreshCw className="spinner" size={32} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '16px' }}>{t('dashboard.loading')}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!kpis) {
    return (
      <section className="destruction-page">
        <div className="destruction-wrapper">
          <div className="destruction-card">
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <AlertCircle size={32} style={{ color: 'var(--text-secondary)' }} />
              <p style={{ marginTop: '16px' }}>{t('dashboard.noData')}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="destruction-page">
      <div className="destruction-wrapper">
        <div className="destruction-card">
          <div className="destruction-card__header">
            <div>
              <p className="eyebrow">{t('dashboard.title')}</p>
              <h1>{t('dashboard.overview')}</h1>
              <p>{t('dashboard.subtitle')}</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="destruction-field" style={{ maxWidth: 200 }}>
                <select
                  className="destruction-input"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                >
                  <option value="day">{t('dashboard.period.today')}</option>
                  <option value="week">{t('dashboard.period.thisWeek')}</option>
                  <option value="month">{t('dashboard.period.thisMonth')}</option>
                  <option value="year">{t('dashboard.period.thisYear')}</option>
                </select>
              </div>
              <button
                className="btn btn-outline"
                onClick={loadKpis}
                disabled={loading}
              >
                <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                {t('dashboard.refresh')}
              </button>
            </div>
          </div>

          <div className="destruction-card__body">
            {/* Période et dernière mise à jour */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
              padding: '12px',
              background: 'var(--card-bg)',
              borderRadius: '8px',
              border: '1px solid var(--border)'
            }}>
              <div>
                <strong>{formatPeriodLabel(period)}</strong>
                <span style={{ marginLeft: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {new Date(kpis.start_date).toLocaleDateString('fr-FR')} - {new Date(kpis.end_date).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {t('dashboard.lastUpdate')}: {lastUpdate.toLocaleTimeString('fr-FR')}
              </div>
            </div>

            {/* KPIs Cards */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '16px',
              marginBottom: '32px'
            }}>
              {/* Volume total */}
              <div className="kpi-card">
                <div className="kpi-card__header">
                  <Package size={20} style={{ color: 'var(--primary)' }} />
                  <span className="kpi-card__label">{t('dashboard.kpi.totalVolume')}</span>
                </div>
                <div className="kpi-card__value">{formatNumber(kpis.volumes.total)}</div>
                <div className="kpi-card__details">
                  <span>BB: {formatNumber(kpis.volumes.halle_bb)}</span>
                  <span>•</span>
                  <span>Balles: {formatNumber(kpis.volumes.plastique_balles + kpis.volumes.papier_balles)}</span>
                  <span>•</span>
                  <span>m³: {formatNumber(kpis.volumes.cdt_m3)}</span>
                </div>
              </div>

              {/* Performance routes */}
              <div className="kpi-card">
                <div className="kpi-card__header">
                  <Truck size={20} style={{ color: 'var(--primary)' }} />
                  <span className="kpi-card__label">{t('dashboard.kpi.routes')}</span>
                </div>
                <div className="kpi-card__value">
                  {kpis.performance.routes.completed} / {kpis.performance.routes.total}
                </div>
                <div className="kpi-card__details">
                  <span>{kpis.performance.routes.completion_rate}% {t('dashboard.kpi.completed')}</span>
                  {kpis.performance.routes.avg_duration_minutes > 0 && (
                    <>
                      <span>•</span>
                      <span>{t('dashboard.kpi.avgDuration')}: {Math.round(kpis.performance.routes.avg_duration_minutes / 60)}h{Math.round(kpis.performance.routes.avg_duration_minutes % 60)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Interventions */}
              <div className="kpi-card">
                <div className="kpi-card__header">
                  <AlertCircle size={20} style={{ color: 'var(--primary)' }} />
                  <span className="kpi-card__label">{t('dashboard.kpi.interventions')}</span>
                </div>
                <div className="kpi-card__value">
                  {kpis.performance.interventions.completed} / {kpis.performance.interventions.total}
                </div>
                <div className="kpi-card__details">
                  <span>{kpis.performance.interventions.completion_rate}% {t('dashboard.kpi.completed')}</span>
                  {kpis.performance.interventions.pending > 0 && (
                    <>
                      <span>•</span>
                      <span style={{ color: 'var(--warning)' }}>{kpis.performance.interventions.pending} {t('dashboard.kpi.pending')}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Taux de remplissage */}
              <div className="kpi-card">
                <div className="kpi-card__header">
                  <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
                  <span className="kpi-card__label">{t('dashboard.kpi.vehicleFill')}</span>
                </div>
                <div className="kpi-card__value">
                  {Math.round(kpis.performance.vehicle_fill_rate * 100)}%
                </div>
                <div className="kpi-card__details">
                  <span>{t('dashboard.kpi.avgFillRate')}</span>
                </div>
              </div>
            </div>

            {/* Graphiques */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* Évolution mensuelle */}
              <div className="chart-card">
                <div className="chart-card__header">
                  <BarChart3 size={20} />
                  <h3>{t('dashboard.chart.monthlyEvolution')}</h3>
                </div>
                <div className="chart-card__body">
                  {kpis.charts.monthly_evolution.length > 0 ? (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '20px' }}>
                      {kpis.charts.monthly_evolution.map((month, idx) => {
                        const maxValue = Math.max(
                          ...kpis.charts.monthly_evolution.map(m => 
            m.halle_bb + m.plastique_balles + m.cdt_m3 + m.papier_balles
          )
                        );
                        const total = month.halle_bb + month.plastique_balles + month.cdt_m3 + month.papier_balles;
                        const height = maxValue > 0 ? (total / maxValue) * 100 : 0;
                        return (
                          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ 
                              width: '100%', 
                              background: 'linear-gradient(to top, var(--primary), var(--primary-light))',
                              borderRadius: '4px 4px 0 0',
                              height: `${height}%`,
                              minHeight: '4px',
                              position: 'relative',
                              cursor: 'pointer'
                            }} title={`${new Date(month.month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}: ${formatNumber(total)}`}>
                            </div>
                            <div style={{ 
                              marginTop: '8px', 
                              fontSize: '0.75rem', 
                              color: 'var(--text-secondary)',
                              transform: 'rotate(-45deg)',
                              transformOrigin: 'top left',
                              whiteSpace: 'nowrap'
                            }}>
                              {new Date(month.month + '-01').toLocaleDateString('fr-FR', { month: 'short' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Aucune donnée disponible
                    </div>
                  )}
                </div>
              </div>

              {/* Répartition des matières */}
              <div className="chart-card">
                <div className="chart-card__header">
                  <PieChart size={20} />
                  <h3>{t('dashboard.chart.materialDistribution')}</h3>
                </div>
                <div className="chart-card__body">
                  {materialDistributionData.length > 0 ? (
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {materialDistributionData.map((item, idx) => (
                          <div key={idx}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ 
                                  width: '12px', 
                                  height: '12px', 
                                  borderRadius: '2px', 
                                  background: item.color 
                                }}></div>
                                <strong>{item.name}</strong>
                              </span>
                              <span>{item.percentage.toFixed(1)}%</span>
                            </div>
                            <div style={{ 
                              width: '100%', 
                              height: '8px', 
                              background: 'var(--border)', 
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{ 
                                width: `${item.percentage}%`, 
                                height: '100%', 
                                background: item.color,
                                transition: 'width 0.3s ease'
                              }}></div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {formatNumber(item.value)} unités
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Aucune donnée disponible
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Alertes (si admin/manager) */}
            {(isAdmin || isManager) && kpis.alerts && kpis.alerts.length > 0 && (
              <div className="chart-card" style={{ borderColor: 'var(--warning)' }}>
                <div className="chart-card__header">
                  <AlertCircle size={20} style={{ color: 'var(--warning)' }} />
                  <h3>Alertes</h3>
                </div>
                <div className="chart-card__body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {kpis.alerts.map((alert: any, idx: number) => (
                      <div key={idx} style={{ 
                        padding: '12px', 
                        background: 'var(--warning-bg)', 
                        borderRadius: '6px',
                        border: '1px solid var(--warning)'
                      }}>
                        <strong>{alert.title}</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{alert.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;

