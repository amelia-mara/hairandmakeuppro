import React from 'react'

interface StatCardProps {
  value: string | number
  label: string
}

const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    transition: `all var(--duration-normal) var(--ease-out)`,
    cursor: 'default',
  },
  cardHover: {
    borderColor: 'var(--border-default)',
    boxShadow: 'var(--glow-subtle)',
  },
  value: {
    fontFamily: 'var(--font-display)',
    fontSize: '2rem',
    fontWeight: 600,
    color: 'var(--gold-primary)',
    lineHeight: 1.1,
    marginBottom: 'var(--space-1)',
  },
  label: {
    fontFamily: 'var(--font-sans)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
} satisfies Record<string, React.CSSProperties>

export const StatCard: React.FC<StatCardProps> = ({ value, label }) => {
  const [hovered, setHovered] = React.useState(false)

  return (
    <div
      style={{
        ...styles.card,
        ...(hovered ? styles.cardHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.value}>{value}</div>
      <div style={styles.label}>{label}</div>
    </div>
  )
}
