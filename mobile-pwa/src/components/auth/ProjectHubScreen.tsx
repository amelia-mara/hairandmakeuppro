import { useAuthStore } from '@/stores/authStore';
import { Button, Card } from '@/components/ui';
import type { ProjectMembership } from '@/types';

export function ProjectHubScreen() {
  const {
    user,
    setScreen,
    signOut,
    projectMemberships,
    canCreateProjects,
    updateLastAccessed,
  } = useAuthStore();

  const sortedProjects = [...projectMemberships].sort(
    (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
  );

  const handleProjectClick = (project: ProjectMembership) => {
    updateLastAccessed(project.projectId);
    // This would navigate to the actual project
    // For now, just update last accessed
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'owner':
        return 'bg-gold-100 text-gold-800';
      case 'supervisor':
        return 'bg-blue-100 text-blue-800';
      case 'artist':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProductionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      film: 'Film',
      tv_series: 'TV Series',
      short_film: 'Short Film',
      commercial: 'Commercial',
      music_video: 'Music Video',
      other: 'Production',
    };
    return labels[type] || 'Production';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 safe-top border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Your Projects</h1>
            {user && (
              <p className="text-sm text-text-muted">{user.name}</p>
            )}
          </div>
          <button
            onClick={signOut}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-gray-100 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {sortedProjects.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              No projects yet
            </h2>
            <p className="text-text-secondary mb-8 max-w-xs">
              Join a project or create one to get started.
            </p>
          </div>
        ) : (
          // Project list
          <div className="space-y-3">
            {sortedProjects.map((project) => (
              <Card
                key={project.projectId}
                className="cursor-pointer hover:shadow-card-hover transition-shadow active:scale-[0.99]"
                onClick={() => handleProjectClick(project)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Project name */}
                    <h3 className="font-semibold text-text-primary truncate">
                      {project.projectName}
                    </h3>

                    {/* Production type */}
                    <p className="text-sm text-text-muted mb-2">
                      {getProductionTypeLabel(project.productionType)}
                    </p>

                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        {project.teamMemberCount}
                      </span>
                      <span>{formatRelativeTime(project.lastAccessedAt)}</span>
                    </div>
                  </div>

                  {/* Role badge */}
                  <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadgeColor(project.role)}`}>
                    {project.role}
                  </span>
                </div>

                {/* Chevron */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <svg
                    className="w-5 h-5 text-text-muted"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-4 py-4 pb-safe-bottom border-t border-border space-y-3">
        {canCreateProjects() && (
          <Button
            fullWidth
            size="lg"
            onClick={() => setScreen('create-project')}
          >
            Create Project
          </Button>
        )}
        <Button
          fullWidth
          size="lg"
          variant={canCreateProjects() ? 'outline' : 'primary'}
          onClick={() => setScreen('join')}
        >
          Join Project
        </Button>
      </div>
    </div>
  );
}
