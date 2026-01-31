import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Logo Icon - Gold checkmark extending beyond smaller ring */}
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-6"
        >
          <defs>
            {/* Gold gradient for checkmark */}
            <linearGradient id="checkGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D4B86A" />
              <stop offset="40%" stopColor="#C9A962" />
              <stop offset="100%" stopColor="#A8893D" />
            </linearGradient>
            {/* Ring gradient - gold/black shine effect */}
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2a2a2a" />
              <stop offset="30%" stopColor="#4a4a4a" />
              <stop offset="45%" stopColor="#8B7332" />
              <stop offset="55%" stopColor="#C9A962" />
              <stop offset="70%" stopColor="#4a4a4a" />
              <stop offset="100%" stopColor="#2a2a2a" />
            </linearGradient>
          </defs>

          {/* Circle ring - with gold/black gradient */}
          <circle
            cx="50"
            cy="50"
            r="36"
            stroke="url(#ringGradient)"
            strokeWidth="2.5"
            fill="none"
          />

          {/* Gold checkmark - extends beyond the circle */}
          <path
            d="M30 52L44 66L70 36"
            stroke="url(#checkGold)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>

        {/* CHECKS HAPPY text */}
        <h1 className="text-[26px] font-serif font-normal tracking-[0.2em] text-[#1a1a1a] mb-2">
          CHECKS HAPPY
        </h1>

        {/* Gold underline with tapered ends */}
        <svg width="260" height="6" viewBox="0 0 260 6" className="mb-8">
          <defs>
            <linearGradient id="underlineGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9A962" stopOpacity="0" />
              <stop offset="15%" stopColor="#C9A962" stopOpacity="1" />
              <stop offset="50%" stopColor="#D4B86A" stopOpacity="1" />
              <stop offset="85%" stopColor="#C9A962" stopOpacity="1" />
              <stop offset="100%" stopColor="#C9A962" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="3" x2="260" y2="3" stroke="url(#underlineGold)" strokeWidth="1" />
        </svg>

        {/* Tagline - Italic serif */}
        <p className="text-xl font-serif italic text-[#4a4a4a] mb-12">
          Streamline Hair & Makeup Continuity
        </p>

        {/* Feature icons - Camera, Track, Collaborate */}
        <div className="flex items-center justify-center w-full max-w-sm mb-16">
          {/* Capture - Camera icon */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-12 h-12 mb-3" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="iconGold1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D4B86A" />
                  <stop offset="50%" stopColor="#C9A962" />
                  <stop offset="100%" stopColor="#A8893D" />
                </linearGradient>
              </defs>
              {/* Camera body */}
              <rect x="6" y="14" width="36" height="26" rx="3" stroke="url(#iconGold1)" strokeWidth="2" fill="none" />
              {/* Camera lens */}
              <circle cx="24" cy="27" r="8" stroke="url(#iconGold1)" strokeWidth="2" fill="none" />
              {/* Camera lens inner */}
              <circle cx="24" cy="27" r="3" fill="url(#iconGold1)" />
              {/* Camera flash */}
              <path d="M28 8h8v6h-8" stroke="url(#iconGold1)" strokeWidth="2" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-sm font-serif text-[#1a1a1a]">Capture</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-20 bg-[#d0cbc0]" />

          {/* Track - Sync arrows icon */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-12 h-12 mb-3" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="iconGold2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D4B86A" />
                  <stop offset="50%" stopColor="#C9A962" />
                  <stop offset="100%" stopColor="#A8893D" />
                </linearGradient>
              </defs>
              {/* Circular arrows */}
              <path
                d="M24 8C15.163 8 8 15.163 8 24c0 3 .82 5.8 2.25 8.2"
                stroke="url(#iconGold2)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M24 40c8.837 0 16-7.163 16-16 0-3-.82-5.8-2.25-8.2"
                stroke="url(#iconGold2)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow heads */}
              <path d="M6 28l4 6 6-4" stroke="url(#iconGold2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M42 20l-4-6-6 4" stroke="url(#iconGold2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-sm font-serif text-[#1a1a1a]">Track</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-20 bg-[#d0cbc0]" />

          {/* Collaborate - People icon */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-12 h-12 mb-3" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="iconGold3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#D4B86A" />
                  <stop offset="50%" stopColor="#C9A962" />
                  <stop offset="100%" stopColor="#A8893D" />
                </linearGradient>
              </defs>
              {/* Center person (larger) */}
              <circle cx="24" cy="14" r="6" fill="url(#iconGold3)" />
              <path d="M14 38v-6c0-5.523 4.477-10 10-10s10 4.477 10 10v6" fill="url(#iconGold3)" />
              {/* Left person */}
              <circle cx="10" cy="18" r="4" fill="url(#iconGold3)" />
              <path d="M2 38v-4c0-4.418 3.582-8 8-8 1.5 0 2.9.4 4.1 1.1" fill="url(#iconGold3)" />
              {/* Right person */}
              <circle cx="38" cy="18" r="4" fill="url(#iconGold3)" />
              <path d="M46 38v-4c0-4.418-3.582-8-8-8-1.5 0-2.9.4-4.1 1.1" fill="url(#iconGold3)" />
            </svg>
            <span className="text-sm font-serif text-[#1a1a1a]">Collaborate</span>
          </div>
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="px-8 pb-10 space-y-4">
        {/* Sign In - Black background with gold gradient text */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-xl font-semibold text-lg transition-all duration-200
            bg-[#1a1a1a] active:scale-[0.98] shadow-lg"
        >
          <span className="bg-gradient-to-r from-[#D4B86A] via-[#C9A962] to-[#A8893D] bg-clip-text text-transparent">
            Sign In
          </span>
        </button>

        {/* Create Account - Gold gradient fill with black outline and black text */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded-xl font-semibold text-lg transition-all duration-200
            border border-[#1a1a1a] text-[#1a1a1a] active:scale-[0.98]
            bg-gradient-to-r from-[#D4B86A] via-[#E8D48A] to-[#C9A962]"
        >
          Create Account
        </button>

        {/* Forgot Password with lines */}
        <div className="pt-6 flex items-center justify-center gap-4">
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
