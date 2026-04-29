import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTimesheetStore, CURRENCY_SYMBOLS, type CrewMember, type CurrencyCode, type WeekSummary } from '@/stores/timesheetStore';
import { AddCrewModal } from '@/components/timesheet/crew/AddCrewModal';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAuthStore } from '@/stores/authStore';
import { useUserProfileStore, isProfileComplete } from '@/stores/userProfileStore';
import { UserProfileModal } from '@/components/profile/UserProfileModal';

interface TimesheetProps {
  projectId: string;
}

/* ── Sidebar panels ── */
type PanelId = 'overview' | 'my-ts' | 'invoices' | 'team-ts' | 'team-manage';

interface SidebarItem {
  id: PanelId;
  num: string;
  label: string;
  status: 'done' | 'going' | 'none';
}

/* ── Helpers ── */
function fmt(amount: number, currency: CurrencyCode): string {
  const sym = CURRENCY_SYMBOLS[currency] || '£';
  return `${sym}${Math.round(amount).toLocaleString()}`;
}

function fmtDec(amount: number, currency: CurrencyCode): string {
  const sym = CURRENCY_SYMBOLS[currency] || '£';
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  { bg: '#E8D5C0', color: '#8B5E3C' },
  { bg: '#D5E8E0', color: '#3A6B5A' },
  { bg: '#E8E0D5', color: '#6B5A3A' },
  { bg: '#D5D8E8', color: '#3A4A6B' },
  { bg: '#E8D5D5', color: '#6B3A3A' },
];

function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

/**
 * Confirmation dialog shown before deleting a crew member. Removing
 * the row also wipes their logged hours, so we never auto-confirm.
 */
