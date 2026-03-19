import { useState, useRef, useCallback, useEffect } from 'react';
import { useCallSheetStore, type CallSheetFile } from '@/stores/callSheetStore';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface CallSheetsProps {
  projectId: string;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CALL SHEETS PAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export function CallSheets({ projectId }: CallSheetsProps) {
  const store = useCallSheetStore(projectId);
  const sheets = store((s) => s.sheets);
  const addSheet = store((s) => s.addSheet);
  const removeSheet = store((s) => s.removeSheet);

  const [viewingSheet, setViewingSheet] = useState<CallSheetFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sort by date descending (most recent first)
  const sorted = [...sheets].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  /* ── Generate thumbnail from PDF ── */
  const generateThumbnail = useCallback(async (dataUri: string): Promise<string> => {
    const data = atob(dataUri.split(',')[1]);
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    return canvas.toDataURL('image/png');
  }, []);

  /* ── Handle file upload ── */
  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') return;
      setUploading(true);
      try {
        const dataUri = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const thumbnailUri = await generateThumbnail(dataUri);

        // Try to parse date from filename, fallback to today
        const dateMatch = file.name.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
        const date = dateMatch ? dateMatch[1].replace(/\//g, '-') : new Date().toISOString().slice(0, 10);

        addSheet({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.pdf$/i, ''),
          date,
          dataUri,
          thumbnailUri,
          uploadedAt: new Date().toISOString(),
        });
      } finally {
        setUploading(false);
      }
    },
    [addSheet, generateThumbnail],
  );

  /* ── Keyboard: Escape to close viewer ── */
  useEffect(() => {
    if (!viewingSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewingSheet(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewingSheet]);

  /* ── PDF Viewer overlay ── */
  if (viewingSheet) {
    return (
      <div className="cs-viewer-overlay" onClick={() => setViewingSheet(null)}>
        <div className="cs-viewer-panel" onClick={(e) => e.stopPropagation()}>
          <div className="cs-viewer-header">
            <div>
              <h2 className="cs-viewer-title">{viewingSheet.name}</h2>
              <span className="cs-viewer-date">{formatDate(viewingSheet.date)}</span>
            </div>
            <button className="cs-viewer-close" onClick={() => setViewingSheet(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <iframe
            className="cs-viewer-iframe"
            src={viewingSheet.dataUri}
            title={viewingSheet.name}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="cs-page">
      {/* Header */}
      <div className="cs-header">
        <div>
          <h1 className="cs-title">
            <span className="cs-title-italic">Call</span>{' '}
            <span className="cs-title-regular">Sheets</span>
          </h1>
          <p className="cs-subtitle">{sheets.length} call sheet{sheets.length !== 1 ? 's' : ''} uploaded</p>
        </div>
      </div>

      {/* Thumbnail grid */}
      <div className="cs-grid">
        {/* Upload card — always first */}
        <button
          className="cs-upload-card"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          {uploading ? (
            <div className="cs-upload-spinner" />
          ) : (
            <svg className="cs-upload-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
          <span className="cs-upload-label">{uploading ? 'Uploading...' : 'Upload PDF'}</span>
        </button>

        {/* Call sheet thumbnails */}
        {sorted.map((sheet) => (
          <div key={sheet.id} className="cs-card">
            <button
              className="cs-card-thumb"
              onClick={() => setViewingSheet(sheet)}
            >
              <img src={sheet.thumbnailUri} alt={sheet.name} />
            </button>
            <div className="cs-card-info">
              <span className="cs-card-name" title={sheet.name}>{sheet.name}</span>
              <span className="cs-card-date">{formatDate(sheet.date)}</span>
            </div>
            <button
              className="cs-card-remove"
              title="Remove call sheet"
              onClick={() => removeSheet(sheet.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
