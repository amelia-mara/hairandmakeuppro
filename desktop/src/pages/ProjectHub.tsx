import React, { useState, useMemo } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { StatCard } from '../components/project/StatCard'
import { FilterPills } from '../components/project/FilterPills'
import { ProjectCard, CreateProjectCard } from '../components/project/ProjectCard'
import type { Project } from '../components/project/ProjectCard'

/* ──────────────────────────────────────────
   Mock data — 3 projects matching the spec
   ────────────────────────────────────────── */
const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'The Last Light',
    type: 'Feature Film',
    status: 'active',
    scriptPages: 118,
    scenes: 94,
    shootDays: 32,
    progress: 68,
  },
  {
    id: '2',
    title: 'Neon Nights',
    type: 'Series',
    status: 'active',
    scriptPages: 64,
    scenes: 42,
    shootDays: 18,
    progress: 45,
  },
  {
    id: '3',
    title: 'Bloom Fragrance',
    type: 'Commercial',
    status: 'pending',
    scriptPages: 8,
    scenes: 12,
    shootDays: 3,
    progress: 15,
  },
]

const FILTERS = [
  'All',
  'Feature Film',
  'Series',
  'Commercial',
  'Music Video',
  'Verticals',
]

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'progress', label: 'Progress' },
]

/* ──────────────────────────────────────────
   Page styles
   ────────────────────────────────────────── */
const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  content: {
    padding: 'var(--space-7) var(--space-8)',
    flex: 1,
    maxWidth: '1600px',
    width: '100%',
    margin: '0 auto',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-7)',
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-7)',
    flexWrap: 'wrap' as const,
  },
  searchSection: {
    flex: '0 0 320px',
    minWidth: '200px',
  },
  searchInput: {
    width: '100%',
    padding: '10px 16px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.875rem',
    transition: `all var(--duration-normal) var(--ease-out)`,
    outline: 'none',
  },
  filtersSection: {
    flex: 1,
    overflow: 'hidden',
  },
  sortSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  sortLabel: {
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap' as const,
  },
  sortSelect: {
    padding: '10px 16px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    outline: 'none',
    transition: `all var(--duration-normal) var(--ease-out)`,
  },
  projectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 'var(--space-5)',
  },
}

/* ──────────────────────────────────────────
   Component
   ────────────────────────────────────────── */
export const ProjectHub: React.FC = () => {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [sort, setSort] = useState('recent')
  const [searchFocused, setSearchFocused] = useState(false)

  const filteredProjects = useMemo(() => {
    let list = MOCK_PROJECTS

    // Filter by type
    if (activeFilter !== 'All') {
      list = list.filter((p) => p.type === activeFilter)
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.title.toLowerCase().includes(q))
    }

    // Sort
    if (sort === 'name') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    } else if (sort === 'progress') {
      list = [...list].sort((a, b) => b.progress - a.progress)
    }

    return list
  }, [search, activeFilter, sort])

  // Compute stats from all projects (unfiltered)
  const stats = useMemo(() => {
    const total = MOCK_PROJECTS.length
    const active = MOCK_PROJECTS.filter((p) => p.status === 'active').length
    const upcoming = MOCK_PROJECTS.filter((p) => p.status === 'pending').length
    const avgProgress = Math.round(
      MOCK_PROJECTS.reduce((sum, p) => sum + p.progress, 0) / total
    )
    return { total, active, upcoming, avgProgress }
  }, [])

  return (
    <div style={s.page}>
      <TopBar />

      <main style={s.content}>
        {/* Stat cards */}
        <div style={s.statsRow}>
          <StatCard value={stats.total} label="Total Projects" />
          <StatCard value={stats.active} label="Active" />
          <StatCard value={stats.upcoming} label="Upcoming Shoots" />
          <StatCard value={`${stats.avgProgress}%`} label="Avg Progress" />
        </div>

        {/* Search + Filters + Sort */}
        <div style={s.controlsRow}>
          <div style={s.searchSection}>
            <input
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...s.searchInput,
                ...(searchFocused
                  ? {
                      borderColor: 'var(--gold-primary)',
                      background: 'var(--bg-elevated)',
                      boxShadow: '0 0 0 1px var(--gold-border), var(--glow-subtle)',
                    }
                  : {}),
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>

          <div style={s.filtersSection}>
            <FilterPills
              filters={FILTERS}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          </div>

          <div style={s.sortSection}>
            <span style={s.sortLabel}>Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={s.sortSelect}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Project grid */}
        <div style={s.projectGrid}>
          <CreateProjectCard />
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </main>
    </div>
  )
}
