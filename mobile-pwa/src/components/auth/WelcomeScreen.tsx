import { useAuthStore } from '@/stores/authStore';

export function WelcomeScreen() {
  const { setScreen } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Logo Icon - Gold checkmark with ring (gold top to black bottom) */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-5"
        >
          <defs>
            {/* Gold gradient for checkmark - flows along the tick */}
            <linearGradient id="checkGold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C9A962" />
              <stop offset="50%" stopColor="#D4B86A" />
              <stop offset="100%" stopColor="#A8893D" />
            </linearGradient>
            {/* Ring gradient - gold at top, black at bottom, slightly angled */}
            <linearGradient id="ringGradient" x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor="#D4B86A" />
              <stop offset="25%" stopColor="#C9A962" />
              <stop offset="50%" stopColor="#6B5A28" />
              <stop offset="75%" stopColor="#3a3a3a" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </linearGradient>
          </defs>

          {/* Circle ring - gold at top fading to black at bottom */}
          <circle
            cx="50"
            cy="50"
            r="30"
            stroke="url(#ringGradient)"
            strokeWidth="2.5"
            fill="none"
          />

          {/* Gold checkmark - classic tick shape, tapered from thick to thin */}
          <path
            d="M 24 46
               L 38 64
               C 40 68, 42 68, 44 66
               L 76 28
               L 74 30
               L 44 62
               C 42 64, 40 64, 38 60
               L 28 48
               Z"
            fill="url(#checkGold)"
          />
        </svg>

        {/* CHECKS HAPPY text */}
        <h1 className="text-[28px] font-serif font-normal tracking-normal text-[#1a1a1a]">
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

        {/* Tagline */}
        <p className="text-lg font-serif text-[#4a4a4a] mb-10">
          Streamline Hair & Makeup Continuity
        </p>

        {/* Feature icons - BLACK, SOLID, BOLD */}
        <div className="flex items-center justify-center w-full max-w-md mb-12">
          {/* Capture - Camera icon - OUTLINED */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Camera body - outlined/stroked */}
              <path
                d="M6 18C6 15.79 7.79 14 10 14H15L19 8H37L41 14H46C48.21 14 50 15.79 50 18V42C50 44.21 48.21 46 46 46H10C7.79 46 6 44.21 6 42V18Z"
                stroke="#1a1a1a"
                strokeWidth="3"
                fill="none"
              />
              {/* Camera lens - outer circle */}
              <circle cx="28" cy="30" r="10" stroke="#1a1a1a" strokeWidth="3" fill="none" />
              {/* Camera lens inner - small filled dot */}
              <circle cx="28" cy="30" r="4" fill="#1a1a1a" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Capture</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Track - Sync arrows icon - smooth curved arrows */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Top curved arrow (clockwise from top-left to top-right) */}
              <path
                d="M16 12 A20 20 0 0 1 46 20"
                stroke="#1a1a1a"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow head at top-right - pointing right/down */}
              <path
                d="M44 12 L46 20 L38 20"
                stroke="#1a1a1a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Bottom curved arrow (counter-clockwise from bottom-right to bottom-left) */}
              <path
                d="M40 44 A20 20 0 0 1 10 36"
                stroke="#1a1a1a"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow head at bottom-left - pointing left/up */}
              <path
                d="M12 44 L10 36 L18 36"
                stroke="#1a1a1a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Track</span>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-24 bg-[#c5c0b5]" />

          {/* Collaborate - People icon - Already solid */}
          <div className="flex flex-col items-center flex-1">
            <svg className="w-14 h-14 mb-3" viewBox="0 0 56 56" fill="none">
              {/* Center person (larger) */}
              <circle cx="28" cy="14" r="8" fill="#1a1a1a" />
              <path d="M14 48v-10c0-7.732 6.268-14 14-14s14 6.268 14 14v10" fill="#1a1a1a" />
              {/* Left person */}
              <circle cx="10" cy="20" r="6" fill="#1a1a1a" />
              <path d="M0 48v-8c0-5.523 4.477-10 10-10 2.5 0 4.8.9 6.5 2.4" fill="#1a1a1a" />
              {/* Right person */}
              <circle cx="46" cy="20" r="6" fill="#1a1a1a" />
              <path d="M56 48v-8c0-5.523-4.477-10-10-10-2.5 0-4.8.9-6.5 2.4" fill="#1a1a1a" />
            </svg>
            <span className="text-base font-serif text-[#1a1a1a]">Collaborate</span>
          </div>
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="px-8 pb-10 space-y-4">
        {/* Sign In - Black background with white text */}
        <button
          onClick={() => setScreen('signin')}
          className="w-full h-14 rounded-lg font-semibold text-lg transition-all duration-200
            bg-[#1a1a1a] text-white active:scale-[0.98]"
        >
          Sign In
        </button>

        {/* Create Account - Cream with black border */}
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
