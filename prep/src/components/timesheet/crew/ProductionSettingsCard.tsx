import {
  CURRENCY_SYMBOLS,
  type ProductionSettings,
  type CurrencyCode,
  type BaseContract,
  type BECTUDayType,
  BASE_CONTRACTS,
  DAY_TYPES,
} from '@/stores/timesheetStore';

interface ProductionSettingsCardProps {
  production: ProductionSettings;
  onUpdate: (updates: Partial<ProductionSettings>) => void;
}

export function ProductionSettingsCard({ production, onUpdate }: ProductionSettingsCardProps) {
  return (
    <div className="ts-card">
      <div className="ts-card-header">
        <h3 className="ts-card-title"><span className="heading-italic">Production</span> Settings</h3>
      </div>
      <div className="ts-card-body">
        <div className="ts-form-grid">
          <div className="ts-form-field">
            <label className="ts-label">Currency</label>
            <select
              className="ts-select"
              value={production.currency}
              onChange={e => onUpdate({ currency: e.target.value as CurrencyCode })}
            >
              {(Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[]).map(c => (
                <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>
              ))}
            </select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Default Contract</label>
            <select
              className="ts-select"
              value={production.defaultBaseContract}
              onChange={e => onUpdate({ defaultBaseContract: e.target.value as BaseContract })}
            >
              {(Object.keys(BASE_CONTRACTS) as BaseContract[]).map(c => (
                <option key={c} value={c}>{BASE_CONTRACTS[c].label}</option>
              ))}
            </select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">Default Day Type</label>
            <select
              className="ts-select"
              value={production.defaultDayType}
              onChange={e => onUpdate({ defaultDayType: e.target.value as BECTUDayType })}
            >
              {(Object.keys(DAY_TYPES) as BECTUDayType[]).map(dt => (
                <option key={dt} value={dt}>{dt} — {DAY_TYPES[dt].name}</option>
              ))}
            </select>
          </div>
          <div className="ts-form-field">
            <label className="ts-label">
              <span>LTD Company Mode</span>
              <label className="ts-toggle">
                <input
                  type="checkbox"
                  checked={production.isLTD}
                  onChange={e => onUpdate({ isLTD: e.target.checked })}
                />
                <span className="ts-toggle-slider" />
              </label>
            </label>
            <span className="ts-help-text">
              {production.isLTD
                ? 'LTD crew wages excluded from budget impact'
                : 'All wages count towards budget'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