function RemoveCrewConfirm({
  member,
  onCancel,
  onConfirm,
}: {
  member: CrewMember;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="tm-modal-overlay" onClick={onCancel}>
      <div className="tm-modal tm-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="tm-modal-header">
          <h3 className="tm-modal-title">Remove {member.name}?</h3>
          <button
            type="button"
            className="tm-modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="tm-modal-body">
          <p className="tm-modal-message">
            All of {member.name.split(' ')[0]}'s logged hours, rate-card overrides and timesheet entries on this project will be deleted. This can't be undone.
          </p>
        </div>
        <div className="tm-modal-footer">
          <button type="button" className="tm-modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="tm-modal-confirm tm-modal-confirm--danger"
            onClick={onConfirm}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small "You" pill used to mark the current user's crew row so the
 * designer can spot their own invoice apart from the team's at a
 * glance. Rendered alongside the member's name everywhere the crew
 * list shows up.
 */
function YouPill() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        fontSize: '0.5625rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        borderRadius: '999px',
        background: 'rgba(var(--a), 0.12)',
        color: 'var(--accent)',
      }}
    >
      You
    </span>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TIMESHEET PAGE — Redesigned with sidebar navigation
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function Timesheet({ projectId }: TimesheetProps) {
  const [activePanel, setActivePanel] = useState<PanelId>('overview');
  const [toast, setToast] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<Record<string, boolean>>({});
  const [expandedRc, setExpandedRc] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);

  /* Mobile-only — phone viewport (≤768px) hides the 210px sidebar by
     default and slides it in from the left when ☰ is tapped. Picking
     a panel auto-closes the drawer. */
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);
  const pickPanel = (id: PanelId) => { setActivePanel(id); setDrawerOpen(false); };

  const store = useTimesheetStore(projectId);
  const production = store(s => s.production);
  const crew = store(s => s.crew);
  const selectedWeekStart = store(s => s.selectedWeekStart);
  const addCrew = store(s => s.addCrew);
  const removeCrew = store(s => s.removeCrew);
  const ensureSelfCrew = store(s => s.ensureSelfCrew);
  const getCrewWeekSummary = store(s => s.getCrewWeekSummary);
  const getTotalLabourCost = store(s => s.getTotalLabourCost);

  // Remove-crew confirmation. Deleting also wipes that crew's logged
  // hours, so we never auto-confirm — the user has to acknowledge.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const confirmRemoveMember = useMemo(
    () => crew.find((c) => c.id === confirmRemoveId) ?? null,
    [crew, confirmRemoveId],
  );
  // handleRemoveCrew is declared further down once showToast exists —
  // see below.

  const { currency } = production;

  /* ── Personal-details reminder ────────────────────────────────────
     Some users only want the timesheet calculator and never plan to
     invoice from Checks Happy. We show the profile modal as a
     dismissable reminder when the user opens the timesheet with an
     incomplete profile, but they can skip and continue using the
     page. The user can fill in details later from the account panel
     (Edit Profile). The "me" crew row is created with whatever
     identity we already know (auth name + email, defaults for the
     rest) so the page is usable even without invoicing details. */
  const authUser = useAuthStore((s) => s.user);
  const profile = useUserProfileStore((s) =>
    authUser ? s.profiles[authUser.id] : undefined,
  );
  const ensureProfile = useUserProfileStore((s) => s.ensureProfile);
  const profileComplete = isProfileComplete(profile);
  const reminderDismissed = profile?.signupNudgeDismissed ?? false;
  const [showProfileReminder, setShowProfileReminder] = useState(
    !!authUser && !profileComplete && !reminderDismissed,
  );
  // Re-fire the reminder if the user lands on the timesheet after
  // dismissing it elsewhere — but never twice in the same session
  // and never once they've completed the profile.
  useEffect(() => {
    if (!authUser) return;
    setShowProfileReminder(!profileComplete && !reminderDismissed);
  }, [authUser, profileComplete, reminderDismissed]);

  useEffect(() => {
    if (!authUser) return;
    // Always make sure a "me" crew row exists, even when the user
    // skipped the profile. We fall back to the auth user's name/email
    // and a sensible default crew type.
    const p = profile ?? ensureProfile(authUser.id, authUser.name, authUser.email);
    ensureSelfCrew({
      userId: authUser.id,
      name: p.fullName || authUser.name,
      email: p.email || authUser.email,
      phone: p.phone,
      crewType: p.crewType,
      // Profile's default rate card seeds new "Me" rows. ensureSelfCrew
      // ignores it on rows that already exist so we never overwrite a
      // per-project rate the user already negotiated.
      rateCard: p.rateCard,
    });
  }, [authUser, profile, ensureProfile, ensureSelfCrew]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleRemoveCrew = useCallback(() => {
    if (!confirmRemoveId) return;
    removeCrew(confirmRemoveId);
    setConfirmRemoveId(null);
    showToast('Crew member removed');
  }, [confirmRemoveId, removeCrew, showToast]);

  /* Compute crew summaries — pin the "me" row to the top so the user
     always sees their own invoice ahead of the team list. */
  const crewSummaries = useMemo(() => {
    const sorted = [...crew].sort((a, b) => {
      if (a.isMe && !b.isMe) return -1;
      if (!a.isMe && b.isMe) return 1;
      return 0;
    });
    return sorted.map((member, idx) => ({
      member,
      summary: getCrewWeekSummary(member.id, selectedWeekStart),
      colorIdx: idx,
    }));
  }, [crew, selectedWeekStart, getCrewWeekSummary]);

  const totalLabour = getTotalLabourCost(selectedWeekStart);
  const totalHours = crewSummaries.reduce((s, c) => s + c.summary.totalHours, 0);
  const totalOtHours = crewSummaries.reduce((s, c) => s + c.summary.otHours, 0);
  const totalBasePay = crewSummaries.reduce((s, c) => s + c.summary.basePay, 0);
  const totalOtPay = crewSummaries.reduce((s, c) => s + c.summary.overtimePay, 0);
  const totalDays = crewSummaries.reduce((s, c) => s + c.summary.entries.filter(e => e.unitCall).length, 0);

  /* Determine sidebar item status */
  const sidebarItems: SidebarItem[] = [
    { id: 'overview', num: '01', label: 'Overview', status: crew.length > 0 ? 'done' : 'none' },
    { id: 'my-ts', num: '02', label: 'My Timesheets', status: crew.length > 0 ? 'going' : 'none' },
    { id: 'invoices', num: '03', label: 'My Invoices', status: 'going' },
    { id: 'team-ts', num: '04', label: 'Team Timesheets', status: crew.length > 1 ? 'going' : 'none' },
    { id: 'team-manage', num: '05', label: 'Team Management', status: crew.length > 0 ? 'done' : 'none' },
  ];

  const toggleTeamExpand = (id: string) => setExpandedTeam(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleRcExpand = (id: string) => setExpandedRc(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className={`tsr-layout${isMobile ? ' tsr-layout--mobile' : ''}${isMobile && drawerOpen ? ' tsr-layout--drawer-open' : ''}`}>
      {/* Mobile drawer backdrop */}
      {isMobile && drawerOpen && (
        <div className="tsr-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      )}
      {/* ━━━ Sidebar ━━━ */}
      <nav className="tsr-sidebar">
        <div className="tsr-sb-label">Timesheet Manager</div>
        {sidebarItems.map(item => (
          <button
            key={item.id}
            className={`tsr-sb-item ${activePanel === item.id ? 'active' : ''}`}
            onClick={() => pickPanel(item.id)}
          >
            <span className="tsr-sb-num">{item.num}</span>
            {item.label}
            <span className={`tsr-sb-dot ${item.status}`} />
          </button>
        ))}
        <hr className="tsr-sb-divider" />
        <div className="tsr-sb-label">Completion</div>
        <div className="tsr-sb-legend-row">
          <div className="tsr-sb-legend-dot" style={{ background: 'var(--brand-teal)' }} />
          Complete
        </div>
        <div className="tsr-sb-legend-row">
          <div className="tsr-sb-legend-dot" style={{ background: 'var(--accent)', opacity: 0.65 }} />
          In progress
        </div>
        <div className="tsr-sb-legend-row">
          <div className="tsr-sb-legend-dot" style={{ border: '1.5px solid var(--border-medium)' }} />
          Not started
        </div>
      </nav>

      {/* ━━━ Main Content ━━━ */}
      <main className="tsr-main">
        {isMobile && (
          <button
            type="button"
            className="tsr-drawer-toggle"
            aria-label="Open timesheet sections"
            onClick={() => setDrawerOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span>Sections</span>
          </button>
        )}
        {/* ══════════════ 01 OVERVIEW ══════════════ */}
        {activePanel === 'overview' && (
          <OverviewPanel
            crew={crew}
            crewSummaries={crewSummaries}
            currency={currency}
            totalLabour={totalLabour}
            totalHours={totalHours}
            totalOtHours={totalOtHours}
            totalDays={totalDays}
            totalBasePay={totalBasePay}
            totalOtPay={totalOtPay}
          />
        )}

        {/* ══════════════ 02 MY TIMESHEETS ══════════════ */}
        {activePanel === 'my-ts' && (
          <MyTimesheetsPanel
            crew={crew}
            crewSummaries={crewSummaries}
            currency={currency}
            totalHours={totalHours}
            totalOtHours={totalOtHours}
            totalDays={totalDays}
            totalLabour={totalLabour}
          />
        )}

        {/* ══════════════ 03 MY INVOICES ══════════════ */}
        {activePanel === 'invoices' && (
          <InvoicesPanel currency={currency} totalLabour={totalLabour} crew={crew} />
        )}

        {/* ══════════════ 04 TEAM TIMESHEETS ══════════════ */}
        {activePanel === 'team-ts' && (
          <TeamTimesheetsPanel
            crew={crew}
            crewSummaries={crewSummaries}
            currency={currency}
            totalHours={totalHours}
            totalLabour={totalLabour}
            expandedTeam={expandedTeam}
            toggleTeamExpand={toggleTeamExpand}
          />
        )}

        {/* ══════════════ 05 TEAM MANAGEMENT ══════════════ */}
        {activePanel === 'team-manage' && (
          <TeamManagePanel
            crew={crew}
            crewSummaries={crewSummaries}
            currency={currency}
            totalLabour={totalLabour}
            totalDays={totalDays}
            expandedRc={expandedRc}
            toggleRcExpand={toggleRcExpand}
            onAddCrew={() => setShowAddModal(true)}
            onNavTimesheets={() => setActivePanel('team-ts')}
            onRemoveCrew={(id) => setConfirmRemoveId(id)}
          />
        )}
      </main>

      {showAddModal && (
        <AddCrewModal
          production={production}
          onAdd={(data) => {
            addCrew(data);
            showToast('Crew member added');
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {confirmRemoveMember && (
        <RemoveCrewConfirm
          member={confirmRemoveMember}
          onCancel={() => setConfirmRemoveId(null)}
          onConfirm={handleRemoveCrew}
        />
      )}

      {showProfileReminder && (
        <UserProfileModal
          isSignupNudge
          onClose={() => setShowProfileReminder(false)}
        />
      )}

      {toast && <div className="tsr-toast">{toast}</div>}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PANEL: Overview
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface CrewSummaryRow {
  member: CrewMember;
  summary: WeekSummary;
  colorIdx: number;
}

function OverviewPanel({
  crew, crewSummaries, currency, totalLabour, totalHours, totalOtHours, totalDays, totalBasePay, totalOtPay,
}: {
  crew: CrewMember[];
  crewSummaries: CrewSummaryRow[];
  currency: CurrencyCode;
  totalLabour: number;
  totalHours: number;
  totalOtHours: number;
  totalDays: number;
  totalBasePay: number;
  totalOtPay: number;
}) {
  const myRate = crew[0]?.rateCard.dailyRate ?? 0;

  return (
    <div>
      <div className="tsr-ph">
        <div>
          <div className="tsr-ph-eyebrow">01 — Overview</div>
          <h2 className="tsr-ph-title"><span className="tsr-ph-title-italic">Timesheet</span>{' '}<span className="tsr-ph-title-regular">Overview</span></h2>
          <div className="tsr-ph-sub">{crew.length} crew members active</div>
        </div>
      </div>

      {/* Earnings Band */}
      <div className="tsr-earnings-band">
        <div className="tsr-eb-cell">
          <div className="tsr-eb-label">Total Earnings</div>
          <div className="tsr-eb-val orange">{fmt(totalLabour, currency)}</div>
          <div className="tsr-eb-sub">{totalDays} days logged</div>
        </div>
        <div className="tsr-eb-cell">
          <div className="tsr-eb-label">Base Pay</div>
          <div className="tsr-eb-val teal">{fmt(totalBasePay, currency)}</div>
          <div className="tsr-eb-sub">{Math.round(totalHours - totalOtHours)} base hours</div>
        </div>
        <div className="tsr-eb-cell">
          <div className="tsr-eb-label">Overtime</div>
          <div className="tsr-eb-val gold">{fmt(totalOtPay, currency)}</div>
          <div className="tsr-eb-sub">{totalOtHours.toFixed(1)} OT hours</div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="tsr-stat-grid tsr-sg-4">
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Days Logged</div>
          <div className="tsr-stat-val">{totalDays}</div>
          <div className="tsr-stat-sub">All crew</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Total Hours</div>
          <div className="tsr-stat-val orange">{Math.round(totalHours)}</div>
          <div className="tsr-stat-sub">Incl. {totalOtHours.toFixed(1)} hrs overtime</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">My Day Rate</div>
          <div className="tsr-stat-val">{fmt(myRate, currency)}</div>
          <div className="tsr-stat-sub">{crew[0]?.position ?? 'HOD'}</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Team Size</div>
          <div className="tsr-stat-val teal">{crew.length}</div>
          <div className="tsr-stat-sub">Active crew</div>
        </div>
      </div>

      {/* Earnings Breakdown */}
      {totalLabour > 0 && (
        <>
          <div className="tsr-sh">Earnings Breakdown <div className="tsr-sh-line" /></div>
          <div className="tsr-card">
            <div className="tsr-earn-bar-row">
              <div className="tsr-ebr-name">Base Pay</div>
              <div className="tsr-ebr-bar"><div className="tsr-ebr-track"><div className="tsr-ebr-fill" style={{ width: `${totalLabour ? (totalBasePay / totalLabour) * 100 : 0}%` }} /></div></div>
              <div className="tsr-ebr-amt">{fmt(totalBasePay, currency)}</div>
              <div className="tsr-ebr-days">{totalDays} days</div>
            </div>
            <div className="tsr-earn-bar-row">
              <div className="tsr-ebr-name">Overtime</div>
              <div className="tsr-ebr-bar"><div className="tsr-ebr-track"><div className="tsr-ebr-fill teal" style={{ width: `${totalLabour ? (totalOtPay / totalLabour) * 100 : 0}%` }} /></div></div>
              <div className="tsr-ebr-amt">{fmt(totalOtPay, currency)}</div>
              <div className="tsr-ebr-days">{totalOtHours.toFixed(1)} hrs</div>
            </div>
            <div className="tsr-earn-bar-row" style={{ borderBottom: 'none' }}>
              <div className="tsr-ebr-name" style={{ fontWeight: 700 }}>Total</div>
              <div className="tsr-ebr-bar" />
              <div className="tsr-ebr-amt" style={{ fontWeight: 700, fontSize: 16 }}>{fmt(totalLabour, currency)}</div>
              <div className="tsr-ebr-days" />
            </div>
          </div>
        </>
      )}

      {/* Team Hours */}
      {crew.length > 0 && (
        <>
          <div className="tsr-sh">Team Hours <div className="tsr-sh-line" /></div>
          <div className="tsr-card flush">
            <div className="tsr-col-head">
              <div className="tsr-ch" style={{ flex: 1 }}>Team Member</div>
              <div className="tsr-ch" style={{ width: 80, textAlign: 'right' }}>Days</div>
              <div className="tsr-ch" style={{ width: 80, textAlign: 'right' }}>Hours</div>
              <div className="tsr-ch" style={{ width: 90, textAlign: 'right' }}>Earnings</div>
              <div className="tsr-ch" style={{ width: 90, textAlign: 'right' }}>Status</div>
            </div>
            {crewSummaries.map(({ member, summary, colorIdx }) => {
              const ac = getAvatarColor(colorIdx);
              const workedDays = summary.entries.filter(e => e.unitCall).length;
              return (
                <div key={member.id} className="tsr-team-row" style={{ cursor: 'default' }}>
                  <div className="tsr-avatar" style={{ background: ac.bg, color: ac.color }}>{getInitials(member.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {member.name}
                      {member.isMe && <YouPill />}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {member.position} · {fmt(member.rateCard.dailyRate, currency)}/day
                    </div>
                  </div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>{workedDays}</div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>{summary.totalHours.toFixed(1)} hrs</div>
                  <div style={{ width: 90, textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 15 }}>{fmt(summary.totalEarnings, currency)}</div>
                  <div style={{ width: 90, textAlign: 'right' }}>
                    <span className={`tsr-tag ${workedDays > 0 ? 'teal' : ''}`}>
                      {workedDays > 0 ? 'Up to date' : 'No entries'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {crew.length === 0 && (
        <div className="tsr-empty">
          Add crew members in Team Management to see your timesheet overview.
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PANEL: My Timesheets
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function MyTimesheetsPanel({
  crew, crewSummaries, currency, totalHours: _totalHours, totalOtHours: _totalOtHours, totalDays: _totalDays, totalLabour: _totalLabour,
}: {
  crew: CrewMember[];
  crewSummaries: CrewSummaryRow[];
  currency: CurrencyCode;
  totalHours: number;
  totalOtHours: number;
  totalDays: number;
  totalLabour: number;
}) {
  const myCrew = crew[0];
  const mySummary = crewSummaries[0]?.summary;
  const myRate = myCrew?.rateCard.dailyRate ?? 0;

  return (
    <div>
      <div className="tsr-ph">
        <div>
          <div className="tsr-ph-eyebrow">02 — My Timesheets</div>
          <div className="tsr-ph-title">My Timesheets</div>
          <div className="tsr-ph-sub">
            Track your hours · Day rate {fmt(myRate, currency)} · {myCrew?.rateCard.baseContract ?? '11+1'}
          </div>
        </div>
        <div className="tsr-ph-actions">
          <button className="tsr-btn tsr-btn-ghost">Export CSV</button>
          <button className="tsr-btn tsr-btn-primary">+ Log Day</button>
        </div>
      </div>

      <div className="tsr-stat-grid tsr-sg-4">
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Days This Week</div>
          <div className="tsr-stat-val">{mySummary ? mySummary.entries.filter(e => e.unitCall).length : 0}</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Total Hours</div>
          <div className="tsr-stat-val orange">{mySummary ? `${mySummary.totalHours.toFixed(1)} hrs` : '0'}</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Overtime Hours</div>
          <div className="tsr-stat-val gold">{mySummary ? `${mySummary.otHours.toFixed(1)} hrs` : '0'}</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Gross Earnings</div>
          <div className="tsr-stat-val teal">{mySummary ? fmtDec(mySummary.totalEarnings, currency) : fmtDec(0, currency)}</div>
        </div>
      </div>

      {/* Hour Log */}
      {mySummary && mySummary.entries.filter(e => e.unitCall).length > 0 && (
        <>
          <div className="tsr-sh">Hour Log <div className="tsr-sh-line" /></div>
          <div className="tsr-card flush">
            <div className="tsr-col-head">
              <div className="tsr-ch tsr-tc-date">Date</div>
              <div className="tsr-ch tsr-tc-day">Day</div>
              <div className="tsr-ch tsr-tc-dtype">Type</div>
              <div className="tsr-ch tsr-tc-wday">W/day</div>
              <div className="tsr-ch tsr-tc-start">Start</div>
              <div className="tsr-ch tsr-tc-end">Finish</div>
              <div className="tsr-ch tsr-tc-hrs" style={{ textAlign: 'right' }}>Hrs</div>
              <div className="tsr-ch tsr-tc-ot" style={{ textAlign: 'right' }}>OT</div>
              <div className="tsr-ch tsr-tc-earn" style={{ textAlign: 'right' }}>Earned</div>
            </div>
            {mySummary.entries.filter(e => e.unitCall).map(entry => {
              const d = new Date(entry.date + 'T12:00:00');
              const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
              const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
              return (
                <div key={entry.date} className="tsr-ts-row">
                  <div className="tsr-tc-date">{dateStr}</div>
                  <div className="tsr-tc-day">{dayName}</div>
                  <div className="tsr-tc-dtype"><span className="tsr-tag orange">Shoot</span></div>
                  <div className="tsr-tc-wday"><span className="tsr-tag gold">{myCrew?.rateCard.baseContract ?? '11+1'}</span></div>
                  <div className="tsr-tc-start">{entry.unitCall || '—'}</div>
                  <div className="tsr-tc-end">{entry.wrapOut || '—'}</div>
                  <div className="tsr-tc-hrs">{entry.unitCall && entry.wrapOut ? '—' : '—'}</div>
                  <div className="tsr-tc-ot">—</div>
                  <div className="tsr-tc-earn">{fmt(myRate, currency)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(!mySummary || mySummary.entries.filter(e => e.unitCall).length === 0) && (
        <div className="tsr-empty">
          No timesheet entries logged yet. Click "+ Log Day" to start tracking your hours.
        </div>
      )}

      <button className="tsr-add-btn">+ Log Day</button>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PANEL: My Invoices
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function InvoicesPanel({ currency, totalLabour, crew }: { currency: CurrencyCode; totalLabour: number; crew: CrewMember[] }) {
  const myRate = crew[0]?.rateCard.dailyRate ?? 0;

  return (
    <div>
      <div className="tsr-ph">
        <div>
          <div className="tsr-ph-eyebrow">03 — My Invoices</div>
          <div className="tsr-ph-title">My Invoices</div>
          <div className="tsr-ph-sub">Auto-generated from your timesheet · 14 day payment terms</div>
        </div>
        <div className="tsr-ph-actions">
          <button className="tsr-btn tsr-btn-ghost">Settings</button>
          <button className="tsr-btn tsr-btn-primary">+ New Invoice</button>
        </div>
      </div>

      <div className="tsr-stat-grid tsr-sg-4">
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Total Invoiced</div>
          <div className="tsr-stat-val orange">{fmt(0, currency)}</div>
          <div className="tsr-stat-sub">This production</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Paid</div>
          <div className="tsr-stat-val teal">{fmt(0, currency)}</div>
          <div className="tsr-stat-sub">0 invoices settled</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Outstanding</div>
          <div className="tsr-stat-val gold">{fmt(0, currency)}</div>
          <div className="tsr-stat-sub">No invoices pending</div>
        </div>
        <div className="tsr-stat-card">
          <div className="tsr-stat-label">Uninvoiced</div>
          <div className="tsr-stat-val red">{fmt(totalLabour, currency)}</div>
          <div className="tsr-stat-sub">Not yet invoiced</div>
        </div>
      </div>

      <div className="tsr-sh">Invoices <div className="tsr-sh-line" /></div>
      <div className="tsr-empty">
        No invoices created yet. Click "+ New Invoice" to generate one from your timesheet entries.
      </div>

      <div className="tsr-sh" style={{ marginTop: 28 }}>Invoice Details <div className="tsr-sh-line" /></div>
      <div className="tsr-card flush">
        <div className="tsr-info-grid">
          <div className="tsr-od-cell"><div className="tsr-od-key">Invoice Name</div><div className="tsr-od-val">{crew[0]?.name ?? '—'}</div></div>
          <div className="tsr-od-cell"><div className="tsr-od-key">Payment Terms</div><div className="tsr-od-val">14 days</div></div>
          <div className="tsr-od-cell"><div className="tsr-od-key">Day Rate</div><div className="tsr-od-val">{fmt(myRate, currency)}</div></div>
          <div className="tsr-od-cell"><div className="tsr-od-key">VAT Registered</div><div className="tsr-od-val">No</div></div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
        <button className="tsr-btn tsr-btn-ghost tsr-btn-sm">Edit Invoice Details</button>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PANEL: Team Timesheets
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function TeamTimesheetsPanel({
  crew, crewSummaries, currency, totalHours, totalLabour, expandedTeam, toggleTeamExpand,
}: {
  crew: CrewMember[];
  crewSummaries: CrewSummaryRow[];
  currency: CurrencyCode;
  totalHours: number;
  totalLabour: number;
  expandedTeam: Record<string, boolean>;
  toggleTeamExpand: (id: string) => void;
}) {
  const pendingCount = 0; // future: count entries with status !== 'approved'

  return (
    <div>
      <div className="tsr-ph">
        <div>
          <div className="tsr-ph-eyebrow">04 — Team Timesheets</div>
          <div className="tsr-ph-title">Team Timesheets</div>
          <div className="tsr-ph-sub">Review and approve your crew's hours · tap a row to expand</div>
        </div>
        <div className="tsr-ph-actions"><button className="tsr-btn tsr-btn-ghost">Export All</button></div>
      </div>

      <div className="tsr-stat-grid tsr-sg-4">
        <div className="tsr-stat-card"><div className="tsr-stat-label">Team Members</div><div className="tsr-stat-val">{crew.length}</div><div className="tsr-stat-sub">Active this production</div></div>
        <div className="tsr-stat-card"><div className="tsr-stat-label">Team Hours</div><div className="tsr-stat-val orange">{Math.round(totalHours)} hrs</div><div className="tsr-stat-sub">Across all crew</div></div>
        <div className="tsr-stat-card"><div className="tsr-stat-label">Pending Approval</div><div className="tsr-stat-val gold">{pendingCount}</div><div className="tsr-stat-sub">Entries awaiting review</div></div>
        <div className="tsr-stat-card"><div className="tsr-stat-label">Total Team Cost</div><div className="tsr-stat-val teal">{fmt(totalLabour, currency)}</div><div className="tsr-stat-sub">Wages logged to date</div></div>
      </div>

      <div className="tsr-sh">Team Hour Logs <div className="tsr-sh-line" /></div>

      {crewSummaries.map(({ member, summary, colorIdx }) => {
        const ac = getAvatarColor(colorIdx);
        const workedDays = summary.entries.filter(e => e.unitCall).length;
        const isOpen = expandedTeam[member.id] ?? false;

        return (
          <div key={member.id} className="tsr-card flush" style={{ marginBottom: 10 }}>
            <div className="tsr-team-row" style={{ cursor: 'pointer' }} onClick={() => toggleTeamExpand(member.id)}>
              <div className="tsr-avatar" style={{ background: ac.bg, color: ac.color }}>{getInitials(member.name)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {member.name}
                  {member.isMe && <YouPill />}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {member.position} · {fmt(member.rateCard.dailyRate, currency)}/day · {member.rateCard.baseContract}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>{workedDays} days</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginRight: 14 }}>{fmt(summary.totalEarnings, currency)}</div>
              <span className="tsr-tag teal">{workedDays > 0 ? 'All approved' : 'No entries'}</span>
              <div className="tsr-chevron" style={{ marginLeft: 12 }}>{isOpen ? '\u25B2' : '\u25BC'}</div>
            </div>
            <div className={`tsr-team-ts-block ${isOpen ? 'open' : ''}`}>
              <div className="tsr-team-ts-inner">
                <div style={{ display: 'flex', padding: '4px 0 10px', gap: 0 }}>
                  <div className="tsr-ch tsr-tte-date">Date</div>
                  <div className="tsr-ch tsr-tte-day">Day</div>
                  <div className="tsr-ch tsr-tte-dtype">Type</div>
                  <div className="tsr-ch tsr-tte-wday">W/day</div>
                  <div className="tsr-ch tsr-tte-hrs" style={{ textAlign: 'right' }}>Hrs</div>
                  <div className="tsr-ch tsr-tte-ot" style={{ textAlign: 'right' }}>OT</div>
                  <div className="tsr-ch tsr-tte-earn" style={{ textAlign: 'right' }}>Earned</div>
                  <div className="tsr-ch tsr-tte-appr" style={{ textAlign: 'right' }}>Approval</div>
                </div>
                {summary.entries.filter(e => e.unitCall).length === 0 && (
                  <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--text-muted)' }}>No entries logged</div>
                )}
                {summary.entries.filter(e => e.unitCall).map(entry => {
                  const d = new Date(entry.date + 'T12:00:00');
                  const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
                  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  return (
                    <div key={entry.date} className="tsr-tte">
                      <div className="tsr-tte-date">{dateStr}</div>
                      <div className="tsr-tte-day">{dayName}</div>
                      <div className="tsr-tte-dtype"><span className="tsr-tag orange">Shoot</span></div>
                      <div className="tsr-tte-wday"><span className="tsr-tag gold" style={{ fontSize: 9 }}>{member.rateCard.baseContract}</span></div>
                      <div className="tsr-tte-hrs">—</div>
                      <div className="tsr-tte-ot">—</div>
                      <div className="tsr-tte-earn">{fmt(member.rateCard.dailyRate, currency)}</div>
                      <div className="tsr-tte-appr"><span className="tsr-appr-btn done">Approved</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {crew.length === 0 && (
        <div className="tsr-empty">No crew members yet. Add crew in Team Management.</div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PANEL: Team Management
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function TeamManagePanel({
  crew, crewSummaries, currency, totalLabour, totalDays, expandedRc, toggleRcExpand, onAddCrew, onNavTimesheets, onRemoveCrew,
}: {
  crew: CrewMember[];
  crewSummaries: CrewSummaryRow[];
  currency: CurrencyCode;
  totalLabour: number;
  totalDays: number;
  expandedRc: Record<string, boolean>;
  toggleRcExpand: (id: string) => void;
  onAddCrew: () => void;
  onNavTimesheets: () => void;
  onRemoveCrew: (id: string) => void;
}) {
  return (
    <div>
      <div className="tsr-ph">
        <div>
          <div className="tsr-ph-eyebrow">05 — Team Management</div>
          <div className="tsr-ph-title">Team Management</div>
          <div className="tsr-ph-sub">Crew roster, rate cards, and working day agreements</div>
        </div>
        <div className="tsr-ph-actions">
          <button className="tsr-btn tsr-btn-primary" onClick={onAddCrew}>+ Add Crew Member</button>
        </div>
      </div>

      <div className="tsr-stat-grid tsr-sg-3">
        <div className="tsr-stat-card"><div className="tsr-stat-label">Total Crew</div><div className="tsr-stat-val">{crew.length}</div><div className="tsr-stat-sub">Active members</div></div>
        <div className="tsr-stat-card"><div className="tsr-stat-label">Total Crew Cost</div><div className="tsr-stat-val orange">{fmt(totalLabour, currency)}</div><div className="tsr-stat-sub">Logged wages to date</div></div>
        <div className="tsr-stat-card"><div className="tsr-stat-label">Contracted Days</div><div className="tsr-stat-val teal">{totalDays}</div><div className="tsr-stat-sub">Across all crew</div></div>
      </div>

      {/* Working Day Types Reference */}
      <div className="tsr-sh">Working Day Types <div className="tsr-sh-line" /></div>
      <div className="tsr-card flush" style={{ marginBottom: 24 }}>
        <div className="tsr-col-head" style={{ padding: '9px 18px' }}>
          <div className="tsr-ch" style={{ width: 72 }}>Type</div>
          <div className="tsr-ch" style={{ width: 130 }}>Contracted hrs</div>
          <div className="tsr-ch" style={{ width: 110 }}>Meal break</div>
          <div className="tsr-ch" style={{ flex: 1 }}>OT triggers after</div>
          <div className="tsr-ch" style={{ width: 220 }}>Typical use</div>
        </div>
        {[
          { type: '10+1', hrs: '10 hrs', meal: '1 hr', ot: 'After 10 hrs', use: 'Standard prep / wrap days', tagClass: '' },
          { type: '11+1', hrs: '11 hrs', meal: '1 hr', ot: 'After 11 hrs', use: 'Standard shoot day (most common)', tagClass: 'gold' },
          { type: 'Flat', hrs: 'Any hours', meal: 'N/A', ot: 'No OT — flat rate', use: 'Specialists, buy-outs, fixed deals', tagClass: 'teal' },
        ].map(row => (
          <div key={row.type} className="tsr-wd-ref-row" style={row.tagClass === 'gold' ? { background: 'rgba(245, 166, 35, 0.04)' } : undefined}>
            <div style={{ width: 72 }}><span className={`tsr-tag ${row.tagClass}`}>{row.type}</span></div>
            <div style={{ width: 130, color: 'var(--text-secondary)' }}>{row.hrs}</div>
            <div style={{ width: 110, color: 'var(--text-secondary)' }}>{row.meal}</div>
            <div style={{ flex: 1, fontWeight: 600, color: row.tagClass === 'gold' ? 'var(--brand-amber)' : row.tagClass === 'teal' ? 'var(--brand-teal)' : 'var(--text-primary)' }}>{row.ot}</div>
            <div style={{ width: 220, fontSize: 11, color: 'var(--text-muted)' }}>{row.use}</div>
          </div>
        ))}
      </div>

      {/* Crew Roster */}
      <div className="tsr-sh">Crew Roster <div className="tsr-sh-line" /></div>

      {crewSummaries.map(({ member, colorIdx }) => {
        const ac = getAvatarColor(colorIdx);
        const isOpen = expandedRc[member.id] ?? false;
        const rc = member.rateCard;
        const otRate = rc.dailyRate / (rc.baseDayHours || 10) * rc.otMultiplier;

        return (
          <div key={member.id} className="tsr-card flush" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }} onClick={() => toggleRcExpand(member.id)}>
              <div className="tsr-avatar lg" style={{ background: ac.bg, color: ac.color }}>{getInitials(member.name)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {member.name}
                  {member.isMe && <YouPill />}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{member.position}</div>
              </div>
              <span className="tsr-tag orange">{fmt(rc.dailyRate, currency)}/day</span>
              <span className="tsr-tag gold" style={{ marginLeft: 4 }}>{rc.baseContract} shoot</span>
              <span className="tsr-tag teal" style={{ marginLeft: 10 }}>Active</span>
              <div style={{ marginLeft: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="tsr-btn tsr-btn-ghost tsr-btn-sm" onClick={(e) => { e.stopPropagation(); onNavTimesheets(); }}>Timesheets</button>
                {/* Removing the "me" row would only re-create itself on
                    the next render, so we hide the button on it. Every
                    other crew row gets a small \u00D7 that opens a
                    confirmation dialog before the row + their hours
                    are removed. */}
                {!member.isMe && (
                  <button
                    type="button"
                    className="tsr-icon-btn tsr-icon-btn--danger"
                    title={`Remove ${member.name}`}
                    aria-label={`Remove ${member.name}`}
                    onClick={(e) => { e.stopPropagation(); onRemoveCrew(member.id); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
                <span className="tsr-chevron">{isOpen ? '\u25B2 Rate card' : '\u25BC Rate card'}</span>
              </div>
            </div>

            {/* Inline Rate Card */}
            <div className={`tsr-rc-expand ${isOpen ? 'open' : ''}`}>
              <div style={{ padding: '18px 20px 6px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase' as const, color: 'var(--accent)', marginBottom: 14 }}>Rate Card</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                  <div className="tsr-od-cell"><div className="tsr-od-key">Day Rate</div><div className="tsr-od-val" style={{ fontSize: 15 }}>{fmt(rc.dailyRate, currency)}</div></div>
                  <div className="tsr-od-cell"><div className="tsr-od-key">OT Rate</div><div className="tsr-od-val" style={{ fontSize: 15 }}>{fmt(Math.round(otRate), currency)}/hr</div></div>
                  <div className="tsr-od-cell"><div className="tsr-od-key">Base Contract</div><div className="tsr-od-val" style={{ fontSize: 14 }}>{rc.baseContract}</div></div>
                  <div className="tsr-od-cell"><div className="tsr-od-key">OT Multiplier</div><div className="tsr-od-val" style={{ fontSize: 14 }}>x{rc.otMultiplier}</div></div>
                  <div className="tsr-od-cell"><div className="tsr-od-key">Kit Rental</div><div className="tsr-od-val" style={{ fontSize: 14 }}>{rc.kitRental > 0 ? fmt(rc.kitRental, currency) : 'None'}</div></div>
                  <div className="tsr-od-cell"><div className="tsr-od-key">Contact</div><div className="tsr-od-val" style={{ fontSize: 13 }}>{member.email || '—'}</div></div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add Crew */}
      <div className="tsr-add-card" onClick={onAddCrew}>
        <div style={{ fontSize: 20, color: 'var(--accent)', opacity: 0.6 }}>+</div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase' as const, color: 'var(--accent)', opacity: 0.7 }}>Add Crew Member</div>
      </div>
    </div>
  );
}
