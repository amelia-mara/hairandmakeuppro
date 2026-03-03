import type { Project, ProjectMeta } from '@/types';

export const mockProject: Project = {
  id: 'project-1',
  name: 'The Deadline',
  created: Date.now() - 7 * 86400000,
  modified: Date.now() - 3600000,
  scriptFileName: 'The_Deadline_v3.pdf',
};

export const mockRecentProjects: ProjectMeta[] = [
  {
    id: 'project-1',
    name: 'The Deadline',
    sceneCount: 47,
    characterCount: 12,
    lastOpened: Date.now() - 3600000,
  },
  {
    id: 'project-2',
    name: 'Moonquake',
    sceneCount: 89,
    characterCount: 23,
    lastOpened: Date.now() - 7 * 86400000,
  },
];
