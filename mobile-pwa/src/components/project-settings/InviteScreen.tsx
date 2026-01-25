import { InviteCodeShare } from './InviteCodeShare';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';

interface InviteScreenProps {
  inviteCode: string;
  isOwner: boolean;
  onBack: () => void;
}

export function InviteScreen({
  inviteCode,
  isOwner,
  onBack,
}: InviteScreenProps) {
  const { regenerateInviteCode } = useProjectSettingsStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-text-muted hover:text-text-primary transition-colors tap-target"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-text-primary">Invite Team</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-container px-4 py-6">
        <InviteCodeShare
          inviteCode={inviteCode}
          isOwner={isOwner}
          onRegenerateCode={isOwner ? regenerateInviteCode : undefined}
        />
      </div>
    </div>
  );
}
