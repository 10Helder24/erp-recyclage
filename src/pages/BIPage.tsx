import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  DollarSign,
  Users,
  Truck,
  Calendar,
  Filter,
  Download,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Layers,
  Brain,
  Database
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
// Import Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Api, type HistoricalDataPoint, type OlapCubeResult, type ForecastData, type Anomaly, type DrillDownResult } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type BIDimension = 'time' | 'material' | 'customer' | 'department' | 'employee' | 'vehicle';
type BIMetric = 'volume' | 'revenue' | 'cost' | 'count' | 'efficiency';

type DrillDownLevel = {
  level: string;
  dimension: string;
  label: string;
  parentId?: string;
};

export default function BIPage() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'warehouse' | 'olap' | 'forecast' | 'anomalies'>('warehouse');
  const [loading, setLoading] = useState(false);
  
  // Data Warehouse
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDimensions, setSelectedDimensions] = useState<BIDimension[]>(['time', 'material']);
  const [selectedMetrics, setSelectedMetrics] = useState<BIMetric[]>(['volume', 'revenue']);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  
  // OLAP
  const [olapCube, setOlapCube] = useState<string>('volumes');
  const [olapDimensions, setOlapDimensions] = useState<string[]>(['material', 'time']);
  const [olapMeasures, setOlapMeasures] = useState<string[]>(['total_volume', 'total_revenue']);
  const [olapData, setOlapData] = useState<OlapCubeResult | null>(null);
  
  // Forecast
  const [forecastHorizon, setForecastHorizon] = useState(30);
  const [forecastMaterial, setForecastMaterial] = useState<string>('');
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  
  // Anomalies
  const [anomalyThreshold, setAnomalyThreshold] = useState(0.2);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  
  // Drill-down
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);
  const [currentDrillDown, setCurrentDrillDown] = useState<DrillDownResult | null>(null);

  useEffect(() => {
    if (activeTab === 'warehouse') {
      loadHistoricalData();
    } else if (activeTab === 'olap') {
      loadOlapCube();
    } else if (activeTab === 'forecast') {
      loadForecast();
    } else if (activeTab === 'anomalies') {
      loadAnomalies();
    }
  }, [activeTab, startDate, endDate, selectedDimensions, selectedMetrics, olapCube, olapDimensions, olapMeasures, forecastHorizon, forecastMaterial, anomalyThreshold]);

  const loadHistoricalData = async () => {
    setLoading(true);
    try {
      const data = await Api.fetchHistoricalData({
        startDate,
        endDate,
        dimensions: selectedDimensions,
        metrics: selectedMetrics
      });
      setHistoricalData(data);
    } catch (error: any) {
      console.error('Erreur chargement données historiques:', error);
      toast.error('Erreur lors du chargement des données historiques');
    } finally {
      setLoading(false);
    }
  };

  const loadOlapCube = async () => {
    setLoading(true);
    try {
      const data = await Api.fetchOlapCube({
        cube: olapCube,
        dimensions: olapDimensions,
        measures: olapMeasures
      });
      setOlapData(data);
    } catch (error: any) {
      console.error('Erreur chargement cube OLAP:', error);
      toast.error('Erreur lors du chargement du cube OLAP');
    } finally {
      setLoading(false);
    }
  };

  const loadForecast = async () => {
    setLoading(true);
    try {
      const data = await Api.fetchDemandForecast({
        materialType: forecastMaterial || undefined,
        horizon: forecastHorizon,
        startDate: startDate
      });
      setForecastData(data);
    } catch (error: any) {
      console.error('Erreur chargement prévisions:', error);
      toast.error('Erreur lors du chargement des prévisions');
    } finally {
      setLoading(false);
    }
  };

  const loadAnomalies = async () => {
    setLoading(true);
    try {
      const data = await Api.fetchAnomalies({
        startDate,
        endDate,
        threshold: anomalyThreshold
      });
      setAnomalies(data);
    } catch (error: any) {
      console.error('Erreur chargement anomalies:', error);
      toast.error('Erreur lors du chargement des anomalies');
    } finally {
      setLoading(false);
    }
  };

  const handleDrillDown = async (itemId: string, dimension: string, measure: string) => {
    const currentLevel = drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1] : null;
    try {
      const result = await Api.fetchDrillDown({
        level: `${dimension}_detail`,
        parentId: currentLevel?.parentId || itemId,
        dimension,
        measure
      });
      setCurrentDrillDown(result);
      setDrillDownPath([...drillDownPath, {
        level: result.level,
        dimension,
        label: result.parent?.label || itemId,
        parentId: itemId
      }]);
    } catch (error: any) {
      console.error('Erreur drill-down:', error);
      toast.error('Erreur lors du drill-down');
    }
  };

  const handleDrillUp = () => {
    if (drillDownPath.length > 0) {
      const newPath = drillDownPath.slice(0, -1);
      setDrillDownPath(newPath);
      if (newPath.length > 0) {
        const lastLevel = newPath[newPath.length - 1];
        handleDrillDown(lastLevel.parentId || '', lastLevel.dimension, 'volume');
      } else {
        setCurrentDrillDown(null);
      }
    }
  };

  // Préparer les données pour les graphiques
  const historicalChartData = useMemo(() => {
    if (!historicalData.length) return null;

    const dates = historicalData.map(d => format(new Date(d.date), 'dd/MM/yyyy', { locale: fr }));
    const datasets = selectedMetrics.map((metric, idx) => {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
      return {
        label: metric === 'volume' ? 'Volume' : metric === 'revenue' ? 'Revenus' : metric === 'cost' ? 'Coûts' : metric === 'count' ? 'Nombre' : 'Efficacité',
        data: historicalData.map(d => d.metrics[metric] || 0),
        backgroundColor: colors[idx % colors.length],
        borderColor: colors[idx % colors.length],
        borderWidth: 2
      };
    });

    return {
      labels: dates,
      datasets
    };
  }, [historicalData, selectedMetrics]);

  const forecastChartData = useMemo(() => {
    if (!forecastData.length) return null;

    const dates = forecastData.map(d => format(new Date(d.date), 'dd/MM/yyyy', { locale: fr }));
    return {
      labels: dates,
      datasets: [
        {
          label: 'Valeur réelle',
          data: forecastData.map(d => d.actual_value || null),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: false
        },
        {
          label: 'Prédiction',
          data: forecastData.map(d => d.predicted_value),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: true
        },
        {
          label: 'Intervalle de confiance (min)',
          data: forecastData.map(d => d.confidence_lower),
          borderColor: '#94a3b8',
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [2, 2],
          pointRadius: 0
        },
        {
          label: 'Intervalle de confiance (max)',
          data: forecastData.map(d => d.confidence_upper),
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148, 163, 184, 0.1)',
          borderWidth: 1,
          borderDash: [2, 2],
          pointRadius: 0,
          fill: '+1'
        }
      ]
    };
  }, [forecastData]);

  const olapChartData = useMemo(() => {
    if (!olapData || !olapData.data.length) return null;

    const labels = olapData.data.map(d => {
      return Object.values(d.dimension_values).join(' - ');
    });

    const datasets = olapMeasures.map((measure, idx) => {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
      return {
        label: measure.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        data: olapData.data.map(d => d.measure_values[measure] || 0),
        backgroundColor: colors[idx % colors.length],
        borderColor: colors[idx % colors.length],
        borderWidth: 2
      };
    });

    return {
      labels,
      datasets
    };
  }, [olapData, olapMeasures]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <div className="page-container bi-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Business Intelligence</p>
          <h1 className="page-title">Analyses Avancées & BI</h1>
          <p className="page-subtitle">Data warehouse, cubes OLAP, prédictions ML et visualisations interactives</p>
        </div>
        <div className="page-actions">
          <button className="btn-outline" onClick={() => {
            if (activeTab === 'warehouse') loadHistoricalData();
            else if (activeTab === 'olap') loadOlapCube();
            else if (activeTab === 'forecast') loadForecast();
            else if (activeTab === 'anomalies') loadAnomalies();
          }}>
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="tab-nav">
        <button
          className={activeTab === 'warehouse' ? 'active' : ''}
          onClick={() => setActiveTab('warehouse')}
        >
          <Database size={16} />
          Data Warehouse
        </button>
        <button
          className={activeTab === 'olap' ? 'active' : ''}
          onClick={() => setActiveTab('olap')}
        >
          <Layers size={16} />
          Cubes OLAP
        </button>
        <button
          className={activeTab === 'forecast' ? 'active' : ''}
          onClick={() => setActiveTab('forecast')}
        >
          <Brain size={16} />
          Prédictions ML
        </button>
        <button
          className={activeTab === 'anomalies' ? 'active' : ''}
          onClick={() => setActiveTab('anomalies')}
        >
          <AlertTriangle size={16} />
          Détection Anomalies
        </button>
      </div>

      {/* Data Warehouse Tab */}
      {activeTab === 'warehouse' && (
        <div className="card">
          <div className="filters-panel">
            <h3>Filtres</h3>
            <div className="filters-grid">
              <div className="form-group">
                <label htmlFor="bi-start-date">Date de début</label>
                <input
                  id="bi-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bi-end-date">Date de fin</label>
                <input
                  id="bi-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bi-dimensions">Dimensions</label>
                <select
                  id="bi-dimensions"
                  multiple
                  value={selectedDimensions}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value as BIDimension);
                    setSelectedDimensions(values);
                  }}
                  style={{ minHeight: '100px' }}
                >
                  <option value="time">Temps</option>
                  <option value="material">Matière</option>
                  <option value="customer">Client</option>
                  <option value="department">Département</option>
                  <option value="employee">Employé</option>
                  <option value="vehicle">Véhicule</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="bi-metrics">Métriques</label>
                <select
                  id="bi-metrics"
                  multiple
                  value={selectedMetrics}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value as BIMetric);
                    setSelectedMetrics(values);
                  }}
                  style={{ minHeight: '100px' }}
                >
                  <option value="volume">Volume</option>
                  <option value="revenue">Revenus</option>
                  <option value="cost">Coûts</option>
                  <option value="count">Nombre</option>
                  <option value="efficiency">Efficacité</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="spinner" size={32} />
              <p className="ml-3 text-gray-500">Chargement des données...</p>
            </div>
          ) : historicalChartData ? (
            <div className="chart-container" style={{ height: '500px', marginTop: '24px' }}>
              <Bar data={historicalChartData} options={chartOptions} />
            </div>
          ) : (
            <div className="empty-state">
              <Database size={48} />
              <h3>Aucune donnée disponible</h3>
              <p>Veuillez sélectionner des dimensions et métriques pour afficher les données historiques</p>
            </div>
          )}
        </div>
      )}

      {/* OLAP Cubes Tab */}
      {activeTab === 'olap' && (
        <div className="card">
          <div className="filters-panel">
            <h3>Configuration du Cube OLAP</h3>
            <div className="filters-grid">
              <div className="form-group">
                <label htmlFor="olap-cube">Cube</label>
                <select
                  id="olap-cube"
                  value={olapCube}
                  onChange={(e) => setOlapCube(e.target.value)}
                >
                  <option value="volumes">Volumes</option>
                  <option value="revenues">Revenus</option>
                  <option value="costs">Coûts</option>
                  <option value="performance">Performance</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="olap-dimensions">Dimensions</label>
                <select
                  id="olap-dimensions"
                  multiple
                  value={olapDimensions}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setOlapDimensions(values);
                  }}
                  style={{ minHeight: '100px' }}
                >
                  <option value="material">Matière</option>
                  <option value="time">Temps</option>
                  <option value="customer">Client</option>
                  <option value="department">Département</option>
                  <option value="employee">Employé</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="olap-measures">Mesures</label>
                <select
                  id="olap-measures"
                  multiple
                  value={olapMeasures}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setOlapMeasures(values);
                  }}
                  style={{ minHeight: '100px' }}
                >
                  <option value="total_volume">Volume total</option>
                  <option value="total_revenue">Revenus totaux</option>
                  <option value="total_cost">Coûts totaux</option>
                  <option value="avg_efficiency">Efficacité moyenne</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="spinner" size={32} />
              <p className="ml-3 text-gray-500">Chargement du cube OLAP...</p>
            </div>
          ) : olapChartData ? (
            <div>
              {drillDownPath.length > 0 && (
                <div className="drill-down-breadcrumb" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="btn-icon" onClick={handleDrillUp}>
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  {drillDownPath.map((level, idx) => (
                    <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {level.label}
                      {idx < drillDownPath.length - 1 && <ChevronRight size={14} />}
                    </span>
                  ))}
                </div>
              )}
              <div className="chart-container" style={{ height: '500px', marginTop: '24px' }}>
                <Bar data={olapChartData} options={chartOptions} />
              </div>
              {olapData && (
                <div className="olap-totals" style={{ marginTop: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                  <h4>Totaux</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {Object.entries(olapData.totals).map(([key, value]) => (
                      <div key={key}>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{key.replace(/_/g, ' ')}</span>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{value.toLocaleString('fr-FR')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <Layers size={48} />
              <h3>Aucune donnée disponible</h3>
              <p>Veuillez configurer le cube OLAP pour afficher les données multidimensionnelles</p>
            </div>
          )}
        </div>
      )}

      {/* Forecast Tab */}
      {activeTab === 'forecast' && (
        <div className="card">
          <div className="filters-panel">
            <h3>Paramètres de Prédiction</h3>
            <div className="filters-grid">
              <div className="form-group">
                <label htmlFor="forecast-horizon">Horizon (jours)</label>
                <input
                  id="forecast-horizon"
                  type="number"
                  min="7"
                  max="365"
                  value={forecastHorizon}
                  onChange={(e) => setForecastHorizon(parseInt(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="forecast-material">Type de matière (optionnel)</label>
                <input
                  id="forecast-material"
                  type="text"
                  value={forecastMaterial}
                  onChange={(e) => setForecastMaterial(e.target.value)}
                  placeholder="Tous les types"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="spinner" size={32} />
              <p className="ml-3 text-gray-500">Calcul des prédictions...</p>
            </div>
          ) : forecastChartData ? (
            <div className="chart-container" style={{ height: '500px', marginTop: '24px' }}>
              <Line data={forecastChartData} options={chartOptions} />
            </div>
          ) : (
            <div className="empty-state">
              <Brain size={48} />
              <h3>Aucune prédiction disponible</h3>
              <p>Les prédictions seront calculées en fonction de l'historique des données</p>
            </div>
          )}
        </div>
      )}

      {/* Anomalies Tab */}
      {activeTab === 'anomalies' && (
        <div className="card">
          <div className="filters-panel">
            <h3>Paramètres de Détection</h3>
            <div className="filters-grid">
              <div className="form-group">
                <label htmlFor="anomaly-threshold">Seuil de détection (0-1)</label>
                <input
                  id="anomaly-threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={anomalyThreshold}
                  onChange={(e) => setAnomalyThreshold(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="spinner" size={32} />
              <p className="ml-3 text-gray-500">Analyse des anomalies...</p>
            </div>
          ) : anomalies.length > 0 ? (
            <div className="table-container" style={{ marginTop: '24px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Type d'entité</th>
                    <th>Métrique</th>
                    <th>Valeur</th>
                    <th>Valeur attendue</th>
                    <th>Déviation</th>
                    <th>Sévérité</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((anomaly) => (
                    <tr key={anomaly.id}>
                      <td>{anomaly.entity_type}</td>
                      <td>{anomaly.metric}</td>
                      <td>{anomaly.value.toLocaleString('fr-FR')}</td>
                      <td>{anomaly.expected_value.toLocaleString('fr-FR')}</td>
                      <td>
                        <span style={{ color: anomaly.deviation > 0 ? '#ef4444' : '#10b981' }}>
                          {anomaly.deviation > 0 ? '+' : ''}{(anomaly.deviation * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${anomaly.severity}`}>
                          {anomaly.severity === 'critical' ? 'Critique' : anomaly.severity === 'high' ? 'Élevée' : anomaly.severity === 'medium' ? 'Moyenne' : 'Faible'}
                        </span>
                      </td>
                      <td>{format(new Date(anomaly.detected_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <AlertTriangle size={48} />
              <h3>Aucune anomalie détectée</h3>
              <p>Toutes les métriques sont dans les valeurs attendues</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

