import { useState, useRef, useEffect } from 'react';
import type { TeamMember, TeamMemberRole } from '@/types';
import { getTeamMemberRoleLabel, TEAM_MEMBER_ROLES } from '@/types';
import { ACCESS_TOGGLE_LABELS, type AccessToggles } from '@/utils/projectAccess';

interface TeamMemberCardProps {
  member: TeamMember;
  isCurrentUser?: boolean;
  canManage: boolean;
  isOwner?: boolean; // Whether the CURRENT USER is the project owner
  onChangeRole?: (userId: string, newRole: TeamMemberRole) => void;
  onRemove?: (userId: string) => void;
  onToggleAccess?: (membershipId: string, field: string, value: boolean) => void;
}

export function TeamMemberCard({
  member,
  isCurrentUser,
  canManage,
  isOwner,
  onChangeRole,
  onRemove,
  onToggleAccess,
}: TeamMemberCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showAccessToggles, setShowAccessToggles] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);
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

  // Can manage this member (not yourself, not the owner)
  const canManageThisMember = canManage && !member.isOwner && !isCurrentUser;

  const handleLongPress = () => {
    if (canManageThisMember) {
      setShowActions(true);
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
        className="flex items-center gap-3 px-3 py-3 rounded-xl bg-card border border-border"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => {
          if (canManageThisMember) {
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
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${getAvatarColor(
              member.name
            )}`}
          >
            {getInitials(member.name)}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-text-primary truncate">
              {member.name}
            </h3>
            {isCurrentUser && (
              <span className="text-[10px] text-text-light">(you)</span>
            )}
          </div>
          <p className="text-xs text-text-muted">
            {getTeamMemberRoleLabel(member.role)}
            {member.isOwner && (
              <span className="text-gold font-medium"> &middot; Owner</span>
            )}
          </p>
        </div>

        {/* Joined date or actions */}
        {canManageThisMember ? (
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1.5 -mr-1 text-text-light hover:text-text-primary transition-colors rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        ) : (
          <span className="text-[11px] text-text-light flex-shrink-0">
            {formatJoinDate(member.joinedAt)}
          </span>
        )}
      </div>

      {/* Manage access — owner only, not on the owner's own card */}
      {isOwner && !member.isOwner && onToggleAccess && (
        <>
          <button
            onClick={() => setShowAccessToggles(!showAccessToggles)}
            className="w-full px-3 py-2 text-[11px] font-medium text-text-muted border-t border-border flex items-center justify-between"
          >
            <span>{showAccessToggles ? 'Hide access settings' : 'Manage access'}</span>
            <svg className={`w-3.5 h-3.5 transition-transform ${showAccessToggles ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showAccessToggles && (
            <div className="px-3 pb-3 space-y-1 border-t border-border pt-2">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Access</div>
              {(Object.keys(ACCESS_TOGGLE_LABELS) as (keyof AccessToggles)[]).map((dbField) => {
                const label = ACCESS_TOGGLE_LABELS[dbField];
                // Map snake_case DB field to camelCase TeamMember field
                const camelField = dbField.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
                const value = (member as any)[camelField] ?? true;
                return (
                  <label key={dbField} className="flex items-center justify-between py-1.5">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="text-xs font-medium text-text-primary">{label.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {savedField === camelField && (
                        <span className="text-[10px] text-green-500 animate-pulse">Saved</span>
                      )}
                      <button
                        onClick={() => {
                          onToggleAccess(member.membershipId, camelField, !value);
                          setSavedField(camelField);
                          setTimeout(() => setSavedField(null), 1500);
                        }}
                        className={`relative w-10 h-5.5 rounded-full transition-colors ${
                          value ? 'bg-[#D4591A]' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${
                          value ? 'translate-x-[18px]' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Actions Menu */}
      {showActions && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
          <div className="absolute right-2 top-full mt-1 z-50 bg-card rounded-xl shadow-lg border border-border overflow-hidden min-w-[170px]">
            <button
              onClick={() => {
                setShowActions(false);
                setShowRolePicker(true);
              }}
              className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-background flex items-center gap-2.5"
            >
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Change Role
            </button>
            <button
              onClick={() => {
                setShowActions(false);
                onRemove?.(member.userId);
              }}
              className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2.5 border-t border-border"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 018.624 21c-1.725 0-3.364-.372-4.874-1.073 0-.13.25-.692.25-.692z" />
              </svg>
              Remove
            </button>
          </div>
        </>
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
