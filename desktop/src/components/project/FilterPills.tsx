import React from 'react'

interface FilterPillsProps {
  filters: string[]
  activeFilter: string
  onFilterChange: (filter: string) => void
}

const styles = {
  container: {
    display: 'flex',
    gap: 'var(--space-2)',
    overflow: 'hidden',
  },
  pill: {
    padding: '8px 18px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: `all var(--duration-normal) var(--ease-out)`,
    lineHeight: 1,
  },
  pillActive: {
    background: 'linear-gradient(135deg, var(--gold-primary), var(--gold-light))',
    borderColor: 'rgba(193,154,78,0.4)',
    color: '#0d0b09',
    boxShadow: 'var(--glow-medium)',
  },
  pillHover: {
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
  },
} satisfies Record<string, React.CSSProperties>

export const FilterPills: React.FC<FilterPillsProps> = ({
  filters,
  activeFilter,
  onFilterChange,
}) => {
  const [hoveredFilter, setHoveredFilter] = React.useState<string | null>(null)

  return (
    <div style={styles.container}>
      {filters.map((filter) => {
        const isActive = filter === activeFilter
        const isHovered = filter === hoveredFilter && !isActive

        return (
          <button
            key={filter}
            style={{
              ...styles.pill,
              ...(isActive ? styles.pillActive : {}),
              ...(isHovered ? styles.pillHover : {}),
            }}
            onClick={() => onFilterChange(filter)}
            onMouseEnter={() => setHoveredFilter(filter)}
            onMouseLeave={() => setHoveredFilter(null)}
          >
            {filter}
          </button>
        )
      })}
    </div>
  )
}
