import React from 'react'
import { Button } from '../ui/Button'

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 var(--space-8)',
    height: '64px',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'rgba(13,11,9,0.85)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  wordmark: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
    userSelect: 'none' as const,
    cursor: 'default',
  },
  prep: {
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    fontSize: '1.125rem',
    color: 'var(--text-primary)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  happy: {
    fontFamily: 'var(--font-display)',
    fontStyle: 'italic',
    fontWeight: 500,
    fontSize: '1.125rem',
    color: 'var(--gold-primary)',
    marginLeft: '4px',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-full)',
    background: 'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
    border: '1px solid var(--gold-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#0d0b09',
    cursor: 'pointer',
    transition: 'all var(--duration-normal) var(--ease-out)',
    boxShadow: 'var(--glow-subtle)',
  },
} satisfies Record<string, React.CSSProperties>

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
)

const SyncIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

export const TopBar: React.FC = () => {
  const [avatarHovered, setAvatarHovered] = React.useState(false)

  return (
    <header style={styles.header}>
      <div style={styles.wordmark}>
        <span style={styles.prep}>Prep</span>
        <span style={styles.happy}>Happy</span>
      </div>

      <div style={styles.rightSection}>
        <a
          href="https://checkshappy.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <Button variant="outline" size="sm" icon={<PhoneIcon />}>
            Open Checks Happy
          </Button>
        </a>

        <Button variant="ghost" size="sm" icon={<SyncIcon />}>
          Sync
        </Button>

        <div
          style={{
            ...styles.avatar,
            ...(avatarHovered
              ? { transform: 'scale(1.08)', boxShadow: 'var(--glow-medium)' }
              : {}),
          }}
          onMouseEnter={() => setAvatarHovered(true)}
          onMouseLeave={() => setAvatarHovered(false)}
        >
          JD
        </div>
      </div>
    </header>
  )
}
