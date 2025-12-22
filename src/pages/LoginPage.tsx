import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../hooks/useAuth';
import { Api } from '../lib/api';
import { useI18n } from '../context/I18nContext';
import { useGeolocation } from '../context/GeolocationContext';

type ViewMode = 'login' | 'request' | 'reset';

const LoginPage = () => {
  const { login } = useAuth();
  const { t } = useI18n();
  const { startGeolocation } = useGeolocation();
  const queryToken = useMemo(() => new URLSearchParams(window.location.search).get('resetToken') || '', []);
  const [mode, setMode] = useState<ViewMode>(queryToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState(queryToken);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success(t('login.success'));
      // Démarrer la localisation après connexion réussie
      startGeolocation();
    } catch (error) {
      // Ne logger que si ce n'est pas une erreur d'authentification normale ou de serveur
      const errorMessage = error instanceof Error ? error.message : t('login.error');
      const isServerError = errorMessage.includes('serveur backend') || 
                           errorMessage.includes('serveur est démarré') ||
                           errorMessage.includes('ECONNREFUSED');
      
      if (!errorMessage.includes('Identifiants invalides') && !isServerError) {
        console.error('Erreur de connexion:', error);
      }
      
      // Afficher un message d'erreur plus clair pour les erreurs de serveur
      if (isServerError) {
        toast.error('Le serveur backend n\'est pas démarré. Veuillez démarrer le serveur et réessayer.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await Api.requestPasswordReset({ email });
      toast.success(t('login.request.success'));
      setMode('login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('login.request.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t('login.reset.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await Api.resetPassword({ token, password });
      toast.success(t('login.reset.success'));
      setMode('login');
      setToken('');
      setPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('login.reset.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderForm = () => {
    switch (mode) {
      case 'request':
        return (
          <form className="login-form" onSubmit={handleRequestReset}>
            <label>
              <span>{t('login.email')}</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="spinner" size={16} /> {t('login.request.submitting')}
                </>
              ) : (
                t('login.request.submit')
              )}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMode('login')}>
              {t('login.backToLogin')}
            </button>
          </form>
        );
      case 'reset':
        return (
          <form className="login-form" onSubmit={handleResetPassword}>
            <label>
              <span>{t('login.token')}</span>
              <input value={token} onChange={(event) => setToken(event.target.value)} required />
            </label>
            <label>
              <span>{t('login.newPassword')}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <label>
              <span>{t('login.confirmPassword')}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="spinner" size={16} /> {t('login.reset.submitting')}
                </>
              ) : (
                t('login.reset.submit')
              )}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMode('login')}>
              {t('login.backToLogin')}
            </button>
          </form>
        );
      case 'login':
      default:
        return (
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              <span>{t('login.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="prenom.nom@retripa.ch"
                required
              />
            </label>
            <label>
              <span>{t('login.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="spinner" size={16} /> {t('login.submitting')}
                </>
              ) : (
                t('login.submit')
              )}
            </button>
            <button type="button" className="btn btn-link" onClick={() => setMode('request')}>
              {t('login.forgotPassword')}
            </button>
          </form>
        );
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <p className="eyebrow">ERP</p>
          <h1>
            {mode === 'login'
              ? t('login.title')
              : mode === 'request'
              ? t('login.request.title')
              : t('login.reset.title')}
          </h1>
          <p className="login-subtitle">
            {mode === 'login'
              ? t('login.subtitle')
              : mode === 'request'
              ? t('login.request.subtitle')
              : t('login.reset.subtitle')}
          </p>
        </div>
        {renderForm()}
        <p className="login-hint">
          {t('login.hint')}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

