import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTimesheetStore, CURRENCY_SYMBOLS, type CrewMember, type CurrencyCode, type RateCard, type TimesheetCalculation, type TimesheetEntry, type WeekSummary } from '@/stores/timesheetStore';
import { AddCrewModal } from '@/components/timesheet/crew/AddCrewModal';
import { LogDayModal } from '@/components/timesheet/LogDayModal';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAuthStore } from '@/stores/authStore';
import { useUserProfileStore } from '@/stores/userProfileStore';
import { UserProfileModal } from '@/components/profile/UserProfileModal';
import { useTeamStore } from '@/stores/teamStore';
import { fetchMemberTimesheets } from '@/services/supabaseSync';

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
/**
 * Inline rate-card editor used inside the team-manage Crew Roster
 * card. Each input is autosaved on blur via the callback so a burst
 * of edits doesn't spam triggerTsAutoSave. The base-contract picker
 * keeps `baseDayHours` aligned to the contract so the calculator
 * doesn't end up in an inconsistent state.
 */
function RateCardEditor({
  member,
  currency,
  onUpdate,
}: {
  member: CrewMember;
  currency: CurrencyCode;
  onUpdate: (updates: Partial<RateCard>) => void;
}) {
  const rc = member.rateCard;
  const sym = CURRENCY_SYMBOLS[currency] ?? '£';
  const otRate = (rc.dailyRate / (rc.baseDayHours || 10)) * rc.otMultiplier;

  return (
    <div style={{ padding: '18px 20px 14px' }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Rate Card</span>
        <span style={{ color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'none' }}>
          OT rate {sym}{Math.round(otRate)}/hr
        </span>
      </div>
      <div className="tsr-rc-grid">
        <RcField
          label="Day rate"
          value={rc.dailyRate}
          step={10}
          prefix={sym}
          onCommit={(v) => onUpdate({ dailyRate: v })}
        />
        <RcSelect
          label="Base contract"
          value={rc.baseContract}
          options={[
            { value: '10+1', label: '10+1' },
            { value: '11+1', label: '11+1' },
            { value: '12+1', label: '12+1' },
          ]}
          onCommit={(v) => {
            const bc = v as RateCard['baseContract'];
            onUpdate({
              baseContract: bc,
              baseDayHours: bc === '10+1' ? 10 : bc === '11+1' ? 11 : 12,
            });
          }}
        />
        <RcField
          label="OT multiplier"
          value={rc.otMultiplier}
          step={0.1}
          min={1}
          suffix="x"
          onCommit={(v) => onUpdate({ otMultiplier: v })}
        />
        <RcField
          label="Pre-call multiplier"
          value={rc.preCallMultiplier}
          step={0.1}
          min={1}
          suffix="x"
          onCommit={(v) => onUpdate({ preCallMultiplier: v })}
        />
        <RcField
          label="Late-night multiplier"
          value={rc.lateNightMultiplier}
          step={0.1}
          min={1}
          suffix="x"
          onCommit={(v) => onUpdate({ lateNightMultiplier: v })}
        />
        <RcField
          label="6th-day multiplier"
          value={rc.sixthDayMultiplier}
          step={0.1}
          min={1}
          suffix="x"
          onCommit={(v) => onUpdate({ sixthDayMultiplier: v })}
        />
        <RcField
          label="7th-day multiplier"
          value={rc.seventhDayMultiplier}
          step={0.1}
          min={1}
          suffix="x"
          onCommit={(v) => onUpdate({ seventhDayMultiplier: v })}
        />
        <RcField
          label="Kit rental / day"
          value={rc.kitRental}
          step={5}
          prefix={sym}
          onCommit={(v) => onUpdate({ kitRental: v })}
        />
      </div>
    </div>
  );
}

/**
 * Numeric rate-card input. Keeps a local string draft so partial
 * edits don't churn the store; commits on blur and on Enter.
 */
function RcField({
  label,
  value,
  step,
  min = 0,
  prefix,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // Keep the input in sync if the underlying value changes from
  // somewhere else (e.g. profile-seeded rate card).
  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n !== value) onCommit(Math.max(min, n));
    else setDraft(String(value));
  };

  return (
    <label className="tsr-rc-field">
      <span className="tsr-rc-label">{label}</span>
      <span className="tsr-rc-input-wrap">
        {prefix && <span className="tsr-rc-affix">{prefix}</span>}
        <input
          className="tsr-rc-input"
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          }}
        />
        {suffix && <span className="tsr-rc-affix">{suffix}</span>}
      </span>
    </label>
  );
}

