import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { BottomSheet } from '@/components/ui/Modal';

interface ProjectHeaderProps {
  onSwitchProject?: () => void;
  onNavigateToProfile?: () => void;
}

export function ProjectHeader({ onSwitchProject, onNavigateToProfile }: ProjectHeaderProps) {
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const { currentProject } = useProjectStore();
  const { user, signOut } = useAuthStore();

  if (!currentProject) return null;

  const handleSignOut = () => {
    setShowAccountSheet(false);
    signOut();
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!user?.name) return 'U';
    const parts = user.name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  // Get tier display
  const getTierDisplay = () => {
    if (!user?.tier) return 'Free';
    const tiers: Record<string, string> = {
      trainee: 'Trainee',
      artist: 'Artist',
      designer: 'Designer',
      supervisor: 'Supervisor',
    };
    return tiers[user.tier] || user.tier;
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

            {/* Account icon */}
            <button
              onClick={() => setShowAccountSheet(true)}
              className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold text-xs font-bold active:scale-95 transition-transform"
            >
              {getInitials()}
            </button>
          </div>
        </div>
      </div>

      {/* Account Bottom Sheet */}
      <BottomSheet isOpen={showAccountSheet} onClose={() => setShowAccountSheet(false)} showCloseButton={false}>
        <div className="pb-4">
          {/* User Info Header */}
          <div className="flex items-center gap-4 pb-4 border-b border-border mb-4">
            <div className="w-14 h-14 rounded-full bg-gold-100 flex items-center justify-center text-gold text-lg font-bold">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-text-primary truncate">{user?.name || 'User'}</h2>
              <p className="text-sm text-text-muted truncate">{user?.email || ''}</p>
              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-gold-50 rounded-full">
                <span className="text-xs font-medium text-gold">{getTierDisplay()}</span>
              </div>
            </div>
          </div>

          {/* Account Menu Items */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setShowAccountSheet(false);
                onNavigateToProfile?.();
              }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-text-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-text-primary">My Account</p>
                <p className="text-xs text-text-muted">Profile, password, billing details</p>
              </div>
              <svg className="w-5 h-5 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-border my-4" />

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </div>
            <span className="text-sm font-medium text-red-500">Sign Out</span>
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
