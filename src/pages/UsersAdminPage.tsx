import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Shield, Loader2, Search, X, Save, XCircle, CheckCircle, Key, Copy, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Api, type UserSession, type TwoFactorSetup } from '../lib/api';
import type { AuthUser, UserRole } from '../types/auth';
import { useAuth } from '../hooks/useAuth';

type UserFormState = {
  id?: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string;
  manager_name: string;
  password: string;
  permissions: string[];
};

const defaultForm = (): UserFormState => ({
  email: '',
  full_name: '',
  role: 'manager',
  department: '',
  manager_name: '',
  password: '',
  permissions: []
});

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Responsable',
  user: 'Utilisateur'
};

const PERMISSION_GROUPS: Array<{
  label: string;
  permissions: Array<{ id: string; label: string }>;
}> = [
  {
    label: 'Clients',
    permissions: [
      { id: 'view_customers', label: 'Lecture' },
      { id: 'edit_customers', label: 'Édition' }
    ]
  },
  {
    label: 'Interventions',
    permissions: [
      { id: 'view_interventions', label: 'Lecture' },
      { id: 'edit_interventions', label: 'Édition' }
    ]
  },
  {
    label: 'Routes',
    permissions: [
      { id: 'view_routes', label: 'Lecture' },
      { id: 'edit_routes', label: 'Édition' }
    ]
  },
  {
    label: 'Véhicules',
    permissions: [
      { id: 'view_vehicles', label: 'Lecture' },
      { id: 'edit_vehicles', label: 'Édition' }
    ]
  },
  {
    label: 'Carte',
    permissions: [{ id: 'view_map', label: 'Accès carte' }]
  },
  {
    label: 'Congés',
    permissions: [
      { id: 'approve_leave_manager', label: 'Validation manager' },
      { id: 'approve_leave_hr', label: 'Validation RH' },
      { id: 'approve_leave_director', label: 'Validation direction' }
    ]
  },
  {
    label: 'Matières',
    permissions: [
      { id: 'view_materials', label: 'Lecture' },
      { id: 'edit_materials', label: 'Édition' }
    ]
  }
];

