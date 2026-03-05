import { useState, useRef, useEffect } from 'react';

interface TopBarProps {
  title?: string;
  onBack?: () => void;
  activePage?: string;
  onNavigate?: (page: string) => void;
  projectType?: string;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  { id: 'breakdown', label: 'Breakdown', icon: BreakdownIcon },
  { id: 'continuity', label: 'Continuity', icon: ContinuityIcon },
  { id: 'budget', label: 'Budget', icon: BudgetIcon },
  { id: 'schedule', label: 'Schedule', icon: ScheduleIcon },
  { id: 'crew', label: 'Crew', icon: CrewIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function TopBar({ title = 'Projects', onBack, activePage, onNavigate, projectType }: TopBarProps) {
  const [navOpen, setNavOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!navOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setNavOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [navOpen]);

  const activeLabel = NAV_ITEMS.find((i) => i.id === activePage)?.label;

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left side — back + title + nav dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              className="topbar-back-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
          )}
          <h1 style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'var(--text-muted)',
            margin: 0,
          }}>
            {title}
          </h1>

          {/* Nav dropdown trigger — only in project view */}
          {activePage && onNavigate && (
            <div ref={dropRef} style={{ position: 'relative' }}>
              {/* Separator dot */}
              <span style={{
                display: 'inline-block',
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                background: 'var(--text-muted)',
                marginRight: '12px',
                verticalAlign: 'middle',
                opacity: 0.5,
              }} />

              {projectType && (
                <>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    opacity: 0.6,
                    marginRight: '10px',
                  }}>
                    {projectType}
                  </span>
                  <span style={{
                    display: 'inline-block',
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    background: 'var(--text-muted)',
                    marginRight: '10px',
                    verticalAlign: 'middle',
                    opacity: 0.35,
                  }} />
                </>
              )}

              <button
                className="topbar-nav-trigger"
                onClick={() => setNavOpen(!navOpen)}
              >
                <span>{activeLabel}</span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    transition: 'transform 0.2s ease',
                    transform: navOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>

              {/* Dropdown */}
              {navOpen && (
                <div className="topbar-nav-dropdown">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      className={`topbar-nav-item ${activePage === item.id ? 'active' : ''}`}
                      onClick={() => {
                        onNavigate(item.id);
                        setNavOpen(false);
                      }}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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

/* ━━━ SVG Icons ━━━ */

function DashboardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1"/>
      <rect x="14" y="3" width="7" height="5" rx="1"/>
      <rect x="14" y="12" width="7" height="9" rx="1"/>
      <rect x="3" y="16" width="7" height="5" rx="1"/>
    </svg>
  );
}

function BreakdownIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
      <path d="M14 2v6h6"/>
      <path d="M16 13H8M16 17H8M10 9H8"/>
    </svg>
  );
}

function ContinuityIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h8M4 18V6a2 2 0 0 1 2-2h8.5L20 9.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/>
      <path d="M14 2v6h6"/>
    </svg>
  );
}

function BudgetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function CrewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  );
}
