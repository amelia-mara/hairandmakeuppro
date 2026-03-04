export function TopBar() {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Title — muted, elegant, belongs to the glass world */}
        <h1 style={{
          fontSize: '0.8125rem',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: 'var(--text-muted)',
          margin: 0,
        }}>
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
              background: 'rgba(196, 172, 116, 0.05)',
              border: '1px solid var(--border-card)',
              borderRadius: '10px',
              color: 'var(--accent-gold)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              textDecoration: 'none',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
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

          {/* Avatar — THE SUN — intense radiance */}
          <div style={{ position: 'relative' }}>
            {/* Outermost soft halo — wide warm wash */}
            <div style={{
              position: 'absolute',
              inset: '-40px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(196, 172, 116, 0.08) 0%, rgba(196, 172, 116, 0.03) 40%, transparent 65%)',
              pointerEvents: 'none',
              filter: 'blur(12px)',
            }} />
            {/* Mid halo — visible warm ring */}
            <div style={{
              position: 'absolute',
              inset: '-20px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(196, 172, 116, 0.18) 0%, rgba(196, 172, 116, 0.06) 45%, transparent 70%)',
              pointerEvents: 'none',
              animation: 'pulse-glow 4s ease-in-out infinite',
            }} />
            {/* Inner corona — bright tight glow */}
            <div style={{
              position: 'absolute',
              inset: '-8px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(196, 172, 116, 0.25) 0%, rgba(196, 172, 116, 0.08) 50%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <button
              style={{
                position: 'relative',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #d9c88c 0%, #c4ac74 35%, #9f8845 100%)',
                border: '1.5px solid rgba(220, 198, 140, 0.55)',
                color: '#0c0a08',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: [
                  '0 0 20px rgba(196, 172, 116, 0.35)',
                  '0 0 50px rgba(196, 172, 116, 0.15)',
                  '0 0 80px rgba(196, 172, 116, 0.06)',
                  '0 2px 4px rgba(0, 0, 0, 0.3)',
                  '0 1px 0 0 rgba(252, 236, 200, 0.25) inset',
                ].join(', '),
                zIndex: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = [
                  '0 0 30px rgba(196, 172, 116, 0.45)',
                  '0 0 70px rgba(196, 172, 116, 0.20)',
                  '0 0 100px rgba(196, 172, 116, 0.10)',
                  '0 2px 4px rgba(0, 0, 0, 0.3)',
                  '0 1px 0 0 rgba(252, 236, 200, 0.30) inset',
                ].join(', ');
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = [
                  '0 0 20px rgba(196, 172, 116, 0.35)',
                  '0 0 50px rgba(196, 172, 116, 0.15)',
                  '0 0 80px rgba(196, 172, 116, 0.06)',
                  '0 2px 4px rgba(0, 0, 0, 0.3)',
                  '0 1px 0 0 rgba(252, 236, 200, 0.25) inset',
                ].join(', ');
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
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </header>
  );
}
