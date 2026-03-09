import { useMemo } from 'react';
import {
  CURRENCY_SYMBOLS,
  type CrewMember,
  type WeekSummary,
  type ProductionSettings,
  type CurrencyCode,
} from '@/stores/timesheetStore';

interface TimesheetSidebarProps {
  crew: CrewMember[];
  production: ProductionSettings;
  selectedWeekStart: string;
  getCrewWeekSummary: (crewId: string, weekStartDate: string) => WeekSummary;
}

function fmt(amount: number, currency: CurrencyCode): string {
  const sym = CURRENCY_SYMBOLS[currency] || '£';
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtHrs(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function TimesheetSidebar({
  crew,
  production,
  selectedWeekStart,
  getCrewWeekSummary,
}: TimesheetSidebarProps) {
  const { currency } = production;

  const crewSummaries = useMemo(() => {
    return crew.map(member => ({
      member,
      summary: getCrewWeekSummary(member.id, selectedWeekStart),
    }));
  }, [crew, selectedWeekStart, getCrewWeekSummary]);

  const totals = useMemo(() => {
    let totalHours = 0;
    let totalEarnings = 0;
    let payeSpend = 0;
    let payeCount = 0;

    crewSummaries.forEach(({ member, summary }) => {
      totalHours += summary.totalHours;
      totalEarnings += summary.totalEarnings;
      if (member.crewType === 'paye') {
        payeSpend += summary.totalEarnings;
        payeCount++;
      }
    });

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      payeSpend: Math.round(payeSpend * 100) / 100,
      payeCount,
    };
  }, [crewSummaries]);

  const hasPayeCrew = !production.isLTD && totals.payeCount > 0;

  return (
    <aside className="ts-sidebar">
      <div className="ts-sidebar-header">
        <h3 className="ts-sidebar-title">Overview</h3>
        <span className="ts-sidebar-week-label">This Week</span>
      </div>

      {/* ── Totals ────────────────────────── */}
      <div className="ts-sidebar-totals">
        <div className="ts-sidebar-total-row">
          <span className="ts-sidebar-total-label">Total Hours</span>
          <span className="ts-sidebar-total-value">{fmtHrs(totals.totalHours)}</span>
        </div>
        <div className="ts-sidebar-total-row">
          <span className="ts-sidebar-total-label">Total Earnings</span>
          <span className="ts-sidebar-total-value ts-sidebar-total-accent">{fmt(totals.totalEarnings, currency)}</span>
        </div>
        {hasPayeCrew && (
          <>
            <div className="ts-sidebar-divider" />
            <div className="ts-sidebar-total-row">
              <span className="ts-sidebar-total-label ts-sidebar-paye-label">PAYE Total Spend</span>
              <span className="ts-sidebar-total-value ts-sidebar-paye-value">{fmt(totals.payeSpend, currency)}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Per Crew Member ───────────────── */}
      {crew.length > 0 && (
        <div className="ts-sidebar-crew-list">
          <div className="ts-sidebar-section-label">Per Crew Member</div>
          {crewSummaries.map(({ member, summary }) => (
            <div key={member.id} className="ts-sidebar-crew-item">
              <div className="ts-sidebar-crew-name">
                {member.name || 'Unnamed'}
                {!production.isLTD && member.crewType === 'paye' && (
                  <span className="ts-sidebar-crew-badge">PAYE</span>
                )}
              </div>
              <div className="ts-sidebar-crew-stats">
                <span className="ts-sidebar-crew-hours">{fmtHrs(summary.totalHours)}</span>
                <span className="ts-sidebar-crew-earnings">{fmt(summary.totalEarnings, currency)}</span>
              </div>
              {!production.isLTD && member.crewType === 'paye' && summary.totalEarnings > 0 && (
                <div className="ts-sidebar-crew-paye-line">
                  <span>PAYE cost</span>
                  <span>{fmt(summary.totalEarnings, currency)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {crew.length === 0 && (
        <div className="ts-sidebar-empty">
          Add crew members to see hours and earnings overview
        </div>
      )}
    </aside>
  );
}
