import React from 'react'
import { Button } from '../ui/Button'

export interface Project {
  id: string
  title: string
  type: string
  status: 'active' | 'pending' | 'draft'
  scriptPages: number
  scenes: number
  shootDays: number
  progress: number
}

interface ProjectCardProps {
  project: Project
}

const statusColorMap: Record<Project['status'], { bg: string; glow: string; label: string }> = {
  active:  { bg: 'var(--status-active)',  glow: 'var(--status-active-glow)',  label: 'Active' },
  pending: { bg: 'var(--status-pending)', glow: 'var(--status-pending-glow)', label: 'Upcoming' },
  draft:   { bg: 'var(--status-draft)',   glow: 'var(--status-draft-glow)',   label: 'Draft' },
}

const typeBadgeColors: Record<string, { bg: string; text: string }> = {
  'Feature Film': { bg: 'rgba(193,154,78,0.12)', text: 'var(--gold-primary)' },
  'Series':       { bg: 'rgba(124,156,232,0.12)', text: '#7c9ce8' },
  'Commercial':   { bg: 'rgba(82,193,134,0.12)',  text: '#52c186' },
  'Music Video':  { bg: 'rgba(232,168,124,0.12)', text: '#e8a87c' },
}

const s = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: `all var(--duration-slow) var(--ease-out)`,
    minHeight: '320px',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
  },
  cardHover: {
    borderColor: 'var(--border-default)',
    boxShadow: 'var(--glow-medium)',
    transform: 'translateY(-4px)',
  },
  progressBar: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'var(--gold-muted)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--gold-primary), var(--gold-light))',
    transition: `width var(--duration-slow) var(--ease-out)`,
  },
  header: {
    padding: 'var(--space-6)',
    background: 'linear-gradient(135deg, rgba(193,154,78,0.06) 0%, transparent 100%)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  title: {
    fontFamily: 'var(--font-sans)',
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-2)',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  typeBadge: {
    fontFamily: 'var(--font-sans)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: 'var(--radius-full)',
    letterSpacing: '0.02em',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: 'var(--radius-full)',
  },
  statusLabel: {
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  body: {
    padding: 'var(--space-6)',
    flex: 1,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-5)',
  },
  statLabel: {
    fontFamily: 'var(--font-sans)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '2px',
  },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--gold-primary)',
  },
  footer: {
    padding: 'var(--space-4) var(--space-6)',
    background: 'rgba(0,0,0,0.15)',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  actions: {
    display: 'flex',
    gap: 'var(--space-2)',
  },
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const [hovered, setHovered] = React.useState(false)
  const statusConfig = statusColorMap[project.status]
  const typeColors = typeBadgeColors[project.type] || typeBadgeColors['Feature Film']

  return (
    <div
      style={{
        ...s.card,
        ...(hovered ? s.cardHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Progress bar */}
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${project.progress}%` }} />
      </div>

      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>{project.title}</div>
        <div style={s.meta}>
          <span
            style={{
              ...s.typeBadge,
              background: typeColors.bg,
              color: typeColors.text,
            }}
          >
            {project.type}
          </span>
          <div style={s.footerStatus}>
            <div
              style={{
                ...s.statusDot,
                background: statusConfig.bg,
                boxShadow: `0 0 8px ${statusConfig.glow}`,
              }}
            />
            <span style={s.statusLabel}>{statusConfig.label}</span>
          </div>
        </div>
      </div>

      {/* Body — stats */}
      <div style={s.body}>
        <div style={s.statsGrid}>
          <div>
            <div style={s.statLabel}>Script</div>
            <div style={s.statValue}>{project.scriptPages} pages</div>
          </div>
          <div>
            <div style={s.statLabel}>Scenes</div>
            <div style={s.statValue}>{project.scenes}</div>
          </div>
          <div>
            <div style={s.statLabel}>Days to Shoot</div>
            <div style={s.statValue}>{project.shootDays}</div>
          </div>
          <div>
            <div style={s.statLabel}>Progress</div>
            <div style={s.statValue}>{project.progress}%</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <div style={s.footerStatus}>
          <div
            style={{
              ...s.statusDot,
              background: statusConfig.bg,
              boxShadow: `0 0 8px ${statusConfig.glow}`,
            }}
          />
          <span style={s.statusLabel}>{statusConfig.label}</span>
        </div>
        <div style={s.actions}>
          {project.status === 'draft' ? (
            <>
              <Button variant="outline" size="sm">Setup</Button>
              <Button variant="ghost" size="sm">Import Script</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm">Edit</Button>
              <Button variant="danger" size="sm">Delete</Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---- Create New Project card ---- */

const newCardStyles = {
  card: {
    background: 'var(--bg-surface)',
    border: '2px dashed var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: '60px var(--space-6)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '320px',
    cursor: 'pointer',
    transition: `all var(--duration-slow) var(--ease-out)`,
  },
  cardHover: {
    borderColor: 'var(--gold-primary)',
    borderStyle: 'solid',
    background: 'var(--bg-elevated)',
    boxShadow: 'var(--glow-subtle)',
    transform: 'translateY(-4px)',
  },
  icon: {
    width: '56px',
    height: '56px',
    borderRadius: 'var(--radius-full)',
    border: '2px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 'var(--space-4)',
    transition: `all var(--duration-normal) var(--ease-out)`,
    color: 'var(--gold-primary)',
    fontSize: '1.5rem',
  },
  iconHover: {
    borderColor: 'var(--gold-primary)',
    background: 'var(--gold-muted)',
    boxShadow: 'var(--glow-subtle)',
  },
  label: {
    fontFamily: 'var(--font-sans)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-2)',
  },
  subtext: {
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
  },
}

export const CreateProjectCard: React.FC = () => {
  const [hovered, setHovered] = React.useState(false)

  return (
    <div
      style={{
        ...newCardStyles.card,
        ...(hovered ? newCardStyles.cardHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          ...newCardStyles.icon,
          ...(hovered ? newCardStyles.iconHover : {}),
        }}
      >
        +
      </div>
      <div style={newCardStyles.label}>Create New Project</div>
      <div style={newCardStyles.subtext}>Start your breakdown</div>
    </div>
  )
}
