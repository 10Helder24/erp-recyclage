import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  Mail,
  Calendar,
  TrendingUp,
  Users,
  Package,
  DollarSign,
  BarChart3,
  PieChart,
  Filter,
  RefreshCw,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

type ReportType = 'weekly' | 'monthly' | 'regulatory' | 'performance' | 'predictive';
type ReportFormat = 'excel' | 'pdf';
type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'custom';

type ReportFilters = {
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  department?: string;
  team?: string;
  materialType?: string;
};

type WeeklyReport = {
  week_start: string;
  week_end: string;
  volumes: {
    total: number;
    by_material: Record<string, number>;
  };
  performance: {
    routes_completed: number;
    routes_total: number;
    avg_duration: number;
    vehicle_fill_rate: number;
  };
  financial: {
    revenue: number;
    costs: number;
    margin: number;
  };
};

type MonthlyReport = {
  month: string;
  volumes: {
    total: number;
    by_material: Record<string, number>;
    evolution: number; // % vs previous month
  };
  performance: {
    teams: Array<{
      team_name: string;
      routes_completed: number;
      avg_duration: number;
      efficiency_score: number;
    }>;
  };
  financial: {
    revenue: number;
    costs: number;
    margin: number;
    margin_percentage: number;
  };
};

type RegulatoryReport = {
  period_start: string;
  period_end: string;
  compliance_score: number;
  waste_tracking: {
    total_volume: number;
    tracked_volume: number;
    tracking_rate: number;
  };
  certificates: {
    generated: number;
    pending: number;
    expired: number;
  };
  environmental_impact: {
    co2_saved: number;
    energy_saved: number;
    landfill_diverted: number;
  };
};

type PerformanceReport = {
  period_start: string;
  period_end: string;
  teams: Array<{
    team_id: string;
    team_name: string;
    department: string;
    metrics: {
      routes_completed: number;
      avg_duration_hours: number;
      on_time_rate: number;
      customer_satisfaction: number;
      efficiency_score: number;
    };
  }>;
  departments: Array<{
    department_name: string;
    total_routes: number;
    completion_rate: number;
    avg_efficiency: number;
  }>;
};

type PredictiveAnalysis = {
  forecast_period: string;
  volume_forecast: {
    next_month: number;
    next_quarter: number;
    next_year: number;
    confidence: number;
  };
  resource_needs: {
    vehicles: {
      current: number;
      needed: number;
      recommendation: string;
    };
    staff: {
      current: number;
      needed: number;
      recommendation: string;
    };
    storage: {
      current_capacity: number;
      needed_capacity: number;
      recommendation: string;
    };
  };
  trends: Array<{
    metric: string;
    current_value: number;
    predicted_value: number;
    change_percent: number;
  }>;
};

