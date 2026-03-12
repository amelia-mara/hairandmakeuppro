import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col" style={{
      background: 'linear-gradient(180deg, #fffdfb 0%, #fefcfb 30%, #faf6f0 70%, #f5efe5 100%)'
    }}>
      {/* Department pills at top */}
      <div className="flex items-center justify-center gap-3 pt-14 px-8">
        <span className="px-5 py-2 rounded-pill text-sm font-medium text-gold border border-gold/30 bg-gold/5">
          Hair &amp; Makeup
        </span>
        <span className="px-5 py-2 rounded-pill text-sm font-medium text-[#5A3E28] border border-[#5A3E28]/20 bg-[#5A3E28]/5">
          Costume
        </span>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Text logo — stacked */}
        <div className="flex flex-col items-center mb-2">
          <span className="text-[42px] leading-tight font-serif font-bold text-[#2A1A08]">
            Checks
          </span>
          <span className="text-[42px] leading-tight font-serif font-bold italic text-gold">
            Happy.
          </span>
        </div>

        {/* Rainbow gradient underline */}
        <svg
          width="220"
          height="4"
          viewBox="0 0 220 4"
          className="mb-8"
        >
          <defs>
            <linearGradient id="welcomeRainbow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4A3020" />
              <stop offset="14%" stopColor="#7A5C3A" />
              <stop offset="28%" stopColor="#D4943A" />
              <stop offset="42%" stopColor="#F5A623" />
              <stop offset="56%" stopColor="#F0882A" />
              <stop offset="70%" stopColor="#E8621A" />
              <stop offset="84%" stopColor="#F2C4A0" />
              <stop offset="100%" stopColor="#4ABFB0" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="220" height="4" rx="2" fill="url(#welcomeRainbow)" />
        </svg>

        {/* Tagline */}
        <p className="text-lg text-[#5A3E28] mb-10">
          Your personal onset assistant
        </p>

        {/* Feature icons */}
        <div className="flex items-center justify-center w-full max-w-md mb-12">
          {/* Capture */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-12 h-12 mb-3" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="12" width="40" height="28" rx="4" stroke="#2A1A08" strokeWidth="2.5" fill="none" />
              <path d="M16 12L20 6H28L32 12" stroke="#2A1A08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="24" cy="27" r="8" stroke="#2A1A08" strokeWidth="2.5" fill="none" />
              <circle cx="24" cy="27" r="3" fill="#2A1A08" />
            </svg>
            <span className="text-sm font-medium text-[#2A1A08]">Capture</span>
          </div>

          {/* Divider */}
          <div className="w-px h-20 bg-[#c5c0b5]" />

          {/* Track */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-12 h-12 mb-3" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 8C14.06 8 6 16.06 6 26c0 3.6 1.1 6.9 2.9 9.7"
                stroke="#2A1A08" strokeWidth="2.5" strokeLinecap="round" fill="none"
              />
              <path
                d="M24 44c9.94 0 18-8.06 18-18 0-3.6-1.1-6.9-2.9-9.7"
                stroke="#2A1A08" strokeWidth="2.5" strokeLinecap="round" fill="none"
              />
              <polygon points="4,32 12,38 13,28" fill="#2A1A08" />
              <polygon points="44,20 36,14 35,24" fill="#2A1A08" />
            </svg>
            <span className="text-sm font-medium text-[#2A1A08]">Track</span>
          </div>

          {/* Divider */}
          <div className="w-px h-20 bg-[#c5c0b5]" />

          {/* Collaborate */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-12 h-12 mb-3" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="14" r="6" stroke="#2A1A08" strokeWidth="2.5" fill="none" />
              <path d="M14 40v-6a10 10 0 0120 0v6" stroke="#2A1A08" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <circle cx="10" cy="20" r="4" stroke="#2A1A08" strokeWidth="2" fill="none" />
              <path d="M2 40v-4a8 8 0 018-8" stroke="#2A1A08" strokeWidth="2" strokeLinecap="round" fill="none" />
              <circle cx="38" cy="20" r="4" stroke="#2A1A08" strokeWidth="2" fill="none" />
              <path d="M46 40v-4a8 8 0 00-8-8" stroke="#2A1A08" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            <span className="text-sm font-medium text-[#2A1A08]">Collaborate</span>
          </div>
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="px-8 pb-10 space-y-4">
        {/* Sign In — solid orange, pill-shaped */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-pill font-semibold text-lg transition-all duration-200
            bg-gold text-white active:scale-[0.98] shadow-md hover:bg-gold-dark"
        >
          Sign In
        </button>

        {/* Create Account — outlined, pill-shaped */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded-pill font-semibold text-lg transition-all duration-200
            border-2 border-[#2A1A08] text-[#2A1A08] bg-transparent active:scale-[0.98]"
        >
          Create Account
        </button>

        {/* Join a Team */}
        <div className="pt-6 flex items-center justify-center gap-4">
          <div className="flex-1 h-px bg-[#c5c0b5]" />
          <button
            className="text-sm text-[#7a7a7a] hover:text-[#5A3E28] transition-colors whitespace-nowrap"
            onClick={() => setScreen('signup')}
          >
            Join a Team
          </button>
          <div className="flex-1 h-px bg-[#c5c0b5]" />
        </div>
      </div>
    </div>
  );
}
