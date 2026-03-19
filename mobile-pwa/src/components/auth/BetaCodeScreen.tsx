import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const validateBetaCode = async (enteredCode: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'beta_code')
    .single();

  if (error || !data) return false;

  return enteredCode.toUpperCase().trim() === data.value.toUpperCase().trim();
};

export function BetaCodeScreen() {
  const { setScreen, goBack } = useAuthStore();
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
        // Navigate to signup with betaValidated flag
        // Pass via transient state — not persisted
        setScreen('signup');
        // Store validation in a module-level variable accessible by SignUpScreen
        (window as any).__betaValidated = true;
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
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#F5EFE0', position: 'relative', overflow: 'hidden' }}
    >
      {/* Noise texture overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Back button */}
      <header
        className="flex items-center px-4 py-3 safe-top"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <button
          onClick={goBack}
          className="w-10 h-10 flex items-center justify-center rounded-full"
          style={{ marginLeft: '-8px' }}
          aria-label="Go back"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4A3020"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
      </header>

      {/* Content — vertically centred */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Private Beta pill */}
        <span
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: '20px',
            background: '#EDE4D0',
            border: '1px solid #E8621A',
            color: '#E8621A',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: '9px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: '20px',
          }}
        >
          PRIVATE BETA
        </span>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: '22px',
            color: '#4A3020',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center',
            margin: '0 0 12px',
          }}
        >
          Enter your access code
        </h1>

        {/* Subtext */}
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 300,
            fontSize: '13px',
            color: '#9A7A5A',
            textAlign: 'center',
            margin: '0 0 32px',
            lineHeight: 1.6,
          }}
        >
          Get your code by following us on Instagram.
          <br />
          <a
            href="https://instagram.com/checkshappy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#E8621A', textDecoration: 'none' }}
          >
            @checkshappy
          </a>
        </p>

        {/* Code input form */}
        <form onSubmit={handleSubmit} className="w-full" style={{ maxWidth: '340px' }}>
          <input
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
              width: '100%',
              padding: '14px 16px',
              borderRadius: '12px',
              border: `1.5px solid ${error ? '#C4522A' : '#DDD4C0'}`,
              background: '#FFFFFF',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: '18px',
              color: '#4A3020',
              letterSpacing: '0.1em',
              textAlign: 'center',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              if (!error) e.target.style.borderColor = '#E8621A';
            }}
            onBlur={(e) => {
              if (!error) e.target.style.borderColor = '#DDD4C0';
            }}
          />

          {/* Continue button */}
          <button
            type="submit"
            disabled={isDisabled}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '16px',
              borderRadius: '12px',
              border: 'none',
              background: '#E8621A',
              color: '#FFFFFF',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: '14px',
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {isValidating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking...
              </span>
            ) : (
              'Continue'
            )}
          </button>

          {/* Error message */}
          {error && (
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 400,
                fontSize: '13px',
                color: '#C4522A',
                textAlign: 'center',
                marginTop: '12px',
              }}
            >
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Bottom link */}
      <div
        className="px-6 py-6 text-center"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: '#9A7A5A',
          }}
        >
          Already have an account?{' '}
          <button
            onClick={() => setScreen('signin')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 600,
              color: '#E8621A',
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
