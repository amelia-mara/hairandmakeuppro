import { useState } from 'react';
import { Plus, Search, Folder, Clock, MoreHorizontal } from 'lucide-react';
import { useProjectStore, type Project } from '@/stores/projectStore';

interface ProjectHubProps {
  onCreateProject: () => void;
  onSelectProject: (id: string) => void;
}

export function ProjectHub({ onCreateProject, onSelectProject }: ProjectHubProps) {
  const projects = useProjectStore((s) => s.projects);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'wrapped'>('all');

  const filtered = projects
    .filter((p) => {
      if (filter === 'active') return p.status !== 'wrapped';
      if (filter === 'wrapped') return p.status === 'wrapped';
      return true;
    })
    .filter(
      (p) =>
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.genre.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="min-h-[calc(100vh-4rem)] px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-primary)',
              }}
            >
              Projects
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {projects.length} production{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={onCreateProject}
            className="btn-gold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        {/* Search and filters */}
        {projects.length > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="input-field pl-9 py-2.5 text-sm"
              />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'active', 'wrapped'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-4 py-2 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    backgroundColor:
                      filter === f ? 'var(--gold-muted)' : 'transparent',
                    color:
                      filter === f
                        ? 'var(--gold-primary)'
                        : 'var(--text-muted)',
                    border: `1px solid ${
                      filter === f
                        ? 'var(--gold-border)'
                        : 'var(--border-subtle)'
                    }`,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Projects grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* New Project card */}
            <button
              onClick={onCreateProject}
              className="flex flex-col items-center justify-center min-h-[220px] rounded-[14px] transition-all"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px dashed var(--border-default)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--gold-border)';
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ border: '1px solid var(--border-default)' }}
              >
                <Plus size={20} style={{ color: 'var(--gold-primary)' }} />
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                New Project
              </span>
            </button>

            {/* Existing projects */}
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onSelectProject(project.id)}
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onCreateProject={onCreateProject} />
        ) : (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
}: {
  project: Project;
  onClick: () => void;
}) {
  const timeAgo = getTimeAgo(project.lastActive);

  return (
    <button
      onClick={onClick}
      className="text-left rounded-[14px] overflow-hidden transition-all group"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--gold-border)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-gold)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
    >
      {/* Top section with gradient */}
      <div
        className="relative h-28 flex items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)',
        }}
      >
        <Folder
          size={32}
          style={{ color: 'var(--gold-primary)', opacity: 0.6 }}
        />
        <div className="absolute top-3 right-3">
          <MoreHorizontal
            size={16}
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
        {/* Progress bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: 'var(--border-subtle)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${project.progress}%`,
              background:
                'linear-gradient(90deg, var(--gold-primary), var(--gold-light))',
            }}
          />
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <h3
          className="font-semibold text-sm mb-1 truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {project.title}
        </h3>
        <p
          className="text-xs mb-3 truncate"
          style={{ color: 'var(--text-muted)' }}
        >
          {project.genre || project.type}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {timeAgo}
            </span>
          </div>
          <span
            className="text-[11px] font-medium"
            style={{ color: 'var(--gold-primary)' }}
          >
            {project.progress}%
          </span>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in-up">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{
          backgroundColor: 'var(--gold-muted)',
          border: '1px solid var(--gold-border)',
        }}
      >
        <Folder size={36} style={{ color: 'var(--gold-primary)' }} />
      </div>
      <h2
        className="text-xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
      >
        No projects yet
      </h2>
      <p
        className="text-sm mb-6 text-center max-w-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        Create your first project to get started with script breakdowns,
        character management, and continuity tracking.
      </p>
      <button
        onClick={onCreateProject}
        className="btn-gold px-8 py-3 rounded-lg text-sm flex items-center gap-2"
      >
        <Plus size={16} />
        Create First Project
      </button>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
