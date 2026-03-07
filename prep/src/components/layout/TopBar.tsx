import { useState, useRef, useEffect, useCallback } from 'react';

interface TopBarProps {
  title?: string;
  activePage?: string;
  onNavigate?: (page: string) => void;
  projectType?: string;
}

function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('prep-theme') || 'gold'; } catch { return 'gold'; }
  });
  const setTheme = useCallback((t: string) => {
    setThemeState(t);
    if (t === 'gold') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
    try { localStorage.setItem('prep-theme', t); } catch { /* ignore */ }
  }, []);
  /* Apply on mount */
  useEffect(() => {
    if (theme !== 'gold') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { theme, setTheme };
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

export function TopBar({ title = 'Projects', activePage, onNavigate, projectType }: TopBarProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  // Close nav on outside click
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

  // Close account on outside click
  useEffect(() => {
    if (!accountOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [accountOpen]);

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left side — title + subtitle + nav arrow, aligned with scene list */}
        <div ref={dropRef} className="topbar-title-group">
          <div className="topbar-title-row">
            <h1 className="topbar-title" title={title}>
              {title}
            </h1>
            {activePage && activePage !== 'dashboard' && onNavigate && (
              <button
                className="topbar-nav-arrow"
                onClick={() => setNavOpen(!navOpen)}
                aria-label="Open navigation"
              >
                <svg
                  width="10" height="10" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    transition: 'transform 0.2s ease',
                    transform: navOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            )}
          </div>
          {projectType && (
            <span className="topbar-subtitle">{projectType}</span>
          )}

          {navOpen && onNavigate && (
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

        <div ref={accountRef} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Avatar — THE SUN */}
          <div className="avatar-wrap">
            <div className="avatar-halo avatar-halo--outer" />
            <div className="avatar-halo avatar-halo--mid" />
            <div className="avatar-halo avatar-halo--inner" />
            <button className="avatar-btn" onClick={() => setAccountOpen(!accountOpen)}>AK</button>
          </div>

          {accountOpen && (
            <div className="account-panel">
              <div className="account-panel-scroll">
                {/* Profile card */}
                <div className="account-card">
                  <div className="account-profile">
                    <div className="account-avatar">AK</div>
                    <div className="account-info">
                      <div className="account-name">Amelia Kildear</div>
                      <div className="account-email">amelia-mara@outlook.com</div>
                      <span className="account-badge">Beta Tester</span>
                    </div>
                  </div>
                  <div className="account-divider" />
                  <button className="account-edit-btn" onClick={() => console.log('Edit profile')}>Edit Profile</button>
                </div>

                {/* Account Settings */}
                <div className="account-section-label">Account Settings</div>
                <div className="account-card">
                  <button className="account-row" onClick={() => console.log('Reset password')}>
                    <div className="account-row-icon"><LockIcon /></div>
                    <div className="account-row-text">
                      <span className="account-row-title">Reset Password</span>
                      <span className="account-row-desc">Send password reset email</span>
                    </div>
                    <ChevronRight />
                  </button>
                  <div className="account-divider" />
                  <button className="account-row" onClick={() => console.log('Billing')}>
                    <div className="account-row-icon"><BillingIcon /></div>
                    <div className="account-row-text">
                      <span className="account-row-title">Billing & Bank Details</span>
                      <span className="account-row-desc">For timesheets and invoices</span>
                    </div>
                    <ChevronRight />
                  </button>
                </div>

                {/* Beta Access */}
                <div className="account-section-label">Beta Access</div>
                <div className="account-card">
                  <div className="account-row account-row--static">
                    <div className="account-row-icon account-row-icon--accent"><BetaIcon /></div>
                    <div className="account-row-text">
                      <span className="account-row-title">Full Access Enabled</span>
                      <span className="account-row-desc">Thank you for beta testing!</span>
                    </div>
                  </div>
                </div>

                {/* Appearance */}
                <div className="account-section-label">Appearance</div>
                <div className="account-card">
                  <div className="account-theme-header">
                    <span className="account-row-title">Theme</span>
                    <span className="account-theme-current">{theme === 'gold' ? 'Gold' : theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
                  </div>
                  <div className="account-theme-grid">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        className={`account-theme-opt ${theme === t.id ? 'account-theme-opt--active' : ''}`}
                        onClick={() => setTheme(t.id)}
                      >
                        <t.icon />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sign out */}
                <button className="account-signout" onClick={() => console.log('Sign out')}>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}

/* ━━━ Theme options ━━━ */
const THEMES = [
  { id: 'gold', label: 'Gold', icon: ThemeGoldIcon },
  { id: 'silver', label: 'Silver', icon: ThemeSilverIcon },
  { id: 'teal', label: 'Teal', icon: ThemeTealIcon },
  { id: 'rose', label: 'Rose', icon: ThemeRoseIcon },
  { id: 'ice', label: 'Ice', icon: ThemeIceIcon },
];

/* ━━━ Account panel icons ━━━ */

function LockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
}

function BillingIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
}

function BetaIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}

function ChevronRight() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>;
}

function ThemeGoldIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
}

function ThemeSilverIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}

function ThemeTealIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>;
}

function ThemeRoseIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
}

function ThemeIceIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>;
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