const UsersAdminPage = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UserFormState>(defaultForm());
  
  // 2FA states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<Record<string, boolean>>({});
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [userSessions, setUserSessions] = useState<Record<string, UserSession[]>>({});
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await Api.fetchUsers();
      setUsers(data);
      
      // Charger l'état 2FA pour chaque utilisateur
      const enabledMap: Record<string, boolean> = {};
      for (const user of data) {
        try {
          const status = await Api.get2FAStatusForUser(user.id);
          enabledMap[user.id] = status.enabled;
        } catch (error) {
          enabledMap[user.id] = false;
        }
      }
      setTwoFactorEnabled(enabledMap);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreateModal = () => {
    setForm(defaultForm());
    setShowModal(true);
  };

  const openEditModal = (user: AuthUser) => {
    setForm({
      id: user.id,
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      department: user.department || '',
      manager_name: user.manager_name || '',
      password: '',
      permissions: user.permissions || []
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(defaultForm());
  };

  const handleInputChange = (field: keyof UserFormState, value: string | UserRole | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const togglePermission = (permission: string) => {
    setForm((prev) => {
      const permissions = prev.permissions.includes(permission)
        ? prev.permissions.filter((perm) => perm !== permission)
        : [...prev.permissions, permission];
      return { ...prev, permissions };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (form.id) {
        await Api.updateUser(form.id, {
          email: form.email,
          role: form.role,
          full_name: form.full_name || null,
          department: form.department || null,
          manager_name: form.manager_name || null,
          password: form.password || undefined,
          permissions: form.permissions
        });
        toast.success('Utilisateur mis à jour');
      } else {
        if (!form.password) {
          toast.error('Mot de passe requis pour la création');
          setSaving(false);
          return;
        }
        await Api.createUser({
          email: form.email,
          password: form.password,
          role: form.role,
          full_name: form.full_name || undefined,
          department: form.department || undefined,
          manager_name: form.manager_name || undefined,
          permissions: form.permissions
        });
        toast.success('Utilisateur créé');
      }
      closeModal();
      loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: AuthUser) => {
    if (!window.confirm(`Supprimer ${user.email} ?`)) {
      return;
    }
    try {
      await Api.deleteUser(user.id);
      toast.success('Utilisateur supprimé');
      loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de supprimer');
    }
  };

  const handleSetup2FA = async (userId: string) => {
    try {
      const setup = await Api.setup2FAForUser(userId);
      setTwoFactorSetup(setup);
      setSelectedUserId(userId);
      setShow2FAModal(true);
    } catch (error: any) {
      toast.error('Erreur lors de la configuration 2FA');
    }
  };

  const handleEnable2FA = async () => {
    if (!twoFactorCode || !selectedUserId) return;
    if (twoFactorCode.length !== 6) {
      toast.error('Le code doit contenir 6 chiffres');
      return;
    }
    try {
      await Api.enable2FAForUser(selectedUserId, { code: twoFactorCode });
      toast.success('2FA activé avec succès');
      setShow2FAModal(false);
      setTwoFactorCode('');
      setTwoFactorSetup(null);
      setTwoFactorEnabled((prev) => ({ ...prev, [selectedUserId]: true }));
      loadUsers();
    } catch (error: any) {
      toast.error('Code 2FA invalide');
    }
  };

  const handleDisable2FA = async (userId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir désactiver le 2FA pour cet utilisateur ?')) {
      return;
    }
    try {
      await Api.disable2FAForUser(userId);
      toast.success('2FA désactivé');
      setTwoFactorEnabled((prev) => ({ ...prev, [userId]: false }));
      loadUsers();
    } catch (error: any) {
      toast.error('Erreur lors de la désactivation du 2FA');
    }
  };

  const copyBackupCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    toast.success('Codes de secours copiés');
  };

  const downloadBackupCodes = (codes: string[]) => {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codes-secours-2fa.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Codes de secours téléchargés');
  };

  const handleViewSessions = async (userId: string) => {
    try {
      const sessions = await Api.fetchSessions();
      setUserSessions((prev) => ({ ...prev, [userId]: sessions }));
      setSelectedUserId(userId);
      setShowSessionsModal(true);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des sessions');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await Api.deleteSession(sessionId);
      toast.success('Session fermée');
      if (selectedUserId) {
        const sessions = await Api.fetchSessions();
        setUserSessions((prev) => ({ ...prev, [selectedUserId]: sessions }));
      }
    } catch (error: any) {
      toast.error('Erreur lors de la fermeture de la session');
    }
  };


  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Gestion des utilisateurs</h1>
        </div>
        <div className="page-content">
          <p>Vous n'avez pas accès à cette page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 className="page-title">Gestion des utilisateurs</h1>
          <p className="page-subtitle">Créez, modifiez ou supprimez les accès au portail ERP.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          Nouvel utilisateur
        </button>
      </div>

      <div className="destruction-card">
        <div className="destruction-section">
          <div style={{ marginBottom: '20px' }}>
            <div className="map-input" style={{ maxWidth: '400px' }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 className="spinner" size={32} />
              <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Chargement...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <p>Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <div className="unified-table-container">
              <table className="unified-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Nom complet</th>
                    <th>Rôle</th>
                    <th>Département</th>
                    <th>Autorisations</th>
                    <th>2FA</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.email}</strong>
                      </td>
                      <td>{user.full_name || '—'}</td>
                      <td>
                        <span className="badge badge-secondary">{roleLabels[user.role]}</span>
                      </td>
                      <td>{user.department || '—'}</td>
                      <td>
                        {user.permissions && user.permissions.length > 0 ? (
                          <span className="badge badge-info">{user.permissions.length} modules</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {twoFactorEnabled[user.id] ? (
                          <span className="badge badge-success">
                            <CheckCircle size={12} style={{ marginRight: '4px' }} />
                            Activé
                          </span>
                        ) : (
                          <span className="badge badge-secondary">Désactivé</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => openEditModal(user)}
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleViewSessions(user.id)}
                            title="Sessions actives"
                          >
                            <Shield size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon text-red-600"
                            onClick={() => handleDelete(user)}
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal création/édition utilisateur */}
      {showModal && (
        <div 
          className="modal-backdrop" 
          onClick={closeModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          <div 
            className="modal-panel unified-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <h2 className="modal-title" style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#111827',
                margin: 0
              }}>
                {form.id ? 'Modifier un utilisateur' : 'Nouvel utilisateur'}
              </h2>
              <button 
                type="button" 
                className="modal-close" 
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ×
              </button>
            </div>
            
            <form 
              onSubmit={handleSubmit} 
              className="modal-body"
              style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              <div className="form-section">
                <div className="form-grid-2-cols" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '20px',
                  marginBottom: '24px'
                }}>
                  <div className="form-group">
                    <label htmlFor="user-email" style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Email <span className="required-indicator" style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="user-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => handleInputChange('email', event.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="user-full-name" style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Nom complet
                    </label>
                    <input
                      id="user-full-name"
                      type="text"
                      value={form.full_name}
                      onChange={(event) => handleInputChange('full_name', event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="user-role" style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Rôle
                    </label>
                    <select
                      id="user-role"
                      value={form.role}
                      onChange={(event) => handleInputChange('role', event.target.value as UserRole)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="user-department" style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Département
                    </label>
                    <input
                      id="user-department"
                      type="text"
                      value={form.department}
                      onChange={(event) => handleInputChange('department', event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="user-manager-name" style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Responsable visible
                    </label>
                    <input
                      id="user-manager-name"
                      type="text"
                      value={form.manager_name}
                      onChange={(event) => handleInputChange('manager_name', event.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="user-password" style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      {form.id ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'} {!form.id && <span className="required-indicator" style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    <input
                      id="user-password"
                      type="password"
                      value={form.password}
                      onChange={(event) => handleInputChange('password', event.target.value)}
                      placeholder={form.id ? 'Laisser vide pour ne pas changer' : ''}
                      required={!form.id}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  marginTop: '32px',
                  paddingTop: '24px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: '#111827',
                    marginBottom: '16px'
                  }}>
                    Autorisations fines
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    {PERMISSION_GROUPS.map((group) => (
                      <div 
                        key={group.label} 
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: '#f9fafb',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.backgroundColor = '#f0f9ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                      >
                        <p style={{
                          fontWeight: 600,
                          marginBottom: '12px',
                          fontSize: '0.875rem',
                          color: '#111827'
                        }}>
                          {group.label}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {group.permissions.map((permission) => (
                            <label 
                              key={permission.id} 
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                padding: '4px 0'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  accentColor: '#3b82f6'
                                }}
                              />
                              <span style={{
                                fontSize: '0.875rem',
                                color: '#374151',
                                userSelect: 'none'
                              }}>
                                {permission.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginTop: '12px',
                    fontStyle: 'italic'
                  }}>
                    Les autorisations complètent les rôles et permettent d'ouvrir l'accès module par module.
                  </p>
                </div>

                {form.id && (
                  <div style={{
                    marginTop: '32px',
                    paddingTop: '24px',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: '#111827',
                      marginBottom: '16px'
                    }}>
                      Sécurité - Authentification à deux facteurs (2FA)
                    </h3>
                    <div style={{
                      padding: '16px',
                      backgroundColor: twoFactorEnabled[form.id!] ? '#f0fdf4' : '#fef2f2',
                      borderRadius: '8px',
                      border: `1px solid ${twoFactorEnabled[form.id!] ? '#bbf7d0' : '#fecaca'}`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <div>
                          <p style={{
                            fontSize: '0.875rem',
                            color: twoFactorEnabled[form.id!] ? '#166534' : '#991b1b',
                            marginBottom: '4px',
                            fontWeight: 600
                          }}>
                            {twoFactorEnabled[form.id!] ? '✓ 2FA activé' : '✗ 2FA désactivé'}
                          </p>
                          <p style={{
                            fontSize: '0.75rem',
                            color: twoFactorEnabled[form.id!] ? '#15803d' : '#dc2626',
                            lineHeight: '1.5'
                          }}>
                            {twoFactorEnabled[form.id!] 
                              ? 'L\'authentification à deux facteurs est activée pour cet utilisateur.'
                              : 'L\'authentification à deux facteurs n\'est pas activée pour cet utilisateur.'}
                          </p>
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        marginTop: '12px'
                      }}>
                        {!twoFactorEnabled[form.id!] ? (
                          <button
                            type="button"
                            onClick={() => handleSetup2FA(form.id!)}
                            style={{
                              padding: '8px 16px',
                              border: 'none',
                              borderRadius: '6px',
                              backgroundColor: '#3b82f6',
                              color: '#ffffff',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#3b82f6';
                            }}
                          >
                            <Key size={16} />
                            Activer 2FA
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDisable2FA(form.id!)}
                            style={{
                              padding: '8px 16px',
                              border: 'none',
                              borderRadius: '6px',
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#dc2626';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ef4444';
                            }}
                          >
                            <XCircle size={16} />
                            Désactiver 2FA
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="modal-footer" style={{
                padding: '24px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: '#f9fafb',
                marginTop: 'auto'
              }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={closeModal} 
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!saving) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: saving ? '#9ca3af' : '#3b82f6',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!saving) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {form.id ? 'Mettre à jour' : 'Créer'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Modal 2FA Setup */}
      {show2FAModal && twoFactorSetup && selectedUserId && (
        <div 
          className="modal-backdrop" 
          onClick={() => setShow2FAModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          <div 
            className="modal-panel unified-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#111827',
                margin: 0
              }}>
                Configuration 2FA
              </h2>
              <button 
                type="button" 
                onClick={() => setShow2FAModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              padding: '24px',
              overflowY: 'auto',
              flex: 1
            }}>
              <p style={{
                marginBottom: '16px',
                color: '#6b7280',
                fontSize: '0.875rem',
                lineHeight: '1.6'
              }}>
                1. Scannez ce QR code avec une application d'authentification (Google Authenticator, Authy, Microsoft Authenticator, etc.)
              </p>
              <div style={{
                textAlign: 'center',
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <img 
                  src={twoFactorSetup.qrCode} 
                  alt="QR Code 2FA" 
                  style={{
                    maxWidth: '250px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#ffffff'
                  }} 
                />
              </div>
              <p style={{
                marginBottom: '16px',
                color: '#6b7280',
                fontSize: '0.875rem',
                lineHeight: '1.6'
              }}>
                2. Entrez le code à 6 chiffres généré par votre application pour activer le 2FA
              </p>
              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="2fa-code" style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Code de vérification
                </label>
                <input
                  id="2fa-code"
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '1.5rem',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <p style={{
                  fontWeight: 600,
                  marginBottom: '12px',
                  fontSize: '0.9rem',
                  color: '#1e40af'
                }}>
                  Codes de secours
                </p>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#1e3a8a',
                  marginBottom: '12px',
                  lineHeight: '1.6'
                }}>
                  Conservez ces codes en lieu sûr. Ils vous permettront de vous connecter si l'utilisateur perd accès à son application d'authentification.
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  {twoFactorSetup.backupCodes.map((code, idx) => (
                    <code 
                      key={idx} 
                      style={{
                        padding: '8px',
                        backgroundColor: '#ffffff',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        border: '1px solid #bfdbfe',
                        textAlign: 'center'
                      }}
                    >
                      {code}
                    </code>
                  ))}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '8px'
                }}>
                  <button
                    type="button"
                    onClick={() => copyBackupCodes(twoFactorSetup.backupCodes)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#1e40af',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <Copy size={14} />
                    Copier
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBackupCodes(twoFactorSetup.backupCodes)}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#1e40af',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <Download size={14} />
                    Télécharger
                  </button>
                </div>
              </div>
              <div style={{
                padding: '24px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: '#f9fafb',
                marginTop: '24px'
              }}>
                <button 
                  type="button" 
                  onClick={() => setShow2FAModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleEnable2FA}
                  disabled={twoFactorCode.length !== 6}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: twoFactorCode.length === 6 ? '#3b82f6' : '#9ca3af',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: twoFactorCode.length === 6 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (twoFactorCode.length === 6) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (twoFactorCode.length === 6) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }
                  }}
                >
                  <CheckCircle size={16} />
                  Activer 2FA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sessions */}
      {showSessionsModal && selectedUserId && (
        <div className="unified-modal-overlay" onClick={() => setShowSessionsModal(false)}>
          <div className="unified-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="unified-modal-header">
              <h2>Sessions actives</h2>
              <button type="button" className="btn-icon" onClick={() => setShowSessionsModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="unified-modal-form">
              {userSessions[selectedUserId] && userSessions[selectedUserId].length > 0 ? (
                <div className="unified-table-container">
                  <table className="unified-table">
                    <thead>
                      <tr>
                        <th>IP</th>
                        <th>Appareil</th>
                        <th>Dernière activité</th>
                        <th>Expire le</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userSessions[selectedUserId].map((session) => (
                        <tr key={session.id}>
                          <td>{session.ip_address || '—'}</td>
                          <td>{session.user_agent || '—'}</td>
                          <td>{format(new Date(session.last_activity), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                          <td>{format(new Date(session.expires_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                          <td>
                            {session.is_active && (
                              <button
                                type="button"
                                className="btn-icon text-red-600"
                                onClick={() => handleDeleteSession(session.id)}
                                title="Fermer la session"
                              >
                                <XCircle size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Aucune session active</p>
              )}
              <div className="unified-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowSessionsModal(false)}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersAdminPage;
