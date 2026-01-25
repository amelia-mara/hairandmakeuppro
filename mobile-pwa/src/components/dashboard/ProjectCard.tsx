import { clsx } from 'clsx';
import { Badge, Button } from '@/components/ui';
import type { ProjectMembership, ProjectRole } from '@/types';

export interface ProjectCardProps {
  project: ProjectMembership;
  isActive?: boolean;
  onOpen: () => void;
  onSettings?: () => void;
}

// Format relative time (e.g., "2h ago", "Yesterday")
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

// Get role display label
const getRoleLabel = (role: ProjectRole): string => {
  const labels: Record<ProjectRole, string> = {
    owner: 'HOD',
    supervisor: 'Makeup Supervisor',
    artist: 'Floor Artist',
    viewer: 'Viewer',
  };
  return labels[role] || role;
};

// Get production type display label
const getProductionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    film: 'Feature Film',
    tv_series: 'TV Series',
    short_film: 'Short Film',
    commercial: 'Commercial',
    music_video: 'Music Video',
    other: 'Production',
  };
  return labels[type] || 'Production';
};

export function ProjectCard({ project, isActive = false, onOpen, onSettings }: ProjectCardProps) {
  const {
    projectName,
    productionType,
    role,
    teamMemberCount,
    sceneCount,
    lastAccessedAt,
    status,
  } = project;

  const isOwner = role === 'owner' || role === 'supervisor';

  return (
    <div
      className={clsx(
        'relative rounded-xl p-4 transition-all duration-200',
        'bg-card border',
        'shadow-sm hover:shadow-md',
        isActive
          ? 'border-l-4 border-l-gold border-t-border border-r-border border-b-border'
          : 'border-border',
        status === 'archived' && 'opacity-70'
      )}
    >
      {/* Status badge */}
      {isActive && (
        <div className="mb-3">
          <Badge variant="gold" size="sm">
            ACTIVE
          </Badge>
        </div>
      )}

      {status === 'archived' && (
        <div className="mb-3">
          <Badge variant="default" size="sm">
            ARCHIVED
          </Badge>
        </div>
      )}

      {/* Project name */}
      <h3 className="text-lg font-bold text-text-primary mb-1">
        {projectName}
      </h3>

      {/* Production type */}
      <p className="text-sm text-text-muted mb-4">
        {getProductionTypeLabel(productionType)}
      </p>

      {/* Role and stats */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="font-medium">Your role:</span>
          <span>{getRoleLabel(role)}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-text-muted">
          {/* Team members */}
          <span className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {teamMemberCount} team member{teamMemberCount !== 1 ? 's' : ''}
          </span>

          {/* Separator */}
          <span className="text-text-light">·</span>

          {/* Scene count */}
          <span className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
            {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Last opened */}
      <p className="text-xs text-text-light mb-4">
        Last opened {formatRelativeTime(lastAccessedAt)}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="md"
          fullWidth
          onClick={onOpen}
        >
          Open Project
        </Button>

        {/* Settings cog for owners */}
        {isOwner && onSettings && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSettings();
            }}
            className="p-2.5 rounded-lg border border-border bg-card hover:bg-gray-50 transition-colors"
            aria-label="Project settings"
          >
            <svg
              className="w-5 h-5 text-text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
