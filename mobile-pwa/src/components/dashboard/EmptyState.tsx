import { Button } from '@/components/ui';

export interface EmptyStateProps {
  canCreate: boolean;
  onJoinClick: () => void;
  onCreateClick: () => void;
}

export function EmptyState({ canCreate, onJoinClick, onCreateClick }: EmptyStateProps) {
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
        Join a project with a code from your supervisor, or create your own.
      </p>

      {/* Join Project button (primary) */}
      <div className="w-full max-w-xs space-y-4">
        <Button
          fullWidth
          size="lg"
          variant="primary"
          onClick={onJoinClick}
        >
          Join Project
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-text-muted">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Create section */}
        {canCreate ? (
          <Button
            fullWidth
            size="lg"
            variant="outline"
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
              variant="outline"
              onClick={onCreateClick}
            >
              Create Project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
