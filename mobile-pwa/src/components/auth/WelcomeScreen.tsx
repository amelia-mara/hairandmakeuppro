import { useAuthStore } from '@/stores/authStore';
import { ChecksHappyLogo } from '@/components/ui/ChecksHappyLogo';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-12">
        {/* Checks Happy Logo */}
        <div className="mb-6">
          <ChecksHappyLogo size="lg" animated showText showUnderline />
        </div>

        {/* Tagline - Italic serif */}
        <p
          className="text-lg font-serif italic text-[#4a4a4a] mb-12 animate-fadeInUp"
          style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}
        >
          Streamline Hair & Makeup Continuity
        </p>

        {/* Feature icons - Camera, Track, Collaborate */}
        <div
          className="flex items-center justify-center gap-0 mb-16 animate-fadeInUp"
          style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}
        >
          {/* Capture - Camera icon */}
          <FeatureIcon
            icon={
              <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                <defs>
                  <linearGradient id="iconGold1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D4B86A" />
                    <stop offset="50%" stopColor="#C9A962" />
                    <stop offset="100%" stopColor="#A8893D" />
                  </linearGradient>
                </defs>
                {/* Camera body */}
                <rect x="4" y="12" width="32" height="22" rx="3" stroke="url(#iconGold1)" strokeWidth="2.5" fill="none" />
                {/* Camera lens */}
                <circle cx="20" cy="23" r="6" stroke="url(#iconGold1)" strokeWidth="2.5" fill="none" />
                {/* Camera flash */}
                <rect x="24" y="6" width="8" height="6" rx="1" stroke="url(#iconGold1)" strokeWidth="2" fill="none" />
              </svg>
            }
            label="Capture"
          />

          {/* Vertical divider */}
          <div className="w-px h-16 bg-[#d5d0c5] mx-10" />

          {/* Track - Sync arrows icon */}
          <FeatureIcon
            icon={
              <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                <defs>
                  <linearGradient id="iconGold2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D4B86A" />
                    <stop offset="50%" stopColor="#C9A962" />
                    <stop offset="100%" stopColor="#A8893D" />
                  </linearGradient>
                </defs>
                {/* Circular arrows */}
                <path
                  d="M20 6C12.268 6 6 12.268 6 20c0 2.5.66 4.85 1.8 6.88"
                  stroke="url(#iconGold2)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M20 34c7.732 0 14-6.268 14-14 0-2.5-.66-4.85-1.8-6.88"
                  stroke="url(#iconGold2)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Arrow heads */}
                <path d="M4 24l4 4 4-4" stroke="url(#iconGold2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M36 16l-4-4-4 4" stroke="url(#iconGold2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            }
            label="Track"
          />

          {/* Vertical divider */}
          <div className="w-px h-16 bg-[#d5d0c5] mx-10" />

          {/* Collaborate - People icon */}
          <FeatureIcon
            icon={
              <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                <defs>
                  <linearGradient id="iconGold3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D4B86A" />
                    <stop offset="50%" stopColor="#C9A962" />
                    <stop offset="100%" stopColor="#A8893D" />
                  </linearGradient>
                </defs>
                {/* Center person (larger) */}
                <circle cx="20" cy="12" r="5" fill="url(#iconGold3)" />
                <path d="M12 32v-4a8 8 0 0116 0v4" fill="url(#iconGold3)" />
                {/* Left person */}
                <circle cx="8" cy="16" r="4" fill="url(#iconGold3)" />
                <path d="M2 32v-3a6 6 0 0110 0" fill="url(#iconGold3)" />
                {/* Right person */}
                <circle cx="32" cy="16" r="4" fill="url(#iconGold3)" />
                <path d="M28 29a6 6 0 0110 0v3" fill="url(#iconGold3)" />
              </svg>
            }
            label="Collaborate"
          />
        </div>
      </div>

      {/* Bottom action buttons */}
      <div
        className="px-8 pb-8 space-y-4 animate-fadeInUp"
        style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}
      >
        {/* Sign In - Black background with gold gradient text */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-lg font-semibold text-lg transition-all duration-200
            bg-[#1a1a1a] active:scale-[0.98]"
        >
          <span className="bg-gradient-to-r from-[#D4B86A] via-[#C9A962] to-[#A8893D] bg-clip-text text-transparent">
            Sign In
          </span>
        </button>

        {/* Create Account - Gold gradient fill with black outline and black text */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded-lg font-semibold text-lg transition-all duration-200
            border-2 border-[#1a1a1a] text-[#1a1a1a] active:scale-[0.98]
            bg-gradient-to-r from-[#D4B86A] via-[#E8D48A] to-[#C9A962]"
        >
          Create Account
        </button>

        {/* Forgot Password with lines */}
        <div className="pt-8 flex items-center justify-center gap-4">
          <div className="flex-1 h-px bg-[#c5c0b5]" />
          <button
            className="text-sm text-[#7a7a7a] hover:text-[#4a4a4a] transition-colors whitespace-nowrap"
            onClick={() => setScreen('signin')}
          >
            Forgot Password?
          </button>
          <div className="flex-1 h-px bg-[#c5c0b5]" />
        </div>
      </div>
    </div>
  );
}

// Feature icon component - icon with black label below
function FeatureIcon({
  icon,
  label
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {icon}
      <span className="text-sm font-serif text-[#1a1a1a] tracking-wide">
        {label}
      </span>
    </div>
  );
}
