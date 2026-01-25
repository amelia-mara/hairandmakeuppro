import { useState } from 'react';
import { TeamMemberCard } from './TeamMemberCard';
import { ConfirmationModal } from './ConfirmationModal';
import type { TeamMember, TeamMemberRole, TeamRoleGroup } from '@/types';
import { groupTeamMembersByRole } from '@/types';

interface TeamMemberListProps {
  members: TeamMember[];
  canManage: boolean;
  onChangeRole?: (userId: string, newRole: TeamMemberRole) => void;
  onRemoveMember?: (userId: string) => void;
}

export function TeamMemberList({
  members,
  canManage,
  onChangeRole,
  onRemoveMember,
}: TeamMemberListProps) {
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  // Group members by role
  const roleGroups = groupTeamMembersByRole(members);

  const handleRemoveRequest = (userId: string) => {
    const member = members.find((m) => m.userId === userId);
    if (member) {
      setMemberToRemove(member);
    }
  };

  const confirmRemove = () => {
    if (memberToRemove) {
      onRemoveMember?.(memberToRemove.userId);
      setMemberToRemove(null);
    }
  };

  // Get plural label for role group
  const getGroupLabel = (group: TeamRoleGroup): string => {
    const count = group.members.length;
    switch (group.role) {
      case 'designer':
        return `DESIGNERS (${count})`;
      case 'hod':
        return `HEADS OF DEPARTMENT (${count})`;
      case 'supervisor':
        return `SUPERVISORS (${count})`;
      case 'key':
        return `KEY ARTISTS (${count})`;
      case 'floor':
        return `FLOOR ARTISTS (${count})`;
      case 'daily':
        return `DAILIES (${count})`;
      case 'trainee':
        return `TRAINEES (${count})`;
      default:
        return `${group.label.toUpperCase()} (${count})`;
    }
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <p className="text-sm text-text-muted">No team members yet</p>
        <p className="text-xs text-text-light mt-1">Share the invite code to add team members</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {roleGroups.map((group) => (
          <div key={group.role}>
            <h3 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3 px-1">
              {getGroupLabel(group)}
            </h3>
            <div>
              {group.members.map((member) => (
                <TeamMemberCard
                  key={member.userId}
                  member={member}
                  canManage={canManage}
                  onChangeRole={onChangeRole}
                  onRemove={handleRemoveRequest}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Remove Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={confirmRemove}
        title={`Remove ${memberToRemove?.name}?`}
        message={
          <div className="space-y-2">
            <p>They will lose access to this project immediately.</p>
            <p>Their contributions will remain.</p>
          </div>
        }
        confirmText="Remove"
        variant="danger"
      />
    </>
  );
}
