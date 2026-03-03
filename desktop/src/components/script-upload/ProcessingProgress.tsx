import type { UploadProgress } from '@/services/pdfService';
import clsx from 'clsx';

interface ProcessingProgressProps {
  progress: UploadProgress;
}

const stages = [
  { key: 'reading', label: 'Reading PDF' },
  { key: 'extracting', label: 'Extracting text' },
  { key: 'parsing', label: 'Parsing scenes' },
  { key: 'detecting', label: 'Detecting characters' },
  { key: 'complete', label: 'Complete' },
] as const;

export function ProcessingProgress({ progress }: ProcessingProgressProps) {
  const currentIndex = stages.findIndex((s) => s.key === progress.stage);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div
                className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors',
                  isComplete && 'bg-green-500/20 text-green-400',
                  isActive && 'bg-accent/20 text-accent',
                  isPending && 'bg-white/5 text-white/20'
                )}
              >
                {isComplete ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                ) : isActive ? (
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                )}
              </div>
              <span
                className={clsx(
                  'text-sm',
                  isComplete && 'text-white/50',
                  isActive && 'text-white font-medium',
                  isPending && 'text-white/30'
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {progress.stage === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-sm text-red-400">{progress.message}</p>
        </div>
      )}

      {progress.stage !== 'error' && progress.message && (
        <p className="text-xs text-white/40 text-center">{progress.message}</p>
      )}
    </div>
  );
}
