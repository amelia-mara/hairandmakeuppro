import { useProjectStore } from '@/stores/projectStore';
import { Film, Tv, Clapperboard, Music, Video, Plus, FileText, DollarSign, Eye } from 'lucide-react';
import type { ProjectType } from '@/types';

const TYPE_ICONS: Record<ProjectType, typeof Film> = {
  'Feature Film': Film,
  'TV Series': Tv,
  'Commercial': Clapperboard,
  'Music Video': Music,
  'Short Film': Video,
};

interface ProjectHubProps {
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
}

export function ProjectHub({ onCreateProject, onSelectProject }: ProjectHubProps) {
  const projects = useProjectStore((s) => s.projects);

  // If projects exist, show project cards instead of hero
  if (projects.length > 0) {
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
            {projects.map((project) => {
              const Icon = TYPE_ICONS[project.type as ProjectType] || Film;
              return (
                <button
                  key={project.id}
                  className="project-card"
                  onClick={() => onSelectProject(project.id)}
                >
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
                  </div>
                </button>
              );
            })}

            {/* New project card */}
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
          </div>
          </div>
        </div>
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
          <button className="hub-hero-cta" onClick={onCreateProject}>
            Get Started Free
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
          <div className="hub-feature-icon hub-feature-icon--orange">
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
