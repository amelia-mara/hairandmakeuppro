import { useState } from 'react';
import { ConfirmationModal } from './ConfirmationModal';

interface DangerZoneProps {
  projectName: string;
  photoCount: number;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function DangerZone({
  projectName,
  photoCount,
  onArchive,
  onDelete,
}: DangerZoneProps) {
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await onArchive();
      setShowArchiveConfirm(false);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section>
        <h3 className="text-[10px] font-bold tracking-wider uppercase text-red-500 mb-3">
          DANGER ZONE
        </h3>

        <div className="space-y-3">
          {/* Archive Project */}
          <button
            onClick={() => setShowArchiveConfirm(true)}
            className="w-full card flex items-center gap-4 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-text-primary">Archive Project</p>
              <p className="text-xs text-text-muted">Mark as wrapped, make read-only</p>
            </div>
            <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Delete Project */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full card flex items-center gap-4 border-red-200 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-red-500">Delete Project</p>
              <p className="text-xs text-text-muted">Permanently delete all data</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-red-500" />
          </button>
        </div>
      </section>

      {/* Archive Confirmation Modal */}
      <ConfirmationModal
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={handleArchive}
        title={`Archive "${projectName}"?`}
        message={
          <div className="space-y-2">
            <p>The project will become read-only.</p>
            <p>Team members can still view continuity data and photos, but can't make changes.</p>
            <p className="font-medium">You can restore it later from your Dashboard.</p>
          </div>
        }
        confirmText="Archive Project"
        isLoading={isArchiving}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={`Delete "${projectName}"?`}
        message={
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-500">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">This cannot be undone.</span>
            </div>
            <p>This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>All scenes and breakdowns</li>
              <li>All continuity notes</li>
              <li>All {photoCount.toLocaleString()} photos</li>
              <li>Team member access</li>
            </ul>
          </div>
        }
        confirmText="Delete Forever"
        variant="danger"
        requiresTextConfirmation={projectName}
        isLoading={isDeleting}
      />
    </>
  );
}
