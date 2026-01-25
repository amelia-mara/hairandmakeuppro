import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Badge } from '@/components/ui';
import { ProjectCard, EmptyState, UpgradeModal, QuickAccessBar } from '@/components/dashboard';
import type { ProjectMembership } from '@/types';
import { getTierById } from '@/types/subscription';
import type { SubscriptionTier } from '@/types/subscription';

export function ProjectHubScreen() {
  const {
    user,
    setScreen,
    signOut,
    projectMemberships,
    canCreateProjects,
    updateLastAccessed,
  } = useAuthStore();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Sort projects by last accessed (most recent first)
  const sortedProjects = [...projectMemberships].sort(
    (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
  );

  // Get the most recently accessed project (active project)
  const activeProject = sortedProjects.length > 0 ? sortedProjects[0] : null;

  // Get user's tier info
  const tierInfo = user ? getTierById(user.tier as SubscriptionTier) : null;

  const handleProjectOpen = (project: ProjectMembership) => {
    updateLastAccessed(project.projectId);
    // In a real app, this would navigate to the project
    // For now, just update last accessed
  };

  const handleCreateClick = () => {
    if (canCreateProjects()) {
      setScreen('create-project');
    } else {
      setShowUpgradeModal(true);
    }
  };

  const handleUpgrade = () => {
    setShowUpgradeModal(false);
    setScreen('select-plan');
  };

  // Generate user initials for avatar
  const getUserInitials = (): string => {
    if (!user?.name) return '?';
    const parts = user.name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 safe-top border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Your Projects</h1>
            {tierInfo && (
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={tierInfo.isPremium ? 'gold' : 'default'}
                  size="sm"
                >
                  {tierInfo.displayName}
                </Badge>
              </div>
            )}
          </div>

          {/* User avatar */}
          <button
            onClick={() => setScreen('select-plan')}
            className="flex items-center gap-2"
          >
            <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-white font-semibold text-sm">
              {getUserInitials()}
            </div>
          </button>
        </div>
      </header>

      {/* Quick access bar for active project */}
      {activeProject && sortedProjects.length > 1 && (
        <QuickAccessBar
          project={activeProject}
          onReturn={() => handleProjectOpen(activeProject)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {sortedProjects.length === 0 ? (
          // Empty state
          <EmptyState
            canCreate={canCreateProjects()}
            onJoinClick={() => setScreen('join')}
            onCreateClick={handleCreateClick}
          />
        ) : (
          // Project list
          <div className="space-y-4">
            {/* Primary actions */}
            <div className="flex gap-3 mb-6">
              <Button
                fullWidth
                size="md"
                variant="primary"
                onClick={handleCreateClick}
              >
                Create Project
              </Button>
              <Button
                fullWidth
                size="md"
                variant="outline"
                onClick={() => setScreen('join')}
              >
                Join Project
              </Button>
            </div>

            {/* Project cards */}
            {sortedProjects.map((project, index) => (
              <ProjectCard
                key={project.projectId}
                project={project}
                isActive={index === 0} // First project is most recently accessed
                onOpen={() => handleProjectOpen(project)}
                onSettings={
                  (project.role === 'owner' || project.role === 'supervisor')
                    ? () => {
                        // Navigate to project settings
                        console.log('Project settings for:', project.projectId);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Sign out link */}
      <div className="px-4 py-4 pb-safe-bottom border-t border-border">
        <button
          onClick={signOut}
          className="w-full text-center text-sm text-text-muted hover:text-text-secondary"
        >
          Sign Out
        </button>
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}
