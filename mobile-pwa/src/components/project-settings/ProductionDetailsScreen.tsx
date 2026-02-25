import { useState, useEffect } from 'react';
import { useProductionDetailsStore } from '@/stores/productionDetailsStore';

interface ProductionDetailsScreenProps {
  projectId: string;
  onBack: () => void;
}

export function ProductionDetailsScreen({ projectId, onBack }: ProductionDetailsScreenProps) {
  const { getDetails, updateDetails, isComplete, getCompletionCount } = useProductionDetailsStore();
  const details = getDetails(projectId);
  const complete = isComplete(projectId);
  const { filled, total } = getCompletionCount(projectId);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const update = (updates: Parameters<typeof updateDetails>[1]) => {
    updateDetails(projectId, updates);
  };

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
              <h1 className="text-lg font-semibold text-text-primary">Production Details</h1>
            </div>
            {complete ? (
              <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Complete
              </div>
            ) : (
              <span className="text-xs text-text-muted">{filled}/{total} required</span>
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

        <p className="text-xs text-text-muted mb-4">
          Enter the production company details and invoicing information for this project. These details are specific to this job.
        </p>

        {/* Production Company */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            PRODUCTION COMPANY
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="field-label block mb-1">COMPANY NAME *</label>
              <input
                type="text"
                value={details.productionCompany}
                onChange={(e) => update({ productionCompany: e.target.value })}
                placeholder="e.g. NBC Universal, BBC Studios"
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="field-label block mb-1">ADDRESS *</label>
              <textarea
                value={details.productionAddress}
                onChange={(e) => update({ productionAddress: e.target.value })}
                placeholder="Production office address"
                rows={3}
                className="input-field w-full resize-none"
              />
            </div>

            <div>
              <label className="field-label block mb-1">PHONE</label>
              <input
                type="tel"
                value={details.productionPhone}
                onChange={(e) => update({ productionPhone: e.target.value })}
                placeholder="Production office number"
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="field-label block mb-1">EMAIL *</label>
              <input
                type="email"
                value={details.productionEmail}
                onChange={(e) => update({ productionEmail: e.target.value })}
                placeholder="production@example.com"
                className="input-field w-full"
              />
            </div>
          </div>
        </section>

        {/* Accounts Payable */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            ACCOUNTS PAYABLE
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="field-label block mb-1">CONTACT NAME *</label>
              <input
                type="text"
                value={details.accountsPayableContact}
                onChange={(e) => update({ accountsPayableContact: e.target.value })}
                placeholder="Accounts payable contact"
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="field-label block mb-1">EMAIL *</label>
              <input
                type="email"
                value={details.accountsPayableEmail}
                onChange={(e) => update({ accountsPayableEmail: e.target.value })}
                placeholder="accounts@production.com"
                className="input-field w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                Where invoices should be sent
              </p>
            </div>

            <div>
              <label className="field-label block mb-1">PHONE</label>
              <input
                type="tel"
                value={details.accountsPayablePhone}
                onChange={(e) => update({ accountsPayablePhone: e.target.value })}
                placeholder="Accounts department number"
                className="input-field w-full"
              />
            </div>
          </div>
        </section>

        {/* Job / Contract References */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            JOB & CONTRACT REFERENCES
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="field-label block mb-1">PO NUMBER</label>
              <input
                type="text"
                value={details.poNumber}
                onChange={(e) => update({ poNumber: e.target.value })}
                placeholder="Purchase order number"
                className="input-field w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                Required on most invoices — check your deal memo
              </p>
            </div>

            <div>
              <label className="field-label block mb-1">COST CODE</label>
              <input
                type="text"
                value={details.costCode}
                onChange={(e) => update({ costCode: e.target.value })}
                placeholder="Department or cost code"
                className="input-field w-full"
              />
              <p className="text-xs text-text-muted mt-1">
                Production cost code for your department (e.g. 4001, HMU-01)
              </p>
            </div>

            <div>
              <label className="field-label block mb-1">JOB REFERENCE</label>
              <input
                type="text"
                value={details.jobReference}
                onChange={(e) => update({ jobReference: e.target.value })}
                placeholder="Contract or job reference number"
                className="input-field w-full"
              />
            </div>
          </div>
        </section>

        {/* Invoice Address */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            INVOICE ADDRESS
          </h2>
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-text-primary block">Different invoice address</span>
                <span className="text-xs text-text-muted">Send invoices to a different address</span>
              </div>
              <button
                onClick={() => update({ invoiceAddressDifferent: !details.invoiceAddressDifferent })}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  details.invoiceAddressDifferent ? 'bg-gold' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    details.invoiceAddressDifferent ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {details.invoiceAddressDifferent && (
              <div>
                <label className="field-label block mb-1">ADDRESS</label>
                <textarea
                  value={details.invoiceAddress}
                  onChange={(e) => update({ invoiceAddress: e.target.value })}
                  placeholder="Invoice delivery address"
                  rows={3}
                  className="input-field w-full resize-none"
                />
              </div>
            )}

            {!details.invoiceAddressDifferent && (
              <p className="text-xs text-text-muted">
                Invoices will use the production company address above.
              </p>
            )}
          </div>
        </section>

        {/* Special Instructions */}
        <section className="mb-6">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-3">
            SPECIAL INSTRUCTIONS
          </h2>
          <div className="card">
            <label className="field-label block mb-1">INVOICE NOTES</label>
            <textarea
              value={details.invoiceNotes}
              onChange={(e) => update({ invoiceNotes: e.target.value })}
              placeholder="Any special requirements for invoicing this production (e.g. 'Reference PO number on all invoices', 'Submit via portal', etc.)"
              rows={3}
              className="input-field w-full resize-none"
            />
          </div>
        </section>

        {/* Auto-save notice */}
        <div className="pb-4">
          <p className="text-xs text-text-muted text-center">
            Details are saved automatically for this project
          </p>
        </div>
      </div>
    </>
  );
}
