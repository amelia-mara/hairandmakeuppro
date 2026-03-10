import { useState, useRef } from 'react';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { PROJECT_TYPES } from '@/types';

interface ProjectHubProps {
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
}

export function ProjectHub({ onCreateProject, onSelectProject }: ProjectHubProps) {
  const projects = useProjectStore((s) => s.projects);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Newest First');
  const gridRef = useRef<HTMLDivElement>(null);

  const filterOptions = ['All', ...PROJECT_TYPES];

  const filtered = projects
    .filter((p) => filter === 'All' || p.type === filter)
    .filter(
      (p) =>
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.genre.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === 'Newest First') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'Oldest First') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === 'A-Z') return a.title.localeCompare(b.title);
      return 0;
    });


  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div className="hub-hero">
        {/* Rainbow swirl decoration */}
        <div className="hub-hero-rainbow">
          <div className="rainbow-ring rainbow-ring--1" />
          <div className="rainbow-ring rainbow-ring--2" />
          <div className="rainbow-ring rainbow-ring--3" />
          <div className="rainbow-ring rainbow-ring--4" />
          <div className="rainbow-ring rainbow-ring--5" />
        </div>

        <div className="hub-hero-content">
          <span className="hub-hero-badge">FOR FILM AND TV DEPARTMENTS</span>
          <h2 className="hub-hero-heading">
            Manage the Magic<br />
            <em>Behind the Camera.</em>
          </h2>
          <p className="hub-hero-subtitle">
            Continuity tracking, script breakdowns, budgets, and timesheets.
            Everything your department needs, beautifully organised.
          </p>
          <button className="hub-hero-cta" onClick={onCreateProject}>
            Get Started
          </button>
        </div>
      </div>

      {/* Controls Row */}
      <div style={{ padding: '20px 40px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
        {/* Search */}
        <div style={{ flex: '0 0 340px', minWidth: '200px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="input-field"
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1 }}>
          {filterOptions.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-pill ${filter === f ? 'active' : ''}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-label)', whiteSpace: 'nowrap' }}>Sort:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="select-field"
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option>Newest First</option>
            <option>Oldest First</option>
            <option>A-Z</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div style={{ padding: '0 40px 48px' }}>
        <div
          ref={gridRef}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Create New Project */}
          <button className="new-project-card" onClick={onCreateProject}>
            <div className="icon-circle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent-gold)' }}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-heading)', marginBottom: '4px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
              <span className="heading-italic">Create</span>{' '}
              <span className="heading-regular">New Project</span>
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Start your script
            </span>
          </button>

          {/* Project cards */}
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onSelectProject(project.id)}
              onDelete={() => deleteProject(project.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && projects.length > 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No projects match your search</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
  onDelete,
}: {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}) {
  const statusLabel = project.status === 'active' ? 'Active' : project.status === 'setup' ? 'Setup' : 'Wrapped';

  return (
    <div className="project-card">
      {/* Header */}
      <div className="project-card-header" style={{ cursor: 'pointer' }} onClick={onClick}>
        <h3 className="project-card-name" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '6px', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          {project.title}
        </h3>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {project.type || 'Not Set'}
        </span>
      </div>

      {/* Body */}
      <div className="project-card-body" style={{ cursor: 'pointer' }} onClick={onClick}>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 16px', marginBottom: '20px' }}>
          <StatItem label="Script" value={project.scriptFilename ? 'Uploaded' : '\u2014'} />
          <StatItem label="Scenes" value={String(project.scenes || 0)} />
          <StatItem label="Characters" value={String(project.characters || 0)} />
          <StatItem label="Progress" value={`${project.progress}%`} bold />
        </div>

        {/* Progress bar */}
        <div className="progress-bar-track" style={{ marginBottom: '16px' }}>
          <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
        </div>

        {/* Date / Genre */}
        <div style={{
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
        }}>
          {project.genre || 'No dates set'}
        </div>
      </div>

      {/* Footer */}
      <div className="project-card-footer">
        <div className={`status-dot ${project.status}`} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>
          {statusLabel}
        </span>
        <button className="btn-action-gold" onClick={(e) => { e.stopPropagation(); }}>
          Import Script
        </button>
        <button className="btn-action" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          Edit
        </button>
        <button className="btn-action-danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          Delete
        </button>
      </div>
    </div>
  );
}

function StatItem({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        color: 'var(--text-muted)',
        marginBottom: '6px',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.125rem',
        fontWeight: bold ? 700 : 600,
        color: 'var(--text-primary)',
      }}>
        {value}
      </div>
    </div>
  );
}
