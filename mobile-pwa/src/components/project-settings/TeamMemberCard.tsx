import { useState, useRef, useEffect } from 'react';
import type { TeamMember, TeamMemberRole } from '@/types';
import { getTeamMemberRoleLabel, TEAM_MEMBER_ROLES } from '@/types';

interface TeamMemberCardProps {
  member: TeamMember;
  canManage: boolean;
  onChangeRole?: (userId: string, newRole: TeamMemberRole) => void;
  onRemove?: (userId: string) => void;
}

export function TeamMemberCard({
  member,
  canManage,
  onChangeRole,
  onRemove,
}: TeamMemberCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Format join date
  const formatJoinDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  // Get avatar initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate consistent color from name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false);
        setShowRolePicker(false);
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActions]);

  const handleLongPress = () => {
    if (canManage && !member.isOwner) {
      setShowActions(true);
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  };

  // Long press detection
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(handleLongPress, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="relative" ref={actionsRef}>
      <div
        className="card flex items-center gap-3 mb-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => {
          if (canManage && !member.isOwner) {
            e.preventDefault();
            setShowActions(true);
          }
        }}
      >
        {/* Avatar */}
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={member.name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${getAvatarColor(
              member.name
            )}`}
          >
            {getInitials(member.name)}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {member.name}
            </h3>
            {member.isOwner && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-gold-100 text-gold rounded-full">
                Owner
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {getTeamMemberRoleLabel(member.role)}
          </p>
          <p className="text-xs text-text-light">
            Joined {formatJoinDate(member.joinedAt)}
          </p>
        </div>

        {/* Actions button for managers */}
        {canManage && !member.isOwner && (
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 -m-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        )}
      </div>

      {/* Actions Menu */}
      {showActions && (
        <div className="absolute right-4 top-full mt-1 z-10 bg-card rounded-xl shadow-lg border border-border overflow-hidden min-w-[160px]">
          <button
            onClick={() => {
              setShowActions(false);
              setShowRolePicker(true);
            }}
            className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Change Role
          </button>
          <button
            onClick={() => {
              setShowActions(false);
              onRemove?.(member.userId);
            }}
            className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove from Project
          </button>
        </div>
      )}

      {/* Role Picker */}
      {showRolePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-[430px] bg-card rounded-t-2xl shadow-xl animate-slideUp">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">Change Role</h2>
                <button
                  onClick={() => setShowRolePicker(false)}
                  className="p-2 -m-2 text-text-muted hover:text-text-primary"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-text-muted mt-1">Select a new role for {member.name}</p>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                {TEAM_MEMBER_ROLES.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => {
                      onChangeRole?.(member.userId, role.value);
                      setShowRolePicker(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl text-left flex items-center justify-between transition-colors ${
                      member.role === role.value
                        ? 'bg-gold-50 border border-gold'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      member.role === role.value ? 'text-gold' : 'text-text-primary'
                    }`}>
                      {role.label}
                    </span>
                    {member.role === role.value && (
                      <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
