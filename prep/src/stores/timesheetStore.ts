import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { pushMemberWeekDebounced, getWeekStart as getMemberWeekStart } from '@/services/timesheetSync';
import {
  calculateBECTUTimesheet,
  getLunchDuration,
  addDays,
  formatDateString,
  getWeekStart,
  type BaseContract,
  type BECTUDayType,
  type BECTUTimesheetEntry,
  type BECTUTimesheetCalculation,
} from '@/utils/bectuCalculations';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types — aligned with mobile timesheetStore for future Supabase sync
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'CAD' | 'AUD';
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  GBP: '£', USD: '$', EUR: '€', CAD: 'C$', AUD: 'A$',
};

export type CrewType = 'paye' | 'ltd';
export type Department = 'hair' | 'makeup' | 'sfx' | 'prosthetics';

export interface RateCard {
  /**
   * Prep-day rate (fittings, R&D, recces, costume tests). Used when
   * a TimesheetEntry has `rateType: 'prep'`.
   */
  prepRate: number;
  /**
   * Full shoot-day rate. Used when a TimesheetEntry has
   * `rateType: 'shoot'` (the default for fresh entries).
   */
  shootRate: number;
  /**
   * Legacy single rate. Older persisted cards only carry this
   * value; we fall back to it when a card is missing prepRate /
   * shootRate, then drop it once the user resaves.
   *
   * @deprecated kept for backwards compatibility — read at runtime
   *   via getEffectiveRate(); never write to it from new code.
   */
  dailyRate?: number;
  baseDayHours: number;
  baseContract: BaseContract;
  dayType: BECTUDayType;
  otMultiplier: number;
  lateNightMultiplier: number;
  preCallMultiplier: number;
  sixthDayMultiplier: number;
  seventhDayMultiplier: number;
  kitRental: number;
  lunchDuration: number;
}

/**
 * Resolve which rate applies for an entry. Falls back to the legacy
 * dailyRate when prepRate / shootRate are missing on an older card,
 * and finally to 0 if even that's absent.
 */
export function getEffectiveRate(
  rateCard: RateCard,
  rateType: 'prep' | 'shoot' = 'shoot',
): number {
  if (rateType === 'prep') {
    return rateCard.prepRate
      ?? rateCard.dailyRate
      ?? rateCard.shootRate
      ?? 0;
  }
  return rateCard.shootRate
    ?? rateCard.dailyRate
    ?? rateCard.prepRate
    ?? 0;
}

export interface CrewMember {
  id: string;
  name: string;
  position: string;
  department: Department;
  crewType: CrewType;
  email: string;
  phone: string;
  rateCard: RateCard;
  // (rateType lives on the TimesheetEntry, not here — same crew
  // member can be on prep one day and shoot the next.)
  /**
   * Marks the row as the *current user's* own timesheet entry. Exactly
   * one crew member per project should carry this flag — it identifies
   * "you" so the sidebar / crew list can visually separate your own
   * invoice from the team's.
   */
  isMe?: boolean;
  /** Auth user id linked to this crew row (only set when isMe). */
  userId?: string;
}

export interface TimesheetEntry {
  id: string;
  date: string;
  dayType: BECTUDayType;
  preCall: string;
  unitCall: string;
  lunchStart: string;
  lunchEnd: string;
  outOfChair: string;
  wrapOut: string;
  lunchTaken: number;
  isSixthDay: boolean;
  isSeventhDay: boolean;
  notes: string;
  status: 'draft' | 'submitted' | 'approved';
  previousWrapOut?: string;
  /**
   * Whether this day was billed at the prep or shoot rate. Drives
   * which RateCard rate getEffectiveRate picks. Defaults to 'shoot'
   * — the most common case — so older entries without the field
   * still calculate the same way they used to.
   */
  rateType?: 'prep' | 'shoot';
  /**
   * Auth user id of the team member who logged this entry from
   * mobile. Set by mergeMemberEntries when the row arrives via
   * Supabase; absent on entries the designer added directly in
   * prep. Used by the UI to flag the row as "synced".
   */
  sourceUserId?: string;
}

