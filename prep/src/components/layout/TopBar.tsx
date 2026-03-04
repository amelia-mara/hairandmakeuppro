export function TopBar() {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Title */}
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Projects
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Back to Checks Happy */}
          <a
            href="/"
            className="btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              background: 'rgba(201, 169, 97, 0.05)',
              border: '1px solid var(--border-card)',
              borderRadius: '10px',
              color: 'var(--accent-gold)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              textDecoration: 'none',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Checks Happy
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M17 7H7M17 7v10"/>
            </svg>
          </a>

          {/* Avatar — THE SUN */}
          <div style={{ position: 'relative' }}>
            {/* Outer glow rings */}
            <div style={{
              position: 'absolute',
              inset: '-12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201, 169, 97, 0.12) 0%, rgba(201, 169, 97, 0.04) 40%, transparent 70%)',
              pointerEvents: 'none',
              animation: 'pulse-glow 3s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              inset: '-24px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201, 169, 97, 0.05) 0%, transparent 60%)',
              pointerEvents: 'none',
              filter: 'blur(8px)',
            }} />
            <button
              style={{
                position: 'relative',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #dbbf72 0%, #c9a961 40%, #a07628 100%)',
                border: '1px solid rgba(201, 169, 97, 0.5)',
                color: '#0c0a08',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(201, 169, 97, 0.25), 0 0 40px rgba(201, 169, 97, 0.10), 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 0 0 rgba(255, 255, 255, 0.15) inset',
                zIndex: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 0 24px rgba(201, 169, 97, 0.35), 0 0 60px rgba(201, 169, 97, 0.15), 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 0 0 rgba(255, 255, 255, 0.2) inset';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(201, 169, 97, 0.25), 0 0 40px rgba(201, 169, 97, 0.10), 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 0 0 rgba(255, 255, 255, 0.15) inset';
              }}
            >
              AM
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </header>
  );
}
