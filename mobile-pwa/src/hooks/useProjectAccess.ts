/**
 * useProjectAccess — derives the current user's access toggles for the active project.
 *
 * Returns the ProjectAccess object from getProjectAccess(). Owner always has full access.
 * On joined projects, access is read from the project_members record in authStore.
 */

import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { getProjectAccess, type ProjectAccess } from '@/utils/projectAccess';

export function useProjectAccess(): ProjectAccess {
  const projectMemberships = useAuthStore((s) => s.projectMemberships);
  const activeProjectId = useProjectStore((s) => s.currentProject?.id);
  const membership = projectMemberships.find((m) => m.projectId === activeProjectId);
  const isOwner = membership?.role === 'owner';
  return getProjectAccess(membership ?? null, isOwner);
}
