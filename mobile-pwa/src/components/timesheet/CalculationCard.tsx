import type { TimesheetCalculation, RateCard } from '@/types';

interface CalculationCardProps {
  calculation: TimesheetCalculation;
  rateCard: RateCard;
}

export function CalculationCard({ calculation, rateCard }: CalculationCardProps) {
  const hasData = calculation.totalHours > 0;
  const rateConfigured = rateCard.dailyRate > 0;

  if (!hasData) {
    return (
      <div className="bg-gold-50 rounded-card p-4 text-center">
        <p className="text-sm text-text-muted">
          Enter call times to see calculations
        </p>
      </div>
    );
  }

  return (
    <div className="gold-gradient rounded-card p-4 text-white">
      {/* Total hours - large display */}
      <div className="text-center mb-4">
        <div className="text-white/80 text-xs uppercase tracking-wide">Total Hours</div>
        <div className="text-4xl font-bold">{calculation.totalHours.toFixed(1)}</div>
        <div className="text-white/70 text-xs mt-1 flex flex-wrap justify-center gap-x-2">
          {calculation.preCallHours > 0 && <span>Pre: {calculation.preCallHours.toFixed(1)}</span>}
          <span>Base: {calculation.baseHours.toFixed(1)}</span>
          {calculation.otHours > 0 && <span>OT: {calculation.otHours.toFixed(1)}</span>}
          {calculation.lateNightHours > 0 && <span>Late: {calculation.lateNightHours.toFixed(1)}</span>}
        </div>
      </div>

      {/* Earnings breakdown */}
      {rateConfigured && (
        <>
          <div className="border-t border-white/20 pt-4 space-y-2">
            {calculation.preCallEarnings > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/80">Pre-Call ({rateCard.preCallMultiplier}x)</span>
                <span>£{calculation.preCallEarnings.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-white/80">Base Earnings</span>
              <span>£{calculation.dailyEarnings.toFixed(2)}</span>
            </div>

            {calculation.otHours > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/80">OT ({rateCard.otMultiplier}x)</span>
                <span>£{calculation.otEarnings.toFixed(2)}</span>
              </div>
            )}

            {calculation.lateNightEarnings > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/80">Late Night ({rateCard.lateNightMultiplier}x)</span>
                <span>£{calculation.lateNightEarnings.toFixed(2)}</span>
              </div>
            )}

            {calculation.sixthDayBonus > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/80">6th Day Bonus</span>
                <span>£{calculation.sixthDayBonus.toFixed(2)}</span>
              </div>
            )}

            {calculation.kitRental > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/80">Kit Rental</span>
                <span>£{calculation.kitRental.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Total earnings */}
          <div className="border-t border-white/20 pt-3 mt-3 flex justify-between items-center">
            <span className="text-white/90 font-medium">Daily Earnings</span>
            <span className="text-2xl font-bold">£{calculation.totalEarnings.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}
