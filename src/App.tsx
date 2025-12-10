import { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronDown, Menu, Loader2 } from 'lucide-react';

import DestructionPage from './pages/DestructionPage';
import DeclassementPage from './pages/DeclassementPage';
import DeclassementDispoPage from './pages/DeclassementDispoPage';
import EmployeesPage from './pages/EmployeesPage';
import LeavePage from './pages/LeavePage';
import CDTSheets from './pages/CDTSheets';
import { InventorySheet } from './pages/InventaireHalleSheet';
import ExpeditionPage from './pages/ExpeditionPage';
import UsersAdminPage from './pages/UsersAdminPage';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import CustomersPage from './pages/CustomersPage';
import { MaterialsPage } from './pages/MaterialsPage';
import InterventionsPage from './pages/InterventionsPage';
import VehiclesPage from './pages/VehiclesPage';
import RoutesPage from './pages/RoutesPage';
import LogisticsDashboard from './pages/LogisticsDashboard';
import WeighbridgePage from './pages/WeighbridgePage';
import PdfTemplatesPage from './pages/PdfTemplatesPage';
import DashboardPage from './pages/DashboardPage';
import { FinancePage } from './pages/FinancePage';
import { StockManagementPage } from './pages/StockManagementPage';
import { CRMPage } from './pages/CRMPage';
import { MobileOperatorPage } from './pages/MobileOperatorPage';
import { AlertsPage } from './pages/AlertsPage';
import { SecurityAlertsSettingsPage } from './pages/SecurityAlertsSettingsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdvancedPreferencesPage } from './pages/AdvancedPreferencesPage';
import { MultiSitesPage } from './pages/MultiSitesPage';
import { ReportsPage } from './pages/ReportsPage';
import { CompliancePage } from './pages/CompliancePage';
import { LogisticsOptimizationPage } from './pages/LogisticsOptimizationPage';
import { SuppliersPage } from './pages/SuppliersPage';
import DocumentsPage from './pages/DocumentsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import GamificationPage from './pages/GamificationPage';
import GlobalSearchPage from './pages/GlobalSearchPage';
import BIPage from './pages/BIPage';
import HRDashboardPage from './pages/HRDashboardPage';
import { PayrollContractsPage } from './pages/PayrollContractsPage';
import { TrainingPage } from './pages/TrainingPage';
import { RecruitmentPage } from './pages/RecruitmentPage';
import { DriversHSETimeClockPage } from './pages/DriversHSETimeClockPage';
import { useAuth } from './hooks/useAuth';
import { useI18n } from './context/I18nContext';
import { useOffline } from './hooks/useOffline';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import { Api } from './lib/api';

const NAV_LINK_IDS = [
  'dashboard',
  'hr-dashboard',
  'Inventaires',
  'rh',
  'calendar',
  'employees',
  'destruction',
  'alerts',
  'CDTSheets',
  'IvntaireHalle',
  'expedition',
  'Declassement',
  'map',
  'settings',
  'adminUsers',
  'multiSites',
  'securityAlertsSettings',
  'customers',
  'materials',
  'finance',
  'stocks',
  'crm',
  'mobile',
  'interventions',
  'vehicles',
  'routes',
  'weighbridge',
  'logistics',
  'pdfTemplates',
  'reports',
  'compliance',
  'logistics-optimization',
  'suppliers',
  'documents',
  'integrations',
  'gamification',
  'global-search',
  'bi',
  'DeclassementDispo',
  'payroll-contracts',
  'training',
  'recruitment',
  'drivers-hse',
  'advancedPreferences'
] as const;
type NavId = (typeof NAV_LINK_IDS)[number];

type NavLink = {
  id: NavId;
  label: string;
  pill?: string;
  requiresAdmin?: boolean;
  requiresManager?: boolean;
  requiresPermissions?: string[];
};

type NavSection =
  | ({ type: 'link' } & NavLink)
  | {
      type: 'group';
      id: string;
      label: string;
      children: NavLink[];
    };

