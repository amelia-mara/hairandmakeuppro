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
  const camelFields = fields.map(f => f.replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
  const offCount = camelFields.filter(f => !(member as any)[f]).length;
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

  /* Mobile-only — phones use a master-detail pattern: when no member
     is selected the list panel takes the full screen; tapping a
     member swaps in the detail panel with a back arrow. The 320px
     desktop list + flex-1 detail pair would otherwise need ≥600px
     of horizontal room which a phone doesn't have. */
  const isMobile = useIsMobile();
  const showList = !isMobile || !selectedId;
  const showDetail = !isMobile || !!selectedId;

  useEffect(() => {
    loadFromSupabase(projectId);
  }, [projectId, loadFromSupabase]);

  const selected = members.find(m => m.membershipId === selectedId || m.id === selectedId);
  const roleLabel = (role: TeamRole) => TEAM_ROLES.find(r => r.value === role)?.label || role;

  const handleToggle = async (field: string, value: boolean) => {
    if (!selected) return;
    await updateMemberAccess(selected.membershipId, field, value);
    setSavedField(field);
    setTimeout(() => setSavedField(null), 1500);
  };

  const handleRemove = async () => {
    if (!confirmRemoveId) return;
    const member = members.find(m => m.membershipId === confirmRemoveId || m.id === confirmRemoveId);
    if (!member) return;
    await removeMemberFromSupabase(member.membershipId, projectId);
    setConfirmRemoveId(null);
    if (selectedId === confirmRemoveId) setSelectedId(null);
  };

  return (
    <div
      className="tm-page"
      style={{
        display: 'flex',
        gap: isMobile ? 0 : '24px',
        padding: isMobile ? '16px' : '24px',
        minHeight: 'calc(100vh - 80px)',
      }}
    >
      {/* Left panel — member list */}
      {showList && (
      <div style={{
        width: isMobile ? '100%' : '320px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-secondary, #F0EBE0)', borderRadius: '12px',
        padding: '16px',
        overflow: 'auto',
        maxHeight: isMobile ? undefined : 'calc(100vh - 128px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '0.8125rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-heading)', margin: 0 }}>
              <span style={{ fontStyle: 'italic' }}>Team</span>{' '}
              <span style={{ fontWeight: 400 }}>Members</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Invite code */}
        <div style={{
          padding: '10px 12px', marginBottom: '12px', borderRadius: '8px',
          backgroundColor: 'var(--bg-primary, #FAF5EB)', border: '1px dashed var(--border-subtle)',
          fontSize: '0.6875rem', color: 'var(--text-muted)',
        }}>
          Invite code: <span style={{ fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>{inviteCode}</span>
        </div>

        {isLoading && members.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading...</p>
        ) : members.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No team members yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {members.map(m => {
              const ac = AVATAR_COLORS[m.avatarColor % AVATAR_COLORS.length];
              const summary = getAccessSummary(m);
              const isSelected = (m.membershipId === selectedId || m.id === selectedId);
              return (
                <button
                  key={m.membershipId || m.id}
                  onClick={() => setSelectedId(m.membershipId || m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '8px', border: 'none',
                    backgroundColor: isSelected ? 'var(--bg-primary, #FAF5EB)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    backgroundColor: ac.bg, color: ac.color,
                    fontSize: '0.6875rem', fontWeight: 700,
                  }}>
                    {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {roleLabel(m.role)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.5625rem', fontWeight: 600, padding: '2px 6px',
                    borderRadius: '4px', color: summary.tint,
                    backgroundColor: `${summary.tint}15`,
                    whiteSpace: 'nowrap',
                  }}>
                    {summary.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Right panel — member detail */}
      {showDetail && (
      <div style={{
        flex: 1, backgroundColor: 'var(--bg-primary, #FAF5EB)', borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        overflow: 'auto',
        maxHeight: isMobile ? undefined : 'calc(100vh - 128px)',
      }}>
        {isMobile && selected && (
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px',
              padding: '6px 10px',
              background: 'none',
              border: '1px solid var(--border-card)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            aria-label="Back to team list"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to list
          </button>
        )}
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Select a team member
          </div>
        ) : selected.isOwner ? (
          <div>
            <MemberHeader member={selected} />
            <div style={{ marginTop: '24px', padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary, #F0EBE0)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Project owner — full access
            </div>
          </div>
        ) : (
          <div>
            <MemberHeader member={selected} />

            {/* Access toggles */}
            <div style={{ marginTop: '24px' }}>
              <div style={{
                fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px',
              }}>
                Access Settings
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(Object.keys(ACCESS_TOGGLE_LABELS) as (keyof AccessToggles)[]).map(dbField => {
                  const label = ACCESS_TOGGLE_LABELS[dbField];
                  const camelField = dbField.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
                  const value = (selected as any)[camelField] ?? true;
                  return (
                    <div
                      key={dbField}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: '6px',
                        backgroundColor: 'var(--bg-secondary, #F0EBE0)',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label.name}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>{label.description}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {savedField === camelField && (
                          <span style={{ fontSize: '0.625rem', color: '#3A6B5A' }}>Saved ✓</span>
                        )}
                        <button
                          onClick={() => handleToggle(camelField, !value)}
                          style={{
                            width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                            backgroundColor: value ? '#D4691E' : '#D5CFC3',
                            position: 'relative', transition: 'background-color 0.2s',
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: 2, left: value ? 20 : 2,
                            width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.15)', transition: 'left 0.2s',
                          }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Remove from project */}
            <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <button
                onClick={() => setConfirmRemoveId(selected.membershipId || selected.id)}
                style={{
                  background: 'none', border: 'none', color: '#C4522A',
                  fontSize: '0.8125rem', cursor: 'pointer', padding: '8px 0',
                }}
              >
                Remove from project
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Remove confirmation */}
      {confirmRemoveId && (() => {
        const member = members.find(m => m.membershipId === confirmRemoveId || m.id === confirmRemoveId);
        if (!member) return null;
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)',
          }} onClick={() => setConfirmRemoveId(null)}>
            <div style={{
              backgroundColor: 'var(--bg-primary, #FAF5EB)', borderRadius: '12px',
              padding: '24px', maxWidth: '400px', width: '100%',
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 8px' }}>
                Remove {member.name}?
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
                Their continuity entries and logged hours will be preserved. They will lose access immediately.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConfirmRemoveId(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-card)',
                    background: 'none', color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemove}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#C4522A', color: '#fff', fontSize: '0.8125rem',
                    fontWeight: 500, cursor: 'pointer',
                  }}
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
  const roleLabel = TEAM_ROLES.find(r => r.value === member.role)?.label || member.role;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        backgroundColor: ac.bg, color: ac.color,
        fontSize: '0.875rem', fontWeight: 700,
      }}>
        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div>
        <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-heading)' }}>{member.name}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {roleLabel} · joined {new Date(member.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
