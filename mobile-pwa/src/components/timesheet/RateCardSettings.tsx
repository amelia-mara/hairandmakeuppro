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
          Standard working hours before overtime kicks in (e.g., 10+1, 11+1)
        </p>
      </div>

      {/* Rate Multipliers - now editable */}
      <div className="bg-gray-50 rounded-card p-4 space-y-4">
        <h4 className="field-label">RATE MULTIPLIERS</h4>

        <div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Pre-Call</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-text-muted">x</span>
              <input
                type="number"
                value={rateCard.preCallMultiplier}
                onChange={(e) =>
                  updateRateCard({ preCallMultiplier: parseFloat(e.target.value) || 1.5 })
                }
                min="1"
                max="5"
                step="0.1"
                className="input-field w-16 text-center text-gold font-medium"
              />
            </div>
          </div>
          <p className="text-[11px] text-text-light mt-1">Hours before unit call</p>
        </div>

        <div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Overtime (after base hours)</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-text-muted">x</span>
              <input
                type="number"
                value={rateCard.otMultiplier}
                onChange={(e) =>
                  updateRateCard({ otMultiplier: parseFloat(e.target.value) || 1.5 })
                }
                min="1"
                max="5"
                step="0.1"
                className="input-field w-16 text-center text-gold font-medium"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Late Night (after 23:00)</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-text-muted">x</span>
              <input
                type="number"
                value={rateCard.lateNightMultiplier}
                onChange={(e) =>
                  updateRateCard({ lateNightMultiplier: parseFloat(e.target.value) || 2.0 })
                }
                min="1"
                max="5"
                step="0.1"
                className="input-field w-16 text-center text-gold font-medium"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">6th Day</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-text-muted">x</span>
              <input
                type="number"
                value={rateCard.sixthDayMultiplier}
                onChange={(e) =>
                  updateRateCard({ sixthDayMultiplier: parseFloat(e.target.value) || 1.5 })
                }
                min="1"
                max="5"
                step="0.1"
                className="input-field w-16 text-center text-gold font-medium"
              />
            </div>
          </div>
          <p className="text-[11px] text-text-light mt-1">Applied to entire day's earnings</p>
        </div>
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
              <span className="text-text-muted">Pre-Call Rate</span>
              <span className="text-text-primary font-medium">
                £{((rateCard.dailyRate / rateCard.baseDayHours) * rateCard.preCallMultiplier).toFixed(2)}/hr
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">OT Rate</span>
              <span className="text-text-primary font-medium">
                £{((rateCard.dailyRate / rateCard.baseDayHours) * rateCard.otMultiplier).toFixed(2)}/hr
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Late Night Rate</span>
              <span className="text-text-primary font-medium">
                £{((rateCard.dailyRate / rateCard.baseDayHours) * rateCard.lateNightMultiplier).toFixed(2)}/hr
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
