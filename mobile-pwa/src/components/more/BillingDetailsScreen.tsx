import { useState, useEffect } from 'react';
import { useBillingStore, formatSortCode, formatAccountNumber } from '@/stores/billingStore';
import { useAuthStore } from '@/stores/authStore';
import type { UserTier } from '@/types';

interface BillingDetailsScreenProps {
  onBack: () => void;
  onUpgrade?: () => void;
}

// Tiers that can access full billing features
const BILLING_TIERS: UserTier[] = ['supervisor', 'designer'];

export function BillingDetailsScreen({ onBack, onUpgrade }: BillingDetailsScreenProps) {
  const { user } = useAuthStore();
  const {
    billingDetails,
    updatePersonalInfo,
    updateBankDetails,
    updatePaymentTerms,
    updateVATSettings,
    toggleVATRegistered,
    isBillingComplete,
    getValidationErrors,
  } = useBillingStore();

  const [showValidation, setShowValidation] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Check if user has access to billing features
  const hasAccess = user && BILLING_TIERS.includes(user.tier);

  // Auto-save feedback
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleSave = () => {
    setShowValidation(true);
    const errors = getValidationErrors();
    if (errors.length === 0) {
      setSaveMessage('Details saved successfully');
    }
  };

  const validationErrors = showValidation ? getValidationErrors() : [];
  const isComplete = isBillingComplete();

  // Restricted view for lower tiers
  if (!hasAccess) {
    return (
      <>
        <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
          <div className="mobile-container">
            <div className="h-14 px-4 flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-text-primary">Billing Details</h1>
            </div>
          </div>
        </div>

        <div className="mobile-container px-4 py-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Invoice Generation
            </h2>
            <p className="text-text-muted mb-6 max-w-xs mx-auto">
              Upgrade to Supervisor or Designer to generate professional invoices with your billing details.
            </p>
            <button
              onClick={onUpgrade}
              className="px-6 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform"
            >
              Upgrade to Supervisor
            </button>
            <p className="text-xs text-text-muted mt-3">
              Starting at £9.99/month
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-text-primary">Billing Details</h1>
            </div>
            {isComplete && (
              <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Complete
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mobile-container px-4 py-4 pb-safe-bottom">
        {/* Save message */}
        {saveMessage && (
          <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {saveMessage}
          </div>
        )}

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-700 mb-2">Please fix the following:</p>
            <ul className="text-xs text-red-600 space-y-1">
              {validationErrors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Personal/Business Information */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            PERSONAL / BUSINESS INFORMATION
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="field-label block mb-1">FULL NAME *</label>
              <input
                type="text"
                value={billingDetails.fullName}
                onChange={(e) => updatePersonalInfo({ fullName: e.target.value })}
                placeholder="John Smith"
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="field-label block mb-1">BUSINESS NAME</label>
              <input
                type="text"
                value={billingDetails.businessName}
                onChange={(e) => updatePersonalInfo({ businessName: e.target.value })}
                placeholder="Optional - if trading under a business name"
                className="input-field w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                For freelancers trading under a company or trading name
              </p>
            </div>

            <div>
              <label className="field-label block mb-1">ADDRESS *</label>
              <textarea
                value={billingDetails.address}
                onChange={(e) => updatePersonalInfo({ address: e.target.value })}
                placeholder="123 High Street&#10;London&#10;SW1A 1AA"
                rows={3}
                className="input-field w-full resize-none"
              />
            </div>

            <div>
              <label className="field-label block mb-1">PHONE</label>
              <input
                type="tel"
                value={billingDetails.phone}
                onChange={(e) => updatePersonalInfo({ phone: e.target.value })}
                placeholder="+44 7700 900000"
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="field-label block mb-1">EMAIL *</label>
              <input
                type="email"
                value={billingDetails.email}
                onChange={(e) => updatePersonalInfo({ email: e.target.value })}
                placeholder="john@example.com"
                className="input-field w-full"
              />
            </div>
          </div>
        </section>

        {/* Bank Details */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            BANK DETAILS FOR PAYMENT
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="field-label block mb-1">ACCOUNT NAME *</label>
              <input
                type="text"
                value={billingDetails.bankDetails.accountName}
                onChange={(e) => updateBankDetails({ accountName: e.target.value })}
                placeholder="John Smith"
                className="input-field w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                Name as it appears on your bank account
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label block mb-1">SORT CODE *</label>
                <input
                  type="text"
                  value={billingDetails.bankDetails.sortCode}
                  onChange={(e) => {
                    const formatted = formatSortCode(e.target.value);
                    updateBankDetails({ sortCode: formatted });
                  }}
                  placeholder="12-34-56"
                  maxLength={8}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="field-label block mb-1">ACCOUNT NUMBER *</label>
                <input
                  type="text"
                  value={billingDetails.bankDetails.accountNumber}
                  onChange={(e) => {
                    const formatted = formatAccountNumber(e.target.value);
                    updateBankDetails({ accountNumber: formatted });
                  }}
                  placeholder="12345678"
                  maxLength={8}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Payment Terms */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            PAYMENT TERMS
          </h2>
          <div className="card">
            <label className="field-label block mb-1">TERMS</label>
            <select
              value={billingDetails.paymentTerms}
              onChange={(e) => updatePaymentTerms(e.target.value)}
              className="input-field w-full"
            >
              <option value="Payment upon receipt">Payment upon receipt</option>
              <option value="Payment within 7 days">Payment within 7 days</option>
              <option value="Payment within 14 days">Payment within 14 days</option>
              <option value="Payment within 30 days">Payment within 30 days</option>
              <option value="Payment within 60 days">Payment within 60 days</option>
            </select>
            <p className="text-xs text-text-muted mt-2">
              This will appear on generated invoices
            </p>
          </div>
        </section>

        {/* VAT Settings */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            VAT / TAX SETTINGS
          </h2>
          <div className="card space-y-4">
            {/* VAT Registered Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-text-primary block">VAT Registered</span>
                <span className="text-xs text-text-muted">Are you registered for VAT?</span>
              </div>
              <button
                onClick={toggleVATRegistered}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  billingDetails.vatSettings.isVATRegistered ? 'bg-gold' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    billingDetails.vatSettings.isVATRegistered ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* VAT Fields (shown only when VAT registered) */}
            {billingDetails.vatSettings.isVATRegistered && (
              <>
                <div>
                  <label className="field-label block mb-1">VAT NUMBER *</label>
                  <input
                    type="text"
                    value={billingDetails.vatSettings.vatNumber}
                    onChange={(e) => updateVATSettings({ vatNumber: e.target.value.toUpperCase() })}
                    placeholder="GB123456789"
                    className="input-field w-full"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    UK format: GB followed by 9 digits
                  </p>
                </div>

                <div>
                  <label className="field-label block mb-1">VAT RATE (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={billingDetails.vatSettings.vatRate}
                      onChange={(e) => updateVATSettings({ vatRate: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max="100"
                      step="0.1"
                      className="input-field w-24"
                    />
                    <span className="text-sm text-text-muted">%</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Standard UK rate is 20%
                  </p>
                </div>

                {/* VAT Invoice Preview */}
                <div className="bg-gray-50 rounded-lg p-3 border border-border">
                  <p className="text-xs font-medium text-text-muted mb-2">INVOICE PREVIEW</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Subtotal (ex VAT)</span>
                      <span className="text-text-primary">£1,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">VAT ({billingDetails.vatSettings.vatRate}%)</span>
                      <span className="text-text-primary">
                        £{(1000 * billingDetails.vatSettings.vatRate / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t border-border">
                      <span className="text-text-primary">Total (inc VAT)</span>
                      <span className="text-gold">
                        £{(1000 * (1 + billingDetails.vatSettings.vatRate / 100)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {!billingDetails.vatSettings.isVATRegistered && (
              <p className="text-xs text-text-muted">
                If you're not VAT registered, your invoices will not include VAT calculations.
                You can register for VAT at any time if your taxable turnover exceeds the threshold.
              </p>
            )}
          </div>
        </section>

        {/* Save Button */}
        <div className="sticky bottom-0 bg-background pt-4 pb-safe-bottom">
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-button gold-gradient text-white font-medium active:scale-98 transition-transform"
          >
            Save Details
          </button>
          <p className="text-xs text-text-muted text-center mt-2">
            Details are saved automatically and will appear on your invoices
          </p>
        </div>
      </div>
    </>
  );
}
