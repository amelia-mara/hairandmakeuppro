import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
  requiresTextConfirmation?: string; // If provided, user must type this text to confirm
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  requiresTextConfirmation,
  isLoading = false,
}: ConfirmationModalProps) {
  const [confirmationText, setConfirmationText] = useState('');

  const isConfirmDisabled =
    requiresTextConfirmation !== undefined &&
    confirmationText.toLowerCase() !== requiresTextConfirmation.toLowerCase();

  const handleClose = () => {
    setConfirmationText('');
    onClose();
  };

  const handleConfirm = () => {
    if (!isConfirmDisabled && !isLoading) {
      onConfirm();
      setConfirmationText('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-text-muted">{message}</div>

        {requiresTextConfirmation && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">
              Type "<span className="font-medium text-text-primary">{requiresTextConfirmation}</span>" to confirm:
            </p>
            <Input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={requiresTextConfirmation}
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={handleClose}
            fullWidth
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'outline' : 'primary'}
            onClick={handleConfirm}
            fullWidth
            disabled={isConfirmDisabled || isLoading}
            className={variant === 'danger' ? 'border-red-500 text-red-500 hover:bg-red-50' : ''}
          >
            {isLoading ? 'Loading...' : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
