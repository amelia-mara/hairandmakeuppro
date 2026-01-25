import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from './ConfirmationModal';

interface InviteCodeShareProps {
  inviteCode: string;
  isOwner: boolean;
  onRegenerateCode?: () => Promise<string>;
}

export function InviteCodeShare({
  inviteCode,
  isOwner,
  onRegenerateCode,
}: InviteCodeShareProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentCode, setCurrentCode] = useState(inviteCode);

  const joinLink = `checkshappy.app/join/${currentCode}`;

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my project on Checks Happy',
          text: `Use code ${currentCode} to join my production on Checks Happy!`,
          url: `https://${joinLink}`,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback - copy link
      copyToClipboard(`https://${joinLink}`, 'link');
    }
  };

  const handleRegenerateCode = async () => {
    if (!onRegenerateCode) return;

    setIsRegenerating(true);
    try {
      const newCode = await onRegenerateCode();
      setCurrentCode(newCode);
      setShowRegenerateConfirm(false);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Main Code Section */}
        <div className="text-center">
          <p className="text-sm text-text-muted mb-4">Share this code with your team:</p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-4">
            <span className="text-3xl font-bold tracking-widest text-text-primary">
              {currentCode}
            </span>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(currentCode, 'code')}
              fullWidth
            >
              {copied === 'code' ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </Button>
            <Button variant="primary" onClick={handleShare} fullWidth>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Link Section */}
        <div>
          <p className="text-sm text-text-muted mb-3">Or share this link:</p>

          <div className="bg-gray-50 rounded-xl p-3 mb-3">
            <p className="text-sm text-text-primary font-mono break-all">{joinLink}</p>
          </div>

          <Button
            variant="secondary"
            onClick={() => copyToClipboard(`https://${joinLink}`, 'link')}
            fullWidth
          >
            {copied === 'link' ? (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Link Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Copy Link
              </>
            )}
          </Button>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Tip */}
        <div className="flex gap-3 p-4 bg-gold-50/50 rounded-xl">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-sm text-text-muted">
            <span className="font-medium text-text-primary">Tip:</span> Add the code to your call sheet so the whole team can join easily.
          </p>
        </div>

        {/* Regenerate Code Section (Owner Only) */}
        {isOwner && onRegenerateCode && (
          <>
            <div className="border-t border-border" />

            <div className="p-4 bg-amber-50 rounded-xl">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-amber-800 mb-1">Regenerate Code</h4>
                  <p className="text-xs text-amber-700 mb-3">
                    Create a new code if the current one has been shared too widely. Existing team members won't be affected.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRegenerateConfirm(true)}
                    className="border-amber-600 text-amber-700 hover:bg-amber-100"
                  >
                    Regenerate Code
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Regenerate Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRegenerateConfirm}
        onClose={() => setShowRegenerateConfirm(false)}
        onConfirm={handleRegenerateCode}
        title="Regenerate invite code?"
        message={
          <div className="space-y-2">
            <p>The current code (<span className="font-mono font-medium">{currentCode}</span>) will stop working immediately.</p>
            <p>Team members already joined won't be affected.</p>
          </div>
        }
        confirmText="Regenerate"
        isLoading={isRegenerating}
      />
    </>
  );
}
