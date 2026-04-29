import { useEffect, useState } from 'react';
import {
  useUserProfileStore,
  createEmptyProfile,
  isProfileComplete,
  REQUIRED_PROFILE_FIELDS,
  type UserProfile,
} from '@/stores/userProfileStore';
import { useAuthStore } from '@/stores/authStore';

interface UserProfileModalProps {
  /** When true, the user can't dismiss without completing all required
   *  fields. Used by the timesheet gate. */
  required?: boolean;
  /** When true, we're inviting the user post-signup; dismiss is allowed
   *  but we keep a "skip for now" affordance. */
  isSignupNudge?: boolean;
  onClose: () => void;
}

/**
 * Profile modal that captures the user's identity, tax/employment
 * status, and invoicing details. The data follows the user across
 * every project — only the rate card on each project's crew row
 * differs.
 */
export function UserProfileModal({ required, isSignupNudge, onClose }: UserProfileModalProps) {
  const user = useAuthStore((s) => s.user);
  const ensureProfile = useUserProfileStore((s) => s.ensureProfile);
  const updateProfile = useUserProfileStore((s) => s.updateProfile);
  const dismissSignupNudge = useUserProfileStore((s) => s.dismissSignupNudge);

  const [draft, setDraft] = useState<UserProfile>(() => {
    if (!user) return createEmptyProfile('');
    return ensureProfile(user.id, user.name, user.email);
  });

  // If the auth user changes mid-modal (rare) sync the draft.
  useEffect(() => {
    if (!user) return;
    const fresh = ensureProfile(user.id, user.name, user.email);
    setDraft(fresh);
  }, [user, ensureProfile]);

  if (!user) return null;

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Tiny helper for the rate-card sub-form so each numeric input
  // doesn't need to know about the parent draft shape.
  const setRate = <K extends keyof UserProfile['rateCard']>(
    key: K,
    value: UserProfile['rateCard'][K],
  ) => setDraft((d) => ({ ...d, rateCard: { ...d.rateCard, [key]: value } }));

  const missing = REQUIRED_PROFILE_FIELDS.filter((f) => {
    const v = draft[f];
    return v == null || (typeof v === 'string' && v.trim() === '');
  });
  const ltdMissing = draft.crewType === 'ltd' && !draft.companyName.trim();
  const canSave = missing.length === 0 && !ltdMissing;

  const handleSave = () => {
    updateProfile(user.id, draft);
    onClose();
  };

  const handleSkip = () => {
    if (isSignupNudge) dismissSignupNudge(user.id);
    onClose();
  };

  const subtitle = isSignupNudge
    ? "Add your invoicing details now so they're ready when you log hours. You can skip and come back later — we'll prompt you when you open the timesheet."
    : required
    ? 'Fill in your invoicing details before you can log hours. These details follow you across every project — only the rate card changes.'
    : 'Update the details that follow you across every project.';

  return (
    <div className="tm-modal-overlay" onClick={required ? undefined : onClose}>
      <div
        className="tm-modal"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tm-modal-header">
          <h3 className="tm-modal-title">Your details</h3>
          {!required && (
            <button
              type="button"
              className="tm-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="tm-modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <p className="tm-modal-message" style={{ marginBottom: 8 }}>{subtitle}</p>

          {/* Identity */}
          <Section title="Identity">
            <Row>
              <Field label="Full name" required>
                <input
                  className="tm-form-input"
                  value={draft.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  placeholder="Jane Smith"
                />
              </Field>
              <Field label="Email" required>
                <input
                  className="tm-form-input"
                  type="email"
                  value={draft.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="jane@example.com"
                />
              </Field>
            </Row>
            <Row>
              <Field label="Phone" required>
                <input
                  className="tm-form-input"
                  value={draft.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="07000 000 000"
                />
              </Field>
              <Field label="Tax status" required>
                <select
                  className="tm-form-input"
                  value={draft.crewType}
                  onChange={(e) => set('crewType', e.target.value as 'paye' | 'ltd')}
                >
                  <option value="paye">PAYE (employed)</option>
                  <option value="ltd">LTD (self-employed)</option>
                </select>
              </Field>
            </Row>
            {draft.crewType === 'paye' && (
              <Field label="National Insurance number">
                <input
                  className="tm-form-input"
                  value={draft.niNumber}
                  onChange={(e) => set('niNumber', e.target.value)}
                  placeholder="QQ 12 34 56 C"
                />
              </Field>
            )}
            {draft.crewType === 'ltd' && (
              <>
                <Row>
                  <Field label="Company name" required>
                    <input
                      className="tm-form-input"
                      value={draft.companyName}
                      onChange={(e) => set('companyName', e.target.value)}
                      placeholder="Smith Hair & Makeup Ltd"
                    />
                  </Field>
                  <Field label="Company number">
                    <input
                      className="tm-form-input"
                      value={draft.companyNumber}
                      onChange={(e) => set('companyNumber', e.target.value)}
                      placeholder="12345678"
                    />
                  </Field>
                </Row>
                <Row>
                  <Field label="VAT registered">
                    <select
                      className="tm-form-input"
                      value={draft.vatRegistered ? 'yes' : 'no'}
                      onChange={(e) => set('vatRegistered', e.target.value === 'yes')}
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </Field>
                  {draft.vatRegistered && (
                    <Field label="VAT number">
                      <input
                        className="tm-form-input"
                        value={draft.vatNumber}
                        onChange={(e) => set('vatNumber', e.target.value)}
                        placeholder="GB 123 4567 89"
                      />
                    </Field>
                  )}
                </Row>
              </>
            )}
          </Section>

          {/* Bank */}
          <Section title="Bank details">
            <Field label="Bank name" required>
              <input
                className="tm-form-input"
                value={draft.bankName}
                onChange={(e) => set('bankName', e.target.value)}
                placeholder="Barclays"
              />
            </Field>
            <Field label="Account holder name" required>
              <input
                className="tm-form-input"
                value={draft.accountName}
                onChange={(e) => set('accountName', e.target.value)}
                placeholder="J Smith"
              />
            </Field>
            <Row>
              <Field label="Sort code" required>
                <input
                  className="tm-form-input"
                  value={draft.sortCode}
                  onChange={(e) => set('sortCode', e.target.value)}
                  placeholder="12-34-56"
                />
              </Field>
              <Field label="Account number" required>
                <input
                  className="tm-form-input"
                  value={draft.accountNumber}
                  onChange={(e) => set('accountNumber', e.target.value)}
                  placeholder="12345678"
                />
              </Field>
            </Row>
          </Section>

          {/* Address */}
          <Section title="Invoice address">
            <Field label="Address line 1">
              <input
                className="tm-form-input"
                value={draft.addressLine1}
                onChange={(e) => set('addressLine1', e.target.value)}
              />
            </Field>
            <Field label="Address line 2">
              <input
                className="tm-form-input"
                value={draft.addressLine2}
                onChange={(e) => set('addressLine2', e.target.value)}
              />
            </Field>
            <Row>
              <Field label="City">
                <input
                  className="tm-form-input"
                  value={draft.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </Field>
              <Field label="Postcode">
                <input
                  className="tm-form-input"
                  value={draft.postcode}
                  onChange={(e) => set('postcode', e.target.value)}
                />
              </Field>
            </Row>
            <Field label="Country">
              <input
                className="tm-form-input"
                value={draft.country}
                onChange={(e) => set('country', e.target.value)}
                placeholder="United Kingdom"
              />
            </Field>
          </Section>

          {/* Default rate card — seeds the "Me" crew row in every new
              project. Editing it here doesn't change rate cards on
              existing projects (those rates are negotiated per
              production); only brand-new projects pick up the new
              defaults. */}
          <Section title="Default rate card">
            <p className="tm-modal-message" style={{ margin: 0 }}>
              Used as the starting rate when you join a new project. Per-project rate cards on the timesheet override these defaults.
            </p>
            <Row>
              <Field label="Daily rate">
                <input
                  className="tm-form-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={10}
                  value={draft.rateCard.dailyRate}
                  onChange={(e) =>
                    setRate('dailyRate', Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field label="Base contract">
                <select
                  className="tm-form-input"
                  value={draft.rateCard.baseContract}
                  onChange={(e) => {
                    const bc = e.target.value as UserProfile['rateCard']['baseContract'];
                    setRate('baseContract', bc);
                    // Keep baseDayHours in sync with the contract.
                    setRate(
                      'baseDayHours',
                      bc === '10+1' ? 10 : bc === '11+1' ? 11 : 12,
                    );
                  }}
                >
                  <option value="10+1">10+1 (10-hour shoot)</option>
                  <option value="11+1">11+1 (11-hour shoot)</option>
                  <option value="12+1">12+1 (12-hour shoot)</option>
                </select>
              </Field>
            </Row>
            <Row>
              <Field label="OT multiplier">
                <input
                  className="tm-form-input"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.1}
                  value={draft.rateCard.otMultiplier}
                  onChange={(e) =>
                    setRate('otMultiplier', Number(e.target.value) || 1)
                  }
                />
              </Field>
              <Field label="Pre-call multiplier">
                <input
                  className="tm-form-input"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.1}
                  value={draft.rateCard.preCallMultiplier}
                  onChange={(e) =>
                    setRate('preCallMultiplier', Number(e.target.value) || 1)
                  }
                />
              </Field>
            </Row>
            <Row>
              <Field label="Late-night multiplier">
                <input
                  className="tm-form-input"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.1}
                  value={draft.rateCard.lateNightMultiplier}
                  onChange={(e) =>
                    setRate('lateNightMultiplier', Number(e.target.value) || 1)
                  }
                />
              </Field>
              <Field label="6th-day multiplier">
                <input
                  className="tm-form-input"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.1}
                  value={draft.rateCard.sixthDayMultiplier}
                  onChange={(e) =>
                    setRate('sixthDayMultiplier', Number(e.target.value) || 1)
                  }
                />
              </Field>
            </Row>
            <Row>
              <Field label="7th-day multiplier">
                <input
                  className="tm-form-input"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={0.1}
                  value={draft.rateCard.seventhDayMultiplier}
                  onChange={(e) =>
                    setRate('seventhDayMultiplier', Number(e.target.value) || 1)
                  }
                />
              </Field>
              <Field label="Kit rental / day">
                <input
                  className="tm-form-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={5}
                  value={draft.rateCard.kitRental}
                  onChange={(e) =>
                    setRate('kitRental', Number(e.target.value) || 0)
                  }
                />
              </Field>
            </Row>
          </Section>
        </div>

        <div className="tm-modal-footer">
          {isSignupNudge && (
            <button type="button" className="tm-modal-cancel" onClick={handleSkip}>
              Skip — fill in later
            </button>
          )}
          {!required && !isSignupNudge && (
            <button type="button" className="tm-modal-cancel" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="tm-modal-confirm"
            onClick={handleSave}
            disabled={required && !canSave}
            title={
              required && !canSave
                ? 'Fill all required fields before continuing'
                : undefined
            }
          >
            {required ? 'Save & continue' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h4
        style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          margin: '8px 0 0',
        }}
      >
        {title}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="tm-form-group">
      <span className="tm-form-label">
        {label}
        {required && (
          <span style={{ color: 'var(--accent)', marginLeft: 4 }}>*</span>
        )}
      </span>
      {children}
    </label>
  );
}

/* ━━━ Public helper ━━━ */

/** Returns true when the auth user has a complete profile on file. */
export function useIsProfileComplete(): boolean {
  const user = useAuthStore((s) => s.user);
  const profile = useUserProfileStore((s) => (user ? s.profiles[user.id] : undefined));
  return isProfileComplete(profile);
}
