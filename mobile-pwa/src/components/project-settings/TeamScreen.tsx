import { useEffect } from 'react';
import { TeamMemberList } from './TeamMemberList';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';
import { useAuthStore } from '@/stores/authStore';
import type { TeamMemberRole } from '@/types';

interface TeamScreenProps {
  projectId: string;
  canManage: boolean;
  isOwner: boolean;
  onBack: () => void;
  onInvite: () => void;
}

export function TeamScreen({
  projectId,
  canManage,
  isOwner,
  onBack,
  onInvite,
}: TeamScreenProps) {
  const {
    teamMembers,
    isLoading,
    loadTeamMembers,
    changeTeamMemberRole,
    removeTeamMember,
  } = useProjectSettingsStore();

  const { user } = useAuthStore();

  useEffect(() => {
    loadTeamMembers(projectId);
  }, [projectId, loadTeamMembers]);

  const handleChangeRole = (userId: string, newRole: TeamMemberRole) => {
    changeTeamMemberRole(userId, newRole);
  };

  const handleRemoveMember = (userId: string) => {
    removeTeamMember(userId);
  };

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 -ml-2 text-text-muted hover:text-text-primary transition-colors tap-target"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-text-primary">Team</h1>
                <p className="text-xs text-text-muted">
                  {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
                </p>
              </div>
            </div>
            {isOwner && (
              <button
                onClick={onInvite}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-muted hover:text-gold transition-colors rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-container px-4 py-4">
        {isLoading && teamMembers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <TeamMemberList
              members={teamMembers}
              currentUserId={user?.id}
              canManage={canManage}
              onChangeRole={handleChangeRole}
              onRemoveMember={handleRemoveMember}
            />

            {/* Invite section at bottom */}
            {isOwner && teamMembers.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={onInvite}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border text-text-muted hover:border-gold hover:text-gold transition-colors"
                >
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-current flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Invite team members</p>
                    <p className="text-xs opacity-70">Share a code to join this project</p>
                  </div>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
