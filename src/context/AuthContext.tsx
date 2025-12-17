import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '../lib/api';
import type { AuthUser, UserRole } from '../types/auth';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  hasPermission: (...permissions: string[]) => boolean;
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getStoredToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem('erp_auth_token');
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      if (!token) {
        Api.setAuthToken(null);
        setLoading(false);
        return;
      }
      Api.setAuthToken(token);
      try {
        const { user: currentUser } = await Api.fetchCurrentUser();
        if (mounted) {
          setUser(currentUser);
        }
      } catch (error: any) {
        // Gérer silencieusement les sessions expirées (c'est normal)
        const isSessionExpired = error?.message?.includes('Session expirée') || 
                                 error?.message?.includes('Session expired') ||
                                 error?.message?.includes('Authentification requise');
        
        if (!isSessionExpired) {
          // Logger seulement les erreurs non liées à l'expiration de session
          console.error('Auth bootstrap failed', error);
        }
        
        // Nettoyer le token expiré
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('erp_auth_token');
        }
        Api.setAuthToken(null);
        if (mounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [token]);

  const persistToken = (value: string | null) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (value) {
      window.localStorage.setItem('erp_auth_token', value);
    } else {
      window.localStorage.removeItem('erp_auth_token');
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const response = await Api.login({ email, password });
    setUser(response.user);
    setToken(response.token);
    Api.setAuthToken(response.token);
    persistToken(response.token);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    Api.setAuthToken(null);
    persistToken(null);
    toast.success('Déconnecté');
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) {
        return false;
      }
      return roles.includes(user.role);
    },
    [user]
  );

  const hasPermission = useCallback(
    (...permissions: string[]) => {
      if (!user) {
        return false;
      }
      if (user.role === 'admin') {
        return true;
      }
      const userPermissions = user.permissions ?? [];
      return permissions.some((perm) => userPermissions.includes(perm));
    },
    [user]
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const { user: currentUser } = await Api.fetchCurrentUser();
      setUser(currentUser);
    } catch (error: any) {
      // Gérer silencieusement les sessions expirées
      const isSessionExpired = error?.message?.includes('Session expirée') || 
                               error?.message?.includes('Session expired') ||
                               error?.message?.includes('Authentification requise');
      
      if (!isSessionExpired) {
        console.error('Erreur lors du rafraîchissement de l\'utilisateur:', error);
      } else {
        // Nettoyer le token expiré
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('erp_auth_token');
        }
        Api.setAuthToken(null);
        setUser(null);
        setToken(null);
      }
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      hasRole,
      hasPermission,
      refreshUser
    }),
    [user, token, loading, login, logout, hasRole, hasPermission, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

