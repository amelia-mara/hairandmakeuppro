import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS,
  useBreakdownStore, useParsedScriptStore, useCharacterOverridesStore,
  type Scene, type Character,
} from '@/stores/breakdownStore';
import { useProjectStore } from '@/stores/projectStore';
import { useBudgetStore, CURRENCY_SYMBOLS, type BudgetLineItem } from '@/stores/budgetStore';
import { useTimesheetStore } from '@/stores/timesheetStore';
import { useShoppingFlagStore, SHOPPING_FLAG_KINDS, type ShoppingFlag } from '@/stores/shoppingFlagStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { ReceiptConfirmPanel, type ConfirmData } from '@/components/budget/receipts/ReceiptConfirmPanel';
import { useIsMobile } from '@/hooks/useIsMobile';

/* ━━━ Types ━━━ */

interface BudgetSection {
  id: string;
  num: string;
  title: string;
  status: 'done' | 'going' | 'none';
}

interface ScriptFlag {
  sceneNumber: number;
  characterName: string;
  description: string;
  tags: { label: string; variant: 'teal' | 'orange' | 'red' | 'gold' | 'default' }[];
  type: { label: string; variant: 'teal' | 'orange' | 'gold' | 'default' };
}

/* ━━━ BUDGET PAGE ━━━ */

interface BudgetProps {
  projectId: string;
}

