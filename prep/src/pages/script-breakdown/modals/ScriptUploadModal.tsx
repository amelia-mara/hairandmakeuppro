import { useState, useEffect, useRef } from 'react';
import { useScriptUploadProcessor } from '@/hooks/useScriptUploadProcessor';
import type { DiffResult } from '@/utils/scriptDiff';

export interface ScriptUploadModalProps {
  projectId: string;
  onClose: () => void;
  onUploaded: (filename: string, diffResult?: DiffResult) => void;
}

/**
 * Script upload modal — pure UI shell for the file picker, drag-drop
 * zone, progress bar, and error display. The actual processing
 * pipeline (parsing, character detection, scene construction, revision
 * detection, Supabase upload) lives in useScriptUploadProcessor,
 * which this component calls as a hook and wires into the UI via
 * `processFile`, `processing`, `progress`, and `statusText`.
 *
 * Renders conditionally from ScriptBreakdown when `showUploadModal`
 * is true. Closes on Escape (when not processing) or on backdrop
 * click. On success, calls `onUploaded(filename, diffResult)` and
 * the parent closes the modal from there.
 */
export function ScriptUploadModal({ projectId, onClose, onUploaded }: ScriptUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { processFile, processing, progress, statusText } = useScriptUploadProcessor({
    projectId,
    selectedFile,
    onUploaded,
    onError: setError,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processing) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, processing]);

  const handleFileSelect = (file: File) => {
    const validExts = ['.pdf', '.fdx', '.fountain', '.txt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExts.includes(ext)) {
      setError('Invalid file type. Please upload a PDF, FDX, Fountain, or TXT file.');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="modal-backdrop" onClick={!processing ? onClose : undefined}>
      <div className="modal-glass" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 28px 0',
        }}>
          <h2 style={{
            fontSize: '0.8125rem', letterSpacing: '0.1em',
            textTransform: 'uppercase' as const, color: 'var(--text-heading)', margin: 0,
          }}>
            <span className="heading-italic">Upload</span>{' '}
            <span className="heading-regular">Script</span>
          </h2>
          {!processing && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div style={{ padding: '20px 28px 28px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 20px' }}>
            Upload your screenplay to automatically detect scenes and characters.
          </p>

          {/* Processing state */}
          {processing ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: '100%', height: 6, borderRadius: 3,
                background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: 16,
              }}>
                <div style={{
                  width: `${progress}%`, height: '100%', borderRadius: 3,
                  background: 'var(--accent-gold, #D4943A)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                {statusText}
              </p>
            </div>
          ) : !selectedFile ? (
            /* Drop zone */
            <button
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                width: '100%', padding: '40px 30px', textAlign: 'center',
                border: `2px dashed ${dragOver ? 'var(--accent-gold, #D4943A)' : 'var(--border-subtle, rgba(255,255,255,0.08))'}`,
                borderRadius: 12,
                background: dragOver ? 'rgba(201, 169, 97, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <path d="M14 2v6h6"/>
                  <path d="M12 18v-6"/>
                  <path d="M9 15l3-3 3 3"/>
                </svg>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
                Click to upload or drag and drop
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                PDF, FDX (Final Draft), Fountain, or TXT
              </div>
            </button>
          ) : (
            /* File selected */
            <div style={{
              padding: 16, borderRadius: 10,
              background: 'rgba(201, 169, 97, 0.08)',
              border: '1px solid var(--accent-gold, #D4943A)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold, #D4943A)" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <path d="M14 2v6h6"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: 'var(--text-heading)', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {formatSize(selectedFile.size)}
                  </div>
                </div>
                <button onClick={() => { setSelectedFile(null); setError(''); }} style={{
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8125rem',
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}>
                  Remove
                </button>
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: 12 }}>{error}</p>
          )}

          {/* Actions */}
          {!processing && (
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24,
              borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              paddingTop: 20,
            }}>
              <button onClick={onClose} style={{
                padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500,
              }}>
                Cancel
              </button>
              <button
                onClick={processFile}
                disabled={!selectedFile}
                style={{
                  padding: '8px 24px', borderRadius: 8, cursor: selectedFile ? 'pointer' : 'not-allowed',
                  background: selectedFile ? 'var(--accent-gold, #D4943A)' : 'var(--bg-tertiary)',
                  border: 'none',
                  color: selectedFile ? '#1a1a1a' : 'var(--text-muted)',
                  fontSize: '0.8125rem', fontWeight: 600,
                  opacity: selectedFile ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                }}
              >
                Upload & Analyze
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.fdx,.fountain,.txt"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
