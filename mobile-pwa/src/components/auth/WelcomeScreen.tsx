import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Logo Icon - Gold checkmark with black ring */}
        <svg
          width="110"
          height="110"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-5"
        >
          <defs>
            <linearGradient id="checkGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D4B86A" />
              <stop offset="40%" stopColor="#C9A962" />
              <stop offset="100%" stopColor="#A8893D" />
            </linearGradient>
          </defs>

          {/* Black circle ring */}
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="#1a1a1a"
            strokeWidth="2"
            fill="none"
          />

          {/* Gold checkmark */}
          <path
            d="M28 52L42 66L72 32"
            stroke="url(#checkGold)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>

        {/* CHECKS HAPPY text */}
        <h1 className="text-[28px] font-serif font-normal tracking-[0.15em] text-[#1a1a1a]">
          CHECKS HAPPY
        </h1>

        {/* Gold underline */}
        <div
          className="h-[2px] mt-3 mb-8"
          style={{
            width: '280px',
            background: 'linear-gradient(90deg, transparent 0%, #C9A962 15%, #D4B86A 50%, #C9A962 85%, transparent 100%)'
          }}
        />

        {/* Tagline - Regular (not italic) */}
        <p className="text-lg font-serif text-[#4a4a4a] mb-10">
          Streamline Hair & Makeup Continuity
        </p>

        {/* Feature icons - BLACK, bigger, bolder */}
        <div className="flex items-center justify-center w-full max-w-md mb-12">
          {/* Capture - Camera icon */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Camera body */}
              <rect x="4" y="16" width="48" height="32" rx="4" stroke="#1a1a1a" strokeWidth="3" fill="none" />
              {/* Camera lens */}
              <circle cx="28" cy="32" r="10" stroke="#1a1a1a" strokeWidth="3" fill="none" />
              {/* Camera lens inner */}
              <circle cx="28" cy="32" r="4" fill="#1a1a1a" />
              {/* Camera flash/viewfinder */}
              <rect x="34" y="8" width="12" height="8" rx="2" stroke="#1a1a1a" strokeWidth="3" fill="none" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Capture</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Track - Sync arrows icon */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Circular arrow - top */}
              <path
                d="M28 8C16.954 8 8 16.954 8 28c0 4 1.2 7.7 3.2 10.8"
                stroke="#1a1a1a"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              {/* Circular arrow - bottom */}
              <path
                d="M28 48c11.046 0 20-8.954 20-20 0-4-1.2-7.7-3.2-10.8"
                stroke="#1a1a1a"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow head - bottom left */}
              <path d="M6 34l6 8 8-6" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              {/* Arrow head - top right */}
              <path d="M50 22l-6-8-8 6" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Track</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Collaborate - People icon */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Center person (larger) */}
              <circle cx="28" cy="16" r="7" fill="#1a1a1a" />
              <path d="M16 46v-8c0-6.627 5.373-12 12-12s12 5.373 12 12v8" fill="#1a1a1a" />
              {/* Left person */}
              <circle cx="12" cy="20" r="5" fill="#1a1a1a" />
              <path d="M2 46v-6c0-5.523 4.477-10 10-10 2 0 3.8.6 5.3 1.6" fill="#1a1a1a" />
              {/* Right person */}
              <circle cx="44" cy="20" r="5" fill="#1a1a1a" />
              <path d="M54 46v-6c0-5.523-4.477-10-10-10-2 0-3.8.6-5.3 1.6" fill="#1a1a1a" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Collaborate</span>
          </div>
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="px-8 pb-10 space-y-4">
        {/* Sign In - Black background with WHITE text */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-lg font-semibold text-lg transition-all duration-200
            bg-[#1a1a1a] text-white active:scale-[0.98]"
        >
          Sign In
        </button>

        {/* Create Account - White/cream with black border */}
        <button
          onClick={() => setScreen('signup')}
          className="w-full h-14 rounded-lg font-semibold text-lg transition-all duration-200
            border border-[#1a1a1a] text-[#1a1a1a] bg-[#F5F3EE] active:scale-[0.98]"
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