export const ReportsPage = () => {
  const { hasRole, hasPermission } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');

  const [activeTab, setActiveTab] = useState<ReportType>('weekly');
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({
    period: 'month'
  });
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [regulatoryReport, setRegulatoryReport] = useState<RegulatoryReport | null>(null);
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [predictiveAnalysis, setPredictiveAnalysis] = useState<PredictiveAnalysis | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadWeeklyReport = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchWeeklyReport(filters);
      setWeeklyReport(data);
    } catch (error: any) {
      console.error('Error loading weekly report:', error);
      toast.error('Impossible de charger le rapport hebdomadaire');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReport = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchMonthlyReport(filters);
      setMonthlyReport(data);
    } catch (error: any) {
      console.error('Error loading monthly report:', error);
      toast.error('Impossible de charger le rapport mensuel');
    } finally {
      setLoading(false);
    }
  };

  const loadRegulatoryReport = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchRegulatoryReport(filters);
      setRegulatoryReport(data);
    } catch (error: any) {
      console.error('Error loading regulatory report:', error);
      toast.error('Impossible de charger le rapport réglementaire');
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceReport = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchPerformanceReport(filters);
      setPerformanceReport(data);
    } catch (error: any) {
      console.error('Error loading performance report:', error);
      toast.error('Impossible de charger le rapport de performance');
    } finally {
      setLoading(false);
    }
  };

  const loadPredictiveAnalysis = async () => {
    try {
      setLoading(true);
      const data = await Api.fetchPredictiveAnalysis(filters);
      setPredictiveAnalysis(data);
    } catch (error: any) {
      console.error('Error loading predictive analysis:', error);
      toast.error('Impossible de charger l\'analyse prédictive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    switch (activeTab) {
      case 'weekly':
        loadWeeklyReport();
        break;
      case 'monthly':
        loadMonthlyReport();
        break;
      case 'regulatory':
        loadRegulatoryReport();
        break;
      case 'performance':
        loadPerformanceReport();
        break;
      case 'predictive':
        loadPredictiveAnalysis();
        break;
    }
  }, [activeTab, filters]);

  const handleExport = async (format: ReportFormat) => {
    try {
      setExporting(true);
      await Api.exportReport({
        reportType: activeTab,
        format,
        filters
      });
      toast.success(`Rapport ${format.toUpperCase()} généré avec succès`);
    } catch (error: any) {
      console.error('Error exporting report:', error);
      toast.error(`Impossible d'exporter le rapport en ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  const handleScheduleReport = async () => {
    try {
      await Api.scheduleReport({
        reportType: activeTab,
        frequency: activeTab === 'weekly' ? 'weekly' : 'monthly',
        recipients: [],
        filters
      });
      toast.success('Rapport programmé avec succès');
    } catch (error: any) {
      console.error('Error scheduling report:', error);
      toast.error('Impossible de programmer le rapport');
    }
  };

  const updateFilters = (newFilters: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const getPeriodDates = useMemo(() => {
    const now = new Date();
    switch (filters.period) {
      case 'week':
        return {
          startDate: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          endDate: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'month':
        return {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd')
        };
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        return {
          startDate: format(quarterStart, 'yyyy-MM-dd'),
          endDate: format(quarterEnd, 'yyyy-MM-dd')
        };
      case 'year':
        return {
          startDate: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
          endDate: format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd')
        };
      default:
        return {
          startDate: filters.startDate || format(subMonths(now, 1), 'yyyy-MM-dd'),
          endDate: filters.endDate || format(now, 'yyyy-MM-dd')
        };
    }
  }, [filters.period, filters.startDate, filters.endDate]);

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1>Rapports et Analytics</h1>
          <p className="page-description">
            Rapports automatisés, analyses de performance et prévisions
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            Filtres
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              switch (activeTab) {
                case 'weekly':
                  loadWeeklyReport();
                  break;
                case 'monthly':
                  loadMonthlyReport();
                  break;
                case 'regulatory':
                  loadRegulatoryReport();
                  break;
                case 'performance':
                  loadPerformanceReport();
                  break;
                case 'predictive':
                  loadPredictiveAnalysis();
                  break;
              }
            }}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
            Actualiser
          </button>
          <button
            className="btn-primary"
            onClick={handleScheduleReport}
            disabled={!isAdmin && !isManager}
          >
            <Mail size={18} />
            Programmer
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="reports-filters-panel">
          <div className="filter-group">
            <label>Période</label>
            <select
              value={filters.period}
              onChange={(e) => updateFilters({ period: e.target.value as PeriodType })}
            >
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="quarter">Trimestre</option>
              <option value="year">Année</option>
              <option value="custom">Personnalisé</option>
            </select>
          </div>
          {filters.period === 'custom' && (
            <>
              <div className="filter-group">
                <label>Date de début</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => updateFilters({ startDate: e.target.value })}
                />
              </div>
              <div className="filter-group">
                <label>Date de fin</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => updateFilters({ endDate: e.target.value })}
                />
              </div>
            </>
          )}
          <div className="filter-group">
            <label>Département</label>
            <select
              value={filters.department || ''}
              onChange={(e) => updateFilters({ department: e.target.value || undefined })}
            >
              <option value="">Tous</option>
              <option value="logistics">Logistique</option>
              <option value="operations">Exploitation</option>
              <option value="sales">Commercial</option>
            </select>
          </div>
        </div>
      )}

      <div className="reports-tabs">
        <button
          className={activeTab === 'weekly' ? 'active' : ''}
          onClick={() => setActiveTab('weekly')}
        >
          <Calendar size={18} />
          Hebdomadaire
        </button>
        <button
          className={activeTab === 'monthly' ? 'active' : ''}
          onClick={() => setActiveTab('monthly')}
        >
          <Calendar size={18} />
          Mensuel
        </button>
        <button
          className={activeTab === 'regulatory' ? 'active' : ''}
          onClick={() => setActiveTab('regulatory')}
        >
          <AlertTriangle size={18} />
          Réglementaire
        </button>
        <button
          className={activeTab === 'performance' ? 'active' : ''}
          onClick={() => setActiveTab('performance')}
        >
          <TrendingUp size={18} />
          Performance
        </button>
        <button
          className={activeTab === 'predictive' ? 'active' : ''}
          onClick={() => setActiveTab('predictive')}
        >
          <BarChart3 size={18} />
          Prédictif
        </button>
      </div>

      <div className="reports-content">
        {loading ? (
          <div className="loading-state">
            <RefreshCw className="spinning" size={32} />
            <p>Chargement du rapport...</p>
          </div>
        ) : (
          <>
            {activeTab === 'weekly' && weeklyReport && (
              <WeeklyReportView report={weeklyReport} />
            )}
            {activeTab === 'monthly' && monthlyReport && (
              <MonthlyReportView report={monthlyReport} />
            )}
            {activeTab === 'regulatory' && regulatoryReport && (
              <RegulatoryReportView report={regulatoryReport} />
            )}
            {activeTab === 'performance' && performanceReport && (
              <PerformanceReportView report={performanceReport} />
            )}
            {activeTab === 'predictive' && predictiveAnalysis && (
              <PredictiveAnalysisView analysis={predictiveAnalysis} />
            )}

            <div className="reports-export-actions">
              <button
                className="btn-secondary"
                onClick={() => handleExport('excel')}
                disabled={exporting}
              >
                <FileSpreadsheet size={18} />
                Exporter Excel
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleExport('pdf')}
                disabled={exporting}
              >
                <FileText size={18} />
                Exporter PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Composants de visualisation des rapports
const WeeklyReportView = ({ report }: { report: WeeklyReport }) => (
  <div className="report-view">
    <div className="report-header">
      <h2>Rapport Hebdomadaire</h2>
      <p>
        {format(new Date(report.week_start), 'dd MMMM', { locale: fr })} -{' '}
        {format(new Date(report.week_end), 'dd MMMM yyyy', { locale: fr })}
      </p>
    </div>

    <div className="report-stats-grid">
      <div className="report-stat-card">
        <Package size={24} />
        <div>
          <h3>Volumes totaux</h3>
          <p className="stat-value">{report.volumes.total.toLocaleString()}</p>
        </div>
      </div>
      <div className="report-stat-card">
        <Truck size={24} />
        <div>
          <h3>Tournées</h3>
          <p className="stat-value">
            {report.performance.routes_completed} / {report.performance.routes_total}
          </p>
        </div>
      </div>
      <div className="report-stat-card">
        <DollarSign size={24} />
        <div>
          <h3>Revenus</h3>
          <p className="stat-value">{report.financial.revenue.toLocaleString()} CHF</p>
        </div>
      </div>
      <div className="report-stat-card">
        <TrendingUp size={24} />
        <div>
          <h3>Marge</h3>
          <p className="stat-value">{report.financial.margin.toLocaleString()} CHF</p>
        </div>
      </div>
    </div>

    <div className="report-section">
      <h3>Répartition par matière</h3>
      <div className="material-distribution">
        {Object.entries(report.volumes.by_material).map(([material, volume]) => (
          <div key={material} className="material-item">
            <span className="material-name">{material}</span>
            <span className="material-volume">{volume.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const MonthlyReportView = ({ report }: { report: MonthlyReport }) => (
  <div className="report-view">
    <div className="report-header">
      <h2>Rapport Mensuel</h2>
      <p>{format(new Date(report.month + '-01'), 'MMMM yyyy', { locale: fr })}</p>
    </div>

    <div className="report-stats-grid">
      <div className="report-stat-card">
        <Package size={24} />
        <div>
          <h3>Volumes</h3>
          <p className="stat-value">{report.volumes.total.toLocaleString()}</p>
          <p className={`stat-change ${report.volumes.evolution >= 0 ? 'positive' : 'negative'}`}>
            {report.volumes.evolution >= 0 ? '+' : ''}{report.volumes.evolution.toFixed(1)}% vs mois précédent
          </p>
        </div>
      </div>
      <div className="report-stat-card">
        <DollarSign size={24} />
        <div>
          <h3>Revenus</h3>
          <p className="stat-value">{report.financial.revenue.toLocaleString()} CHF</p>
        </div>
      </div>
      <div className="report-stat-card">
        <TrendingUp size={24} />
        <div>
          <h3>Marge</h3>
          <p className="stat-value">{report.financial.margin_percentage.toFixed(1)}%</p>
        </div>
      </div>
    </div>

    <div className="report-section">
      <h3>Performance par équipe</h3>
      <div className="performance-table">
        <table>
          <thead>
            <tr>
              <th>Équipe</th>
              <th>Tournées complétées</th>
              <th>Durée moyenne</th>
              <th>Score d'efficacité</th>
            </tr>
          </thead>
          <tbody>
            {report.performance.teams.map((team, idx) => (
              <tr key={idx}>
                <td>{team.team_name}</td>
                <td>{team.routes_completed}</td>
                <td>{team.avg_duration.toFixed(1)}h</td>
                <td>
                  <span className={`efficiency-badge ${team.efficiency_score >= 80 ? 'high' : team.efficiency_score >= 60 ? 'medium' : 'low'}`}>
                    {team.efficiency_score}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const RegulatoryReportView = ({ report }: { report: RegulatoryReport }) => (
  <div className="report-view">
    <div className="report-header">
      <h2>Rapport Réglementaire</h2>
      <p>
        {format(new Date(report.period_start), 'dd MMMM yyyy', { locale: fr })} -{' '}
        {format(new Date(report.period_end), 'dd MMMM yyyy', { locale: fr })}
      </p>
    </div>

    <div className="report-stats-grid">
      <div className="report-stat-card">
        <CheckCircle2 size={24} />
        <div>
          <h3>Score de conformité</h3>
          <p className={`stat-value ${report.compliance_score >= 90 ? 'high' : report.compliance_score >= 70 ? 'medium' : 'low'}`}>
            {report.compliance_score}%
          </p>
        </div>
      </div>
      <div className="report-stat-card">
        <Package size={24} />
        <div>
          <h3>Taux de traçabilité</h3>
          <p className="stat-value">{report.waste_tracking.tracking_rate.toFixed(1)}%</p>
        </div>
      </div>
      <div className="report-stat-card">
        <FileText size={24} />
        <div>
          <h3>Certificats générés</h3>
          <p className="stat-value">{report.certificates.generated}</p>
        </div>
      </div>
    </div>

    <div className="report-section">
      <h3>Impact environnemental</h3>
      <div className="environmental-impact">
        <div className="impact-item">
          <span className="impact-label">CO₂ économisé</span>
          <span className="impact-value">{report.environmental_impact.co2_saved.toLocaleString()} kg</span>
        </div>
        <div className="impact-item">
          <span className="impact-label">Énergie économisée</span>
          <span className="impact-value">{report.environmental_impact.energy_saved.toLocaleString()} kWh</span>
        </div>
        <div className="impact-item">
          <span className="impact-label">Déchets détournés</span>
          <span className="impact-value">{report.environmental_impact.landfill_diverted.toLocaleString()} t</span>
        </div>
      </div>
    </div>
  </div>
);

const PerformanceReportView = ({ report }: { report: PerformanceReport }) => (
  <div className="report-view">
    <div className="report-header">
      <h2>Rapport de Performance</h2>
      <p>
        {format(new Date(report.period_start), 'dd MMMM yyyy', { locale: fr })} -{' '}
        {format(new Date(report.period_end), 'dd MMMM yyyy', { locale: fr })}
      </p>
    </div>

    <div className="report-section">
      <h3>Performance par équipe</h3>
      <div className="performance-table">
        <table>
          <thead>
            <tr>
              <th>Équipe</th>
              <th>Département</th>
              <th>Tournées</th>
              <th>Durée moyenne</th>
              <th>Taux de ponctualité</th>
              <th>Satisfaction client</th>
              <th>Score d'efficacité</th>
            </tr>
          </thead>
          <tbody>
            {report.teams.map((team) => (
              <tr key={team.team_id}>
                <td>{team.team_name}</td>
                <td>{team.department}</td>
                <td>{team.metrics.routes_completed}</td>
                <td>{team.metrics.avg_duration_hours.toFixed(1)}h</td>
                <td>{team.metrics.on_time_rate.toFixed(1)}%</td>
                <td>{team.metrics.customer_satisfaction.toFixed(1)}/5</td>
                <td>
                  <span className={`efficiency-badge ${team.metrics.efficiency_score >= 80 ? 'high' : team.metrics.efficiency_score >= 60 ? 'medium' : 'low'}`}>
                    {team.metrics.efficiency_score}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="report-section">
      <h3>Performance par département</h3>
      <div className="department-performance">
        {report.departments.map((dept, idx) => (
          <div key={idx} className="department-card">
            <h4>{dept.department_name}</h4>
            <div className="dept-metrics">
              <div className="dept-metric">
                <span>Tournées totales</span>
                <span>{dept.total_routes}</span>
              </div>
              <div className="dept-metric">
                <span>Taux de complétion</span>
                <span>{dept.completion_rate.toFixed(1)}%</span>
              </div>
              <div className="dept-metric">
                <span>Efficacité moyenne</span>
                <span>{dept.avg_efficiency.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const PredictiveAnalysisView = ({ analysis }: { analysis: PredictiveAnalysis }) => {
  if (!analysis) {
    return <div className="empty-state">Aucune donnée disponible</div>;
  }
  
  return (
    <div className="report-view">
      <div className="report-header">
        <h2>Analyse Prédictive</h2>
        <p>Prévisions et recommandations basées sur l'historique</p>
      </div>

      <div className="report-section">
        <h3>Prévisions de volumes</h3>
        <div className="forecast-grid">
          <div className="forecast-card">
            <h4>Mois prochain</h4>
            <p className="forecast-value">{(analysis.volume_forecast?.next_month ?? 0).toLocaleString()}</p>
            <p className="forecast-confidence">Confiance: {analysis.volume_forecast?.confidence ?? 0}%</p>
          </div>
          <div className="forecast-card">
            <h4>Trimestre prochain</h4>
            <p className="forecast-value">{(analysis.volume_forecast?.next_quarter ?? 0).toLocaleString()}</p>
          </div>
          <div className="forecast-card">
            <h4>Année prochaine</h4>
            <p className="forecast-value">{(analysis.volume_forecast?.next_year ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

    <div className="report-section">
      <h3>Besoins en ressources</h3>
      <div className="resource-needs">
        <div className="resource-card">
          <Truck size={24} />
          <div>
            <h4>Véhicules</h4>
            <p>Actuel: {analysis.resource_needs?.vehicles?.current ?? 0}</p>
            <p>Nécessaire: {analysis.resource_needs?.vehicles?.needed ?? 0}</p>
            <p className="recommendation">{analysis.resource_needs?.vehicles?.recommendation ?? 'N/A'}</p>
          </div>
        </div>
        <div className="resource-card">
          <Users size={24} />
          <div>
            <h4>Personnel</h4>
            <p>Actuel: {analysis.resource_needs?.staff?.current ?? 0}</p>
            <p>Nécessaire: {analysis.resource_needs?.staff?.needed ?? 0}</p>
            <p className="recommendation">{analysis.resource_needs?.staff?.recommendation ?? 'N/A'}</p>
          </div>
        </div>
        <div className="resource-card">
          <Building2 size={24} />
          <div>
            <h4>Stockage</h4>
            <p>Capacité actuelle: {(analysis.resource_needs?.storage?.current_capacity ?? 0).toLocaleString()} m³</p>
            <p>Capacité nécessaire: {(analysis.resource_needs?.storage?.needed_capacity ?? 0).toLocaleString()} m³</p>
            <p className="recommendation">{analysis.resource_needs?.storage?.recommendation ?? 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>

    <div className="report-section">
      <h3>Tendances</h3>
      <div className="trends-list">
        {(analysis.trends ?? []).map((trend, idx) => (
          <div key={idx} className="trend-item">
            <span className="trend-metric">{trend.metric}</span>
            <div className="trend-values">
              <span>Actuel: {(trend.current_value ?? 0).toLocaleString()}</span>
              <span>Prévu: {(trend.predicted_value ?? 0).toLocaleString()}</span>
              <span className={`trend-change ${(trend.change_percent ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                {(trend.change_percent ?? 0) >= 0 ? '+' : ''}{(trend.change_percent ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

