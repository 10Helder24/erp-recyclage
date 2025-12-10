import { useEffect, useState } from 'react';
import { Palette, Keyboard, Layout, Save, Moon, Sun, Monitor, X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { Api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import './PayrollContractsPage.css';

type TabType = 'theme' | 'shortcuts' | 'dashboard';

interface KeyboardShortcut {
  id: string;
  action: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { id: '1', action: 'Recherche globale', key: 'k', ctrl: true },
  { id: '2', action: 'Nouveau client', key: 'n', ctrl: true, shift: true },
  { id: '3', action: 'Nouvelle facture', key: 'f', ctrl: true, shift: true },
  { id: '4', action: 'Tableau de bord', key: 'd', ctrl: true },
  { id: '5', action: 'Calendrier', key: 'c', ctrl: true },
  { id: '6', action: 'Carte', key: 'm', ctrl: true },
];

export const AdvancedPreferencesPage = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(DEFAULT_SHORTCUTS);
  const [editingShortcut, setEditingShortcut] = useState<KeyboardShortcut | null>(null);
  const [newShortcut, setNewShortcut] = useState<Partial<KeyboardShortcut>>({ action: '', key: '' });
  const [dashboardWidgets, setDashboardWidgets] = useState<string[]>(['kpis', 'recent', 'alerts', 'calendar']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      // Charger les préférences depuis l'API
      const savedShortcuts = localStorage.getItem('keyboard_shortcuts');
      if (savedShortcuts) {
        setShortcuts(JSON.parse(savedShortcuts));
      }
      const savedWidgets = localStorage.getItem('dashboard_widgets');
      if (savedWidgets) {
        setDashboardWidgets(JSON.parse(savedWidgets));
      }
    } catch (error: any) {
      console.error('Erreur chargement préférences:', error);
    }
  };

  const handleSaveTheme = () => {
    toast.success('Thème enregistré');
  };

  const handleSaveShortcuts = () => {
    localStorage.setItem('keyboard_shortcuts', JSON.stringify(shortcuts));
    toast.success('Raccourcis clavier enregistrés');
  };

  const handleSaveDashboard = () => {
    localStorage.setItem('dashboard_widgets', JSON.stringify(dashboardWidgets));
    toast.success('Configuration du tableau de bord enregistrée');
  };

  const handleAddShortcut = () => {
    if (!newShortcut.action || !newShortcut.key) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const shortcut: KeyboardShortcut = {
      id: Date.now().toString(),
      action: newShortcut.action,
      key: newShortcut.key,
      ctrl: newShortcut.ctrl,
      shift: newShortcut.shift,
      alt: newShortcut.alt,
    };
    setShortcuts([...shortcuts, shortcut]);
    setNewShortcut({ action: '', key: '' });
    toast.success('Raccourci ajouté');
  };

  const handleDeleteShortcut = (id: string) => {
    setShortcuts(shortcuts.filter(s => s.id !== id));
    toast.success('Raccourci supprimé');
  };

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  return (
    <div className="payroll-contracts-page">
      <div className="page-header">
        <div>
          <h1>Préférences Avancées</h1>
          <p>Personnalisez votre expérience utilisateur</p>
        </div>
      </div>

      <div className="tabs">
        <button className={activeTab === 'theme' ? 'active' : ''} onClick={() => setActiveTab('theme')}>
          <Palette size={18} /> Thème
        </button>
        <button className={activeTab === 'shortcuts' ? 'active' : ''} onClick={() => setActiveTab('shortcuts')}>
          <Keyboard size={18} /> Raccourcis Clavier
        </button>
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          <Layout size={18} /> Tableau de Bord
        </button>
      </div>

      {activeTab === 'theme' && (
        <div className="unified-modal" style={{ maxWidth: '600px', margin: '2rem auto' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Sélection du Thème</h2>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <button
              className={`btn-secondary ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              style={{ padding: '2rem', textAlign: 'center', border: theme === 'light' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)' }}
            >
              <Sun size={32} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600 }}>Clair</div>
            </button>
            <button
              className={`btn-secondary ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              style={{ padding: '2rem', textAlign: 'center', border: theme === 'dark' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)' }}
            >
              <Moon size={32} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600 }}>Sombre</div>
            </button>
            <button
              className={`btn-secondary ${theme === 'auto' ? 'active' : ''}`}
              onClick={() => setTheme('auto')}
              style={{ padding: '2rem', textAlign: 'center', border: theme === 'auto' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)' }}
            >
              <Monitor size={32} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 600 }}>Automatique</div>
            </button>
          </div>
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Le thème automatique s'adapte aux préférences de votre système d'exploitation.
            </p>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={handleSaveTheme}>
              <Save size={16} /> Enregistrer
            </button>
          </div>
        </div>
      )}

      {activeTab === 'shortcuts' && (
        <div className="unified-modal" style={{ maxWidth: '800px', margin: '2rem auto' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Raccourcis Clavier</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Raccourci</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shortcuts.map((shortcut) => (
                  <tr key={shortcut.id}>
                    <td>{shortcut.action}</td>
                    <td>
                      <code style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                        {formatShortcut(shortcut)}
                      </code>
                    </td>
                    <td>
                      <button className="icon-btn danger" onClick={() => handleDeleteShortcut(shortcut.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Ajouter un Raccourci</h3>
            <div className="unified-form" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr auto' }}>
              <input
                type="text"
                placeholder="Action (ex: Nouveau client)"
                value={newShortcut.action || ''}
                onChange={(e) => setNewShortcut({ ...newShortcut, action: e.target.value })}
              />
              <input
                type="text"
                placeholder="Touche (ex: n)"
                value={newShortcut.key || ''}
                onChange={(e) => setNewShortcut({ ...newShortcut, key: e.target.value.toLowerCase() })}
                maxLength={1}
              />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={newShortcut.ctrl || false}
                    onChange={(e) => setNewShortcut({ ...newShortcut, ctrl: e.target.checked })}
                  />
                  Ctrl
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={newShortcut.shift || false}
                    onChange={(e) => setNewShortcut({ ...newShortcut, shift: e.target.checked })}
                  />
                  Shift
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={newShortcut.alt || false}
                    onChange={(e) => setNewShortcut({ ...newShortcut, alt: e.target.checked })}
                  />
                  Alt
                </label>
                <button className="btn-primary" onClick={handleAddShortcut}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={handleSaveShortcuts}>
              <Save size={16} /> Enregistrer
            </button>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="unified-modal" style={{ maxWidth: '800px', margin: '2rem auto' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Personnalisation du Tableau de Bord</h2>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            Glissez et déposez les widgets pour réorganiser votre tableau de bord.
          </p>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {['kpis', 'recent', 'alerts', 'calendar', 'charts', 'tasks'].map((widget) => (
              <div
                key={widget}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('widget', widget);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedWidget = e.dataTransfer.getData('widget');
                  const newWidgets = [...dashboardWidgets];
                  const draggedIndex = newWidgets.indexOf(draggedWidget);
                  const dropIndex = newWidgets.indexOf(widget);
                  if (draggedIndex !== -1 && dropIndex !== -1) {
                    newWidgets.splice(draggedIndex, 1);
                    newWidgets.splice(dropIndex, 0, draggedWidget);
                    setDashboardWidgets(newWidgets);
                  }
                }}
                style={{
                  padding: '1rem',
                  backgroundColor: dashboardWidgets.includes(widget) ? 'var(--accent-color)' : 'var(--bg-secondary)',
                  color: dashboardWidgets.includes(widget) ? 'white' : 'var(--text-primary)',
                  borderRadius: '8px',
                  cursor: 'move',
                  border: '2px dashed var(--border-color)',
                  textAlign: 'center',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}
              >
                {widget}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={handleSaveDashboard}>
              <Save size={16} /> Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

