import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { deleteProjectFromSupabase } from '@/services/projectService';
import { Film, Tv, Clapperboard, Music, Video, Plus, FileText, DollarSign, Eye, Trash2 } from 'lucide-react';
import type { ProjectType } from '@/types';

const TYPE_ICONS: Record<ProjectType, typeof Film> = {
  'Feature Film': Film,
  'TV Series': Tv,
  'Commercial': Clapperboard,
  'Music Video': Music,
  'Short Film': Video,
};

function formatCardDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

interface ProjectHubProps {
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
  onNavigateToAuth?: () => void;
}

export function ProjectHub({ onCreateProject, onSelectProject, onNavigateToAuth }: ProjectHubProps) {
  const projects = useProjectStore((s) => s.projects);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  // Newest first — keeps the most recent project sitting next to the
  // "+ New Project" card. createdAt is an ISO timestamp so the
  // lexicographic sort is correct; falls back to lastActive when
  // createdAt is missing on legacy entries.
  const sortedProjects = useMemo(() => {
    const ts = (p: typeof projects[number]) => p.createdAt || p.lastActive || '';
    return [...projects].sort((a, b) => ts(b).localeCompare(ts(a)));
  }, [projects]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setDeleteConfirm({ id, title });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const { error } = await deleteProjectFromSupabase(deleteConfirm.id);
    if (error) {
      console.error('Failed to delete from Supabase:', error);
    }
    deleteProject(deleteConfirm.id);
    setDeleting(false);
    setDeleteConfirm(null);
  };

  // If authenticated and projects exist, show project cards instead of hero
  if (isAuthenticated && projects.length > 0) {
    return (
      <div className="animate-fade-in">
        <div className="hub-projects">
          {/* Rainbow swirl decoration — same as hero */}
          <div className="hub-hero-rainbow hub-projects-rainbow">
            <div className="rainbow-ring rainbow-ring--1" />
            <div className="rainbow-ring rainbow-ring--2" />
            <div className="rainbow-ring rainbow-ring--3" />
          </div>

          <div className="hub-projects-board">
            <div className="hub-projects-header">
              <h2 className="hub-projects-title">
                <span className="heading-italic">Your</span>{' '}
                <span className="heading-regular">Projects</span>
              </h2>
            </div>

            <div className="hub-projects-grid">
            {/* New project card — first */}
            <button className="new-project-card" onClick={onCreateProject}>
              <div className="icon-circle">
                <Plus size={22} style={{ color: '#fff' }} />
              </div>
              <span style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>
                New Project
              </span>
            </button>

            {sortedProjects.map((project) => {
              const Icon = TYPE_ICONS[project.type as ProjectType] || Film;
              return (
                <button
                  key={project.id}
                  className="project-card"
                  onClick={() => onSelectProject(project.id)}
                >
                  {/* Delete button */}
                  <div
                    className="project-card-delete"
                    onClick={(e) => handleDeleteClick(e, project.id, project.title)}
                    role="button"
                    tabIndex={0}
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </div>

                  <div className="project-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <div className="project-card-icon">
                        <Icon size={16} />
                      </div>
                      <span className="project-card-type">{project.type}</span>
                    </div>
                    <h3 className="project-card-title">{project.title}</h3>
                    {project.genre && (
                      <span className="project-card-genre">{project.genre}</span>
                    )}
                  </div>

                  <div className="project-card-body">
                    <div className="project-card-stats">
                      <div className="project-card-stat">
                        <span className="project-card-stat-value">{project.scenes}</span>
                        <span className="project-card-stat-label">Scenes</span>
                      </div>
                      <div className="project-card-stat">
                        <span className="project-card-stat-value">{project.characters}</span>
                        <span className="project-card-stat-label">Characters</span>
                      </div>
                    </div>
                    <div className="progress-bar-track" style={{ marginTop: '16px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="project-card-footer">
                    <span className={`status-dot ${project.status}`} />
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      textTransform: 'capitalize',
                    }}>
                      {project.status}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '2px',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        lineHeight: 1.3,
                        textAlign: 'right',
                      }}
                    >
                      <span>Created {formatCardDate(project.createdAt)}</span>
                      <span>Updated {formatCardDate(project.lastActive)}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="modal-backdrop" onClick={() => !deleting && setDeleteConfirm(null)}>
            <div className="modal-glass" onClick={(e) => e.stopPropagation()} style={{ padding: '28px 32px' }}>
              <h3 style={{
                margin: '0 0 12px',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--text-heading)',
              }}>
                Delete Project
              </h3>
              <p style={{
                margin: '0 0 24px',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                Are you sure you want to delete <strong>{deleteConfirm.title}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  className="btn-ghost"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="btn-action-danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                  style={{
                    background: 'var(--brand-terracotta, #C4522A)',
                    color: '#fff',
                    borderColor: 'var(--brand-terracotta, #C4522A)',
                    fontWeight: 600,
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Welcome hero — no projects yet
  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div className="hub-hero">
        {/* Rainbow swirl decoration */}
        <div className="hub-hero-rainbow">
          <div className="rainbow-ring rainbow-ring--1" />
          <div className="rainbow-ring rainbow-ring--2" />
          <div className="rainbow-ring rainbow-ring--3" />
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
          <button
            className="hub-hero-cta"
            onClick={isAuthenticated ? onCreateProject : onNavigateToAuth}
          >
            {isAuthenticated ? 'Create a Project' : 'Get Started'}
          </button>
        </div>
      </div>

      {/* Features Section */}
      <div className="hub-features">
        <div className="hub-feature-card">
          <div className="hub-feature-icon hub-feature-icon--orange">
            <FileText size={16} />
          </div>
          <h3 className="hub-feature-title">Script Breakdowns</h3>
          <p className="hub-feature-desc">
            Automatic scene identification that reduces a 15-hour manual process to under 2 hours.
          </p>
        </div>

        <div className="hub-feature-card">
          <div className="hub-feature-icon hub-feature-icon--yellow">
            <DollarSign size={16} />
          </div>
          <h3 className="hub-feature-title">Budget &amp; Timesheet Tracking</h3>
          <p className="hub-feature-desc">
            Real-time spend tracking with receipt scanning and automatic expense logging. Track your hours and export timesheets and invoices.
          </p>
        </div>

        <div className="hub-feature-card">
          <div className="hub-feature-icon hub-feature-icon--teal">
            <Eye size={16} />
          </div>
          <h3 className="hub-feature-title">Continuity</h3>
          <p className="hub-feature-desc">
            Track every look, every scene, every character. Never lose a continuity note again.
          </p>
        </div>
      </div>

    </div>
  );
}
