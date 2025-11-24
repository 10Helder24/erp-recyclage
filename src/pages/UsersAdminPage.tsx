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
};

const defaultForm = (): UserFormState => ({
  email: '',
  full_name: '',
  role: 'manager',
  department: '',
  manager_name: '',
  password: ''
});

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Responsable',
  user: 'Utilisateur'
};

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
      password: ''
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
          password: form.password || undefined
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
          manager_name: form.manager_name || undefined
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
              <span>Responsable</span>
              <span>Actions</span>
            </div>
            {users.map((user) => (
              <div key={user.id} className="users-row">
                <span>{user.email}</span>
                <span>{user.full_name || '—'}</span>
                <span>{roleLabels[user.role]}</span>
                <span>{user.department || '—'}</span>
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
          <div className="modal-panel">
            <div className="modal-header">
              <h3 className="modal-title">{form.id ? 'Modifier un utilisateur' : 'Nouvel utilisateur'}</h3>
              <button className="icon-button" onClick={closeModal} aria-label="Fermer">
                ✕
              </button>
            </div>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="destruction-field">
                <span>Email</span>
                <input
                  className="destruction-input"
                  type="email"
                  value={form.email}
                  onChange={(event) => handleInputChange('email', event.target.value)}
                  required
                />
              </label>
              <label className="destruction-field">
                <span>Nom complet</span>
                <input
                  className="destruction-input"
                  value={form.full_name}
                  onChange={(event) => handleInputChange('full_name', event.target.value)}
                />
              </label>
              <label className="destruction-field">
                <span>Rôle</span>
                <select
                  className="destruction-input"
                  value={form.role}
                  onChange={(event) => handleInputChange('role', event.target.value as UserRole)}
                >
                  {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="destruction-field">
                <span>Département</span>
                <input
                  className="destruction-input"
                  value={form.department}
                  onChange={(event) => handleInputChange('department', event.target.value)}
                />
              </label>
              <label className="destruction-field">
                <span>Responsable visible</span>
                <input
                  className="destruction-input"
                  value={form.manager_name}
                  onChange={(event) => handleInputChange('manager_name', event.target.value)}
                />
              </label>
              <label className="destruction-field">
                <span>{form.id ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}</span>
                <input
                  className="destruction-input"
                  type="password"
                  value={form.password}
                  onChange={(event) => handleInputChange('password', event.target.value)}
                  placeholder={form.id ? 'Laisser vide pour ne pas changer' : ''}
                  required={!form.id}
                />
              </label>
              <div className="modal-actions">
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

