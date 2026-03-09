import {
  CURRENCY_SYMBOLS,
  BASE_CONTRACTS,
  DAY_TYPES,
  type CrewMember,
  type RateCard,
  type BaseContract,
  type BECTUDayType,
  type Department,
  type CrewType,
} from '@/stores/timesheetStore';

interface RateCardPanelProps {
  crew: CrewMember;
  onUpdateCrew: (updates: Partial<CrewMember>) => void;
  onUpdateRateCard: (updates: Partial<RateCard>) => void;
}

export function RateCardPanel({ crew, onUpdateCrew, onUpdateRateCard }: RateCardPanelProps) {
  const rc = crew.rateCard;
  const sym = CURRENCY_SYMBOLS['GBP'];

  return (
    <div className="ts-card ts-rate-card-panel">
      <div className="ts-card-header">
        <h3 className="ts-card-title">{crew.name}</h3>
        <span className={`ts-type-badge ts-type-${crew.crewType}`}>{crew.crewType.toUpperCase()}</span>
      </div>
      <div className="ts-card-body">
        {/* Personal Details */}
        <div className="ts-section-label">PERSONAL DETAILS</div>
        <div className="ts-form-grid ts-form-grid-3">
          <div className="ts-form-field">
            <label className="ts-label">Name</label>
            <input className="ts-input" value={crew.name} onChange={e => onUpdateCrew({ name: e.target.value })} />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Position</label>
            <input className="ts-input" value={crew.position} onChange={e => onUpdateCrew({ position: e.target.value })} />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Department</label>
            <select className="ts-select" value={crew.department} onChange={e => onUpdateCrew({ department: e.target.value as Department })}>
              <option value="hair">Hair</option>
              <option value="makeup">Makeup</option>
              <option value="sfx">SFX</option>
              <option value="prosthetics">Prosthetics</option>
            </select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Employment Type</label>
            <select className="ts-select" value={crew.crewType} onChange={e => onUpdateCrew({ crewType: e.target.value as CrewType })}>
              <option value="paye">PAYE</option>
              <option value="ltd">LTD</option>
            </select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Email</label>
            <input className="ts-input" type="email" value={crew.email} onChange={e => onUpdateCrew({ email: e.target.value })} />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Phone</label>
            <input className="ts-input" type="tel" value={crew.phone} onChange={e => onUpdateCrew({ phone: e.target.value })} />
          </div>
        </div>

        {/* Rate Card */}
        <div className="ts-section-label" style={{ marginTop: 24 }}>RATE CARD</div>
        <div className="ts-form-grid ts-form-grid-3">
          <div className="ts-form-field">
            <label className="ts-label">Daily Rate ({sym})</label>
            <input
              className="ts-input"
              type="number"
              min={0}
              step={10}
              value={rc.dailyRate}
              onChange={e => onUpdateRateCard({ dailyRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Base Contract</label>
            <select
              className="ts-select"
              value={rc.baseContract}
              onChange={e => {
                const bc = e.target.value as BaseContract;
                onUpdateRateCard({
                  baseContract: bc,
                  baseDayHours: bc === '10+1' ? 10 : 11,
                });
              }}
            >
              {(Object.keys(BASE_CONTRACTS) as BaseContract[]).map(c => (
                <option key={c} value={c}>{BASE_CONTRACTS[c].label}</option>
              ))}
            </select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Day Type</label>
            <select
              className="ts-select"
              value={rc.dayType}
              onChange={e => {
                const dt = e.target.value as BECTUDayType;
                onUpdateRateCard({ dayType: dt, lunchDuration: DAY_TYPES[dt].lunchMins });
              }}
            >
              {(Object.keys(DAY_TYPES) as BECTUDayType[]).map(dt => (
                <option key={dt} value={dt}>{dt} — {DAY_TYPES[dt].name}</option>
              ))}
            </select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Kit Rental ({sym})</label>
            <input
              className="ts-input"
              type="number"
              min={0}
              step={5}
              value={rc.kitRental}
              onChange={e => onUpdateRateCard({ kitRental: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">OT Multiplier</label>
            <input
              className="ts-input"
              type="number"
              min={1}
              step={0.1}
              value={rc.otMultiplier}
              onChange={e => onUpdateRateCard({ otMultiplier: parseFloat(e.target.value) || 1.5 })}
            />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Late Night Multiplier</label>
            <input
              className="ts-input"
              type="number"
              min={1}
              step={0.1}
              value={rc.lateNightMultiplier}
              onChange={e => onUpdateRateCard({ lateNightMultiplier: parseFloat(e.target.value) || 2 })}
            />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Pre-Call Multiplier</label>
            <input
              className="ts-input"
              type="number"
              min={1}
              step={0.1}
              value={rc.preCallMultiplier}
              onChange={e => onUpdateRateCard({ preCallMultiplier: parseFloat(e.target.value) || 1.5 })}
            />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">6th Day Multiplier</label>
            <input
              className="ts-input"
              type="number"
              min={1}
              step={0.1}
              value={rc.sixthDayMultiplier}
              onChange={e => onUpdateRateCard({ sixthDayMultiplier: parseFloat(e.target.value) || 1.5 })}
            />
          </div>
          <div className="ts-form-field">
            <label className="ts-label">7th Day Multiplier</label>
            <input
              className="ts-input"
              type="number"
              min={1}
              step={0.1}
              value={rc.seventhDayMultiplier}
              onChange={e => onUpdateRateCard({ seventhDayMultiplier: parseFloat(e.target.value) || 2 })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
