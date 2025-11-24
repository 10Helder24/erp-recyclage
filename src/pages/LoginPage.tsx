import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../hooks/useAuth';
import { Api } from '../lib/api';

type ViewMode = 'login' | 'request' | 'reset';

const LoginPage = () => {
  const { login } = useAuth();
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
      toast.success('Connexion réussie');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Connexion impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await Api.requestPasswordReset({ email });
      toast.success('Si un compte existe, un email a été envoyé.');
      setMode('login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible denvoyer linstruction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setSubmitting(true);
    try {
      await Api.resetPassword({ token, password });
      toast.success('Mot de passe mis à jour');
      setMode('login');
      setToken('');
      setPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de réinitialiser');
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
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="spinner" size={16} /> Envoi…
                </>
              ) : (
                'Envoyer le lien'
              )}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMode('login')}>
              Retour à la connexion
            </button>
          </form>
        );
      case 'reset':
        return (
          <form className="login-form" onSubmit={handleResetPassword}>
            <label>
              <span>Token</span>
              <input value={token} onChange={(event) => setToken(event.target.value)} required />
            </label>
            <label>
              <span>Nouveau mot de passe</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <label>
              <span>Confirmation</span>
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
                  <Loader2 className="spinner" size={16} /> Réinitialisation…
                </>
              ) : (
                'Réinitialiser'
              )}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMode('login')}>
              Retour à la connexion
            </button>
          </form>
        );
      case 'login':
      default:
        return (
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="prenom.nom@retripa.ch"
                required
              />
            </label>
            <label>
              <span>Mot de passe</span>
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
                  <Loader2 className="spinner" size={16} /> Connexion…
                </>
              ) : (
                'Se connecter'
              )}
            </button>
            <button type="button" className="btn btn-link" onClick={() => setMode('request')}>
              Mot de passe oublié ?
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
              ? 'Portail interne'
              : mode === 'request'
              ? 'Réinitialiser le mot de passe'
              : 'Choisissez un nouveau mot de passe'}
          </h1>
          <p className="login-subtitle">
            {mode === 'login'
              ? 'Connectez-vous pour accéder aux modules RH.'
              : mode === 'request'
              ? 'Entrez votre email pour recevoir un lien de réinitialisation.'
              : 'Saisissez le code reçu par email et votre nouveau mot de passe.'}
          </p>
        </div>
        {renderForm()}
        <p className="login-hint">
          Besoin d’un accès ? Demandez à l’administrateur de créer un compte dans la console utilisateurs.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

