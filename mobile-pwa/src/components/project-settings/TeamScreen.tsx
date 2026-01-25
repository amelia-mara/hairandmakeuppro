import { useEffect } from 'react';
import { TeamMemberList } from './TeamMemberList';
import { Button } from '@/components/ui/Button';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';
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
    <div className="min-h-screen bg-background">
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
                <p className="text-xs text-text-muted">{teamMembers.length} members</p>
              </div>
            </div>
            {isOwner && (
              <Button variant="primary" size="sm" onClick={onInvite}>
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite
              </Button>
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
          <TeamMemberList
            members={teamMembers}
            canManage={canManage}
            onChangeRole={handleChangeRole}
            onRemoveMember={handleRemoveMember}
          />
        )}
      </div>
    </div>
  );
}
