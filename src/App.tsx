import { useMemo, useState } from 'react';
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
import { useAuth } from './hooks/useAuth';

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
  'adminUsers'
] as const;
type NavId = (typeof NAV_LINK_IDS)[number];

type NavLink = {
  id: NavId;
  label: string;
  pill?: string;
  requiresAdmin?: boolean;
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
  { type: 'link', id: 'map', label: 'Carte' },
  {
    type: 'group',
    id: 'matieres',
    label: 'Matières',
    children: [
      { id: 'destruction', label: 'Destruction matières' },
          { id: 'Declassement', label: 'Déclassement matières' }
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

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const canDisplayLink = (link: NavLink) => (!link.requiresAdmin || hasRole('admin'));

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
        return <MapPage />;
      case 'adminUsers':
        return hasRole('admin') ? <UsersAdminPage /> : <LeavePage initialTab="demandes" />;
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
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <main className="main-content">{activePage}</main>
    </div>
  );
};

export default App;