export function Budget({ projectId }: BudgetProps) {
  const [activePanel, setActivePanel] = useState('overview');
  const [expensePanelOpen, setExpensePanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /* Mobile-only — phone viewport (≤768px) hides the 210px sidebar by
     default and slides it in from the left when ☰ is tapped. Picking
     a section auto-closes the drawer. */
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);
  const pickPanel = (id: string) => { setActivePanel(id); setDrawerOpen(false); };
  const project = useProjectStore((s) => s.getProject(projectId));
  const deptLabel = project?.department === 'costume' ? 'Costume' : 'Hair & Makeup';

  /* ── Stores ── */
  const store = useBudgetStore(projectId);
  const categories = store(s => s.categories);
  const expenses = store(s => s.expenses);
  const isLTD = store(s => s.isLTD);
  const currency = store(s => s.currency);
  const setIsLTD = store(s => s.setIsLTD);
  const addLineItem = store(s => s.addLineItem);
  const addExpense = store(s => s.addExpense);
  const projectInfo = store(s => s.projectInfo);
  const setBudgetLimit = store(s => s.setBudgetLimit);
  /** Production-set fixed budget. Some productions skip the proposal
   *  flow and just hand the department a number — when this is > 0
   *  it overrides the bottom-up approvedBudget calculation. */
  const productionBudget = projectInfo?.budgetLimit || 0;
  const getTotalBudget = store(s => s.getTotalBudget);
  const getTotalSpent = store(s => s.getTotalSpent);
  const getPerCategoryBudget = store(s => s.getPerCategoryBudget);
  const getPerCategorySpend = store(s => s.getPerCategorySpend);
  const getLineItemTotal = store(s => s.getLineItemTotal);

  const tsStore = useTimesheetStore(projectId);
  const crew = tsStore(s => s.crew);
  const selectedWeekStart = tsStore(s => s.selectedWeekStart);
  const getTotalLabourCost = tsStore(s => s.getTotalLabourCost);
  const hasTimesheetData = crew.length > 0;
  const totalCrewCost = hasTimesheetData ? getTotalLabourCost(selectedWeekStart) : 0;

  const breakdownStore = useBreakdownStore();
  const parsedScriptStore = useParsedScriptStore();
  const overridesStore = useCharacterOverridesStore();

  /* ── Script data resolution ── */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const scenes: Scene[] = useMemo(() => {
    const arr = parsedData ? parsedData.scenes : MOCK_SCENES;
    return [...arr].sort((a, b) => a.number - b.number);
  }, [parsedData]);
  const rawCharacters: Character[] = useMemo(() => {
    if (!parsedData) return MOCK_CHARACTERS;
    return parsedData.characters.map(c => ({ ...c, category: c.category || 'principal' as const }));
  }, [parsedData]);
  const characters = useMemo(
    () => rawCharacters.map(c => overridesStore.getCharacter(c)).sort((a, b) => a.billing - b.billing),
    [rawCharacters, overridesStore],
  );

  /* ── Computed budget values ── */
  const totalBudget = getTotalBudget();
  const totalSpent = getTotalSpent();
  const perCategoryBudget = getPerCategoryBudget();
  const perCategorySpend = getPerCategorySpend();

  const contingencyRate = 0.10;
  const contingencyAmount = totalBudget * contingencyRate;
  const fullBudgetAsk = isLTD
    ? totalBudget + totalCrewCost + contingencyAmount
    : totalBudget + contingencyAmount;
  /** Final budget the department is working against — production-set
   *  amount when supplied, otherwise the bottom-up proposal total.
   *  Used for "Approved Budget", spend %, remaining, variance. */
  const approvedBudget = productionBudget > 0 ? productionBudget : fullBudgetAsk;
  const remainingApproved = approvedBudget - totalSpent;
  const pctApproved = approvedBudget > 0 ? (totalSpent / approvedBudget) * 100 : 0;

  const sym = CURRENCY_SYMBOLS[currency] || '£';
  const fmt = (n: number) => `${sym}${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtSigned = (n: number) => n < 0 ? `-${fmt(n)}` : n > 0 ? `+${fmt(n)}` : '—';

  /* ── Shopping list rollup ──────────────────────────────────
     Per-character "major item" flags (wig / facial hair / tattoo /
     prosthetic) ticked in the breakdown panel. The store dedupes by
     (character, kind, scope, scopeRef), so each entry here maps to
     one budget line item. We expand each flag to the scenes it
     covers and, if a schedule is parsed, count unique shoot days. */
  const shoppingStore = useShoppingFlagStore(projectId);
  const shoppingFlags = shoppingStore((s) => s.flags);
  const scheduleStore = useScheduleStore(projectId);
  const schedule = scheduleStore((s) => s.current);

  const allLooks = useMemo(
    () => parsedData ? parsedData.looks : [],
    [parsedData],
  );

  /** Map sceneNumber (int) → unique shoot day count from the parsed
   *  schedule. Returns 0 when the scene doesn't appear in the schedule
   *  or no schedule has been uploaded. */
  const scheduleDaysFor = useCallback((sceneNumbers: number[]): number => {
    if (!schedule) return 0;
    const wanted = new Set(sceneNumbers.map(String));
    const days = new Set<number>();
    for (const day of schedule.days) {
      for (const s of day.scenes) {
        if (wanted.has(String(parseInt(s.sceneNumber, 10)))) {
          days.add(day.dayNumber);
          break;
        }
      }
    }
    return days.size;
  }, [schedule]);

  interface ShoppingRollupRow {
    flag: ShoppingFlag;
    kindLabel: string;
    characterName: string;
    scopeLabel: string;
    sceneNumbers: number[];
    dayCount: number;
  }

  const shoppingRollup: ShoppingRollupRow[] = useMemo(() => {
    if (shoppingFlags.length === 0) return [];

    /** Compact a sorted array of scene numbers into "1, 4-7, 12" form. */
    const formatSceneRange = (nums: number[]): string => {
      if (nums.length === 0) return '—';
      const sorted = [...nums].sort((a, b) => a - b);
      const ranges: string[] = [];
      let start = sorted[0];
      let prev = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
          prev = sorted[i];
        } else {
          ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
          start = sorted[i];
          prev = sorted[i];
        }
      }
      ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
      return ranges.join(', ');
    };

    return shoppingFlags
      .map((flag): ShoppingRollupRow | null => {
        const kindDef = SHOPPING_FLAG_KINDS.find((k) => k.id === flag.kind);
        const ch = characters.find((c) => c.id === flag.characterId);
        if (!kindDef || !ch) return null;

        let sceneNumbers: number[] = [];
        let scopeLabel = '';

        if (flag.scope === 'storyline') {
          sceneNumbers = scenes
            .filter((s) => s.characterIds.includes(flag.characterId) && !s.isOmitted)
            .map((s) => s.number);
          scopeLabel = 'Storyline';
        } else if (flag.scope === 'look' && flag.lookId) {
          const look = allLooks.find((l) => l.id === flag.lookId);
          scopeLabel = `Look · ${look?.name || 'Untitled'}`;
          // Scene matches when its breakdown has this character on this look.
          for (const scene of scenes) {
            if (scene.isOmitted) continue;
            const bd = breakdownStore.getBreakdown(scene.id);
            if (!bd) continue;
            const cb = bd.characters.find(
              (c) => c.characterId === flag.characterId && c.lookId === flag.lookId,
            );
            if (cb) sceneNumbers.push(scene.number);
          }
        } else if (flag.scope === 'continuity' && flag.continuityEventId) {
          // Find the event by scanning every scene's breakdown — the
          // event lives wherever it was created, but its sceneRange
          // covers the whole arc.
          let event = null as null | { sceneRange: string; description?: string; type: string };
          for (const scene of scenes) {
            const bd = breakdownStore.getBreakdown(scene.id);
            if (!bd) continue;
            const found = bd.continuityEvents.find((e) => e.id === flag.continuityEventId);
            if (found) { event = found; break; }
          }
          if (!event) return null;
          scopeLabel = `Event · ${event.description || event.type}`;
          // Parse sceneRange like "5-12" or "5"
          const rangeMatch = event.sceneRange.match(/^(\d+)\s*[-–]\s*(\d+)?/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : start;
            sceneNumbers = scenes
              .filter((s) => s.number >= start && s.number <= end && !s.isOmitted)
              .map((s) => s.number);
          }
        }

        return {
          flag,
          kindLabel: kindDef.label,
          characterName: ch.name,
          scopeLabel: scopeLabel + (sceneNumbers.length > 0 ? ` · Sc ${formatSceneRange(sceneNumbers)}` : ''),
          sceneNumbers,
          dayCount: scheduleDaysFor(sceneNumbers),
        };
      })
      .filter((r): r is ShoppingRollupRow => r !== null)
      .sort((a, b) => {
        // Group by character name, then by kind in the canonical order.
        if (a.characterName !== b.characterName) return a.characterName.localeCompare(b.characterName);
        const aIdx = SHOPPING_FLAG_KINDS.findIndex((k) => k.id === a.flag.kind);
        const bIdx = SHOPPING_FLAG_KINDS.findIndex((k) => k.id === b.flag.kind);
        return aIdx - bIdx;
      });
  }, [shoppingFlags, characters, scenes, allLooks, breakdownStore, scheduleDaysFor]);

  /* ── Script flags (SFX/prosthetics from breakdown) ── */
  const scriptFlags: ScriptFlag[] = useMemo(() => {
    const flags: ScriptFlag[] = [];
    for (const scene of scenes) {
      const bd = breakdownStore.getBreakdown(scene.id);
      if (!bd) continue;
      for (const ev of bd.continuityEvents) {
        if (ev.type === 'Prosthetic' || ev.type === 'Wound') {
          const ch = characters.find(c => c.id === ev.characterId);
          flags.push({
            sceneNumber: scene.number,
            characterName: ch?.name || 'Unknown',
            description: ev.description || ev.name || ev.type,
            tags: [
              { label: ev.type === 'Prosthetic' ? 'Prosthetics' : 'SFX', variant: 'teal' },
            ],
            type: { label: ev.type === 'Prosthetic' ? 'SFX' : 'SFX', variant: 'teal' },
          });
        }
      }
      for (const cb of bd.characters) {
        if (cb.sfx) {
          const ch = characters.find(c => c.id === cb.characterId);
          flags.push({
            sceneNumber: scene.number,
            characterName: ch?.name || 'Unknown',
            description: cb.sfx,
            tags: [{ label: 'SFX', variant: 'teal' }],
            type: { label: 'SFX', variant: 'teal' },
          });
        }
      }
    }
    return flags;
  }, [scenes, breakdownStore, characters]);

  /* ── Category spend data for bars ── */
  const categorySpendData = useMemo(() => {
    return categories
      .filter(cat => perCategoryBudget[cat.id] > 0 || perCategorySpend[cat.id] > 0)
      .map(cat => {
        const budgeted = perCategoryBudget[cat.id] || 0;
        const spent = perCategorySpend[cat.id] || 0;
        const pct = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
        const status: 'ok' | 'warn' | 'over' | 'nil' =
          budgeted === 0 ? 'nil' :
          spent > budgeted ? 'over' :
          spent >= budgeted * 0.75 ? 'warn' : 'ok';
        return { id: cat.id, name: cat.name, budgeted, spent, pct, status };
      });
  }, [categories, perCategoryBudget, perCategorySpend]);

  /* ── Flat line items for proposal table ── */
  const allLineItems = useMemo(() => {
    const items: { catId: string; catName: string; item: BudgetLineItem; total: number }[] = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        items.push({ catId: cat.id, catName: cat.name, item, total: getLineItemTotal(item) });
      }
    }
    return items;
  }, [categories, getLineItemTotal]);

  /* ── Sorted expenses for receipt log ── */
  const sortedExpenses = useMemo(() =>
    [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [expenses]);

  /* ── Sections ── */
  const flaggedCount = scriptFlags.length;
  const hasExpenses = expenses.length > 0;

  const sections: BudgetSection[] = [
    { id: 'overview', num: '01', title: 'Overview', status: 'done' },
    { id: 'flags', num: '02', title: 'Script Flags', status: flaggedCount > 0 ? 'going' : 'none' },
    { id: 'proposal', num: '03', title: 'Budget Proposal', status: totalBudget > 0 ? 'going' : 'none' },
    { id: 'tracking', num: '04', title: 'Spend Tracking', status: hasExpenses ? 'going' : 'none' },
    { id: 'reconciliation', num: '05', title: 'Reconciliation', status: 'none' },
  ];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleExpenseConfirm = useCallback((data: ConfirmData) => {
    addExpense({
      date: data.date,
      supplier: data.supplier,
      category: data.category,
      lineItemId: data.lineItemId,
      vat: data.vat,
      amount: data.amount,
      receiptImageUri: data.imageUri,
    });
    setExpensePanelOpen(false);
    showToast('Expense logged');
  }, [addExpense, showToast]);

  /* ── Tag variant class helper ── */
  const tagCls = (v: string) =>
    v === 'teal' ? 'bg-tag--teal' :
    v === 'orange' ? 'bg-tag--orange' :
    v === 'red' ? 'bg-tag--red' :
    v === 'gold' ? 'bg-tag--gold' : '';

  /* ── Render helper for stat cards ── */
  const StatCard = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
    <div className="bg-stat-card">
      <div className="bg-stat-label">{label}</div>
      <div className={`bg-stat-value ${color || ''}`}>{value}</div>
      {sub && <div className="bg-stat-sub">{sub}</div>}
    </div>
  );

  return (
    <div className={`bg-page${isMobile ? ' bg-page--mobile' : ''}${isMobile && drawerOpen ? ' bg-page--drawer-open' : ''}`}>
      {/* Mobile drawer backdrop */}
      {isMobile && drawerOpen && (
        <div className="bg-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      )}
      {/* ── SIDEBAR ── */}
      <nav className="bg-sidebar">
        <div className="bg-sidebar-label">Budget Manager</div>
        {sections.map(s => (
          <button
            key={s.id}
            className={`bg-sidebar-item ${activePanel === s.id ? 'bg-sidebar-item--active' : ''}`}
            onClick={() => pickPanel(s.id)}
          >
            <span className="bg-sidebar-text">{s.title}</span>
            <span className={`bg-sidebar-dot ${s.status === 'done' ? 'bg-sidebar-dot--done' : s.status === 'going' ? 'bg-sidebar-dot--going' : ''}`} />
          </button>
        ))}
        <div className="bg-sidebar-divider" />
        <div className="bg-sidebar-legend-label">Completion</div>
        <div className="bg-sidebar-legend">
          <span className="bg-sidebar-legend-dot bg-sidebar-legend-dot--done" /> Complete
        </div>
        <div className="bg-sidebar-legend">
          <span className="bg-sidebar-legend-dot bg-sidebar-legend-dot--going" /> In progress
        </div>
        <div className="bg-sidebar-legend">
          <span className="bg-sidebar-legend-dot bg-sidebar-legend-dot--none" /> Not started
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main className="bg-main">
        {isMobile && (
          <button
            type="button"
            className="bg-drawer-toggle"
            aria-label="Open budget sections"
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
        {/* ═══════════════════════════════════
            01  OVERVIEW
        ═══════════════════════════════════ */}
        {activePanel === 'overview' && (
          <div className="bg-panel">
            <div className="bg-page-header">
              <div>
                <div className="bg-eyebrow">01 — Overview</div>
                <h2 className="bg-title"><span className="bg-title-italic">Budget</span>{' '}<span className="bg-title-regular">Overview</span></h2>
                <div className="bg-subtitle">{scenes.length} scenes · {deptLabel}</div>
              </div>
              <div className="bg-header-actions">
                <span className="bg-last-updated">Last updated today</span>
              </div>
            </div>

            <div className="bg-stat-grid bg-stat-grid--4">
              <StatCard label="Approved Budget" value={fmt(approvedBudget)} color="bg-stat-value--teal" sub={productionBudget > 0 ? 'Production-set' : 'Bottom-up estimate'} />
              <StatCard label="Proposed Total" value={fmt(totalBudget)} color="bg-stat-value--orange" sub="Materials only" />
              <StatCard label="Spent to Date" value={fmt(totalSpent)} color="bg-stat-value--orange" sub={`${Math.round(pctApproved)}% of approved budget`} />
              <StatCard label="Remaining" value={fmt(remainingApproved)} color={remainingApproved >= 0 ? 'bg-stat-value--teal' : 'bg-stat-value--red'} sub={hasExpenses ? `${expenses.length} receipts logged` : 'No spend logged yet'} />
            </div>

            <div className="bg-section-heading">
              Production Details <span className="bg-section-line" />
            </div>
            <div className="bg-card bg-card--flush">
              <div className="bg-info-grid">
                <div className="bg-info-cell"><div className="bg-info-key">Production</div><div className="bg-info-val">Short Film</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">HOD</div><div className="bg-info-val">{characters[0]?.name || '—'}</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">Scenes</div><div className="bg-info-val">{scenes.length} scenes</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">Department</div><div className="bg-info-val">{deptLabel}</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">Flagged Scenes</div><div className="bg-info-val">{flaggedCount} flagged</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">Categories</div><div className="bg-info-val">{categories.filter(c => c.items.length > 0).length} with items</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">Crew Wages</div><div className="bg-info-val">{isLTD ? fmt(totalCrewCost) : 'Not included in budget'}</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">Contingency</div><div className="bg-info-val">{Math.round(contingencyRate * 100)}% ({fmt(contingencyAmount)}) added</div></div>
              </div>
            </div>

            <div className="bg-section-heading" style={{ marginTop: 28 }}>
              Spend by Category <span className="bg-section-line" />
            </div>
            <div className="bg-card bg-card--flush">
              {categorySpendData.length === 0 && (
                <div className="bg-empty-row">No budget categories with items yet. Add line items in Budget Proposal.</div>
              )}
              {categorySpendData.map(cat => (
                <div key={cat.id} className="bg-cat-row">
                  <div className="bg-cat-name">{cat.name}</div>
                  <div className="bg-cat-bar">
                    <div className="bg-cat-track">
                      <div className={`bg-cat-fill bg-cat-fill--${cat.status}`} style={{ width: `${Math.max(cat.pct, cat.status === 'nil' ? 1 : cat.pct)}%` }} />
                    </div>
                  </div>
                  <div className="bg-cat-amounts"><strong>{fmt(cat.spent)}</strong> / {fmt(cat.budgeted)}</div>
                  <div className={`bg-cat-status bg-cat-status--${cat.status}`}>
                    {cat.status === 'nil' ? '—' : cat.pct >= 100 ? 'Done' : `${Math.round(cat.pct)}%`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════
            02  SCRIPT FLAGS
        ═══════════════════════════════════ */}
        {activePanel === 'flags' && (
          <div className="bg-panel">
            <div className="bg-page-header">
              <div>
                <div className="bg-eyebrow">02 — Script Flags</div>
                <h2 className="bg-title">Script Breakdown Flags</h2>
                <div className="bg-subtitle">Identified during breakdown — auto-populates Budget Proposal</div>
              </div>
            </div>

            <div className="bg-stat-grid bg-stat-grid--4">
              <StatCard label="Total Scenes" value={String(scenes.length)} />
              <StatCard label="Flagged" value={String(flaggedCount)} color="bg-stat-value--orange" />
              <StatCard label="SFX / Prosthetics" value={String(scriptFlags.filter(f => f.type.variant === 'teal').length)} />
              <StatCard label="Shopping Items" value={String(shoppingRollup.length)} color="bg-stat-value--teal" />
            </div>

            {/* Shopping list rollup — major HMU items the production has
                to source ahead of shooting. Each row is one budget line
                item (deduped across scenes via the flag's scope). */}
            <div className="bg-section-heading">
              Shopping List <span className="bg-section-line" />
            </div>
            <div className="bg-card bg-card--flush">
              <div className="bg-col-head">
                <span className="bg-ch" style={{ width: 110 }}>Item</span>
                <span className="bg-ch" style={{ width: 130 }}>Character</span>
                <span className="bg-ch" style={{ flex: 1 }}>Scope · Scenes</span>
                <span className="bg-ch" style={{ width: 80, textAlign: 'right' }}>{schedule ? 'Days' : 'Scenes'}</span>
              </div>
              {shoppingRollup.length === 0 && (
                <div className="bg-empty-row">
                  No shopping items flagged yet. Tick wig / facial hair / tattoo / prosthetic in the Script Breakdown panel.
                </div>
              )}
              {shoppingRollup.map((row) => (
                <div key={row.flag.id} className="bg-flag-row">
                  <div className="bg-flag-sc">{row.kindLabel}</div>
                  <div className="bg-flag-char">{row.characterName}</div>
                  <div className="bg-flag-body">
                    <div className="bg-flag-desc">{row.scopeLabel}</div>
                  </div>
                  <div className="bg-flag-type">
                    <span className="bg-tag bg-tag--teal">
                      {schedule
                        ? `${row.dayCount} day${row.dayCount === 1 ? '' : 's'}`
                        : `${row.sceneNumbers.length} sc`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-section-heading">
              Scene Flags <span className="bg-section-line" />
            </div>
            <div className="bg-card bg-card--flush">
              <div className="bg-col-head">
                <span className="bg-ch" style={{ width: 42 }}>Sc.</span>
                <span className="bg-ch" style={{ width: 118 }}>Character</span>
                <span className="bg-ch" style={{ flex: 1 }}>Notes</span>
                <span className="bg-ch" style={{ width: 70, textAlign: 'right' }}>Type</span>
              </div>
              {scriptFlags.length === 0 && (
                <div className="bg-empty-row">No scene flags found. Flag SFX or prosthetics in the Script Breakdown page.</div>
              )}
              {scriptFlags.map((flag, i) => (
                <div key={i} className="bg-flag-row">
                  <div className="bg-flag-sc">Sc {flag.sceneNumber}</div>
                  <div className="bg-flag-char">{flag.characterName}</div>
                  <div className="bg-flag-body">
                    <div className="bg-flag-desc">{flag.description}</div>
                    <div className="bg-flag-tags">
                      {flag.tags.map((t, j) => (
                        <span key={j} className={`bg-tag ${tagCls(t.variant)}`}>{t.label}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-flag-type">
                    <span className={`bg-tag ${tagCls(flag.type.variant)}`}>{flag.type.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════
            03  BUDGET PROPOSAL
        ═══════════════════════════════════ */}
        {activePanel === 'proposal' && (
          <div className="bg-panel">
            <div className="bg-page-header">
              <div>
                <div className="bg-eyebrow">03 — Budget Proposal</div>
                <h2 className="bg-title">Budget Proposal</h2>
                <div className="bg-subtitle">Ready to send to production</div>
              </div>
              <div className="bg-header-actions">
                <button className="bg-btn bg-btn--ghost">Preview</button>
                <button className="bg-btn bg-btn--primary">Send to Production</button>
              </div>
            </div>

            <div className="bg-stat-grid bg-stat-grid--4">
              <StatCard label="Materials Total" value={fmt(totalBudget)} color="bg-stat-value--orange" sub={`${allLineItems.length} line items`} />
              <StatCard label="Crew Wages" value={isLTD ? fmt(totalCrewCost) : 'Not included'} color={isLTD ? 'bg-stat-value--teal' : 'bg-stat-value--muted'} sub="Toggle below to include" />
              <StatCard label={`Contingency (${Math.round(contingencyRate * 100)}%)`} value={fmt(contingencyAmount)} color="bg-stat-value--gold" sub="Added to total ask" />
              <StatCard label="Full Budget Ask" value={fmt(fullBudgetAsk)} color="bg-stat-value--teal" sub={isLTD ? 'Materials + wages + contingency' : 'Materials + contingency'} />
            </div>

            {/* Production-set budget — for productions that skip the
                proposal flow and just hand you a fixed amount. When
                set (>0), it overrides the bottom-up calculation as
                the "Approved Budget" on every panel. */}
            <div className="bg-section-heading">
              Production-set budget <span className="bg-section-line" />
            </div>
            <div className="bg-toggle-block">
              <div className="bg-toggle-info">
                <div className="bg-toggle-title">Skip the proposal — production gave you a fixed amount</div>
                <div className="bg-toggle-sub">If production has confirmed a number, enter it here. Spend tracking will compare against this instead of the bottom-up calculation above. Leave blank (or 0) to use the proposal total.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-muted)' }}>{sym}</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={productionBudget || ''}
                  placeholder="0"
                  onChange={(e) => setBudgetLimit(parseFloat(e.target.value) || 0)}
                  className="bg-budget-input"
                  style={{
                    width: 140,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-card)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    textAlign: 'right',
                  }}
                />
              </div>
            </div>

            {/* Crew wages toggle */}
            <div className="bg-section-heading">
              Crew Wages <span className="bg-section-line" />
            </div>
            <div className="bg-toggle-block">
              <div className="bg-toggle-info">
                <div className="bg-toggle-title">Include crew wages in this budget</div>
                <div className="bg-toggle-sub">Enable only if you are VAT registered, operating as an LTD, or are personally responsible for paying crew wages from your department budget.</div>
              </div>
              <button
                className={`bg-switch ${isLTD ? 'bg-switch--on' : ''}`}
                onClick={() => setIsLTD(!isLTD)}
              >
                <span className="bg-switch-thumb" />
              </button>
            </div>

            {isLTD && hasTimesheetData && (
              <div className="bg-wages-panel">
                <div className="bg-wages-head">
                  <span className="bg-wages-head-title">Crew Wages Breakdown</span>
                  <span className="bg-tag bg-tag--teal">From timesheet</span>
                </div>
                <table className="bg-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Day Rate</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crew.map(member => (
                      <tr key={member.id}>
                        <td>{member.name} — {member.position}</td>
                        <td className="bg-td-muted">{fmt(member.rateCard.dailyRate)}</td>
                        <td className="bg-td-amount">{fmt(member.rateCard.dailyRate)}/day</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-tr-total">
                      <td colSpan={2}>Wages Subtotal</td>
                      <td style={{ textAlign: 'right' }}>{fmt(totalCrewCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Materials table */}
            <div className="bg-section-heading" style={{ marginTop: 20 }}>
              Consumables and Materials <span className="bg-section-line" />
            </div>
            <div className="bg-card bg-card--flush">
              <table className="bg-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {allLineItems.length === 0 && (
                    <tr><td colSpan={5} className="bg-empty-row">No line items yet. Add categories and items below.</td></tr>
                  )}
                  {allLineItems.map(({ catName, item, total }) => (
                    <tr key={item.id}>
                      <td><span className="bg-tag bg-tag--default">{catName}</span></td>
                      <td>{item.description || '(untitled)'}</td>
                      <td className="bg-td-muted">{item.qty}</td>
                      <td className="bg-td-muted">{fmt(item.price)}</td>
                      <td className="bg-td-amount">{fmt(total)}</td>
                    </tr>
                  ))}
                </tbody>
                {allLineItems.length > 0 && (
                  <tfoot>
                    <tr className="bg-tr-total">
                      <td colSpan={4}>Materials Total</td>
                      <td style={{ textAlign: 'right' }}>{fmt(totalBudget)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <button className="bg-add-btn" onClick={() => {
              const firstCat = categories[0];
              if (firstCat) {
                addLineItem(firstCat.id);
                showToast('Line item added');
              }
            }}>
              + Add Line Item
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════
            04  SPEND TRACKING
        ═══════════════════════════════════ */}
        {activePanel === 'tracking' && (
          <div className="bg-panel">
            <div className="bg-page-header">
              <div>
                <div className="bg-eyebrow">04 — Spend Tracking</div>
                <h2 className="bg-title">Spend Tracking</h2>
                <div className="bg-subtitle">Live during shoot — log receipts as you purchase</div>
              </div>
              <div className="bg-header-actions">
                <button className="bg-btn bg-btn--primary" onClick={() => setExpensePanelOpen(true)}>+ Log Receipt</button>
              </div>
            </div>

            <div className="bg-stat-grid bg-stat-grid--4">
              <StatCard label="Approved Budget" value={fmt(approvedBudget)} sub={productionBudget > 0 ? 'Production-set' : 'Bottom-up estimate'} />
              <StatCard label="Spent to Date" value={fmt(totalSpent)} color="bg-stat-value--orange" sub={`${Math.round(pctApproved)}% of approved`} />
              <StatCard label="Remaining" value={fmt(remainingApproved)} color={remainingApproved >= 0 ? 'bg-stat-value--teal' : 'bg-stat-value--red'} sub={`${Math.max(0, 100 - Math.round(pctApproved))}% left to spend`} />
              <StatCard label="Receipts" value={String(expenses.length)} sub={`${expenses.length} logged`} />
            </div>

            {/* Progress bars */}
            <div className="bg-section-heading">
              Spend by Category <span className="bg-section-line" />
            </div>
            <div className="bg-card">
              {categorySpendData.length === 0 && (
                <div className="bg-empty-row">No categories with budget or spend yet.</div>
              )}
              {categorySpendData.map(cat => (
                <div key={cat.id} className="bg-prog-block">
                  <div className="bg-prog-header">
                    <span className="bg-prog-label">{cat.name}</span>
                    <span className="bg-prog-vals"><strong>{fmt(cat.spent)}</strong> / {fmt(cat.budgeted)}</span>
                  </div>
                  <div className="bg-prog-track">
                    <div className={`bg-prog-fill bg-prog-fill--${cat.status}`} style={{ width: `${Math.max(cat.pct, 1)}%` }} />
                  </div>
                  <div className={`bg-prog-note bg-prog-note--${cat.status}`}>
                    {cat.status === 'nil' ? 'Not yet purchased' :
                     cat.pct >= 100 ? 'Complete — all materials purchased' :
                     `${Math.round(cat.pct)}% spent`}
                  </div>
                </div>
              ))}
            </div>

            {/* Receipt log */}
            <div className="bg-section-heading" style={{ marginTop: 28 }}>
              Receipt Log <span className="bg-section-line" />
            </div>
            <div className="bg-card bg-card--flush">
              {sortedExpenses.length === 0 && (
                <div className="bg-empty-row">No receipts logged yet. Click &quot;+ Log Receipt&quot; to add your first expense.</div>
              )}
              {sortedExpenses.map(exp => {
                const cat = categories.find(c => c.id === exp.category);
                return (
                  <div key={exp.id} className="bg-receipt-row">
                    <div className="bg-receipt-icon">
                      {exp.receiptImageUri ? (
                        <img src={exp.receiptImageUri} alt="" className="bg-receipt-thumb-img" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="bg-receipt-name">{exp.supplier || '(no supplier)'}</div>
                      <div className="bg-receipt-meta">{cat?.name || exp.category} · {exp.date}</div>
                    </div>
                    <div className="bg-receipt-amount">{fmt(exp.amount)}</div>
                    <span className="bg-status-dot bg-status-dot--ok" />
                  </div>
                );
              })}
            </div>
            <button className="bg-add-btn" onClick={() => setExpensePanelOpen(true)}>+ Log Receipt</button>
          </div>
        )}

        {/* ═══════════════════════════════════
            05  RECONCILIATION
        ═══════════════════════════════════ */}
        {activePanel === 'reconciliation' && (
          <div className="bg-panel">
            <div className="bg-page-header">
              <div>
                <div className="bg-eyebrow">05 — Reconciliation</div>
                <h2 className="bg-title">Reconciliation</h2>
                <div className="bg-subtitle">Post-wrap · Final account to production</div>
              </div>
              <div className="bg-header-actions">
                <button className="bg-btn bg-btn--ghost">Generate Notes</button>
                <button className="bg-btn bg-btn--primary">Send Final Account</button>
              </div>
            </div>

            <div className="bg-stat-grid bg-stat-grid--4">
              <StatCard label="Approved Budget" value={fmt(approvedBudget)} />
              <StatCard label="Total Spent" value={fmt(totalSpent)} color="bg-stat-value--orange" />
              <StatCard label="Variance" value={fmtSigned(totalSpent - approvedBudget)} color={totalSpent <= approvedBudget ? 'bg-stat-value--teal' : 'bg-stat-value--red'} sub={totalSpent <= approvedBudget ? 'Under budget' : 'Over budget'} />
              <StatCard label="Status" value={totalSpent <= approvedBudget ? 'Under budget' : 'Over budget'} color={totalSpent <= approvedBudget ? 'bg-stat-value--teal' : 'bg-stat-value--red'} />
            </div>

            <div className="bg-section-heading">
              Proposed vs Actual <span className="bg-section-line" />
            </div>
            <div className="bg-card bg-card--flush">
              <div className="bg-col-head">
                <span className="bg-ch" style={{ flex: 1 }}>Category</span>
                <span className="bg-ch" style={{ width: 90, textAlign: 'right' }}>Proposed</span>
                <span className="bg-ch" style={{ width: 90, textAlign: 'right' }}>Actual</span>
                <span className="bg-ch" style={{ width: 80, textAlign: 'right' }}>Variance</span>
              </div>
              {categories.filter(c => perCategoryBudget[c.id] > 0 || perCategorySpend[c.id] > 0).map(cat => {
                const proposed = perCategoryBudget[cat.id] || 0;
                const actual = perCategorySpend[cat.id] || 0;
                const variance = actual - proposed;
                return (
                  <div key={cat.id} className="bg-recon-row">
                    <div className="bg-recon-cat">{cat.name}</div>
                    <div className="bg-recon-proposed">{fmt(proposed)}</div>
                    <div className="bg-recon-actual">{fmt(actual)}</div>
                    <div className={`bg-recon-var ${variance > 0 ? 'bg-recon-var--over' : variance < 0 ? 'bg-recon-var--under' : 'bg-recon-var--zero'}`}>
                      {fmtSigned(variance)}
                    </div>
                  </div>
                );
              })}
              {categories.filter(c => perCategoryBudget[c.id] > 0 || perCategorySpend[c.id] > 0).length > 0 && (
                <div className="bg-recon-row bg-recon-row--total">
                  <div className="bg-recon-cat">Total</div>
                  <div className="bg-recon-proposed">{fmt(totalBudget)}</div>
                  <div className="bg-recon-actual" style={{ color: 'var(--accent)' }}>{fmt(totalSpent)}</div>
                  <div className={`bg-recon-var ${totalSpent > totalBudget ? 'bg-recon-var--over' : totalSpent < totalBudget ? 'bg-recon-var--under' : 'bg-recon-var--zero'}`}>
                    {fmtSigned(totalSpent - totalBudget)}
                  </div>
                </div>
              )}
              {categories.filter(c => perCategoryBudget[c.id] > 0 || perCategorySpend[c.id] > 0).length === 0 && (
                <div className="bg-empty-row">No categories with budget or spend data yet.</div>
              )}
            </div>

            <div className="bg-section-heading" style={{ marginTop: 28 }}>
              Reconciliation Notes <span className="bg-section-line" />
            </div>
            <div className="bg-card">
              <textarea className="bg-notes-textarea" placeholder="Add reconciliation notes here..." />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button className="bg-btn bg-btn--ghost" style={{ fontSize: '0.6875rem' }}>Generate with Scriptie</button>
                <button className="bg-btn bg-btn--primary" style={{ fontSize: '0.6875rem' }}>Send Final Account</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Expense slide-out panel ── */}
      <ReceiptConfirmPanel
        open={expensePanelOpen}
        onClose={() => setExpensePanelOpen(false)}
        onConfirm={handleExpenseConfirm}
        onDiscard={() => setExpensePanelOpen(false)}
        categories={categories}
        currency={currency}
        isManual
      />

      {/* ── Toast ── */}
      {toast && <div className="bg-toast">{toast}</div>}
    </div>
  );
}
