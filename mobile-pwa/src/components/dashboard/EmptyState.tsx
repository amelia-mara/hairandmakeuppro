import { Button } from '@/components/ui';

export interface EmptyStateProps {
  canCreate: boolean;
  onJoinClick: () => void;
  onCreateClick: () => void;
  onSyncClick?: () => void;
}

export function EmptyState({ canCreate, onJoinClick, onCreateClick, onSyncClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {/* Illustration - Folder with plus icon */}
      <div className="w-24 h-24 rounded-full bg-gold-50 flex items-center justify-center mb-6">
        <svg
          className="w-12 h-12 text-gold"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </div>

      {/* Heading */}
      <h2 className="text-xl font-bold text-text-primary mb-2">
        No projects yet
      </h2>

      {/* Description */}
      <p className="text-text-secondary mb-8 max-w-xs">
        Create a new project, join your team, or sync from desktop.
      </p>

      {/* Action buttons */}
      <div className="w-full max-w-xs space-y-4">
        {/* Create Project button (primary) */}
        {canCreate ? (
          <Button
            fullWidth
            size="lg"
            variant="primary"
            onClick={onCreateClick}
          >
            Create Project
          </Button>
        ) : (
          <div className="text-center">
            <p className="text-sm text-text-muted mb-3">
              Supervisor or Designer?
            </p>
            <Button
              fullWidth
              size="lg"
              variant="primary"
              onClick={onCreateClick}
            >
              Create Project
            </Button>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-text-muted">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Secondary actions */}
        <div className="flex gap-3">
          <Button
            fullWidth
            size="lg"
            variant="outline"
            onClick={onJoinClick}
          >
            Join Team
          </Button>
          {onSyncClick && (
            <Button
              fullWidth
              size="lg"
              variant="outline"
              onClick={onSyncClick}
            >
              Sync
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
