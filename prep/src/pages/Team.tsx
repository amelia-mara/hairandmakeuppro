import { useState, useEffect } from 'react';
import {
  useTeamStore,
  TEAM_ROLES,
  type TeamMember,
  type TeamRole,
} from '@/stores/teamStore';
import { ACCESS_TOGGLE_LABELS, type AccessToggles } from '@/utils/projectAccess';
import { useIsMobile } from '@/hooks/useIsMobile';

interface TeamProps {
  projectId: string;
}

const AVATAR_COLORS = [
  { bg: '#E8D5C0', color: '#8B5E3C' },
  { bg: '#D5E8E0', color: '#3A6B5A' },
  { bg: '#E8E0D5', color: '#6B5A3A' },
  { bg: '#D5D8E8', color: '#3A4A6B' },
  { bg: '#E8D5D5', color: '#6B3A3A' },
];

function getAccessSummary(member: TeamMember): { label: string; tint: string } {
  if (member.isOwner) return { label: 'Owner', tint: 'var(--accent-gold, #D4943A)' };
  const fields: (keyof AccessToggles)[] = Object.keys(ACCESS_TOGGLE_LABELS) as (keyof AccessToggles)[];
  const camelFields = fields.map((f) => f.replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
  const offCount = camelFields.filter((f) => !(member as unknown as Record<string, boolean>)[f]).length;
  if (offCount === 0) return { label: 'Full access', tint: '#3A6B5A' };
  if (offCount <= 3) return { label: 'Custom', tint: '#B8860B' };
  return { label: 'Limited', tint: 'var(--text-muted, #9C9488)' };
}

export function Team({ projectId }: TeamProps) {
  const store = useTeamStore(projectId);
  const members = store((s) => s.members);
  const inviteCode = store((s) => s.inviteCode);
  const isLoading = store((s) => s.isLoading);
  const loadFromSupabase = store((s) => s.loadFromSupabase);
  const updateMemberAccess = store((s) => s.updateMemberAccess);
  const removeMemberFromSupabase = store((s) => s.removeMemberFromSupabase);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Phones use a master-detail pattern: list-only until you tap a
  // member, then the detail pane covers the screen with a back arrow.
  const isMobile = useIsMobile();
  const showList = !isMobile || !selectedId;
  const showDetail = !isMobile || !!selectedId;

  useEffect(() => {
    loadFromSupabase(projectId);
  }, [projectId, loadFromSupabase]);

  const selected = members.find((m) => m.membershipId === selectedId || m.id === selectedId);
  const roleLabel = (role: TeamRole) => TEAM_ROLES.find((r) => r.value === role)?.label || role;

  const handleToggle = async (field: string, value: boolean) => {
    if (!selected) return;
    await updateMemberAccess(selected.membershipId, field, value);
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  };

  const handleRemove = async () => {
    if (!confirmRemoveId) return;
    const member = members.find((m) => m.membershipId === confirmRemoveId || m.id === confirmRemoveId);
    if (!member) return;
    await removeMemberFromSupabase(member.membershipId, projectId);
    setConfirmRemoveId(null);
    if (selectedId === confirmRemoveId) setSelectedId(null);
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      // Clipboard write can fail in older browsers / restrictive contexts —
      // silently swallow; the code is visible so users can still copy by hand.
    }
  };

  return (
    <div className="tm-page">
      {/* Header bar — mirrors breakdown's bs-header */}
      <div className="tm-header">
        <div className="tm-header-left">
          <h1 className="tm-title">
            <span className="tm-title-italic">Team</span>{' '}
            <span className="tm-title-regular">Members</span>
          </h1>
          <p className="tm-subtitle">
            {members.length} member{members.length !== 1 ? 's' : ''}
            {' · '}members appear here once they join with the invite code below
          </p>
        </div>
        <div className="tm-header-right">
          <div className="tm-invite-chip" title="Share this code with your team to let them join the project">
            <span className="tm-invite-chip-label">Invite</span>
            <span className="tm-invite-chip-code">{inviteCode}</span>
            <button
              type="button"
              className="tm-invite-chip-copy"
              onClick={handleCopyInvite}
              aria-label="Copy invite code"
              title="Copy invite code"
            >
              {copiedCode ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>
      </div>

      <div className={`tm-body ${isMobile ? 'tm-body--mobile' : ''}`}>
        {/* List */}
        {showList && (
          <div className="tm-list-pane">
            {isLoading && members.length === 0 ? (
              <div className="tm-list-empty">Loading…</div>
            ) : members.length === 0 ? (
              <div className="tm-list-empty">
                No team members yet
                <span className="tm-list-empty-hint">
                  Share the invite code at the top to add people to this project.
                </span>
              </div>
            ) : (
              <div className="tm-list">
                {members.map((m) => {
                  const ac = AVATAR_COLORS[m.avatarColor % AVATAR_COLORS.length];
                  const summary = getAccessSummary(m);
                  const isSelected = m.membershipId === selectedId || m.id === selectedId;
                  return (
                    <button
                      key={m.membershipId || m.id}
                      type="button"
                      onClick={() => setSelectedId(m.membershipId || m.id)}
                      className={`tm-list-item ${isSelected ? 'tm-list-item--active' : ''}`}
                    >
                      <span
                        className="tm-list-avatar"
                        style={{ backgroundColor: ac.bg, color: ac.color }}
                      >
                        {m.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span className="tm-list-meta">
                        <span className="tm-list-name">{m.name}</span>
                        <span className="tm-list-role">{roleLabel(m.role)}</span>
                      </span>
                      <span
                        className="tm-list-tag"
                        style={{ color: summary.tint, backgroundColor: `${summary.tint}15` }}
                      >
                        {summary.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Detail */}
        {showDetail && (
          <div className="tm-detail-pane">
            {isMobile && selected && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="tm-detail-back"
                aria-label="Back to team list"
              >
                <BackIcon /> Back to list
              </button>
            )}
            {!selected ? (
              <div className="tm-detail-empty">Select a team member</div>
            ) : selected.isOwner ? (
              <>
                <MemberHeader member={selected} />
                <div className="tm-detail-owner-note">Project owner — full access.</div>
              </>
            ) : (
              <>
                <MemberHeader member={selected} />
                <h2 className="tm-detail-section-title">Access settings</h2>
                <div className="tm-access-list">
                  {(Object.keys(ACCESS_TOGGLE_LABELS) as (keyof AccessToggles)[]).map((dbField) => {
                    const label = ACCESS_TOGGLE_LABELS[dbField];
                    const camelField = dbField.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
                    const value = (selected as unknown as Record<string, boolean | undefined>)[camelField] ?? true;
                    return (
                      <div key={dbField} className="tm-access-row">
                        <div className="tm-access-info">
                          <div className="tm-access-label">{label.name}</div>
                          <div className="tm-access-desc">{label.description}</div>
                        </div>
                        <div className="tm-access-controls">
                          {savedField === camelField && (
                            <span className="tm-access-saved">Saved ✓</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggle(camelField, !value)}
                            className={`tm-toggle ${value ? 'tm-toggle--on' : ''}`}
                            aria-pressed={value}
                            aria-label={`Toggle ${label.name}`}
                          >
                            <span className="tm-toggle-knob" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="tm-detail-danger">
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(selected.membershipId || selected.id)}
                    className="tm-remove-link"
                  >
                    Remove from project
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Remove confirmation */}
      {confirmRemoveId &&
        (() => {
          const member = members.find(
            (m) => m.membershipId === confirmRemoveId || m.id === confirmRemoveId,
          );
          if (!member) return null;
          return (
            <div className="tm-modal-overlay" onClick={() => setConfirmRemoveId(null)}>
              <div className="tm-modal tm-modal--sm" onClick={(e) => e.stopPropagation()}>
                <div className="tm-modal-header">
                  <h3 className="tm-modal-title">Remove {member.name}?</h3>
                  <button
                    type="button"
                    className="tm-modal-close"
                    onClick={() => setConfirmRemoveId(null)}
                    aria-label="Close"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className="tm-modal-body">
                  <p className="tm-modal-message">
                    Their continuity entries and logged hours will be preserved. They will lose access immediately.
                  </p>
                </div>
                <div className="tm-modal-footer">
                  <button
                    type="button"
                    className="tm-modal-cancel"
                    onClick={() => setConfirmRemoveId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="tm-modal-confirm tm-modal-confirm--danger"
                    onClick={handleRemove}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

function MemberHeader({ member }: { member: TeamMember }) {
  const ac = AVATAR_COLORS[member.avatarColor % AVATAR_COLORS.length];
  const roleLabel = TEAM_ROLES.find((r) => r.value === member.role)?.label || member.role;
  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="tm-detail-header">
      <div
        className="tm-detail-avatar"
        style={{ backgroundColor: ac.bg, color: ac.color }}
      >
        {initials}
      </div>
      <div>
        <div className="tm-detail-name">{member.name}</div>
        <div className="tm-detail-meta">
          {roleLabel}
          {' · joined '}
          {new Date(member.joinedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      </div>
    </div>
  );
}

/* ━━━ Icons ━━━ */

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
