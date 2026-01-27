import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { Button, Badge } from '@/components/ui';
import { ProjectCard, EmptyState, UpgradeModal, QuickAccessBar } from '@/components/dashboard';
import type { ProjectMembership, Project } from '@/types';
import { getTierById } from '@/types/subscription';
import type { SubscriptionTier } from '@/types/subscription';

// Sync Project Modal component
function SyncProjectModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold text-text-primary mb-2">
          Sync with Desktop
        </h3>
        <p className="text-text-secondary text-sm mb-6">
          Connect to your desktop project to sync data between devices. This feature is coming soon.
        </p>

        <div className="p-4 bg-gold-50 border border-gold-200 rounded-xl mb-6">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-gold"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gold-800">
                To sync, you'll need to be logged into the same account on the desktop app.
              </p>
            </div>
          </div>
        </div>

        <Button
          fullWidth
          variant="primary"
          onClick={onClose}
        >
          Got it
        </Button>
      </div>
    </div>
  );
}

// Delete Project Confirmation Modal
function DeleteProjectModal({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isOwner,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
  isOwner: boolean;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  const title = isOwner ? 'Delete Project' : 'Leave Project';
  const description = isOwner
    ? `Are you sure you want to delete "${projectName}"? This will permanently remove the project and all its data for all team members. This action cannot be undone.`
    : `Are you sure you want to leave "${projectName}"? You will lose access to this project and will need a new invite code to rejoin.`;
  const confirmText = isOwner ? 'Delete Project' : 'Leave Project';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold text-text-primary mb-2">
          {title}
        </h3>
        <p className="text-text-secondary text-sm mb-6">
          {description}
        </p>

        {isOwner && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-red-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-red-800">
                  Warning: All scenes, characters, looks, and photos will be permanently deleted.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            fullWidth
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="primary"
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper to create a mock project from membership data
// In production, this would fetch the full project from the server
function createProjectFromMembership(membership: ProjectMembership): Project {
  return {
    id: membership.projectId,
    name: membership.projectName,
    createdAt: membership.joinedAt,
    updatedAt: membership.lastAccessedAt,
    scenes: [], // Would be loaded from server
    characters: [],
    looks: [],
  };
}

export function ProjectHubScreen() {
  const {
    user,
    setScreen,
    goBack,
    signOut,
    projectMemberships,
    canCreateProjects,
    updateLastAccessed,
    hasCompletedOnboarding,
    deleteProject,
    leaveProject,
    isLoading,
  } = useAuthStore();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [deleteModalProject, setDeleteModalProject] = useState<ProjectMembership | null>(null);

  // Sort projects by last accessed (most recent first)
  const sortedProjects = [...projectMemberships].sort(
    (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
  );

  // Get the most recently accessed project (active project)
  const activeProject = sortedProjects.length > 0 ? sortedProjects[0] : null;

  // Get user's tier info
  const tierInfo = user ? getTierById(user.tier as SubscriptionTier) : null;

  const handleProjectOpen = (membership: ProjectMembership) => {
    updateLastAccessed(membership.projectId);

    // First try to restore saved project data (preserves scenes, characters, etc.)
    const store = useProjectStore.getState();
    if (store.hasSavedProject(membership.projectId)) {
      store.restoreSavedProject(membership.projectId);
      return;
    }

    // Check if the current project in store already matches (user may be re-opening same project)
    if (store.currentProject?.id === membership.projectId) {
      // Already loaded, nothing to do
      return;
    }

    // Check if currentProject has actual data (scenes uploaded) - don't overwrite it!
    // This handles the case where user uploaded a script but project IDs don't match
    // (e.g., local project vs server project with different IDs)
    if (store.currentProject && store.currentProject.scenes.length > 0) {
      // Current project has data - preserve it, don't replace with empty shell
      // Just update the project ID and name to match the membership
      const updatedProject: Project = {
        ...store.currentProject,
        id: membership.projectId,
        name: membership.projectName,
      };
      store.setProject(updatedProject);
      return;
    }

    // Fallback: Create a project that needs setup
    // Use setProjectNeedsSetup to prompt user to upload their script
    // This is safer than creating an empty project which would lose data
    const project = createProjectFromMembership(membership);
    store.setProjectNeedsSetup(project);
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

  const handleDeleteClick = (project: ProjectMembership) => {
    setDeleteModalProject(project);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalProject) return;

    const isOwner = deleteModalProject.role === 'owner';
    const result = isOwner
      ? await deleteProject(deleteModalProject.projectId)
      : await leaveProject(deleteModalProject.projectId);

    if (result.success) {
      // Also clear from project store if this was the current project
      const store = useProjectStore.getState();
      if (store.currentProject?.id === deleteModalProject.projectId) {
        store.clearProject();
      }
      // Also clear from saved projects
      if (store.hasSavedProject(deleteModalProject.projectId)) {
        store.removeSavedProject(deleteModalProject.projectId);
      }
      setDeleteModalProject(null);
    }
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
          <div className="flex items-center gap-3">
            {/* Back button - shown when user hasn't completed onboarding */}
            {!hasCompletedOnboarding && (
              <button
                onClick={goBack}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-2"
                aria-label="Go back"
              >
                <svg
                  className="w-6 h-6 text-text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
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
          </div>

          {/* User avatar */}
          <button
            onClick={() => setScreen('profile')}
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
            onSyncClick={() => setShowSyncModal(true)}
          />
        ) : (
          // Project list
          <div className="space-y-4">
            {/* Primary actions */}
            <div className="space-y-3 mb-6">
              <div className="flex gap-3">
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
                  Join Production
                </Button>
              </div>
              {/* Sync Project button */}
              <Button
                fullWidth
                size="md"
                variant="ghost"
                onClick={() => setShowSyncModal(true)}
                className="text-gold"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
                Sync Project from Desktop
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
                onDelete={() => handleDeleteClick(project)}
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

      {/* Sync Project modal */}
      <SyncProjectModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />

      {/* Delete/Leave Project modal */}
      <DeleteProjectModal
        isOpen={deleteModalProject !== null}
        onClose={() => setDeleteModalProject(null)}
        onConfirm={handleDeleteConfirm}
        projectName={deleteModalProject?.projectName || ''}
        isOwner={deleteModalProject?.role === 'owner'}
        isLoading={isLoading}
      />
    </div>
  );
}
