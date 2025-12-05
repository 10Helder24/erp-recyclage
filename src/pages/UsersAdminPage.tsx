import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit, Shield, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Api } from '../lib/api';
import type { AuthUser, UserRole } from '../types/auth';

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
  }
];

const UsersAdminPage = () => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UserFormState>(defaultForm);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await Api.fetchUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateModal = () => {
    setForm(defaultForm());
    setModalOpen(true);
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
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(defaultForm());
  };

  const handleInputChange = (field: keyof UserFormState, value: string) => {
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

  const roleCounts = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc[user.role] = (acc[user.role] ?? 0) + 1;
        return acc;
      },
      {} as Record<UserRole, number>
    );
  }, [users]);

  return (
    <section className="destruction-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Gestion des utilisateurs</h1>
          <p>Créer, mettre à jour ou supprimer les accès au portail ERP.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          Nouvel utilisateur
        </button>
      </div>

      <div className="users-grid">
        <div className="destruction-card users-card">
          <h3>Statistiques</h3>
          <div className="role-stats">
            {(Object.keys(roleLabels) as UserRole[]).map((role) => (
              <div key={role} className="role-chip">
                <Shield size={16} />
                <div>
                  <span>{roleLabels[role]}</span>
                  <strong>{roleCounts[role] ?? 0}</strong>
                </div>
              </div>
            ))}
          </div>
          <p className="users-helper">
            Les rôles définissent les droits d’accès. Un administrateur voit tous les modules et peut gérer les
            utilisateurs.
          </p>
        </div>

        <div className="destruction-card users-card">
          <h3>Bonnes pratiques</h3>
          <ul className="users-tips">
            <li>Utiliser un mot de passe unique par responsable.</li>
            <li>Révoquer les accès des personnes qui quittent l’entreprise.</li>
            <li>Associer chaque compte à un email personnel (pas de partages).</li>
            <li>Documenter les rôles pour garder une vision claire des responsabilités.</li>
          </ul>
        </div>
      </div>

      <div className="destruction-card users-table-card">
        {loading ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <Loader2 className="spinner" />
            <p>Chargement…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">Aucun utilisateur configuré.</div>
        ) : (
          <div className="users-table">
            <div className="users-row users-row--head">
              <span>Email</span>
              <span>Nom</span>
              <span>Rôle</span>
              <span>Département</span>
              <span>Autorisations</span>
              <span>Responsable</span>
              <span>Actions</span>
            </div>
            {users.map((user) => (
              <div key={user.id} className="users-row">
                <span>{user.email}</span>
                <span>{user.full_name || '—'}</span>
                <span>{roleLabels[user.role]}</span>
                <span>{user.department || '—'}</span>
                <span>
                  {user.permissions && user.permissions.length > 0 ? (
                    <span className="permission-count">{user.permissions.length} modules</span>
                  ) : (
                    '—'
                  )}
                </span>
                <span>{user.manager_name || '—'}</span>
                <span className="users-actions">
                  <button className="icon-button" onClick={() => openEditModal(user)} aria-label="Modifier">
                    <Edit size={18} />
                  </button>
                  <button className="icon-button warn" onClick={() => handleDelete(user)} aria-label="Supprimer">
                    <Trash2 size={18} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel unified-modal">
            <div className="modal-header">
              <h2 className="modal-title">{form.id ? 'Modifier un utilisateur' : 'Nouvel utilisateur'}</h2>
              <button className="modal-close" onClick={closeModal} aria-label="Fermer">
                ×
              </button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="user-email">
                    Email <span className="required-indicator">*</span>
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => handleInputChange('email', event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="user-full-name">Nom complet</label>
                  <input
                    id="user-full-name"
                    value={form.full_name}
                    onChange={(event) => handleInputChange('full_name', event.target.value)}
                  />
                </div>
                <div className="form-grid-2-cols">
                  <div className="form-group">
                    <label htmlFor="user-role">Rôle</label>
                    <select
                      id="user-role"
                      value={form.role}
                      onChange={(event) => handleInputChange('role', event.target.value as UserRole)}
                    >
                      {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="user-department">Département</label>
                    <input
                      id="user-department"
                      value={form.department}
                      onChange={(event) => handleInputChange('department', event.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="user-manager-name">Responsable visible</label>
                  <input
                    id="user-manager-name"
                    value={form.manager_name}
                    onChange={(event) => handleInputChange('manager_name', event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="user-password">
                    {form.id ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'} {!form.id && <span className="required-indicator">*</span>}
                  </label>
                  <input
                    id="user-password"
                    type="password"
                    value={form.password}
                    onChange={(event) => handleInputChange('password', event.target.value)}
                    placeholder={form.id ? 'Laisser vide pour ne pas changer' : ''}
                    required={!form.id}
                  />
                </div>
                <div className="permissions-wrapper">
                  <p className="permissions-title">Autorisations fines</p>
                  <div className="permissions-grid">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.label} className="permissions-group">
                        <p>{group.label}</p>
                        <div className="permissions-options">
                          {group.permissions.map((permission) => (
                            <label key={permission.id} className="checkbox-chip">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                              />
                              <span>{permission.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="muted-text">Les autorisations complètent les rôles et permettent d'ouvrir l'accès module par module.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeModal} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement…' : form.id ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default UsersAdminPage;

