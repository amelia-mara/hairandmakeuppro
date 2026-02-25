import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { UpgradeModal } from '@/components/dashboard';
import * as supabaseProjects from '@/services/supabaseProjects';
import type { ProjectMembership, Project, ProjectRole, ProductionType } from '@/types';
import { createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';

// Format relative time
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

const getRoleLabel = (role: ProjectRole): string => {
  const labels: Record<string, string> = {
    owner: 'Owner', designer: 'Designer', hod: 'HOD',
    supervisor: 'Supervisor', key: 'Key', floor: 'Floor',
    daily: 'Daily', trainee: 'Trainee', artist: 'Artist', viewer: 'Viewer',
  };
  return labels[role] || role;
};

const getTypeLabel = (type: ProductionType): string => {
  const labels: Record<string, string> = {
    film: 'Feature Film', tv_series: 'TV Series', short_film: 'Short Film',
    commercial: 'Commercial', music_video: 'Music Video', other: 'Production',
  };
  return labels[type] || 'Production';
};

function createProjectFromMembership(membership: ProjectMembership): Project {
  return {
    id: membership.projectId,
    name: membership.projectName,
    createdAt: membership.joinedAt,
    updatedAt: membership.lastAccessedAt,
    scenes: [],
    characters: [],
    looks: [],
  };
}

// Delete/Leave Confirmation Modal
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-2xl p-5 max-w-sm w-full shadow-xl">
        <h3 className="text-base font-semibold text-text-primary mb-1.5">
          {isOwner ? 'Delete project?' : 'Leave project?'}
        </h3>
        <p className="text-sm text-text-secondary mb-5">
          {isOwner
            ? `This will permanently delete "${projectName}" and all its data for everyone.`
            : `You'll need a new invite code to rejoin "${projectName}".`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-text-primary active:scale-[0.98] transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-11 rounded-xl bg-red-600 text-sm font-medium text-white active:scale-[0.98] transition-transform"
          >
            {isLoading ? 'Deleting...' : isOwner ? 'Delete' : 'Leave'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Overflow menu for project actions
function ProjectMenu({
  isOpen,
  onClose,
  onSettings,
  onDelete,
  isOwner,
  openUpward,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSettings?: () => void;
  onDelete: () => void;
  isOwner: boolean;
  openUpward?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute right-0 z-50 bg-card rounded-xl shadow-lg border border-border py-1 min-w-[160px] ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
        {onSettings && (
          <button
            onClick={() => { onSettings(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm text-text-primary hover:bg-gray-50 transition-colors"
          >
            Settings
          </button>
        )}
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          {isOwner ? 'Delete project' : 'Leave project'}
        </button>
      </div>
    </>
  );
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
    setSettingsProjectId,
  } = useAuthStore();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteModalProject, setDeleteModalProject] = useState<ProjectMembership | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Sort by last accessed
  const sortedProjects = [...projectMemberships].sort(
    (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
  );

  const currentProject = sortedProjects.length > 0 ? sortedProjects[0] : null;
  const otherProjects = sortedProjects.slice(1);

  const handleProjectOpen = async (membership: ProjectMembership) => {
    updateLastAccessed(membership.projectId);

    const store = useProjectStore.getState();

    // 1. Restore from local save if available
    if (store.hasSavedProject(membership.projectId)) {
      store.restoreSavedProject(membership.projectId);
      store.setActiveTab('today');
      return;
    }

    // 2. Already the active project
    if (store.currentProject?.id === membership.projectId) {
      store.setActiveTab('today');
      return;
    }

    // 3. Save current project if it has data, before switching
    if (store.currentProject && store.currentProject.scenes.length > 0) {
      store.saveAndClearProject();
    } else if (store.currentProject) {
      // Project exists but has no scenes - still clear call sheets to prevent data leaking
      useCallSheetStore.getState().clearCallSheetsForProject();
    }

    // 4. Try to fetch project data from Supabase
    try {
      const { scenes, characters, looks, sceneCharacters, lookScenes, error } =
        await supabaseProjects.getProjectData(membership.projectId);

      if (!error && (scenes.length > 0 || characters.length > 0)) {
        // Build character ID lookup for scene_characters mapping
        const sceneCharMap = new Map<string, string[]>();
        for (const sc of sceneCharacters) {
          const existing = sceneCharMap.get(sc.scene_id) || [];
          existing.push(sc.character_id);
          sceneCharMap.set(sc.scene_id, existing);
        }

        // Build look_scenes mapping
        const lookSceneMap = new Map<string, string[]>();
        for (const ls of lookScenes) {
          const existing = lookSceneMap.get(ls.look_id) || [];
          existing.push(ls.scene_number);
          lookSceneMap.set(ls.look_id, existing);
        }

        // Convert DB scenes to local Scene type
        const localScenes = scenes.map(s => ({
          id: s.id,
          sceneNumber: s.scene_number,
          slugline: s.location || `Scene ${s.scene_number}`,
          intExt: (s.int_ext === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
          timeOfDay: (s.time_of_day || 'DAY') as 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS',
          synopsis: s.synopsis || undefined,
          characters: sceneCharMap.get(s.id) || [],
          isComplete: s.is_complete,
          completedAt: s.completed_at ? new Date(s.completed_at) : undefined,
          filmingStatus: s.filming_status as any,
          filmingNotes: s.filming_notes || undefined,
          shootingDay: s.shooting_day || undefined,
          characterConfirmationStatus: 'confirmed' as const,
        }));

        // Convert DB characters to local Character type
        const localCharacters = characters.map(c => ({
          id: c.id,
          name: c.name,
          initials: c.initials,
          avatarColour: c.avatar_colour,
        }));

        // Convert DB looks to local Look type
        const localLooks = looks.map(l => ({
          id: l.id,
          characterId: l.character_id,
          name: l.name,
          scenes: lookSceneMap.get(l.id) || [],
          estimatedTime: l.estimated_time,
          makeup: (l.makeup_details as any) || createEmptyMakeupDetails(),
          hair: (l.hair_details as any) || createEmptyHairDetails(),
        }));

        const project: Project = {
          id: membership.projectId,
          name: membership.projectName,
          createdAt: membership.joinedAt,
          updatedAt: membership.lastAccessedAt,
          scenes: localScenes,
          characters: localCharacters,
          looks: localLooks,
        };

        store.setProject(project);
        store.setActiveTab('today');
        return;
      }
    } catch (err) {
      console.error('Failed to fetch project data from server:', err);
    }

    // 5. Fallback: no data on server yet
    // For non-owners (joined via invite code), the owner may not have synced data yet.
    // Create the project without needsSetup so startSync can pull data via realtime.
    const project = createProjectFromMembership(membership);
    if (membership.role === 'owner') {
      // Owner with no data: show the setup/upload flow
      store.setProjectNeedsSetup(project);
    } else {
      // Non-owner (joined via invite): load project and let sync pull data
      // startSync in App.tsx will subscribe to realtime updates
      store.setProject(project);
    }
    store.setActiveTab('today');
  };

  const handleCreateClick = () => {
    if (canCreateProjects()) {
      setScreen('create-project');
    } else {
      setShowUpgradeModal(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalProject) return;
    const isOwner = deleteModalProject.role === 'owner';
    const result = isOwner
      ? await deleteProject(deleteModalProject.projectId)
      : await leaveProject(deleteModalProject.projectId);

    if (result.success) {
      const store = useProjectStore.getState();
      const callSheetStore = useCallSheetStore.getState();
      if (store.currentProject?.id === deleteModalProject.projectId) {
        store.clearProject();
        callSheetStore.clearCallSheetsForProject();
      }
      if (store.hasSavedProject(deleteModalProject.projectId)) {
        store.removeSavedProject(deleteModalProject.projectId);
      }
      setDeleteModalProject(null);
    }
  };

  const getUserInitials = (): string => {
    if (!user?.name) return '?';
    const parts = user.name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return user.name.slice(0, 2).toUpperCase();
  };

  const canManage = (role: string) => role === 'owner' || role === 'supervisor';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!hasCompletedOnboarding && (
                <button
                  onClick={goBack}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 -ml-2"
                >
                  <svg className="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h1 className="text-[17px] font-bold text-text-primary">Projects</h1>
            </div>
            <button
              onClick={() => setScreen('profile')}
              className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold text-xs font-bold active:scale-95 transition-transform"
            >
              {getUserInitials()}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {sortedProjects.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-text-primary mb-1">No projects yet</h2>
            <p className="text-sm text-text-muted mb-8 max-w-[240px]">
              Create a new project or join your team with an invite code.
            </p>
            <div className="w-full max-w-[280px] space-y-3">
              <button
                onClick={handleCreateClick}
                className="w-full h-11 rounded-xl gold-gradient text-white text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Create Project
              </button>
              <button
                onClick={() => setScreen('join')}
                className="w-full h-11 rounded-xl border border-border text-sm font-medium text-text-primary active:scale-[0.98] transition-transform"
              >
                Join with Code
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current project - hero card */}
            {currentProject && (
              <section>
                <div className="text-[11px] font-medium tracking-wider text-text-muted uppercase mb-2.5">Current</div>
                <button
                  onClick={() => handleProjectOpen(currentProject)}
                  className="w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-text-primary leading-tight pr-2">
                      {currentProject.projectName}
                    </h3>
                    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === currentProject.projectId ? null : currentProject.projectId);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 -mr-1 -mt-0.5"
                      >
                        <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      <ProjectMenu
                        isOpen={menuOpenId === currentProject.projectId}
                        onClose={() => setMenuOpenId(null)}
                        onSettings={
                          canManage(currentProject.role)
                            ? () => { setSettingsProjectId(currentProject.projectId); setScreen('project-settings'); }
                            : undefined
                        }
                        onDelete={() => setDeleteModalProject(currentProject)}
                        isOwner={currentProject.role === 'owner'}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-text-muted">
                    {getTypeLabel(currentProject.productionType)}
                    <span className="mx-1.5 text-text-light">&middot;</span>
                    {getRoleLabel(currentProject.role)}
                  </p>
                  {(currentProject.sceneCount > 0 || currentProject.teamMemberCount > 0) && (
                    <p className="text-xs text-text-muted mt-1.5">
                      {currentProject.sceneCount > 0 && `${currentProject.sceneCount} scene${currentProject.sceneCount !== 1 ? 's' : ''}`}
                      {currentProject.sceneCount > 0 && currentProject.teamMemberCount > 0 && (
                        <span className="mx-1.5 text-text-light">&middot;</span>
                      )}
                      {currentProject.teamMemberCount > 0 && `${currentProject.teamMemberCount} team`}
                    </p>
                  )}
                </button>
              </section>
            )}

            {/* Other projects - list rows */}
            {otherProjects.length > 0 && (
              <section>
                <div className="text-[11px] font-medium tracking-wider text-text-muted uppercase mb-2.5">Other Projects</div>
                <div className="bg-card rounded-2xl border border-border divide-y divide-border">
                  {otherProjects.map((project) => (
                    <div key={project.projectId} className="relative">
                      <button
                        onClick={() => handleProjectOpen(project)}
                        className="w-full text-left px-4 py-3.5 flex items-center justify-between active:bg-gray-50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-text-primary truncate">
                            {project.projectName}
                          </h4>
                          <p className="text-xs text-text-muted mt-0.5">
                            {getTypeLabel(project.productionType)}
                            <span className="mx-1.5 text-text-light">&middot;</span>
                            {formatRelativeTime(project.lastAccessedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <div onClick={(e) => e.stopPropagation()} className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === project.projectId ? null : project.projectId);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                            >
                              <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                              </svg>
                            </button>
                            <ProjectMenu
                              isOpen={menuOpenId === project.projectId}
                              onClose={() => setMenuOpenId(null)}
                              onSettings={
                                canManage(project.role)
                                  ? () => { setSettingsProjectId(project.projectId); setScreen('project-settings'); }
                                  : undefined
                              }
                              onDelete={() => setDeleteModalProject(project)}
                              isOwner={project.role === 'owner'}
                              openUpward
                            />
                          </div>
                          <svg className="w-4 h-4 text-text-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Create / Join - inline at bottom */}
            <div className="flex items-center justify-center gap-5 pt-2 pb-4">
              <button
                onClick={handleCreateClick}
                className="flex items-center gap-1.5 text-sm font-medium text-gold active:opacity-70 transition-opacity"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={() => setScreen('join')}
                className="flex items-center gap-1.5 text-sm font-medium text-text-secondary active:opacity-70 transition-opacity"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Join
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="px-4 py-3 pb-safe-bottom">
        <button
          onClick={signOut}
          className="w-full text-center text-xs text-text-muted active:opacity-70 transition-opacity"
        >
          Sign out
        </button>
      </div>

      {/* Modals */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => { setShowUpgradeModal(false); setScreen('select-plan'); }}
      />
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
