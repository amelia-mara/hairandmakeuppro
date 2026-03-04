export function TopBar() {
  return (
    <header className="app-header">
      <div className="flex items-center justify-between">
        <h1
          style={{
            fontSize: '1.875em',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}
        >
          Prep Happy
        </h1>

        <div className="flex items-center gap-3">
          {/* Back to Checks Happy */}
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: 'linear-gradient(135deg, rgba(201, 169, 97, 0.15) 0%, rgba(201, 169, 97, 0.08) 100%)',
              border: '1px solid rgba(201, 169, 97, 0.4)',
              borderRadius: '10px',
              color: 'var(--accent-gold)',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(201, 169, 97, 0.25) 0%, rgba(201, 169, 97, 0.15) 100%)';
              e.currentTarget.style.boxShadow = 'var(--glow-medium)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(201, 169, 97, 0.15) 0%, rgba(201, 169, 97, 0.08) 100%)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Checks Happy
          </a>

          {/* Profile */}
          <button
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(201, 169, 97, 0.9) 0%, rgba(184, 150, 81, 0.9) 100%)',
              border: '1px solid rgba(201, 169, 97, 0.3)',
              color: 'var(--bg-primary)',
              fontWeight: 600,
              fontSize: '0.8125em',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = 'var(--glow-medium)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            AM
          </button>
        </div>
      </div>
    </header>
  );
}
