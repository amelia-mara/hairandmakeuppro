import { useAuthStore } from '@/stores/authStore';
import { ChecksHappyLogo } from '@/components/ui/ChecksHappyLogo';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Checks Happy Logo */}
        <div
          className="mb-8"
          style={{ animationDelay: '0.1s' }}
        >
          <ChecksHappyLogo size="lg" animated showText showUnderline />
        </div>

        {/* Tagline */}
        <p
          className="text-sm text-text-secondary tracking-wider mb-14 animate-fadeInUp"
          style={{ animationDelay: '0.25s', opacity: 0, animationFillMode: 'forwards' }}
        >
          Hair & Makeup Continuity Simplified
        </p>

        {/* Feature icons - Horizontal row */}
        <div
          className="flex items-center justify-center gap-0 mb-14 animate-fadeInUp"
          style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}
        >
          <FeatureIcon
            icon={
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            }
            label="Capture"
          />
          <div className="w-px h-12 bg-border mx-8" />
          <FeatureIcon
            icon={
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M4.93 4.93l2.83 2.83" />
                <path d="M16.24 16.24l2.83 2.83" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
                <path d="M4.93 19.07l2.83-2.83" />
                <path d="M16.24 7.76l2.83-2.83" />
              </svg>
            }
            label="Track"
          />
          <div className="w-px h-12 bg-border mx-8" />
          <FeatureIcon
            icon={
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            label="Collaborate"
          />
        </div>
      </div>

      {/* Bottom action buttons */}
      <div
        className="px-8 pb-12 space-y-3 animate-fadeInUp"
        style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}
      >
        {/* Sign In - Gold gradient in both modes */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-lg font-semibold text-base transition-all duration-200
            btn-gold text-white active:scale-[0.98]"
        >
          Sign In
        </button>

        {/* Create Account - Outlined gold */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded-lg font-semibold text-base transition-all duration-200
            btn-outline-gold active:scale-[0.98]"
        >
          Create Account
        </button>

        {/* Forgot Password link */}
        <div className="pt-4 text-center">
          <button
            className="text-sm text-text-muted hover:text-text-secondary transition-colors"
            onClick={() => setScreen('signin')}
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}

// Feature icon component
function FeatureIcon({
  icon,
  label
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="text-gold">
        {icon}
      </div>
      <span className="text-xs text-text-muted tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}
