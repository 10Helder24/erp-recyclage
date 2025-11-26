import { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronDown, Menu, Loader2 } from 'lucide-react';

import DestructionPage from './pages/DestructionPage';
import DeclassementPage from './pages/DeclassementPage';
import EmployeesPage from './pages/EmployeesPage';
import LeavePage from './pages/LeavePage';
import CDTSheets from './pages/CDTSheets';
import { InventorySheet } from './pages/InventaireHalleSheet';
import ExpeditionPage from './pages/ExpeditionPage';
import UsersAdminPage from './pages/UsersAdminPage';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import CustomersPage from './pages/CustomersPage';
import InterventionsPage from './pages/InterventionsPage';
import VehiclesPage from './pages/VehiclesPage';
import RoutesPage from './pages/RoutesPage';
import { useAuth } from './hooks/useAuth';
import { Api } from './lib/api';

const NAV_LINK_IDS = [
  'dashboard',
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
  'adminUsers',
  'customers',
  'interventions',
  'vehicles',
  'routes'
] as const;
type NavId = (typeof NAV_LINK_IDS)[number];

type NavLink = {
  id: NavId;
  label: string;
  pill?: string;
  requiresAdmin?: boolean;
  requiresManager?: boolean;
};

type NavSection =
  | ({ type: 'link' } & NavLink)
  | {
      type: 'group';
      id: string;
      label: string;
      children: NavLink[];
    };

    
const NAV_SECTIONS: NavSection[] = [
  { type: 'link', id: 'dashboard', label: 'Tableau de bord', pill: 'Bientôt' },
  {
    type: 'group',
    id: 'rhPlus',
    label: 'RH+',
    children: [
      { id: 'calendar', label: 'Calendrier' },
      { id: 'employees', label: 'Employés' }
    ]
  },
  {
    type: 'group',
    id: 'inventaires',
    label: 'Inventaires',
    children: [
      { id: 'CDTSheets', label: 'CDT' },
          { id: 'IvntaireHalle', label: 'Inventaire halle' },
      { id: 'expedition', label: 'Expéditions' }
    ]
  },
  {
    type: 'group',
    id: 'matieres',
    label: 'Matières',
    children: [
      { id: 'destruction', label: 'Destruction matières' },
          { id: 'Declassement', label: 'Déclassement matières' }
    ]
  },
  {
    type: 'group',
    id: 'gestion',
    label: 'Gestion',
    children: [
      { id: 'map', label: 'Carte', requiresManager: true },
      { id: 'customers', label: 'Clients', requiresManager: true },
      { id: 'interventions', label: 'Interventions', requiresManager: true },
      { id: 'vehicles', label: 'Véhicules', requiresManager: true },
      { id: 'routes', label: 'Routes & Tournées', requiresManager: true }
    ]
  },
  { type: 'link', id: 'alerts', label: 'Alertes sécurité', pill: 'Nouveau' },
  { type: 'link', id: 'adminUsers', label: 'Utilisateurs', requiresAdmin: true }
];

const App = () => {
  const { user, loading, logout, hasRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>('rh');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    rhPlus: true
  });
  const [showGeoPrompt, setShowGeoPrompt] = useState(false);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  useEffect(() => {
    if (user) {
      const storedConsent = typeof window !== 'undefined' ? window.localStorage.getItem('geoConsent') : null;
      if (storedConsent === 'granted') {
        handleEnableGeolocation(true);
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
    Api.updateCurrentLocation({ latitude: coords[0], longitude: coords[1] }).catch((error) => console.error(error));
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
    if (link.requiresAdmin && !hasRole('admin')) {
      return false;
    }
    if (link.requiresManager && !(hasRole('manager') || hasRole('admin'))) {
      return false;
    }
    return true;
  };

  const filteredSections = useMemo(() => {
    return NAV_SECTIONS.map((section) => {
      if (section.type === 'group') {
        const children = section.children.filter((child) => canDisplayLink(child));
        return { ...section, children };
      }
      return section;
    }).filter((section) => (section.type === 'group' ? section.children.length > 0 : canDisplayLink(section)));
  }, [hasRole]);

  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 769) {
      setSidebarOpen(false);
    }
  };

  const handleNavSelect = (navId: NavId) => {
    setActiveNav(navId);
    closeSidebarOnMobile();
  };

  const activePage = useMemo(() => {
    if (!user) {
      return null;
    }
    switch (activeNav) {
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
      case 'map':
        return hasRole('admin') || hasRole('manager') ? <MapPage /> : <LeavePage initialTab="demandes" />;
      case 'adminUsers':
        return hasRole('admin') ? <UsersAdminPage /> : <LeavePage initialTab="demandes" />;
      case 'customers':
        return hasRole('admin') || hasRole('manager') ? <CustomersPage /> : <LeavePage initialTab="demandes" />;
      case 'interventions':
        return hasRole('admin') || hasRole('manager') ? <InterventionsPage /> : <LeavePage initialTab="demandes" />;
      case 'vehicles':
        return hasRole('admin') || hasRole('manager') ? <VehiclesPage /> : <LeavePage initialTab="demandes" />;
      case 'routes':
        return hasRole('admin') || hasRole('manager') ? <RoutesPage /> : <LeavePage initialTab="demandes" />;
      case 'rh':
      case 'dashboard':
      case 'alerts':
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
