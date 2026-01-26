import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Logo - Elegant gold checkmark */}
        <div
          className="mb-8 animate-scaleIn"
          style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}
        >
          <div className="w-28 h-28 flex items-center justify-center relative">
            {/* Subtle glow behind checkmark in dark mode */}
            <div className="absolute inset-0 rounded-full dark:bg-gold/5 dark:blur-xl" />
            <svg
              className="w-24 h-24 relative"
              viewBox="0 0 80 80"
              fill="none"
            >
              {/* Circle outline - subtle in light mode */}
              <circle
                cx="40"
                cy="40"
                r="38"
                className="stroke-gold/20 dark:stroke-gold/15"
                strokeWidth="1"
                fill="none"
              />
              {/* Metallic gold gradient checkmark */}
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D4B86A" />
                  <stop offset="30%" stopColor="#E8D48A" />
                  <stop offset="50%" stopColor="#C9A962" />
                  <stop offset="70%" stopColor="#D4B86A" />
                  <stop offset="100%" stopColor="#A8893D" />
                </linearGradient>
                <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d="M24 42L35 53L56 28"
                stroke="url(#goldGradient)"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="url(#goldGlow)"
              />
            </svg>
          </div>
        </div>

        {/* App name - Luxury spaced typography */}
        <h1
          className="text-[22px] font-semibold tracking-[0.35em] text-text-primary mb-2 animate-fadeInUp"
          style={{
            animationDelay: '0.2s',
            opacity: 0,
            animationFillMode: 'forwards',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          CHECKS HAPPY
        </h1>

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
        {/* Sign In - Dark in light mode, Gold gradient in dark mode */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-xl font-semibold text-base transition-all duration-200
            btn-dark text-white active:scale-[0.98]
            dark:btn-gold dark:text-white"
        >
          Sign In
        </button>

        {/* Create Account - Outlined */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded-xl font-semibold text-base transition-all duration-200
            btn-outline-dark active:scale-[0.98]
            dark:btn-outline-gold"
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
