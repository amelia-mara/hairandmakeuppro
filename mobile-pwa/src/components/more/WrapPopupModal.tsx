import { useProjectStore } from '@/stores/projectStore';
import { PROJECT_RETENTION_DAYS } from '@/types';

interface WrapPopupModalProps {
  onExport: () => void;
}

export function WrapPopupModal({ onExport }: WrapPopupModalProps) {
  const {
    currentProject,
    showWrapPopup,
    wrapTriggerReason,
    lifecycle,
    wrapProject,
    dismissWrapPopup,
  } = useProjectStore();

  if (!showWrapPopup || !currentProject) return null;

  // Calculate deletion date
  const getDeletionDateString = () => {
    if (lifecycle.state === 'wrapped' && lifecycle.deletionDate) {
      return new Date(lifecycle.deletionDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + PROJECT_RETENTION_DAYS);
    return futureDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Get trigger message
  const getTriggerMessage = () => {
    switch (wrapTriggerReason) {
      case 'all_scenes_complete':
        return `All scenes for "${currentProject.name}" are marked complete.`;
      case 'inactivity':
        return `"${currentProject.name}" has been inactive for 30 days.`;
      case 'manual':
        return `"${currentProject.name}" has been marked as wrapped.`;
      default:
        return `"${currentProject.name}" is ready to be wrapped.`;
    }
  };

  const handleExport = () => {
    // Wrap the project first if not already wrapped
    if (lifecycle.state === 'active' && wrapTriggerReason) {
      wrapProject(wrapTriggerReason);
    }
    onExport();
  };

  const handleRemindLater = () => {
    // Wrap the project if triggered by completion
    if (lifecycle.state === 'active' && wrapTriggerReason) {
      wrapProject(wrapTriggerReason);
    }
    dismissWrapPopup(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card rounded-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with film icon */}
        <div className="pt-8 pb-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.875 1.875 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-1">That's a Wrap!</h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-sm text-text-secondary text-center mb-4">
            {getTriggerMessage()}
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800">
              Your project will be stored for {PROJECT_RETENTION_DAYS} days in case of pickups, then automatically deleted.
            </p>
            <p className="text-sm text-amber-900 font-medium mt-2">
              Export your continuity documents now to keep a permanent backup.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleExport}
              className="w-full py-3.5 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export Documents
            </button>

            <button
              onClick={handleRemindLater}
              className="w-full py-3 rounded-button bg-gray-100 text-text-secondary font-medium text-base active:scale-[0.98] transition-transform"
            >
              Remind Me Later
            </button>
          </div>

          {/* Deletion date */}
          <p className="text-xs text-text-light text-center mt-4">
            Project deletion: {getDeletionDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
