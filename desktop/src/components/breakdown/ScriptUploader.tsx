import { useState, useRef, useCallback } from 'react';

interface ScriptUploaderProps {
  onFileSelected: (file: File) => void;
  onTextPasted: (text: string) => void;
  isLoading: boolean;
  progressMessage: string;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/x-fountain',
  'application/xml',
  'text/xml',
];
const ACCEPTED_EXTENSIONS = ['.pdf', '.fdx', '.fountain', '.txt'];

export default function ScriptUploader({
  onFileSelected,
  onTextPasted,
  isLoading,
  progressMessage,
}: ScriptUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  const handlePasteSubmit = useCallback(() => {
    if (pasteText.trim()) onTextPasted(pasteText.trim());
  }, [pasteText, onTextPasted]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-white text-lg font-medium mb-2">Analyzing Script</p>
        <p className="text-neutral-400 text-sm">{progressMessage || 'Processing...'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-white mb-2">Script Breakdown</h2>
        <p className="text-neutral-400">
          Upload a screenplay to extract scenes and detect characters
        </p>
      </div>

      {/* Drag-Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-gold bg-gold/5'
            : 'border-neutral-700 hover:border-neutral-500 hover:bg-[#1a1a1a]'
        }`}
      >
        <div className="text-4xl mb-4 opacity-50">
          {isDragging ? '📥' : '📄'}
        </div>
        <p className="text-white font-medium mb-1">
          {isDragging ? 'Drop your script here' : 'Drag & drop your script'}
        </p>
        <p className="text-neutral-500 text-sm mb-4">
          PDF, Final Draft (.fdx), Fountain, or plain text
        </p>
        <button
          type="button"
          className="px-4 py-2 bg-[#1a1a1a] border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:border-gold/50 hover:text-white transition-colors"
        >
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-neutral-800" />
        <span className="text-neutral-600 text-sm">or</span>
        <div className="flex-1 h-px bg-neutral-800" />
      </div>

      {/* Paste Fallback */}
      {!showPaste ? (
        <button
          onClick={() => setShowPaste(true)}
          className="w-full py-3 text-sm text-neutral-400 hover:text-white border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors"
        >
          Paste script text instead
        </button>
      ) : (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste your screenplay text here..."
            className="w-full h-48 bg-[#1a1a1a] border border-neutral-700 rounded-lg p-4 text-white text-sm font-mono resize-none focus:outline-none focus:border-gold/50"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowPaste(false); setPasteText(''); }}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              className="px-4 py-2 bg-gold text-black text-sm font-medium rounded-lg hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Import & Analyze
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