const App = () => {
  const { user, loading, logout, hasRole, hasPermission } = useAuth();
  const { t } = useI18n();
  const { pendingCount } = useOffline();
  const { checkForUpdate } = useServiceWorkerUpdate(); // Vérifie automatiquement les mises à jour
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>('dashboard');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    rhPlus: true
  });
  const [showGeoPrompt, setShowGeoPrompt] = useState(false);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Fonction helper pour traduire les labels de navigation
  const getNavLabel = (id: string): string => {
    return t(`nav.${id}`) || id;
  };

  // Navigation avec traductions dynamiques
  const NAV_SECTIONS: NavSection[] = useMemo(() => [
    { type: 'link', id: 'dashboard', label: getNavLabel('dashboard') },
    { type: 'link', id: 'alerts', label: getNavLabel('alerts') },
    { type: 'link', id: 'global-search', label: getNavLabel('global-search') },
    {
      type: 'group',
      id: 'rhPlus',
      label: getNavLabel('rhPlus'),
      children: [
        { id: 'hr-dashboard', label: getNavLabel('hr-dashboard') },
        { id: 'calendar', label: getNavLabel('calendar') },
        { id: 'employees', label: getNavLabel('employees') },
        { id: 'payroll-contracts', label: getNavLabel('payroll-contracts'), requiresManager: true },
        { id: 'training', label: getNavLabel('training'), requiresManager: true },
        { id: 'recruitment', label: getNavLabel('recruitment'), requiresManager: true },
        { id: 'drivers-hse', label: getNavLabel('drivers-hse'), requiresManager: true }
      ]
    },
    {
      type: 'group',
      id: 'inventaires',
      label: getNavLabel('inventaires'),
      children: [
        { id: 'CDTSheets', label: getNavLabel('CDTSheets') },
        { id: 'IvntaireHalle', label: getNavLabel('IvntaireHalle') },
        { id: 'expedition', label: getNavLabel('expedition') }
      ]
    },
    {
      type: 'group',
      id: 'matieres',
      label: getNavLabel('matieres'),
      children: [
        { id: 'destruction', label: getNavLabel('destruction') },
        { id: 'Declassement', label: getNavLabel('Declassement') },
        { id: 'DeclassementDispo', label: 'Déclassements (Dispo)', requiresManager: true }
      ]
    },
    {
      type: 'group',
      id: 'logistique',
      label: getNavLabel('logistique'),
      children: [
        { id: 'map', label: getNavLabel('map'), requiresManager: true, requiresPermissions: ['view_map'] },
        { id: 'interventions', label: getNavLabel('interventions'), requiresManager: true, requiresPermissions: ['view_interventions'] },
        { id: 'vehicles', label: getNavLabel('vehicles'), requiresManager: true, requiresPermissions: ['view_vehicles'] },
        { id: 'weighbridge', label: getNavLabel('weighbridge'), requiresManager: true, requiresPermissions: ['view_routes'] },
        { id: 'routes', label: getNavLabel('routes'), requiresManager: true, requiresPermissions: ['view_routes'] },
        { id: 'logistics', label: getNavLabel('logistics'), requiresManager: true, requiresPermissions: ['view_routes'] },
        { id: 'mobile', label: getNavLabel('mobile'), requiresManager: false }
      ]
    },
    {
      type: 'group',
      id: 'gestion',
      label: getNavLabel('gestion'),
      children: [
        { id: 'customers', label: getNavLabel('customers'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'materials', label: getNavLabel('materials'), requiresManager: true, requiresPermissions: ['view_materials'] },
        { id: 'finance', label: getNavLabel('finance'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'stocks', label: getNavLabel('stocks'), requiresManager: true, requiresPermissions: ['view_materials'] },
        { id: 'crm', label: getNavLabel('crm'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'reports', label: getNavLabel('reports'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'bi', label: getNavLabel('bi'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'compliance', label: getNavLabel('compliance'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'logistics-optimization', label: getNavLabel('logistics-optimization'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'suppliers', label: getNavLabel('suppliers'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'documents', label: getNavLabel('documents'), requiresManager: true, requiresPermissions: ['view_customers'] },
        { id: 'integrations', label: getNavLabel('integrations'), requiresAdmin: true },
        { id: 'gamification', label: getNavLabel('gamification'), requiresManager: false }
      ]
    },
    {
      type: 'group',
      id: 'parametres',
      label: getNavLabel('parametres'),
      children: [
        { id: 'settings', label: getNavLabel('settings') },
        { id: 'pdfTemplates', label: getNavLabel('pdfTemplates'), requiresAdmin: true },
        { id: 'adminUsers', label: getNavLabel('adminUsers'), requiresAdmin: true },
        { id: 'multiSites', label: getNavLabel('multiSites'), requiresAdmin: true },
        { id: 'securityAlertsSettings', label: getNavLabel('securityAlertsSettings'), requiresAdmin: true }
      ]
    }
  ], [t]);

  // Service Worker est déjà enregistré dans main.tsx, pas besoin de le refaire ici

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  useEffect(() => {
    if (user) {
      // Ne pas déclencher automatiquement la géoloc : attendre un geste utilisateur (bouton)
      const storedConsent = typeof window !== 'undefined' ? window.localStorage.getItem('geoConsent') : null;
      if (storedConsent === 'granted') {
        // On affiche le prompt/bouton mais on ne déclenche pas la requête pour éviter le warning
        setShowGeoPrompt(true);
      } else {
        setShowGeoPrompt(true);
      }
    } else {
      setShowGeoPrompt(false);
      if (geoWatchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(geoWatchId);
      }
      setGeoWatchId(null);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (geoWatchId !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(geoWatchId);
      }
    };
  }, [geoWatchId]);

  const handleGeolocationSuccess = useCallback((position: GeolocationPosition) => {
    const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
    Api.updateCurrentLocation({ latitude: coords[0], longitude: coords[1] })
      .then(() => {
        window.localStorage.setItem('geoConsent', 'granted');
      })
      .catch((error) => {
        if (error instanceof Error) {
          try {
            const parsed = JSON.parse(error.message);
            if (parsed?.message?.toLowerCase().includes('employé introuvable')) {
              console.info('Géolocalisation ignorée : aucun employé associé');
              return;
            }
          } catch {
            // ignore JSON parse errors
          }
          if (error.message.toLowerCase().includes('employé introuvable')) {
            console.info('Géolocalisation ignorée : aucun employé associé');
            return;
          }
        }
        console.error(error);
      });
  }, []);

  const handleEnableGeolocation = useCallback((skipPrompt?: boolean) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Géolocalisation non supportée par ce navigateur.');
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleGeolocationSuccess(pos);
        const id = navigator.geolocation.watchPosition(handleGeolocationSuccess, (err) => {
          console.warn(err);
          setGeoError("Impossible de suivre la position : " + err.message);
        }, { enableHighAccuracy: true });
        setGeoWatchId(id);
        setShowGeoPrompt(false);
        if (!skipPrompt) {
          window.localStorage.setItem('geoConsent', 'granted');
        }
      },
      (err) => {
        console.warn(err);
        setGeoError("Permission refusée ou indisponible : " + err.message);
      },
      { enableHighAccuracy: true }
    );
  }, [handleGeolocationSuccess]);

  const canDisplayLink = (link: NavLink) => {
    const isAdmin = hasRole('admin');
    const isManager = hasRole('manager') || isAdmin;
    if (link.requiresAdmin && !isAdmin) {
      return false;
    }
    const hasRoleAccess =
      (!link.requiresManager && !link.requiresAdmin) || (link.requiresManager && isManager) || link.requiresAdmin;
    if (link.requiresPermissions) {
      const permissionOk = hasPermission(...link.requiresPermissions);
      return permissionOk || hasRoleAccess;
    }
    return hasRoleAccess;
  };

  const filteredSections = useMemo(() => {
    return NAV_SECTIONS.map((section) => {
      if (section.type === 'group') {
        const children = section.children.filter((child) => canDisplayLink(child));
        return { ...section, children };
      }
      return section;
    }).filter((section) => (section.type === 'group' ? section.children.length > 0 : canDisplayLink(section)));
  }, [hasRole, hasPermission]);

  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 769) {
      setSidebarOpen(false);
    }
  };

  const handleNavSelect = (navId: NavId) => {
    setActiveNav(navId);
    closeSidebarOnMobile();
  };

  useEffect(() => {
    const handleNavigate = (event: CustomEvent) => {
      if (event.detail?.page) {
        setActiveNav(event.detail.page as NavId);
        closeSidebarOnMobile();
      }
    };
    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);

  const activePage = useMemo(() => {
    if (!user) {
      return null;
    }
    switch (activeNav) {
      case 'hr-dashboard':
        return <HRDashboardPage />;
      case 'payroll-contracts':
        return hasRole('admin') || hasRole('manager') ? <PayrollContractsPage /> : <LeavePage initialTab="demandes" />;
      case 'training':
        return hasRole('admin') || hasRole('manager') ? <TrainingPage /> : <LeavePage initialTab="demandes" />;
      case 'recruitment':
        return hasRole('admin') || hasRole('manager') ? <RecruitmentPage /> : <LeavePage initialTab="demandes" />;
      case 'drivers-hse':
        return hasRole('admin') || hasRole('manager') ? <DriversHSETimeClockPage /> : <LeavePage initialTab="demandes" />;
      case 'dashboard':
        return <DashboardPage />;
      case 'destruction':
        return <DestructionPage />;
      case 'employees':
        return hasRole('admin') || hasRole('manager') ? <EmployeesPage /> : <LeavePage initialTab="calendrier" />;
      case 'calendar':
        return <LeavePage initialTab="calendrier" />;
      case 'CDTSheets':
        return <CDTSheets user={user} signOut={async () => logout()} />;
      case 'IvntaireHalle':
        return <InventorySheet articles={[]} user={user} signOut={async () => logout()} />;
      case 'expedition':
        return <ExpeditionPage />;
      case 'Declassement':
        return <DeclassementPage />;
      case 'DeclassementDispo':
        return <DeclassementDispoPage />;
      case 'map':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_map') ? (
          <MapPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'adminUsers':
        return hasRole('admin') ? <UsersAdminPage /> : <LeavePage initialTab="demandes" />;
      case 'multiSites':
        return hasRole('admin') ? <MultiSitesPage /> : <LeavePage initialTab="demandes" />;
      case 'customers':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <CustomersPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'materials':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_materials') ? (
          <MaterialsPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'finance':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <FinancePage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'stocks':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_materials') ? (
          <StockManagementPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'crm':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <CRMPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'mobile':
        return <MobileOperatorPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'interventions':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_interventions') ? (
          <InterventionsPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'vehicles':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_vehicles') ? (
          <VehiclesPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'weighbridge':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_routes') ? (
          <WeighbridgePage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'routes':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_routes') ? (
          <RoutesPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'logistics':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_routes') ? (
          <LogisticsDashboard />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'pdfTemplates':
        return hasRole('admin') || hasPermission('edit_pdf_templates') ? (
          <PdfTemplatesPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'settings':
        return <SettingsPage />;
      case 'advancedPreferences':
        return <AdvancedPreferencesPage />;
      case 'securityAlertsSettings':
        return hasRole('admin') ? (
          <SecurityAlertsSettingsPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'reports':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <ReportsPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'compliance':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <CompliancePage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'logistics-optimization':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <LogisticsOptimizationPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'suppliers':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <SuppliersPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'documents':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <DocumentsPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'integrations':
        return hasRole('admin') ? (
          <IntegrationsPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'gamification':
        return <GamificationPage />;
      case 'global-search':
        return <GlobalSearchPage />;
      case 'bi':
        return hasRole('admin') || hasRole('manager') || hasPermission('view_customers') ? (
          <BIPage />
        ) : (
          <LeavePage initialTab="demandes" />
        );
      case 'rh':
      case 'Inventaires':
      default:
        return <LeavePage initialTab="demandes" />;
    }
  }, [activeNav, user, logout]);

  if (loading) {
    return (
      <div className="app-loading">
        <Loader2 className="spinner" size={32} />
        <p>Initialisation...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <p className="eyebrow" style={{ color: '#38bdf8', letterSpacing: '0.3em', marginBottom: 4 }}>
              ERP
            </p>
            <div className="sidebar-brand" style={{ color: '#38bdf8', letterSpacing: '0.3em', marginBottom: 4 }}>RECYCLAGE</div>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="Basculer le menu latéral">
            <Menu size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredSections.map((section) => {
            if (section.type === 'group') {
              const expanded = openGroups[section.id];
              return (
                <div key={section.id} className="sidebar-group">
                  <button
                    type="button"
                    className={`sidebar-group-toggle${expanded ? ' expanded' : ''}`}
                    onClick={() => toggleGroup(section.id)}
                  >
                    <span>{section.label}</span>
                    <ChevronDown size={16} className="chevron" />
                  </button>
                  {expanded && (
                    <div className="sidebar-subnav">
                        {section.children.map((child) => (
                          <button key={child.id} className={activeNav === child.id ? 'active' : ''} onClick={() => handleNavSelect(child.id)}>
                            <span>{child.label}</span>
                            {child.pill ? <span className="pill">{child.pill}</span> : null}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button key={section.id} className={activeNav === section.id ? 'active' : ''} onClick={() => handleNavSelect(section.id)}>
                <span>{section.label}</span>
                {section.pill && <span className="pill">{section.pill}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-user-block">
          <p className="sidebar-user-name">{user.full_name || user.email}</p>
          <span className="sidebar-user-role">
            {hasRole('admin') ? 'Administrateur' : user.manager_name || user.department || 'Responsable'}
          </span>
          <button className="btn btn-outline" onClick={logout}>
            Déconnexion
          </button>
        </div>
        <div className="sidebar-footer">
          Calendrier partagé · Mise à jour {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
      </aside>
      <div className="mobile-topbar">
        <button className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">
          <Menu size={18} />
        </button>
        <div className="mobile-topbar__brand">
          <p>ERP</p>
          <strong>Recyclage</strong>
        </div>
        <button className="mobile-topbar__logout" onClick={logout}>
          Déconnexion
        </button>
      </div>
      {showGeoPrompt && (
        <div className="geo-banner geo-banner--floating">
          <div className="geo-banner__content">
            <p>
              Activer le suivi de position ?
              {geoError ? <span className="geo-error"> {geoError}</span> : null}
            </p>
            <div className="geo-banner__actions">
              <button className="btn btn-primary" onClick={() => handleEnableGeolocation()}>
                Activer
              </button>
              <button className="btn btn-outline" onClick={() => setShowGeoPrompt(false)}>
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <main className="main-content">{activePage}</main>
    </div>
  );
};

export default App;
