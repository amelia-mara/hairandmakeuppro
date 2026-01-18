import { useTimesheetStore } from '@/stores/timesheetStore';
import type { BaseDayHours } from '@/types';
import { BASE_DAY_OPTIONS } from '@/types';

export function RateCardSettings() {
  const { rateCard, updateRateCard } = useTimesheetStore();

  return (
    <div className="space-y-4">
      {/* Daily Rate */}
      <div>
        <label className="field-label block mb-2">DAILY RATE</label>
        <div className="flex items-center gap-2">
          <span className="text-text-muted">£</span>
          <input
            type="number"
            value={rateCard.dailyRate || ''}
            onChange={(e) =>
              updateRateCard({ dailyRate: e.target.value ? parseFloat(e.target.value) : 0 })
            }
            placeholder="0.00"
            min="0"
            step="0.01"
            className="input-field flex-1"
          />
        </div>
        <p className="text-xs text-text-muted mt-1">Your agreed daily rate before overtime</p>
      </div>

      {/* Base Day Hours */}
      <div>
        <label className="field-label block mb-2">BASE DAY</label>
        <select
          value={rateCard.baseDayHours}
          onChange={(e) =>
            updateRateCard({ baseDayHours: parseInt(e.target.value, 10) as BaseDayHours })
          }
          className="input-field w-full"
        >
          {BASE_DAY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-text-muted mt-1">
          Standard working hours before overtime kicks in
        </p>
      </div>

      {/* OT Rate - Read only */}
      <div>
        <label className="field-label block mb-2">OVERTIME RATE</label>
        <div className="input-field bg-gray-100 text-text-muted">
          x{rateCard.otMultiplier} (fixed)
        </div>
        <p className="text-xs text-text-muted mt-1">
          Overtime is paid at 1.5x your hourly rate
        </p>
      </div>

      {/* 6th Day Rate - Read only */}
      <div>
        <label className="field-label block mb-2">6TH DAY RATE</label>
        <div className="input-field bg-gray-100 text-text-muted">
          x{rateCard.sixthDayMultiplier} (applied to whole day)
        </div>
        <p className="text-xs text-text-muted mt-1">
          When working a 6th day, entire day is paid at 1.5x
        </p>
      </div>

      {/* Kit Rental */}
      <div>
        <label className="field-label block mb-2">KIT / BOX RENTAL</label>
        <div className="flex items-center gap-2">
          <span className="text-text-muted">£</span>
          <input
            type="number"
            value={rateCard.kitRental || ''}
            onChange={(e) =>
              updateRateCard({ kitRental: e.target.value ? parseFloat(e.target.value) : 0 })
            }
            placeholder="0.00"
            min="0"
            step="0.01"
            className="input-field flex-1"
          />
          <span className="text-text-muted text-sm">/day</span>
        </div>
        <p className="text-xs text-text-muted mt-1">
          Daily kit rental added to each working day
        </p>
      </div>

      {/* Summary preview */}
      {rateCard.dailyRate > 0 && (
        <div className="bg-gold-50 rounded-card p-4 mt-6">
          <h4 className="field-label mb-3">RATE SUMMARY</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Hourly Rate</span>
              <span className="text-text-primary font-medium">
                £{(rateCard.dailyRate / rateCard.baseDayHours).toFixed(2)}/hr
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">OT Hourly Rate</span>
              <span className="text-text-primary font-medium">
                £{((rateCard.dailyRate / rateCard.baseDayHours) * rateCard.otMultiplier).toFixed(2)}/hr
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Max Day (no OT)</span>
              <span className="text-text-primary font-medium">
                £{(rateCard.dailyRate + rateCard.kitRental).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
