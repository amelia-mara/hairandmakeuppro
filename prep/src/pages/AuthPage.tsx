import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
}

export function AuthPage({ initialMode = 'signup' }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, signup } = useAuthStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (!name.trim() || !email.trim() || !password.trim()) {
        setError('Please fill in all fields.');
        return;
      }
      signup(name.trim(), email.trim(), password);
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Please fill in all fields.');
        return;
      }
      login(email.trim(), password);
    }
  };

  return (
    <div className="auth-page">
      {/* Rainbow swirl decoration */}
      <div className="hub-hero-rainbow">
        <div className="rainbow-ring rainbow-ring--1" />
        <div className="rainbow-ring rainbow-ring--2" />
        <div className="rainbow-ring rainbow-ring--3" />
      </div>

      <div className="auth-container">
        {/* Brand */}
        <div className="auth-brand">
          <div className="brand-logo" style={{ fontSize: '1.75rem' }}>
            <span className="brand-logo-checks">Checks</span>{' '}
            <span className="brand-logo-happy">Happy.</span>
          </div>
          <div className="topbar-divider" style={{ height: '24px' }} />
          <span className="topbar-prep-label" style={{ fontSize: '1.125rem' }}>PREP</span>
        </div>

        {/* Auth card */}
        <div className="auth-card">
          <h2 className="auth-heading">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="auth-subtext">
            {mode === 'signup'
              ? 'Start managing your productions for free.'
              : 'Sign in to your account.'}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  className="auth-input"
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="auth-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit">
              {mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button className="auth-switch-btn" onClick={() => { setMode('login'); setError(''); }}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button className="auth-switch-btn" onClick={() => { setMode('signup'); setError(''); }}>
                  Create one
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
