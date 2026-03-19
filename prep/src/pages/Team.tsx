import { useState, useCallback } from 'react';
import {
  useTeamStore,
  TEAM_ROLES,
  PERMISSION_LEVELS,
  type TeamMember,
  type TeamRole,
  type PermissionLevel,
  type ProjectPermissions,
} from '@/stores/teamStore';

interface TeamProps {
  projectId: string;
}

type Panel = 'members' | 'permissions' | 'invite';

const AVATAR_COLORS = [
  { bg: '#E8D5C0', color: '#8B5E3C' },
  { bg: '#D5E8E0', color: '#3A6B5A' },
  { bg: '#E8E0D5', color: '#6B5A3A' },
  { bg: '#D5D8E8', color: '#3A4A6B' },
  { bg: '#E8D5D5', color: '#6B3A3A' },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TEAM PAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function Team({ projectId }: TeamProps) {
  const store = useTeamStore(projectId);
  const members = store((s) => s.members);
  const inviteCode = store((s) => s.inviteCode);
  const permissions = store((s) => s.permissions);
  const addMember = store((s) => s.addMember);
  const removeMember = store((s) => s.removeMember);
  const updateRole = store((s) => s.updateRole);
  const updatePermissions = store((s) => s.updatePermissions);
  const regenerateCode = store((s) => s.regenerateCode);

  const [panel, setPanel] = useState<Panel>('members');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // Group members by role
  const grouped = groupByRole(members);

  return (
    <div className="tm-page">
      {/* Header */}
      <div className="tm-header">
        <div>
          <h1 className="tm-title">
            <span className="tm-title-italic">Team</span>{' '}
            <span className="tm-title-regular">Management</span>
          </h1>
          <p className="tm-subtitle">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="tm-add-btn" onClick={() => setShowAddModal(true)}>
          <PlusIcon />
          Add Member
        </button>
      </div>

      {/* Tabs */}
      <div className="tm-tabs">
        <button
          className={`tm-tab ${panel === 'members' ? 'tm-tab--active' : ''}`}
          onClick={() => setPanel('members')}
        >
          <UsersIcon /> Members
        </button>
        <button
          className={`tm-tab ${panel === 'permissions' ? 'tm-tab--active' : ''}`}
          onClick={() => setPanel('permissions')}
        >
          <ShieldIcon /> Permissions
        </button>
        <button
          className={`tm-tab ${panel === 'invite' ? 'tm-tab--active' : ''}`}
          onClick={() => setPanel('invite')}
        >
          <LinkIcon /> Invite Code
        </button>
      </div>

      {/* ── Members Panel ── */}
      {panel === 'members' && (
        <div className="tm-members">
          {members.length === 0 ? (
            <div className="tm-empty">
              <div className="tm-empty-icon"><UsersIcon /></div>
              <p>No team members yet</p>
              <p className="tm-empty-hint">Add members or share the invite code to get started</p>
              <button className="tm-empty-btn" onClick={() => setShowAddModal(true)}>
                Add First Member
              </button>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.role} className="tm-role-group">
                <div className="tm-role-header">
                  <span className="tm-role-label">{group.label}</span>
                  <span className="tm-role-count">{group.members.length}</span>
                </div>
                {group.members.map((m) => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    onChangeRole={(role) => updateRole(m.id, role)}
                    onRemove={() => setConfirmRemove(m.id)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Permissions Panel ── */}
      {panel === 'permissions' && (
        <PermissionsPanel
          permissions={permissions}
          onChange={updatePermissions}
        />
      )}

      {/* ── Invite Code Panel ── */}
      {panel === 'invite' && (
        <InvitePanel
          code={inviteCode}
          onRegenerate={regenerateCode}
        />
      )}

      {/* ── Add Member Modal ── */}
      {showAddModal && (
        <AddMemberModal
          onAdd={(name, email, role) => {
            addMember({ name, email, role, isOwner: false });
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* ── Confirm Remove Modal ── */}
      {confirmRemove && (
        <ConfirmModal
          title="Remove team member?"
          message="This person will lose access to all project data. This action cannot be undone."
          confirmLabel="Remove"
          onConfirm={() => { removeMember(confirmRemove); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

/* ━━━ Member Card ━━━ */

function MemberCard({
  member,
  onChangeRole,
  onRemove,
}: {
  member: TeamMember;
  onChangeRole: (role: TeamRole) => void;
  onRemove: () => void;
}) {
  const avatarColor = AVATAR_COLORS[member.avatarColor % AVATAR_COLORS.length];
  const initials = member.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const roleLabel = TEAM_ROLES.find((r) => r.value === member.role)?.label || member.role;

  return (
    <div className="tm-card">
      <div
        className="tm-card-avatar"
        style={{ background: avatarColor.bg, color: avatarColor.color }}
      >
        {initials}
      </div>

      <div className="tm-card-info">
        <div className="tm-card-name">
          {member.name}
          {member.isOwner && <span className="tm-owner-badge">Owner</span>}
        </div>
        <div className="tm-card-email">{member.email}</div>
        <div className="tm-card-meta">
          Joined {formatDate(member.joinedAt)}
        </div>
      </div>

      <div className="tm-card-actions">
        {!member.isOwner && (
          <>
            <select
              className="tm-role-select"
              value={member.role}
              onChange={(e) => onChangeRole(e.target.value as TeamRole)}
            >
              {TEAM_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button className="tm-remove-btn" onClick={onRemove} title="Remove member">
              <XIcon />
            </button>
          </>
        )}
        {member.isOwner && (
          <span className="tm-role-label-static">{roleLabel}</span>
        )}
      </div>
    </div>
  );
}

/* ━━━ Permissions Panel ━━━ */

const PERMISSION_ITEMS: { key: keyof ProjectPermissions; label: string; description: string }[] = [
  { key: 'editScript', label: 'Edit Script', description: 'Upload and modify the script breakdown' },
  { key: 'editBreakdown', label: 'Edit Breakdown', description: 'Modify scene breakdowns and tags' },
  { key: 'editCharacterDesign', label: 'Edit Character Design', description: 'Create and modify character looks' },
  { key: 'editContinuity', label: 'Edit Continuity', description: 'Update continuity notes and photos' },
  { key: 'editBudget', label: 'Edit Budget', description: 'Modify budget entries and categories' },
  { key: 'viewBudget', label: 'View Budget', description: 'See budget information and totals' },
  { key: 'editTimesheet', label: 'Edit Timesheet', description: 'Submit and approve timesheets' },
  { key: 'editSchedule', label: 'Edit Schedule', description: 'Upload and modify the production schedule' },
  { key: 'manageTeam', label: 'Manage Team', description: 'Add/remove members and change roles' },
];

function PermissionsPanel({
  permissions,
  onChange,
}: {
  permissions: ProjectPermissions;
  onChange: (perms: Partial<ProjectPermissions>) => void;
}) {
  return (
    <div className="tm-perms">
      <p className="tm-perms-intro">
        Control which team members can access and edit different parts of the project.
        The project owner always has full access.
      </p>
      <div className="tm-perms-grid">
        {PERMISSION_ITEMS.map((item) => (
          <div key={item.key} className="tm-perm-row">
            <div className="tm-perm-info">
              <span className="tm-perm-label">{item.label}</span>
              <span className="tm-perm-desc">{item.description}</span>
            </div>
            <select
              className="tm-perm-select"
              value={permissions[item.key]}
              onChange={(e) =>
                onChange({ [item.key]: e.target.value as PermissionLevel })
              }
            >
              {PERMISSION_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ━━━ Invite Panel ━━━ */

function InvitePanel({
  code,
  onRegenerate,
}: {
  code: string;
  onRegenerate: () => string;
}) {
  const [copied, setCopied] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="tm-invite">
      <p className="tm-invite-intro">
        Share this code with team members so they can join the project from the Checks Happy app.
      </p>

      <div className="tm-invite-code-wrap">
        <span className="tm-invite-code">{code}</span>
      </div>

      <div className="tm-invite-actions">
        <button className="tm-invite-btn" onClick={copyCode}>
          {copied ? (
            <><CheckIcon /> Copied!</>
          ) : (
            <><CopyIcon /> Copy Code</>
          )}
        </button>
        <button className="tm-invite-btn tm-invite-btn--share" onClick={async () => {
          if (navigator.share) {
            try {
              await navigator.share({
                title: 'Join my project on Checks Happy',
                text: `Use code ${code} to join my production on Checks Happy!`,
              });
            } catch { /* cancelled */ }
          } else {
            copyCode();
          }
        }}>
          <ShareIcon /> Share
        </button>
      </div>

      <div className="tm-invite-regen">
        <div className="tm-invite-regen-info">
          <span className="tm-invite-regen-title">Regenerate Code</span>
          <span className="tm-invite-regen-desc">
            Create a new code if the current one has been shared too widely.
            Existing team members won't be affected.
          </span>
        </div>
        <button
          className="tm-invite-regen-btn"
          onClick={() => setShowRegenConfirm(true)}
        >
          Regenerate
        </button>
      </div>

      {showRegenConfirm && (
        <ConfirmModal
          title="Regenerate invite code?"
          message={`The current code (${code}) will stop working immediately. Team members already joined won't be affected.`}
          confirmLabel="Regenerate"
          onConfirm={() => { onRegenerate(); setShowRegenConfirm(false); }}
          onCancel={() => setShowRegenConfirm(false)}
        />
      )}
    </div>
  );
}

/* ━━━ Add Member Modal ━━━ */

function AddMemberModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, email: string, role: TeamRole) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('makeup');

  return (
    <div className="tm-modal-overlay" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tm-modal-header">
          <h2 className="tm-modal-title">Add Team Member</h2>
          <button className="tm-modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="tm-modal-body">
          <div className="tm-form-group">
            <label className="tm-form-label">Name</label>
            <input
              className="tm-form-input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="tm-form-group">
            <label className="tm-form-label">Email</label>
            <input
              className="tm-form-input"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="tm-form-group">
            <label className="tm-form-label">Role</label>
            <select
              className="tm-form-input"
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
            >
              {TEAM_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="tm-modal-footer">
          <button className="tm-modal-cancel" onClick={onClose}>Cancel</button>
          <button
            className="tm-modal-confirm"
            disabled={!name.trim() || !email.trim()}
            onClick={() => onAdd(name.trim(), email.trim(), role)}
          >
            Add Member
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ Confirm Modal ━━━ */

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="tm-modal-overlay" onClick={onCancel}>
      <div className="tm-modal tm-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="tm-modal-header">
          <h2 className="tm-modal-title">{title}</h2>
        </div>
        <div className="tm-modal-body">
          <p className="tm-modal-message">{message}</p>
        </div>
        <div className="tm-modal-footer">
          <button className="tm-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="tm-modal-confirm tm-modal-confirm--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ Helpers ━━━ */

function groupByRole(members: TeamMember[]) {
  const groups: Map<TeamRole, TeamMember[]> = new Map();
  TEAM_ROLES.forEach((r) => groups.set(r.value, []));
  members.forEach((m) => {
    groups.get(m.role)?.push(m);
  });
  groups.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));

  return TEAM_ROLES
    .filter((r) => (groups.get(r.value)?.length ?? 0) > 0)
    .map((r) => ({
      role: r.value,
      label: r.label + (groups.get(r.value)!.length > 1 ? 's' : ''),
      members: groups.get(r.value)!,
    }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ━━━ Icons ━━━ */

function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function ShieldIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function LinkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function CopyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function ShareIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}
