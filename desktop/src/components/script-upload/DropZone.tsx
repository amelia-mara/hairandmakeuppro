import { useState, useCallback, type DragEvent } from 'react';
import clsx from 'clsx';

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function DropZone({ onFile, disabled }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items?.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragOut = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        onFile(file);
      }
    }
  }, [onFile, disabled]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onFile(file);
    };
    input.click();
  }, [onFile, disabled]);

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
      className={clsx(
        'border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer',
        isDragOver
          ? 'border-accent bg-accent/10 scale-[1.02]'
          : 'border-white/20 hover:border-white/40 hover:bg-white/5',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <svg className={clsx('w-12 h-12', isDragOver ? 'text-accent' : 'text-white/30')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <div>
          <p className={clsx('text-sm font-medium', isDragOver ? 'text-accent' : 'text-white/70')}>
            {isDragOver ? 'Drop PDF here' : 'Drop script PDF or click to browse'}
          </p>
          <p className="text-xs text-white/40 mt-1">PDF files only</p>
        </div>
      </div>
    </div>
  );
}
