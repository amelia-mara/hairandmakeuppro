import { useEffect } from 'react';

interface ReceiptLightboxProps {
  imageUri: string;
  onClose: () => void;
}

export function ReceiptLightbox({ imageUri, onClose }: ReceiptLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="budget-lightbox" onClick={onClose}>
      <button className="budget-lightbox-close" onClick={onClose}>×</button>
      <img
        src={imageUri}
        alt="Receipt"
        className="budget-lightbox-image"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}
