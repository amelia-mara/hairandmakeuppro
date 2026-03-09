import {
  CURRENCY_SYMBOLS,
  type CrewMember,
  type ProductionSettings,
  type WeekSummary,
} from '@/stores/timesheetStore';
import { addDays, formatShortDate } from '@/utils/bectuCalculations';

interface ExportTabProps {
  crew: CrewMember[];
  production: ProductionSettings;
  selectedWeekStart: string;
  getCrewWeekSummary: (crewId: string, weekStartDate: string) => WeekSummary;
  getTotalLabourCost: (weekStart: string) => number;
  getLTDSavings: (weekStart: string) => number;
  getBudgetImpact: (weekStart: string) => number;
  onShowToast: (msg: string) => void;
}

export function ExportTab({
  crew,
  production,
  selectedWeekStart,
  getCrewWeekSummary,
  getTotalLabourCost,
  getLTDSavings,
  getBudgetImpact,
  onShowToast,
}: ExportTabProps) {
  const sym = CURRENCY_SYMBOLS[production.currency];
  const fmt = (n: number) => sym + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const weekEnd = addDays(selectedWeekStart, 6);
  const weekLabel = `${formatShortDate(selectedWeekStart)} – ${formatShortDate(weekEnd)}`;

  const totalLabour = getTotalLabourCost(selectedWeekStart);
  const ltdSavings = getLTDSavings(selectedWeekStart);
  const budgetImpact = getBudgetImpact(selectedWeekStart);

  const handleExportCSV = () => {
    if (crew.length === 0) { onShowToast('No crew to export'); return; }

    const headers = ['Crew Member', 'Position', 'Type', 'Day', 'Date', 'Pre-Call', 'Unit Call', 'Lunch', 'Wrap Out',
      '6th Day', 'Pre-Call Hrs', 'Base Hrs', 'OT Hrs', 'Late Night Hrs', 'Total Hrs',
      'Base Pay', 'Pre-Call Pay', 'OT Pay', 'Late Night Pay', 'Total Pay'];
    const rows: string[][] = [];

    crew.forEach(member => {
      const summary = getCrewWeekSummary(member.id, selectedWeekStart);
      for (let i = 0; i < 7; i++) {
        const date = addDays(selectedWeekStart, i);
        const entry = summary.entries.find(e => e.date === date);
        if (!entry || !entry.unitCall) continue;

        rows.push([
          member.name, member.position, member.crewType.toUpperCase(),
          new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }),
          date, entry.preCall || '', entry.unitCall, entry.lunchStart || '', entry.wrapOut,
          entry.isSixthDay ? 'Yes' : '', '0', '0', '0', '0', '0',
          '0', '0', '0', '0', '0',
        ]);
      }
    });

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_${production.code || 'export'}_${selectedWeekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('CSV exported');
  };

  return (
    <div className="ts-export-tab">
      <div className="ts-export-header">
        <h2 className="ts-section-title">Export & Reports</h2>
        <span className="ts-week-label">{weekLabel}</span>
      </div>

      {/* Summary Cards */}
      <div className="ts-export-stats">
        <div className="ts-stat-card">
          <div className="ts-stat-label">Total Labour Cost</div>
          <div className="ts-stat-value">{fmt(totalLabour)}</div>
        </div>
        {production.isLTD && (
          <div className="ts-stat-card">
            <div className="ts-stat-label">LTD Savings</div>
            <div className="ts-stat-value" style={{ color: '#6b9bd1' }}>{fmt(ltdSavings)}</div>
          </div>
        )}
        <div className="ts-stat-card">
          <div className="ts-stat-label">Budget Impact</div>
          <div className="ts-stat-value">{fmt(budgetImpact)}</div>
        </div>
        <div className="ts-stat-card">
          <div className="ts-stat-label">Active Crew</div>
          <div className="ts-stat-value">{crew.length}</div>
        </div>
      </div>

      {/* Per-Crew Breakdown */}
      {crew.length > 0 && (
        <div className="ts-export-section">
          <h3 className="ts-section-subtitle">Crew Breakdown</h3>
          <div className="ts-export-table-wrap">
            <table className="ts-export-table">
              <thead>
                <tr>
                  <th>Crew Member</th>
                  <th>Position</th>
                  <th>Type</th>
                  <th>Days</th>
                  <th>Hours</th>
                  <th>OT Hrs</th>
                  <th>Base Pay</th>
                  <th>OT Pay</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {crew.map(member => {
                  const summary = getCrewWeekSummary(member.id, selectedWeekStart);
                  return (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      <td>{member.position}</td>
                      <td>
                        <span className={`ts-type-badge ts-type-${member.crewType}`}>
                          {member.crewType.toUpperCase()}
                        </span>
                      </td>
                      <td>{summary.entries.length}</td>
                      <td>{summary.totalHours}h</td>
                      <td>{summary.otHours}h</td>
                      <td>{fmt(summary.basePay)}</td>
                      <td>{fmt(summary.overtimePay)}</td>
                      <td className="ts-cell-total">{fmt(summary.totalEarnings)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>Total</td>
                  <td>{fmt(crew.reduce((s, m) => s + getCrewWeekSummary(m.id, selectedWeekStart).basePay, 0))}</td>
                  <td>{fmt(crew.reduce((s, m) => s + getCrewWeekSummary(m.id, selectedWeekStart).overtimePay, 0))}</td>
                  <td className="ts-cell-total">{fmt(totalLabour)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="ts-export-section">
        <h3 className="ts-section-subtitle">Export Options</h3>
        <div className="ts-export-actions">
          <button className="btn-gold" onClick={handleExportCSV}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          <button className="btn-ghost" onClick={() => onShowToast('PDF export coming soon')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <path d="M14 2v6h6" />
            </svg>
            Generate PDF
          </button>
          <button className="btn-ghost" onClick={() => onShowToast('Invoice generation coming soon')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M7 15h0M2 9.5h20" />
            </svg>
            Generate Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
