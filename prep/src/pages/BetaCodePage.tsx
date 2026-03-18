import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface BetaCodePageProps {
  onValidated: () => void;
  onBack: () => void;
  onSignIn: () => void;
}

const validateBetaCode = async (enteredCode: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'beta_code')
    .single();

  if (error || !data) return false;

  return enteredCode.toUpperCase().trim() === data.value.toUpperCase().trim();
};

export function BetaCodePage({ onValidated, onBack, onSignIn }: BetaCodePageProps) {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsValidating(true);
    setError('');

    try {
      const valid = await validateBetaCode(code);
      if (valid) {
        onValidated();
      } else {
        setError("That code isn't valid. Try again.");
      }
    } catch {
      setError("That code isn't valid. Try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const isDisabled = !code.trim() || isValidating;

  return (
    <div className="auth-page" style={{ flexDirection: 'column', gap: '0' }}>
      {/* Rainbow swirl decoration */}
      <div className="hub-hero-rainbow">
        <div className="rainbow-ring rainbow-ring--1" />
        <div className="rainbow-ring rainbow-ring--2" />
        <div className="rainbow-ring rainbow-ring--3" />
      </div>

      {/* Top nav-style bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderRadius: '8px',
            transition: 'color 0.15s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <button
          onClick={onSignIn}
          className="topbar-login-btn"
        >
          Sign In
        </button>
      </div>

      {/* Main centered content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px 40px',
        position: 'relative',
        zIndex: 2,
      }}>
        {/* Brand */}
        <div className="auth-brand" style={{ marginBottom: '48px' }}>
          <div className="brand-logo" style={{ fontSize: '2rem' }}>
            <span className="brand-logo-checks">Checks</span>{' '}
            <span className="brand-logo-happy">Happy.</span>
          </div>
          <div className="topbar-divider" style={{ height: '28px' }} />
          <span className="topbar-prep-label" style={{ fontSize: '1.25rem' }}>PREP</span>
        </div>

        {/* Wide card container */}
        <div style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(var(--a), 0.03)',
          border: '1px solid var(--border-card)',
          borderRadius: '20px',
          padding: '48px 48px 40px',
        }}>
          {/* Private beta pill */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 16px',
              borderRadius: '20px',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '0.625rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}>
              PRIVATE BETA
            </span>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            textAlign: 'center',
            margin: '0 0 8px',
          }}>
            Enter your access code
          </h2>

          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            margin: '0 0 32px',
            lineHeight: 1.5,
          }}>
            Get your code by following us on Instagram.{' '}
            <a
              href="https://instagram.com/checkshappy"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
            >
              @checkshappy
            </a>
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              className="auth-input"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError('');
              }}
              placeholder="ACCESS CODE"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              style={{
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '1.125rem',
                letterSpacing: '0.12em',
                padding: '14px 16px',
                borderColor: error ? 'rgba(200, 60, 60, 0.6)' : undefined,
              }}
            />

            {error && (
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.8125rem',
                color: 'rgba(200, 60, 60, 0.9)',
                textAlign: 'center',
                margin: 0,
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={isDisabled}
              style={{
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'default' : 'pointer',
                padding: '14px',
                fontSize: '1rem',
                borderRadius: '12px',
              }}
            >
              {isValidating ? 'Checking...' : 'Continue'}
            </button>
          </form>

          <div className="auth-switch" style={{ marginTop: '24px' }}>
            Already have an account?{' '}
            <button className="auth-switch-btn" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
