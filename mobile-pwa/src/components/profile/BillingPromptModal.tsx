interface BillingPromptModalProps {
  reason: 'signup' | 'timesheet';
  onFillIn: () => void;
  onClose: () => void;
}

export function BillingPromptModal({ reason, onFillIn, onClose }: BillingPromptModalProps) {
  const handleSkip = () => onClose();

  const title = reason === 'signup' ? 'Add invoicing details?' : 'Finish your billing details';
  const body =
    reason === 'signup'
      ? "We'll need your name, bank and VAT info to generate invoices for you. You can fill them in now or skip — you can always add them later from the profile menu."
      : "You can keep using the timesheet calculator without invoicing details, but to send invoices through Checks Happy we'll need your name, bank and VAT info. Want to add them now?";

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-2 text-sm text-text-muted leading-relaxed">{body}</p>
        </div>
        <div className="px-5 pb-5 flex flex-col gap-2">
          <button
            type="button"
            className="w-full py-2.5 rounded-lg bg-gold text-white text-sm font-semibold active:opacity-80"
            onClick={onFillIn}
          >
            Fill in now
          </button>
          <button
            type="button"
            className="w-full py-2.5 rounded-lg bg-transparent border border-border text-text-secondary text-sm font-medium active:opacity-80"
            onClick={handleSkip}
          >
            Skip — fill in later
          </button>
        </div>
      </div>
    </div>
  );
}
