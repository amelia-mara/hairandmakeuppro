import { useState } from 'react';
import { Button } from '@/components/ui';

export interface ProjectCodeShareProps {
  projectName: string;
  projectCode: string;
  onGoToProject: () => void;
}

export function ProjectCodeShare({
  projectName,
  projectCode,
  onGoToProject,
}: ProjectCodeShareProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(projectCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = projectCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareText = `Join me on Checks Happy for ${projectName}. Use code: ${projectCode}. Download the app: https://checkshappy.app`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${projectName} on Checks Happy`,
          text: shareText,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback - copy the share text
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-6">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-green-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Heading */}
      <h2 className="text-xl font-bold text-text-primary mb-2">
        Project Created
      </h2>

      {/* Project name */}
      <p className="text-lg text-text-secondary mb-6">
        {projectName}
      </p>

      {/* Share code section */}
      <div className="w-full max-w-xs mb-6">
        <p className="text-sm text-text-muted mb-3">
          Share this code with your team:
        </p>

        {/* Code display */}
        <div className="bg-gold-50 border-2 border-gold/30 rounded-xl p-4 mb-4">
          <span className="text-2xl font-bold tracking-widest text-gold">
            {projectCode}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            fullWidth
            size="md"
            variant="outline"
            onClick={handleCopyCode}
          >
            {copied ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy Code
              </span>
            )}
          </Button>

          <Button
            fullWidth
            size="md"
            variant="outline"
            onClick={handleShare}
          >
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </span>
          </Button>
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-text-muted mb-8 max-w-xs">
        Anyone with this code can join your project and contribute.
      </p>

      {/* Go to project button */}
      <Button
        fullWidth
        size="lg"
        variant="primary"
        onClick={onGoToProject}
        className="max-w-xs"
      >
        Go to Project
      </Button>
    </div>
  );
}
