import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { SyncIcon } from '@/components/sync';
import { getAutoSaveFailureCount, getLastAutoSaveError } from '@/services/autoSave';

interface ProjectHeaderProps {
  onSwitchProject?: () => void;
  onNavigateToProfile?: () => void;
  onSyncTap?: () => void;
}

export function ProjectHeader({ onSwitchProject, onNavigateToProfile, onSyncTap }: ProjectHeaderProps) {
  const { currentProject } = useProjectStore();
  const { user } = useAuthStore();
  const [saveFailures, setSaveFailures] = useState(0);

  // Poll for auto-save failures every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSaveFailures(getAutoSaveFailureCount());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!currentProject) return null;

  // Get user initials for avatar
  const getInitials = () => {
    if (!user?.name) return 'U';
    const parts = user.name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Simplified Header Bar */}
      <div className="bg-card border-b border-border">
        <div className="mobile-container">
          <div className="h-12 px-4 flex items-center justify-between">
            {/* Project name - tap to switch */}
            <button
              onClick={onSwitchProject}
              className="flex items-center gap-2 min-w-0 active:opacity-70 transition-opacity"
            >
              <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-text-primary truncate max-w-[200px]">
                {currentProject.name}
              </span>
              <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
              </svg>
            </button>

            <div className="flex items-center gap-1">
              {/* Sync icon */}
              {onSyncTap && <SyncIcon onClick={onSyncTap} />}

              {/* Account icon - navigates directly to profile */}
              <button
                onClick={onNavigateToProfile}
                className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold text-xs font-bold active:scale-95 transition-transform"
              >
                {getInitials()}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save failure warning banner */}
      {saveFailures >= 2 && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5">
          <p className="text-xs text-red-600 dark:text-red-400 text-center">
            Auto-save failing — your changes may not be saved to the cloud.
            {getLastAutoSaveError() && (
              <span className="block text-[10px] opacity-70 mt-0.5">
                {getLastAutoSaveError()}
              </span>
            )}
          </p>
        </div>
      )}
    </>
  );
}
