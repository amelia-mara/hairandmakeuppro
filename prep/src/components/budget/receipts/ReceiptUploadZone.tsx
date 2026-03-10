import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

interface ReceiptUploadZoneProps {
  onFileSelected: (file: File) => void;
  onApiSettings: () => void;
}

export interface ReceiptUploadZoneHandle {
  triggerFilePicker: () => void;
}

export const ReceiptUploadZone = forwardRef<ReceiptUploadZoneHandle, ReceiptUploadZoneProps>(
  function ReceiptUploadZone({ onFileSelected, onApiSettings }, ref) {
    const [isDragActive, setIsDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      triggerFilePicker: () => {
        inputRef.current?.click();
      },
    }));

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelected(file);
    }, [onFileSelected]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
      e.target.value = '';
    };

    return (
      <div className="budget-upload-card">
        <div className="budget-upload-header">
          <h3 style={{ fontSize: '0.8125rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-heading)', margin: 0 }}>
            <span className="heading-italic">Upload</span>{' '}
            <span className="heading-regular">Receipts</span>
          </h3>
          <button className="btn-ghost budget-btn-sm" onClick={onApiSettings}>
            <SettingsIcon />
            API Settings
          </button>
        </div>

        <div
          className={`budget-drop-zone ${isDragActive ? 'active' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,application/pdf"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <CameraIcon />
            <UploadIcon />
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
            Drag and drop or click to browse
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Accepts JPG, PNG, HEIC, PDF up to 10MB
          </div>
        </div>

        <div className="budget-sync-note">
          <SmartphoneIcon />
          <span>Syncs with Checks Happy</span>
        </div>
      </div>
    );
  }
);

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SmartphoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}
