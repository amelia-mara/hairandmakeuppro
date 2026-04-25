/**
 * ExportPreviewModal — renders an in-browser preview of an
 * ExportPreview payload before the user commits to downloading.
 *
 * PDFs embed as an <iframe> over a blob URL; browsers render those
 * natively and the user gets scroll + zoom for free. Spreadsheet /
 * document / presentation formats are not previewable by browsers, so
 * for those we show a summary card with the filename, metadata, and a
 * Download button — the user can open the file in Excel / Word /
 * Keynote afterwards.
 */

import { useEffect, useMemo } from 'react';
import type { ExportPreview } from '@/utils/export/common';
import { downloadBlob } from '@/utils/export/common';

interface ExportPreviewModalProps {
  preview: ExportPreview | null;
  onClose: () => void;
}

export function ExportPreviewModal({ preview, onClose }: ExportPreviewModalProps) {
  // Keep the blob URL stable for the life of this preview; revoke it
  // on unmount or when the preview swaps to something else.
  const blobUrl = useMemo(() => (preview ? URL.createObjectURL(preview.blob) : null), [preview]);
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Close on Escape.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, onClose]);

  if (!preview || !blobUrl) return null;

  const handleDownload = () => {
    downloadBlob(preview.blob, preview.filename);
  };

  const isPdf = preview.kind === 'pdf';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-glass export-preview-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="export-preview-header">
          <div>
            <div className="export-preview-eyebrow">{preview.section}</div>
            <div className="export-preview-filename">{preview.filename}</div>
            <div className="export-preview-subtitle">{preview.subtitle}</div>
          </div>
          <button
            className="export-preview-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="export-preview-body">
          {isPdf ? (
            <iframe
              title={`${preview.section} preview`}
              src={blobUrl}
              className="export-preview-iframe"
            />
          ) : (
            <div className="export-preview-placeholder">
              <div className="export-preview-placeholder-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <div className="export-preview-placeholder-title">
                Preview not available in browser
              </div>
              <div className="export-preview-placeholder-body">
                {preview.kind === 'spreadsheet'
                  ? 'Download the XLSX and open it in Excel, Numbers, or Google Sheets.'
                  : preview.kind === 'document'
                  ? 'Download the DOCX and open it in Word, Pages, or Google Docs.'
                  : 'Download the file and open it in your presentation app.'}
              </div>
            </div>
          )}
        </div>

        <div className="export-preview-footer">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="export-preview-download" onClick={handleDownload}>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
