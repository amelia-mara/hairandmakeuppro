import { useState, useMemo, useCallback, useRef } from 'react';
import {
  MOCK_SCENES, MOCK_CHARACTERS,
  useBreakdownStore, useTagStore, useParsedScriptStore, useCharacterOverridesStore,
  type Scene, type Character,
} from '@/stores/breakdownStore';
import { useBudgetStore, CURRENCY_SYMBOLS, type BudgetLineItem } from '@/stores/budgetStore';
import { useTimesheetStore } from '@/stores/timesheetStore';
import { ReceiptConfirmPanel, type ConfirmData } from '@/components/budget/receipts/ReceiptConfirmPanel';

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
  const [wagesOpen, setWagesOpen] = useState(false);
  const [expensePanelOpen, setExpensePanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /* ── Stores ── */
  const store = useBudgetStore(projectId);
  const categories = store(s => s.categories);
  const expenses = store(s => s.expenses);
  const isLTD = store(s => s.isLTD);
  const currency = store(s => s.currency);
  const setIsLTD = store(s => s.setIsLTD);
  const addLineItem = store(s => s.addLineItem);
  const updateLineItem = store(s => s.updateLineItem);
  const removeLineItem = store(s => s.removeLineItem);
  const addExpense = store(s => s.addExpense);
  const getTotalBudget = store(s => s.getTotalBudget);
  const getTotalSpent = store(s => s.getTotalSpent);
  const getRemaining = store(s => s.getRemaining);
  const getBudgetUsedPercent = store(s => s.getBudgetUsedPercent);
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
  const tagStore = useTagStore();
  const parsedScriptStore = useParsedScriptStore();
  const overridesStore = useCharacterOverridesStore();

  /* ── Script data resolution ── */
  const parsedData = parsedScriptStore.getParsedData(projectId);
  const scenes: Scene[] = useMemo(() => parsedData ? parsedData.scenes : MOCK_SCENES, [parsedData]);
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
  const remaining = getRemaining();
  const percentUsed = getBudgetUsedPercent();
  const perCategoryBudget = getPerCategoryBudget();
  const perCategorySpend = getPerCategorySpend();

  const contingencyRate = 0.10;
  const contingencyAmount = totalBudget * contingencyRate;
  const fullBudgetAsk = isLTD
    ? totalBudget + totalCrewCost + contingencyAmount
    : totalBudget + contingencyAmount;

  const sym = CURRENCY_SYMBOLS[currency] || '£';
  const fmt = (n: number) => `${sym}${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtSigned = (n: number) => n < 0 ? `-${fmt(n)}` : n > 0 ? `+${fmt(n)}` : '—';

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
    <div className="bg-page">
      {/* ── SIDEBAR ── */}
      <nav className="bg-sidebar">
        <div className="bg-sidebar-label">Budget Manager</div>
        {sections.map(s => (
          <button
            key={s.id}
            className={`bg-sidebar-item ${activePanel === s.id ? 'bg-sidebar-item--active' : ''}`}
            onClick={() => setActivePanel(s.id)}
          >
            <span className="bg-sidebar-num">{s.num}</span>
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
        {/* ═══════════════════════════════════
            01  OVERVIEW
        ═══════════════════════════════════ */}
        {activePanel === 'overview' && (
          <div className="bg-panel">
            <div className="bg-page-header">
              <div>
                <div className="bg-eyebrow">01 — Overview</div>
                <h2 className="bg-title">Budget Overview</h2>
                <div className="bg-subtitle">{scenes.length} scenes · Hair &amp; Makeup</div>
              </div>
              <div className="bg-header-actions">
                <span className="bg-last-updated">Last updated today</span>
              </div>
            </div>

            <div className="bg-stat-grid bg-stat-grid--4">
              <StatCard label="Approved Budget" value={fmt(fullBudgetAsk)} color="bg-stat-value--teal" sub="Confirmed by production" />
              <StatCard label="Proposed Total" value={fmt(totalBudget)} color="bg-stat-value--orange" sub="Materials only" />
              <StatCard label="Spent to Date" value={fmt(totalSpent)} color="bg-stat-value--orange" sub={`${Math.round(percentUsed)}% of approved budget`} />
              <StatCard label="Remaining" value={fmt(remaining)} color={remaining >= 0 ? 'bg-stat-value--teal' : 'bg-stat-value--red'} sub={hasExpenses ? `${expenses.length} receipts logged` : 'No spend logged yet'} />
            </div>

            <div className="bg-section-heading">
              Production Details <span className="bg-section-line" />
            </div>
            <div className="bg-card bg-card--flush">
              <div className="bg-info-grid">
                <div className="bg-info-cell"><div className="bg-info-key">Production</div><div className="bg-info-val">Short Film</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">HOD</div><div className="bg-info-val">{characters[0]?.name || '—'}</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">Scenes</div><div className="bg-info-val">{scenes.length} scenes</div></div>
                <div className="bg-info-cell"><div className="bg-info-key">Department</div><div className="bg-info-val">Hair &amp; Makeup</div></div>
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
              <StatCard label="Budget Items Generated" value={String(allLineItems.length)} color="bg-stat-value--teal" />
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
                    {crew.map(member => {
                      const memberCost = member.dayRate * (member.prepDays + member.shootDays + member.wrapDays);
                      return (
                        <tr key={member.id}>
                          <td>{member.name} — {member.role}</td>
                          <td className="bg-td-muted">{fmt(member.dayRate)}</td>
                          <td className="bg-td-amount">{fmt(memberCost)}</td>
                        </tr>
                      );
                    })}
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
              <StatCard label="Approved Budget" value={fmt(fullBudgetAsk)} sub="Confirmed by production" />
              <StatCard label="Spent to Date" value={fmt(totalSpent)} color="bg-stat-value--orange" sub={`${Math.round(percentUsed)}% of approved`} />
              <StatCard label="Remaining" value={fmt(remaining)} color={remaining >= 0 ? 'bg-stat-value--teal' : 'bg-stat-value--red'} sub={`${100 - Math.round(percentUsed)}% left to spend`} />
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
              <StatCard label="Approved Budget" value={fmt(fullBudgetAsk)} />
              <StatCard label="Total Spent" value={fmt(totalSpent)} color="bg-stat-value--orange" />
              <StatCard label="Variance" value={fmtSigned(totalSpent - fullBudgetAsk)} color={totalSpent <= fullBudgetAsk ? 'bg-stat-value--teal' : 'bg-stat-value--red'} sub={totalSpent <= fullBudgetAsk ? 'Under budget' : 'Over budget'} />
              <StatCard label="Status" value={totalSpent <= fullBudgetAsk ? 'Under budget' : 'Over budget'} color={totalSpent <= fullBudgetAsk ? 'bg-stat-value--teal' : 'bg-stat-value--red'} />
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