export interface TimesheetCalculation {
  contractedHours: number;
  hourlyRate: number;
  otRate: number;
  preCallHours: number;
  actualWorkHours: number;
  baseHours: number;
  otHours: number;
  brokenLunchHours: number;
  brokenTurnaroundHours: number;
  lateNightHours: number;
  totalHours: number;
  basePay: number;
  preCallPay: number;
  overtimePay: number;
  brokenLunchPay: number;
  brokenTurnaroundPay: number;
  lateNightPay: number;
  sixthDayBonus: number;
  seventhDayBonus: number;
  dayMultiplier: number;
  subtotal: number;
  kitRental: number;
  totalPay: number;
  hasBrokenLunch: boolean;
  hasBrokenTurnaround: boolean;
  hasLateNight: boolean;
  hasOvertime: boolean;
}

export interface WeekSummary {
  startDate: string;
  endDate: string;
  totalHours: number;
  preCallHours: number;
  baseHours: number;
  otHours: number;
  sixthDayHours: number;
  seventhDayHours: number;
  lateNightHours: number;
  brokenLunchHours: number;
  brokenTurnaroundHours: number;
  kitRentalTotal: number;
  totalEarnings: number;
  entries: TimesheetEntry[];
  basePay: number;
  overtimePay: number;
  preCallPay: number;
  brokenLunchPay: number;
  brokenTurnaroundPay: number;
  lateNightPay: number;
}

