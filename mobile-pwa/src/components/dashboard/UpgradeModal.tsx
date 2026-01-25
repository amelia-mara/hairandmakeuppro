import { Modal, Button } from '@/components/ui';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export function UpgradeModal({ isOpen, onClose, onUpgrade }: UpgradeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upgrade to Create Projects"
    >
      <div className="text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-gold-50 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gold"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>

        {/* Message */}
        <p className="text-text-secondary mb-6">
          Creating projects requires a{' '}
          <span className="font-semibold text-text-primary">Supervisor</span> or{' '}
          <span className="font-semibold text-text-primary">Designer</span> subscription.
        </p>

        {/* Features list */}
        <div className="bg-gold-50/50 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm font-medium text-text-primary mb-2">
            With Supervisor or higher, you can:
          </p>
          <ul className="space-y-1.5 text-sm text-text-secondary">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Create and manage projects
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Generate team invite codes
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Team management tools
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gold flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              1000+ photos per project
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            fullWidth
            size="lg"
            variant="primary"
            onClick={onUpgrade}
          >
            Upgrade Now
          </Button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-text-muted hover:text-text-secondary"
          >
            Not now
          </button>
        </div>
      </div>
    </Modal>
  );
}
