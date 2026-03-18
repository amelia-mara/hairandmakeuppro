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
    <div className="auth-page">
      {/* Rainbow swirl decoration */}
      <div className="hub-hero-rainbow">
        <div className="rainbow-ring rainbow-ring--1" />
        <div className="rainbow-ring rainbow-ring--2" />
        <div className="rainbow-ring rainbow-ring--3" />
      </div>

      <div className="auth-container">
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Brand */}
        <div className="auth-brand">
          <div className="brand-logo" style={{ fontSize: '1.75rem' }}>
            <span className="brand-logo-checks">Checks</span>{' '}
            <span className="brand-logo-happy">Happy.</span>
          </div>
          <div className="topbar-divider" style={{ height: '24px' }} />
          <span className="topbar-prep-label" style={{ fontSize: '1.125rem' }}>PREP</span>
        </div>

        {/* Beta code card */}
        <div className="auth-card">
          {/* Private beta pill */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 12px',
                borderRadius: '20px',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: '0.5625rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              PRIVATE BETA
            </span>
          </div>

          <h2 className="auth-heading" style={{ textAlign: 'center' }}>
            Enter your access code
          </h2>
          <p className="auth-subtext" style={{ textAlign: 'center' }}>
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

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
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
                  letterSpacing: '0.1em',
                  borderColor: error ? 'rgba(200, 60, 60, 0.6)' : undefined,
                }}
              />
            </div>

            {error && <p className="auth-error" style={{ textAlign: 'center' }}>{error}</p>}

            <button
              type="submit"
              className="auth-submit"
              disabled={isDisabled}
              style={{
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'default' : 'pointer',
              }}
            >
              {isValidating ? 'Checking...' : 'Continue'}
            </button>
          </form>

          <div className="auth-switch">
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
