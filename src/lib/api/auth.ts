import type { AuthUser } from '../../types/auth';
import { request, setAuthToken as setAuthTokenBase } from './base';

export const AuthApi = {
  setAuthToken: (token: string | null) => {
    setAuthTokenBase(token);
  },
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  fetchCurrentUser: () => request<{ user: AuthUser }>('/auth/me'),
  requestPasswordReset: (payload: { email: string }) =>
    request<{ message: string }>('/auth/password/request', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  resetPassword: (payload: { token: string; password: string }) =>
    request<{ message: string }>('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  setup2FA: () =>
    request<{ secret: string; qrCode: string; backupCodes: string[] }>('/auth/2fa/setup', {
      method: 'POST'
    }),
  enable2FA: (payload: { code: string }) =>
    request<{ message: string }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  disable2FA: (payload: { password: string }) =>
    request<{ message: string }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  regenerateBackupCodes: () =>
    request<{ backupCodes: string[] }>('/auth/2fa/regenerate-backup-codes', {
      method: 'POST'
    })
};