export interface ProductionSettings {
  name: string;
  code: string;
  defaultBaseContract: BaseContract;
  defaultDayType: BECTUDayType;
  currency: CurrencyCode;
  isLTD: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Defaults
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createDefaultRateCard(): RateCard {
  return {
    prepRate: 150,
    shootRate: 200,
    baseDayHours: 10,
    baseContract: '10+1',
    dayType: 'SWD',
    otMultiplier: 1.5,
    lateNightMultiplier: 2,
    preCallMultiplier: 1.5,
    sixthDayMultiplier: 1.5,
    seventhDayMultiplier: 2,
    kitRental: 0,
    lunchDuration: 60,
  };
}

export function createEmptyEntry(date: string): TimesheetEntry {
  return {
    id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    dayType: 'SWD',
    preCall: '',
    unitCall: '',
    lunchStart: '',
    lunchEnd: '',
    outOfChair: '',
    wrapOut: '',
    lunchTaken: 60,
    isSixthDay: false,
    isSeventhDay: false,
    notes: '',
    status: 'draft',
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Store interface
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface TimesheetState {
  production: ProductionSettings;
  crew: CrewMember[];
  // entries keyed by `${crewId}:${YYYY-MM-DD}`
  entries: Record<string, TimesheetEntry>;
  selectedCrewId: string | null;
  selectedWeekStart: string;
  lastSaved: string | null;

  // Production
  setProduction: (updates: Partial<ProductionSettings>) => void;

  // Crew
  addCrew: (crew: Omit<CrewMember, 'id'>) => string;
  updateCrew: (id: string, updates: Partial<CrewMember>) => void;
  removeCrew: (id: string) => void;
  updateCrewRateCard: (crewId: string, updates: Partial<RateCard>) => void;
  /**
   * Ensure a "me" crew row exists in this project, prefilled from the
   * caller-supplied user-profile fields. When the row is created for
   * the first time we seed it with `me.rateCard` (the user's default
   * rate card from their profile) when supplied, otherwise we fall
   * back to createDefaultRateCard(). Existing rows keep their rate
   * card untouched so per-project negotiations aren't overwritten by
   * profile edits.
   */
  ensureSelfCrew: (
    me: {
      userId: string;
      name: string;
      email: string;
      phone: string;
      crewType: CrewType;
      rateCard?: RateCard;
    },
  ) => string;
  /**
   * Sync project team members (joined via the project invite code)
   * into the timesheet's crew list. For each member with a userId we
   * either add a new crew row (with a default rate card the designer
   * can adjust later) or refresh the personal fields (name / email)
   * on the existing row. Rate cards on existing rows are NEVER
   * touched. Pass `removeOrphans: true` to also delete crew rows
   * whose userId no longer matches an active team member — used when
   * the designer removes someone from the project.
   */
  ensureTeamCrew: (
    members: Array<{
      userId: string;
      name: string;
      email?: string;
      phone?: string;
    }>,
    options?: { removeOrphans?: boolean },
  ) => void;

  // Entries
  getEntry: (crewId: string, date: string) => TimesheetEntry;
  saveEntry: (crewId: string, entry: TimesheetEntry) => void;
  deleteEntry: (crewId: string, date: string) => void;
  /** Toggle approval state on a single entry. Triggers a write-back
   *  to the team member's Supabase row when the crew row is synced
   *  so mobile sees the new status. */
  setEntryStatus: (
    crewId: string,
    date: string,
    status: TimesheetEntry['status'],
  ) => void;
  /**
   * Apply timesheet rows pulled from Supabase onto the local store.
   * Each member row contributes a list of entries that get keyed
   * under `${crewId}:${entry.date}` for the crew row whose `userId`
   * matches the member's user_id. Existing entries are replaced so
   * the latest mobile log wins; entries the designer added by hand
   * for a date the member hasn't logged yet are preserved.
   *
   * Returns the count of entries that were applied so callers can
   * surface a "X new entries from your team" toast.
   */
  mergeMemberEntries: (
    rows: Array<{ user_id: string; entries: unknown }>,
  ) => number;

  // Navigation
  setSelectedCrew: (crewId: string | null) => void;
  setSelectedWeekStart: (date: string) => void;
  navigateWeek: (direction: 'prev' | 'next') => void;

  // Calculations
  calculateEntry: (crewId: string, entry: TimesheetEntry, previousWrapOut?: string) => TimesheetCalculation;
  getPreviousWrapOut: (crewId: string, date: string) => string | undefined;
  getCrewWeekSummary: (crewId: string, weekStartDate: string) => WeekSummary;

  // Aggregations
  getTotalLabourCost: (weekStart: string) => number;
  getLTDSavings: (weekStart: string) => number;
  getBudgetImpact: (weekStart: string) => number;

  clearAll: () => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Auto-save debounce
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let _tsSaveTimer: ReturnType<typeof setTimeout> | null = null;
let _tsSaveStatus: 'idle' | 'saving' | 'saved' = 'idle';
const _tsSaveListeners = new Set<(status: 'idle' | 'saving' | 'saved') => void>();

export function onTimesheetSaveStatusChange(listener: (status: 'idle' | 'saving' | 'saved') => void) {
  _tsSaveListeners.add(listener);
  return () => { _tsSaveListeners.delete(listener); };
}

function setTsSaveStatus(status: 'idle' | 'saving' | 'saved') {
  _tsSaveStatus = status;
  _tsSaveListeners.forEach(fn => fn(status));
}

function triggerTsAutoSave() {
  if (_tsSaveTimer) clearTimeout(_tsSaveTimer);
  setTsSaveStatus('saving');
  _tsSaveTimer = setTimeout(() => {
    setTsSaveStatus('saved');
    setTimeout(() => setTsSaveStatus('idle'), 2000);
  }, 800);
}

// Suppress unused read warning — status is read by listeners
void _tsSaveStatus;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Calculation helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function emptyCalculation(): TimesheetCalculation {
  return {
    contractedHours: 0, hourlyRate: 0, otRate: 0,
    preCallHours: 0, actualWorkHours: 0, baseHours: 0, otHours: 0,
    brokenLunchHours: 0, brokenTurnaroundHours: 0, lateNightHours: 0,
    totalHours: 0, basePay: 0, preCallPay: 0, overtimePay: 0,
    brokenLunchPay: 0, brokenTurnaroundPay: 0, lateNightPay: 0,
    sixthDayBonus: 0, seventhDayBonus: 0, dayMultiplier: 1,
    subtotal: 0, kitRental: 0, totalPay: 0,
    hasBrokenLunch: false, hasBrokenTurnaround: false,
    hasLateNight: false, hasOvertime: false,
  };
}

function toBECTUEntry(entry: TimesheetEntry, rateCard: RateCard, previousWrapOut?: string): BECTUTimesheetEntry {
  return {
    date: entry.date,
    // Pick prepRate for prep days, shootRate otherwise. Falls back
    // to the legacy dailyRate when an older card is missing the new
    // fields — see getEffectiveRate.
    dayRate: getEffectiveRate(rateCard, entry.rateType ?? 'shoot'),
    baseContract: rateCard.baseContract,
    dayType: entry.dayType,
    preCallTime: entry.preCall || null,
    unitCallTime: entry.unitCall,
    lunchTime: entry.lunchStart || null,
    lunchDuration: entry.lunchTaken || getLunchDuration(entry.dayType),
    wrapOutTime: entry.wrapOut,
    is6thDay: entry.isSixthDay,
    is7thDay: entry.isSeventhDay,
    previousWrapOut: entry.previousWrapOut || previousWrapOut || null,
    preCallMultiplier: rateCard.preCallMultiplier,
    otMultiplier: rateCard.otMultiplier,
    lateNightMultiplier: rateCard.lateNightMultiplier,
    sixthDayMultiplier: rateCard.sixthDayMultiplier,
    seventhDayMultiplier: rateCard.seventhDayMultiplier,
  };
}

function mapCalc(bectu: BECTUTimesheetCalculation, rateCard: RateCard, entry: TimesheetEntry): TimesheetCalculation {
  let sixthDayBonus = 0;
  let seventhDayBonus = 0;
  if (entry.isSeventhDay) {
    seventhDayBonus = bectu.subtotal * (rateCard.seventhDayMultiplier - 1);
  } else if (entry.isSixthDay) {
    sixthDayBonus = bectu.subtotal * (rateCard.sixthDayMultiplier - 1);
  }
  const kitRental = rateCard.kitRental;
  const totalPay = bectu.totalPay + kitRental;

  return {
    contractedHours: bectu.contractedHours,
    hourlyRate: bectu.hourlyRate,
    otRate: bectu.otRate,
    preCallHours: bectu.preCallHours,
    actualWorkHours: bectu.actualWorkHours,
    baseHours: bectu.contractedHours,
    otHours: bectu.overtimeHours,
    brokenLunchHours: bectu.brokenLunchHours,
    brokenTurnaroundHours: bectu.brokenTurnaroundHours,
    lateNightHours: bectu.lateNightHours,
    totalHours: bectu.actualWorkHours + bectu.preCallHours,
    basePay: bectu.basePay,
    preCallPay: bectu.preCallPay,
    overtimePay: bectu.overtimePay,
    brokenLunchPay: bectu.brokenLunchPay,
    brokenTurnaroundPay: bectu.brokenTurnaroundPay,
    lateNightPay: bectu.lateNightPay,
    sixthDayBonus: Math.round(sixthDayBonus * 100) / 100,
    seventhDayBonus: Math.round(seventhDayBonus * 100) / 100,
    dayMultiplier: bectu.dayMultiplier,
    subtotal: bectu.subtotal,
    kitRental,
    totalPay: Math.round(totalPay * 100) / 100,
    hasBrokenLunch: bectu.hasBrokenLunch,
    hasBrokenTurnaround: bectu.hasBrokenTurnaround,
    hasLateNight: bectu.hasLateNight,
    hasOvertime: bectu.hasOvertime,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Store factory — per-project
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const tsStoreCache: Record<string, ReturnType<typeof createTimesheetStore>> = {};

function entryKey(crewId: string, date: string) {
  return `${crewId}:${date}`;
}

function createTimesheetStore(projectId: string) {
  return create<TimesheetState>()(
    persist(
      (set, get) => {
        // Pulled out so saveEntry / deleteEntry / approveEntry don't
        // each re-implement the same plumbing. Computes the affected
        // user + week, gathers that week's current entries from the
        // store, and pushes via the debounced helper. Designer-only
        // crew rows (no userId) are no-ops.
        const pushBackIfSynced = (crewId: string, dateInWeek: string) => {
          const state = get();
          const member = state.crew.find((c) => c.id === crewId);
          if (!member?.userId) return;
          const weekStart = getMemberWeekStart(dateInWeek);
          const prefix = `${crewId}:`;
          const weekEntries: TimesheetEntry[] = [];
          for (const [k, v] of Object.entries(state.entries)) {
            if (!k.startsWith(prefix)) continue;
            if (getMemberWeekStart(v.date) !== weekStart) continue;
            weekEntries.push(v);
          }
          pushMemberWeekDebounced(projectId, member.userId, weekStart, weekEntries);
        };

        return {
        production: {
          name: '',
          code: '',
          defaultBaseContract: '10+1' as BaseContract,
          defaultDayType: 'SWD' as BECTUDayType,
          currency: 'GBP' as CurrencyCode,
          isLTD: false,
        },
        crew: [],
        entries: {},
        selectedCrewId: null,
        selectedWeekStart: getWeekStart(formatDateString(new Date())),
        lastSaved: null,

        // ── Production ─────────────────────────────
        setProduction: (updates) => {
          set((s) => ({ production: { ...s.production, ...updates }, lastSaved: new Date().toISOString() }));
          triggerTsAutoSave();
        },

        // ── Crew ───────────────────────────────────
        addCrew: (crewData) => {
          const id = `crew-${Date.now()}`;
          const member: CrewMember = { ...crewData, id };
          set((s) => ({
            crew: [...s.crew, member],
            selectedCrewId: s.selectedCrewId || id,
            lastSaved: new Date().toISOString(),
          }));
          triggerTsAutoSave();
          return id;
        },
        updateCrew: (id, updates) => {
          set((s) => ({
            crew: s.crew.map(c => c.id === id ? { ...c, ...updates } : c),
            lastSaved: new Date().toISOString(),
          }));
          triggerTsAutoSave();
        },
        removeCrew: (id) => {
          set((s) => {
            const newEntries = { ...s.entries };
            Object.keys(newEntries).forEach(k => {
              if (k.startsWith(`${id}:`)) delete newEntries[k];
            });
            const newCrew = s.crew.filter(c => c.id !== id);
            return {
              crew: newCrew,
              entries: newEntries,
              selectedCrewId: s.selectedCrewId === id ? (newCrew[0]?.id || null) : s.selectedCrewId,
              lastSaved: new Date().toISOString(),
            };
          });
          triggerTsAutoSave();
        },
        ensureSelfCrew: (me) => {
          const state = get();
          // Match on the userId we stamp on the row, then by email as a
          // fallback so a row a designer added by hand earlier still
          // gets recognised as "me".
          const existing =
            state.crew.find((c) => c.isMe && c.userId === me.userId) ||
            state.crew.find((c) => c.userId === me.userId) ||
            state.crew.find(
              (c) =>
                me.email.trim() !== '' &&
                c.email.trim().toLowerCase() === me.email.trim().toLowerCase(),
            );
          if (existing) {
            // Refresh the personal fields from the profile but keep the
            // project-specific rate card and position untouched.
            set((s) => ({
              crew: s.crew.map((c) =>
                c.id === existing.id
                  ? {
                      ...c,
                      isMe: true,
                      userId: me.userId,
                      name: me.name || c.name,
                      email: me.email || c.email,
                      phone: me.phone || c.phone,
                      crewType: me.crewType,
                    }
                  : c.isMe && c.id !== existing.id
                  ? { ...c, isMe: false } // Only one row should carry the flag.
                  : c,
              ),
              lastSaved: new Date().toISOString(),
            }));
            triggerTsAutoSave();
            return existing.id;
          }
          // No matching crew yet — insert a fresh row with sensible
          // defaults. The user can edit position/department/rate card
          // from the crew settings tab.
          const id = `crew-${Date.now()}`;
          const member: CrewMember = {
            id,
            name: me.name,
            position: 'Designer',
            department: 'hair',
            crewType: me.crewType,
            email: me.email,
            phone: me.phone,
            rateCard: me.rateCard ?? createDefaultRateCard(),
            isMe: true,
            userId: me.userId,
          };
          set((s) => ({
            crew: [member, ...s.crew],
            selectedCrewId: s.selectedCrewId || id,
            lastSaved: new Date().toISOString(),
          }));
          triggerTsAutoSave();
          return id;
        },
        ensureTeamCrew: (members, options) => {
          if (members.length === 0 && !options?.removeOrphans) return;
          const state = get();
          const memberByUserId = new Map(members.map((m) => [m.userId, m]));
          const newCrew: CrewMember[] = [];
          const newEntries = { ...state.entries };

          // First pass: walk the existing crew and either refresh
          // matching rows or drop them when removeOrphans is set.
          for (const c of state.crew) {
            // The user's own row is managed separately by ensureSelfCrew;
            // never overwrite or delete it here.
            if (c.isMe) { newCrew.push(c); continue; }
            const match = c.userId ? memberByUserId.get(c.userId) : undefined;
            if (match) {
              newCrew.push({
                ...c,
                userId: match.userId,
                name: match.name || c.name,
                email: match.email ?? c.email,
                phone: match.phone ?? c.phone,
              });
              memberByUserId.delete(match.userId);
            } else if (c.userId && options?.removeOrphans) {
              // Drop synced rows whose user is no longer on the team
              // — also wipe their logged hours so we don't leak data.
              for (const k of Object.keys(newEntries)) {
                if (k.startsWith(`${c.id}:`)) delete newEntries[k];
              }
            } else {
              newCrew.push(c);
            }
          }

          // Second pass: anyone left in memberByUserId is a brand new
          // team member with no crew row yet — add one with default rate.
          let nextIdx = 0;
          for (const m of memberByUserId.values()) {
            const id = `crew-team-${m.userId}-${Date.now()}-${nextIdx++}`;
            newCrew.push({
              id,
              name: m.name,
              position: 'Crew',
              department: 'hair',
              crewType: 'paye',
              email: m.email ?? '',
              phone: m.phone ?? '',
              rateCard: createDefaultRateCard(),
              userId: m.userId,
            });
          }

          // Skip the set when nothing actually changed (avoids
          // touching lastSaved on every render).
          const sameLength = newCrew.length === state.crew.length;
          const sameOrder =
            sameLength && newCrew.every((c, i) => c.id === state.crew[i].id);
          const sameContent =
            sameOrder &&
            newCrew.every((c, i) => {
              const o = state.crew[i];
              return (
                c.name === o.name &&
                c.email === o.email &&
                c.phone === o.phone &&
                c.userId === o.userId
              );
            });
          if (sameContent) return;

          set({
            crew: newCrew,
            entries: newEntries,
            selectedCrewId:
              state.selectedCrewId &&
              newCrew.some((c) => c.id === state.selectedCrewId)
                ? state.selectedCrewId
                : (newCrew[0]?.id ?? null),
            lastSaved: new Date().toISOString(),
          });
          triggerTsAutoSave();
        },
        mergeMemberEntries: (rows) => {
          if (rows.length === 0) return 0;
          const state = get();
          // Build userId → crewId map (skip rows we don't track yet —
          // the synced crew row is created by ensureTeamCrew before
          // this runs in the timesheet page mount sequence).
          const crewByUserId = new Map<string, string>();
          for (const c of state.crew) {
            if (c.userId) crewByUserId.set(c.userId, c.id);
          }

          let applied = 0;
          const newEntries = { ...state.entries };
          for (const row of rows) {
            const crewId = crewByUserId.get(row.user_id);
            if (!crewId) continue;
            const list = Array.isArray(row.entries)
              ? (row.entries as TimesheetEntry[])
              : [];
            for (const incoming of list) {
              if (!incoming?.date || !incoming?.id) continue;
              const key = `${crewId}:${incoming.date}`;
              // Tag the entry so the UI can show a "synced from
              // mobile" badge and so write-back logic in phase 2 can
              // tell synced from designer-added rows apart.
              newEntries[key] = { ...incoming, sourceUserId: row.user_id };
              applied += 1;
            }
          }
          if (applied === 0) return 0;
          set({ entries: newEntries, lastSaved: new Date().toISOString() });
          triggerTsAutoSave();
          return applied;
        },
        updateCrewRateCard: (crewId, updates) => {
          set((s) => ({
            crew: s.crew.map(c =>
              c.id === crewId ? { ...c, rateCard: { ...c.rateCard, ...updates } } : c
            ),
            lastSaved: new Date().toISOString(),
          }));
          triggerTsAutoSave();
        },

        // ── Entries ────────────────────────────────
        getEntry: (crewId, date) => {
          const key = entryKey(crewId, date);
          return get().entries[key] || createEmptyEntry(date);
        },
        saveEntry: (crewId, entry) => {
          const key = entryKey(crewId, entry.date);
          // Stamp sourceUserId on every entry that lives on a synced
          // crew row so write-back / "Synced" UI logic doesn't have
          // to re-derive ownership every time.
          const member = get().crew.find((c) => c.id === crewId);
          const stamped = member?.userId
            ? { ...entry, sourceUserId: entry.sourceUserId ?? member.userId }
            : entry;
          set((s) => ({
            entries: { ...s.entries, [key]: stamped },
            lastSaved: new Date().toISOString(),
          }));
          triggerTsAutoSave();
          pushBackIfSynced(crewId, stamped.date);
        },
        deleteEntry: (crewId, date) => {
          const key = entryKey(crewId, date);
          set((s) => {
            const newEntries = { ...s.entries };
            delete newEntries[key];
            return { entries: newEntries, lastSaved: new Date().toISOString() };
          });
          triggerTsAutoSave();
          pushBackIfSynced(crewId, date);
        },
        setEntryStatus: (crewId, date, status) => {
          const key = entryKey(crewId, date);
          set((s) => {
            const existing = s.entries[key];
            if (!existing) return s;
            return {
              entries: { ...s.entries, [key]: { ...existing, status } },
              lastSaved: new Date().toISOString(),
            };
          });
          triggerTsAutoSave();
          pushBackIfSynced(crewId, date);
        },

        // ── Navigation ─────────────────────────────
        setSelectedCrew: (crewId) => set({ selectedCrewId: crewId }),
        setSelectedWeekStart: (date) => set({ selectedWeekStart: date }),
        navigateWeek: (direction) => {
          const current = get().selectedWeekStart;
          set({ selectedWeekStart: addDays(current, direction === 'next' ? 7 : -7) });
        },

        // ── Calculations ───────────────────────────
        calculateEntry: (crewId, entry, previousWrapOut) => {
          const member = get().crew.find(c => c.id === crewId);
          if (!member || !entry.unitCall || !entry.wrapOut) return emptyCalculation();
          const bectuEntry = toBECTUEntry(entry, member.rateCard, previousWrapOut);
          const bectuCalc = calculateBECTUTimesheet(bectuEntry);
          return mapCalc(bectuCalc, member.rateCard, entry);
        },

        getPreviousWrapOut: (crewId, date) => {
          const prevDate = addDays(date, -1);
          const key = entryKey(crewId, prevDate);
          return get().entries[key]?.wrapOut || undefined;
        },

        getCrewWeekSummary: (crewId, weekStartDate) => {
          const state = get();
          const entries: TimesheetEntry[] = [];
          for (let i = 0; i < 7; i++) {
            const date = addDays(weekStartDate, i);
            const key = entryKey(crewId, date);
            if (state.entries[key]) entries.push(state.entries[key]);
          }

          let totalHours = 0, preCallHours = 0, baseHours = 0, otHours = 0;
          let lateNightHours = 0, brokenLunchHours = 0, brokenTurnaroundHours = 0;
          let sixthDayHours = 0, seventhDayHours = 0, totalEarnings = 0, kitRentalTotal = 0;
          let basePay = 0, overtimePay = 0, preCallPay = 0;
          let brokenLunchPay = 0, brokenTurnaroundPay = 0, lateNightPay = 0;

          const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
          sorted.forEach((entry, index) => {
            const prevWrap = index > 0 ? sorted[index - 1].wrapOut : state.getPreviousWrapOut(crewId, entry.date);
            const calc = state.calculateEntry(crewId, entry, prevWrap);
            totalHours += calc.totalHours;
            preCallHours += calc.preCallHours;
            baseHours += calc.baseHours;
            otHours += calc.otHours;
            lateNightHours += calc.lateNightHours;
            brokenLunchHours += calc.brokenLunchHours;
            brokenTurnaroundHours += calc.brokenTurnaroundHours;
            if (entry.isSixthDay && !entry.isSeventhDay) sixthDayHours += calc.totalHours;
            if (entry.isSeventhDay) seventhDayHours += calc.totalHours;
            totalEarnings += calc.totalPay;
            basePay += calc.basePay;
            overtimePay += calc.overtimePay;
            preCallPay += calc.preCallPay;
            brokenLunchPay += calc.brokenLunchPay;
            brokenTurnaroundPay += calc.brokenTurnaroundPay;
            lateNightPay += calc.lateNightPay;
            if (entry.unitCall && entry.wrapOut) {
              const member = state.crew.find(c => c.id === crewId);
              if (member) kitRentalTotal += member.rateCard.kitRental;
            }
          });

          return {
            startDate: weekStartDate,
            endDate: addDays(weekStartDate, 6),
            totalHours: Math.round(totalHours * 10) / 10,
            preCallHours: Math.round(preCallHours * 10) / 10,
            baseHours: Math.round(baseHours * 10) / 10,
            otHours: Math.round(otHours * 10) / 10,
            sixthDayHours: Math.round(sixthDayHours * 10) / 10,
            seventhDayHours: Math.round(seventhDayHours * 10) / 10,
            lateNightHours: Math.round(lateNightHours * 10) / 10,
            brokenLunchHours: Math.round(brokenLunchHours * 10) / 10,
            brokenTurnaroundHours: Math.round(brokenTurnaroundHours * 10) / 10,
            kitRentalTotal,
            totalEarnings: Math.round(totalEarnings * 100) / 100,
            entries,
            basePay: Math.round(basePay * 100) / 100,
            overtimePay: Math.round(overtimePay * 100) / 100,
            preCallPay: Math.round(preCallPay * 100) / 100,
            brokenLunchPay: Math.round(brokenLunchPay * 100) / 100,
            brokenTurnaroundPay: Math.round(brokenTurnaroundPay * 100) / 100,
            lateNightPay: Math.round(lateNightPay * 100) / 100,
          };
        },

        // ── Aggregations ──────────────────────────
        getTotalLabourCost: (weekStart) => {
          const state = get();
          return state.crew.reduce((sum, member) => {
            const summary = state.getCrewWeekSummary(member.id, weekStart);
            return sum + summary.totalEarnings;
          }, 0);
        },
        getLTDSavings: (weekStart) => {
          const state = get();
          if (!state.production.isLTD) return 0;
          return state.crew
            .filter(c => c.crewType === 'ltd')
            .reduce((sum, member) => {
              const summary = state.getCrewWeekSummary(member.id, weekStart);
              return sum + summary.totalEarnings;
            }, 0);
        },
        getBudgetImpact: (weekStart) => {
          const state = get();
          return state.getTotalLabourCost(weekStart) - state.getLTDSavings(weekStart);
        },

        clearAll: () => {
          set({
            crew: [],
            entries: {},
            selectedCrewId: null,
            lastSaved: new Date().toISOString(),
          });
          triggerTsAutoSave();
        },
        };
      },
      {
        name: `prep-happy-timesheet-${projectId}`,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          production: state.production,
          crew: state.crew,
          entries: state.entries,
          selectedCrewId: state.selectedCrewId,
          selectedWeekStart: state.selectedWeekStart,
          lastSaved: state.lastSaved,
        }),
      }
    )
  );
}

export function useTimesheetStore(projectId: string) {
  if (!tsStoreCache[projectId]) {
    tsStoreCache[projectId] = createTimesheetStore(projectId);
  }
  return tsStoreCache[projectId];
}

// Re-export types from calculations for convenience
export type { BaseContract, BECTUDayType } from '@/utils/bectuCalculations';
export { BASE_CONTRACTS, DAY_TYPES, getContractedWorkHours } from '@/utils/bectuCalculations';