function RcSelect({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="tsr-rc-field">
      <span className="tsr-rc-label">{label}</span>
      <span className="tsr-rc-input-wrap">
        <select
          className="tsr-rc-input"
          value={value}
          onChange={(e) => onCommit(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </span>
    </label>
  );
}

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

/** Marks a timesheet entry that arrived from a team member's mobile
 *  log via Supabase. Helps the designer spot which rows are
 *  authoritative team input vs. ones they keyed in themselves. */
function SyncedPill() {
  return (
    <span
      title="Synced from this team member's mobile timesheet"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 6px',
        fontSize: '0.5625rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        borderRadius: '999px',
        background: 'rgba(74, 191, 176, 0.12)',
        color: 'var(--brand-teal, #4ABFB0)',
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      Synced
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
  const ensureTeamCrew = store(s => s.ensureTeamCrew);
  const mergeMemberEntries = store(s => s.mergeMemberEntries);
  const getCrewWeekSummary = store(s => s.getCrewWeekSummary);
  const getTotalLabourCost = store(s => s.getTotalLabourCost);
  const saveEntry = store(s => s.saveEntry);
  const deleteEntry = store(s => s.deleteEntry);
  const setEntryStatus = store(s => s.setEntryStatus);
  const updateCrewRateCard = store(s => s.updateCrewRateCard);
  const calculateEntry = store(s => s.calculateEntry);
  const getPreviousWrapOut = store(s => s.getPreviousWrapOut);

  // Log-day modal state — `null` for closed, `{ crew, entry }` for open.
  const [logDayState, setLogDayState] = useState<{
    crew: CrewMember;
    entry: TimesheetEntry | null;
  } | null>(null);
  const openLogDay = useCallback(
    (member: CrewMember, entry?: TimesheetEntry | null) =>
      setLogDayState({ crew: member, entry: entry ?? null }),
    [],
  );

  // Pull project team members so anyone joined via the invite code
  // automatically appears as a crew row in the timesheet.
  const teamStore = useTeamStore(projectId);
  const teamMembers = teamStore((s) => s.members);
  const loadTeam = teamStore((s) => s.loadFromSupabase);
  useEffect(() => { loadTeam(projectId); }, [projectId, loadTeam]);

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
     Fires once, the very first time the user opens the timesheet
     for this account. Independent of the post-signup nudge — the
     two prompts each get their own flag so opening the timesheet
     re-prompts even if the user already saw the signup nudge. After
     close (Save, Skip, or click outside), the flag flips and the
     prompt never auto-fires again. The Edit Profile menu item is
     the only way back in. */
  const authUser = useAuthStore((s) => s.user);
  const profile = useUserProfileStore((s) =>
    authUser ? s.profiles[authUser.id] : undefined,
  );
  const ensureProfile = useUserProfileStore((s) => s.ensureProfile);
  const dismissTimesheetNudge = useUserProfileStore((s) => s.dismissTimesheetNudge);
  const [showProfileReminder, setShowProfileReminder] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    const fresh = profile ?? ensureProfile(authUser.id, authUser.name, authUser.email);
    if (!fresh.timesheetNudgeDismissed) setShowProfileReminder(true);
    // Intentionally only reads the dismissed flag once per mount — we
    // don't want the modal to re-open if the user closes it then
    // navigates away and back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

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

  // Mirror the project team into the crew list. Anyone joined via the
  // invite code (i.e. visible on the Team page) gets an auto-created
  // crew row with a default rate card the designer can then adjust.
  // The user's own row is excluded — it's managed by ensureSelfCrew.
  // removeOrphans cleans up rows for people the designer kicked off
  // the project so their hours don't keep showing up.
  useEffect(() => {
    if (!authUser) return;
    const synced = teamMembers
      .filter((m) => m.id !== authUser.id)
      .map((m) => ({
        userId: m.id,
        name: m.name,
        email: m.email,
        phone: '',
      }));
    ensureTeamCrew(synced, { removeOrphans: true });
  }, [authUser, teamMembers, ensureTeamCrew]);

  // Pull every team member's timesheet rows from Supabase and merge
  // them onto the synced crew rows. Re-runs when the membership list
  // changes so a freshly-added team member's history surfaces too.
  // (Phase 1: pull-only — designer edits don't write back yet.)
  useEffect(() => {
    let cancelled = false;
    if (!projectId || teamMembers.length === 0) return;
    fetchMemberTimesheets(projectId)
      .then((rows) => {
        if (cancelled) return;
        const applied = mergeMemberEntries(rows);
        if (applied > 0) {
          console.log(`[Timesheet] pulled ${applied} entries from team`);
        }
      })
      .catch((err) =>
        console.warn('[Timesheet] fetchMemberTimesheets failed', err),
      );
    return () => { cancelled = true; };
  }, [projectId, teamMembers, mergeMemberEntries]);

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
            calculateEntry={calculateEntry}
            onLogDay={(member, entry) => openLogDay(member, entry)}
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
            calculateEntry={calculateEntry}
            onToggleApproval={(crewId, date, current) => {
              const next = current === 'approved' ? 'submitted' : 'approved';
              setEntryStatus(crewId, date, next);
              showToast(next === 'approved' ? 'Entry approved' : 'Approval cleared');
            }}
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
            onUpdateRateCard={updateCrewRateCard}
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

      {logDayState && (
        <LogDayModal
          crew={logDayState.crew}
          currency={currency}
          initialEntry={logDayState.entry}
          previousWrapOut={
            logDayState.entry
              ? getPreviousWrapOut(logDayState.crew.id, logDayState.entry.date)
              : undefined
          }
          calculate={(entry, prev) => calculateEntry(logDayState.crew.id, entry, prev)}
          onSave={(entry) => {
            saveEntry(logDayState.crew.id, entry);
            showToast(logDayState.entry ? 'Entry updated' : 'Day logged');
            setLogDayState(null);
          }}
          onDelete={(date) => {
            deleteEntry(logDayState.crew.id, date);
            showToast('Entry deleted');
            setLogDayState(null);
          }}
          onClose={() => setLogDayState(null)}
        />
      )}

      {showProfileReminder && (
        <UserProfileModal
          isSignupNudge
          onClose={() => {
            if (authUser) dismissTimesheetNudge(authUser.id);
            setShowProfileReminder(false);
          }}
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
  calculateEntry, onLogDay,
}: {
  crew: CrewMember[];
  crewSummaries: CrewSummaryRow[];
  currency: CurrencyCode;
  totalHours: number;
  totalOtHours: number;
  totalDays: number;
  totalLabour: number;
  calculateEntry: (crewId: string, entry: TimesheetEntry, previousWrapOut?: string) => TimesheetCalculation;
  onLogDay: (member: CrewMember, entry?: TimesheetEntry | null) => void;
}) {
  // Prefer the row marked isMe so the panel always reflects the auth
  // user, falling back to the first crew row when nothing is marked.
  const myCrew = crew.find((c) => c.isMe) ?? crew[0];
  const mySummary = crewSummaries.find((s) => s.member.id === myCrew?.id)?.summary
    ?? crewSummaries[0]?.summary;
  const myRate = myCrew?.rateCard.dailyRate ?? 0;
  const handleNew = () => myCrew && onLogDay(myCrew, null);
  const handleEdit = (entry: TimesheetEntry) => myCrew && onLogDay(myCrew, entry);

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
          <button
            type="button"
            className="tsr-btn tsr-btn-primary"
            onClick={handleNew}
            disabled={!myCrew}
          >
            + Log Day
          </button>
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
              // Run a fresh calc per row so the displayed totals
              // always match the rate card (which can be edited per
              // project after the entry was logged).
              const calc = myCrew && entry.unitCall && entry.wrapOut
                ? calculateEntry(myCrew.id, entry, entry.previousWrapOut)
                : null;
              const dayTypeLabel =
                entry.dayType === 'SCWD' ? 'Semi-cont' :
                entry.dayType === 'CWD' ? 'Continuous' :
                'Shoot';
              return (
                <div
                  key={entry.date}
                  className="tsr-ts-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleEdit(entry)}
                  title="Edit this entry"
                >
                  <div className="tsr-tc-date">{dateStr}</div>
                  <div className="tsr-tc-day">{dayName}</div>
                  <div className="tsr-tc-dtype">
                    <span className="tsr-tag orange">{dayTypeLabel}</span>
                  </div>
                  <div className="tsr-tc-wday">
                    <span className="tsr-tag gold">{myCrew?.rateCard.baseContract ?? '11+1'}</span>
                  </div>
                  <div className="tsr-tc-start">{entry.unitCall || '—'}</div>
                  <div className="tsr-tc-end">{entry.wrapOut || '—'}</div>
                  <div className="tsr-tc-hrs">
                    {calc ? `${calc.totalHours.toFixed(1)}` : '—'}
                  </div>
                  <div className="tsr-tc-ot">
                    {calc ? `${calc.otHours.toFixed(1)}` : '—'}
                  </div>
                  <div className="tsr-tc-earn">
                    {calc ? fmtDec(calc.totalPay, currency) : fmt(myRate, currency)}
                  </div>
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

      <button
        type="button"
        className="tsr-add-btn"
        onClick={handleNew}
        disabled={!myCrew}
      >
        + Log Day
      </button>
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
  crew, crewSummaries, currency, totalHours, totalLabour, expandedTeam, toggleTeamExpand, calculateEntry, onToggleApproval,
}: {
  crew: CrewMember[];
  crewSummaries: CrewSummaryRow[];
  currency: CurrencyCode;
  totalHours: number;
  totalLabour: number;
  expandedTeam: Record<string, boolean>;
  toggleTeamExpand: (id: string) => void;
  calculateEntry: (crewId: string, entry: TimesheetEntry, previousWrapOut?: string) => TimesheetCalculation;
  onToggleApproval: (crewId: string, date: string, current: TimesheetEntry['status']) => void;
}) {
  // Count entries that arrived from a team member's mobile and
  // haven't been touched by the designer yet.
  const pendingCount = crewSummaries.reduce(
    (sum, { summary }) =>
      sum + summary.entries.filter((e) => e.sourceUserId && e.status !== 'approved').length,
    0,
  );

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
                  const calc = entry.unitCall && entry.wrapOut
                    ? calculateEntry(member.id, entry, entry.previousWrapOut)
                    : null;
                  const fromMobile = !!entry.sourceUserId;
                  return (
                    <div key={entry.date} className="tsr-tte">
                      <div className="tsr-tte-date" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {dateStr}
                        {fromMobile && <SyncedPill />}
                      </div>
                      <div className="tsr-tte-day">{dayName}</div>
                      <div className="tsr-tte-dtype">
                        <span className="tsr-tag orange">
                          {entry.dayType === 'SCWD' ? 'Semi-cont' :
                           entry.dayType === 'CWD' ? 'Continuous' : 'Shoot'}
                        </span>
                      </div>
                      <div className="tsr-tte-wday">
                        <span className="tsr-tag gold" style={{ fontSize: 9 }}>
                          {member.rateCard.baseContract}
                        </span>
                      </div>
                      <div className="tsr-tte-hrs">
                        {calc ? calc.totalHours.toFixed(1) : '—'}
                      </div>
                      <div className="tsr-tte-ot">
                        {calc ? calc.otHours.toFixed(1) : '—'}
                      </div>
                      <div className="tsr-tte-earn">
                        {calc ? fmtDec(calc.totalPay, currency) : fmt(member.rateCard.dailyRate, currency)}
                      </div>
                      <div className="tsr-tte-appr">
                        <button
                          type="button"
                          className={`tsr-appr-btn ${entry.status === 'approved' ? 'done' : ''}`}
                          onClick={() => onToggleApproval(member.id, entry.date, entry.status)}
                          title={
                            entry.status === 'approved'
                              ? 'Click to revoke approval'
                              : 'Click to approve'
                          }
                        >
                          {entry.status === 'approved' ? 'Approved' : entry.status === 'submitted' ? 'Pending' : 'Draft'}
                        </button>
                      </div>
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
  crew, crewSummaries, currency, totalLabour, totalDays, expandedRc, toggleRcExpand, onAddCrew, onNavTimesheets, onRemoveCrew, onUpdateRateCard,
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
  onUpdateRateCard: (crewId: string, updates: Partial<RateCard>) => void;
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
              <RateCardEditor
                member={member}
                currency={currency}
                onUpdate={(updates) => onUpdateRateCard(member.id, updates)}
              />
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
