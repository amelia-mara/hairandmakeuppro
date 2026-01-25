import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Logo and branding */}
        <div className="flex flex-col items-center mb-12">
          {/* Makeup brush icon */}
          <div className="w-24 h-24 mb-6 gold-gradient rounded-3xl flex items-center justify-center shadow-lg">
            <svg
              className="w-14 h-14 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Brush handle */}
              <path d="M18 3L22 7" />
              <path d="M14 7L18 3" />
              {/* Brush head */}
              <ellipse cx="9" cy="15" rx="5" ry="7" />
              <path d="M14 8L9 13" />
              {/* Bristles detail */}
              <path d="M6 12C6 12 7 14 9 15" />
              <path d="M12 12C12 12 11 14 9 15" />
            </svg>
          </div>

          {/* App name */}
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Checks Happy
          </h1>

          {/* Tagline */}
          <p className="text-lg text-text-secondary">
            Your onset assistant
          </p>
        </div>

        {/* Feature highlights */}
        <div className="w-full max-w-xs mb-12 space-y-4">
          <FeatureItem
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            }
            text="Track continuity across scenes"
          />
          <FeatureItem
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            }
            text="Capture reference photos"
          />
          <FeatureItem
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            text="Collaborate with your team"
          />
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="px-6 pb-safe-bottom space-y-3">
        <Button
          fullWidth
          size="lg"
          onClick={() => setScreen('signin')}
        >
          Sign In
        </Button>

        <Button
          fullWidth
          size="lg"
          variant="outline"
          onClick={() => setScreen('signup')}
        >
          Create Account
        </Button>

        <button
          className="w-full py-3 text-gold font-medium hover:underline"
          onClick={() => setScreen('join')}
        >
          Join a Project
        </button>
      </div>
    </div>
  );
}

// Feature item component
function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center text-gold flex-shrink-0">
        {icon}
      </div>
      <span className="text-text-secondary">{text}</span>
    </div>
  );
}
