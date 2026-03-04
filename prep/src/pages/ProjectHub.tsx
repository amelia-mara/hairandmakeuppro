import { useState } from 'react';
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

  const filterOptions = ['All', ...PROJECT_TYPES];

  const filtered = projects
    .filter((p) => {
      if (filter !== 'All') return p.type === filter;
      return true;
    })
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

  const activeCount = projects.filter((p) => p.status === 'active').length;
  const setupCount = projects.filter((p) => p.status === 'setup').length;

  return (
    <div className="animate-fade-in">
      {/* Dashboard Stats */}
      <div style={{ padding: '20px 40px 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div className="stat-card">
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Total Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{activeCount}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{setupCount}</div>
            <div className="stat-label">In Setup</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {projects.length > 0
                ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
                : 0}%
            </div>
            <div className="stat-label">Avg Progress</div>
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div
        style={{
          padding: '0 40px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {/* Search */}
        <div style={{ flex: '0 0 360px', minWidth: '200px' }}>
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
              className={`filter-btn ${filter === f ? 'active' : ''}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8125em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Sort:
          </span>
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
      <div style={{ padding: '0 40px 40px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {/* New Project Card */}
          <button className="new-project-card" onClick={onCreateProject}>
            <div className="icon-circle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent-gold)' }}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: '1em', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Create New Project
            </span>
            <span style={{ fontSize: '0.8125em', color: 'var(--text-secondary)' }}>
              Start your breakdown
            </span>
          </button>

          {/* Project Cards */}
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onSelectProject(project.id)}
              onDelete={() => deleteProject(project.id)}
            />
          ))}
        </div>

        {/* Empty search results */}
        {filtered.length === 0 && projects.length > 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '0.875em', color: 'var(--text-muted)' }}>
              No projects match your search
            </p>
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
      {/* Progress bar at top */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${project.progress}%` }} />
      </div>

      {/* Header */}
      <div className="project-card-header" style={{ cursor: 'pointer' }} onClick={onClick}>
        <h3 style={{ fontSize: '1.25em', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {project.title}
        </h3>
        <span style={{ fontSize: '0.8125em', color: 'var(--text-secondary)' }}>
          {project.type || 'Not Set'}
        </span>
      </div>

      {/* Body — stats grid */}
      <div className="project-card-body" style={{ cursor: 'pointer' }} onClick={onClick}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Script
            </div>
            <div style={{ fontSize: '1em', fontWeight: 600, color: 'var(--text-primary)' }}>
              {project.scriptFilename ? '...' : '\u2014'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Scenes
            </div>
            <div style={{ fontSize: '1em', fontWeight: 600, color: 'var(--text-primary)' }}>
              {project.scenes || 0}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Characters
            </div>
            <div style={{ fontSize: '1em', fontWeight: 600, color: 'var(--text-primary)' }}>
              {project.characters || 0}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Progress
            </div>
            <div style={{ fontSize: '1em', fontWeight: 700, color: 'var(--text-primary)' }}>
              {project.progress}%
            </div>
          </div>
        </div>

        {/* Date info */}
        <div style={{
          paddingTop: '12px',
          borderTop: '1px solid var(--glass-border)',
          fontSize: '0.8125em',
          color: 'var(--text-muted)',
        }}>
          {project.genre ? project.genre : 'No dates set'}
        </div>
      </div>

      {/* Footer */}
      <div className="project-card-footer">
        <div className={`status-dot ${project.status}`} />
        <span style={{ fontSize: '0.8125em', color: 'var(--text-secondary)', marginRight: 'auto' }}>
          {statusLabel}
        </span>
        <button className="btn-import" onClick={(e) => { e.stopPropagation(); }}>
          Import Script
        </button>
        <button className="btn-edit" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          Edit
        </button>
        <button className="btn-delete" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          Delete
        </button>
      </div>
    </div>
  );
}
